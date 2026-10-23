/**
 * Backup do banco para o seu computador (feito para quem não tem backup automático no Supabase).
 *
 * O que faz: lê TODAS as tabelas do banco (as do app, em `public`, e o registro de migrações do Drizzle) e grava uma cópia compactada
 * numa pasta FORA do repositório. Só LÊ: roda numa transação somente-leitura e num retrato único do banco (todas as tabelas
 * da mesma hora). Não muda nada no banco.
 *
 * Como rodar (na pasta lib/db), com o arquivo do banco que você quer copiar:
 *   node --env-file=../../.env.producao ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/backup-producao.ts
 *
 * Opções:
 *   --saida=<pasta>        onde guardar (padrão: Backups-MyASA, dentro da sua pasta de usuário)
 *   --incluir-sessoes      inclui refresh_tokens, sessions e tentativas_de_acesso (por padrão ficam FORA: são só logins abertos
 *                          e contagem de senha errada; sem eles todo mundo apenas entra de novo depois de uma restauração)
 *
 * ATENÇÃO: a cópia tem dados de pessoas (nomes, mensagens, escala) e os códigos das senhas (já embaralhados). Guarde num lugar protegido,
 * nunca no repositório nem numa pasta compartilhada. O script recusa gravar dentro do repositório.
 *
 * Nunca imprime a URL, o usuário nem a senha do banco: só o servidor, a porta e o nome da base.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/database-url.js";

const { Client } = pg;
const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizDoRepositorio = path.resolve(aqui, "../../..");
const argumentos = process.argv.slice(2);
const valorDe = (nome: string) => argumentos.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3) ?? null;
const incluirSessoes = argumentos.includes("--incluir-sessoes");

const FORA_POR_PADRAO = new Set(["refresh_tokens", "sessions", "tentativas_de_acesso"]);
const LOTE = 500;

type Tabela = { esquema: string; nome: string };
type EntradaDoManifesto = { esquema: string; nome: string; linhas: number; arquivo: string; sha256: string; bytes: number };

function conexao(urlBruta: string) {
  const url = new URL(normalizeDatabaseUrl(urlBruta));
  const portaOriginal = url.port || "5432";
  // O modo transação (6543) não segura um retrato único entre vários comandos; o modo sessão do mesmo servidor é a 5432.
  if (portaOriginal === "6543") url.port = "5432";
  return { url: url.toString(), portaOriginal, porta: url.port || "5432", servidor: url.hostname, banco: url.pathname.replace(/^\//, "") };
}

const aspas = (nome: string) => `"${nome.replace(/"/g, '""')}"`;

async function sha256DoArquivo(arquivo: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  await new Promise<void>((resolve, reject) => fs.createReadStream(arquivo).on("data", (d) => hash.update(d)).on("end", () => resolve()).on("error", reject));
  return hash.digest("hex");
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não está definida. Rode com --env-file apontando para o arquivo do banco que você quer copiar.");
  const base = path.resolve(valorDe("saida") ?? path.join(os.homedir(), "Backups-MyASA"));
  const dentroDoRepositorio = path.relative(raizDoRepositorio, base);
  if (!dentroDoRepositorio.startsWith("..") && !path.isAbsolute(dentroDoRepositorio)) {
    throw new Error(`Recusei gravar dentro do repositório (${base}). A cópia tem dados de pessoas: escolha uma pasta fora dele com --saida=<pasta>.`);
  }

  const c = conexao(process.env.DATABASE_URL);
  console.log(`Banco: ${c.servidor} · porta ${c.porta}${c.portaOriginal !== c.porta ? ` (o arquivo dizia ${c.portaOriginal}; troquei para ${c.porta})` : ""} · base "${c.banco}"`);
  console.log("Modo: só leitura. Nada será alterado no banco.");

  const agora = new Date();
  const carimbo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}_${String(agora.getHours()).padStart(2, "0")}${String(agora.getMinutes()).padStart(2, "0")}`;
  const pasta = path.join(base, carimbo);
  if (fs.existsSync(pasta)) throw new Error(`A pasta ${pasta} já existe. Espere um minuto e rode de novo (cada cópia tem a hora no nome).`);
  fs.mkdirSync(pasta, { recursive: true });

  const cliente = new Client({ connectionString: c.url, connectionTimeoutMillis: 20000 });
  await cliente.connect();
  const manifesto: EntradaDoManifesto[] = [];
  const deixadasDeFora: string[] = [];
  try {
    // Um retrato único e somente-leitura: todas as tabelas refletem o mesmo instante.
    await cliente.query("begin isolation level repeatable read read only");
    const listadas = (await cliente.query<Tabela & { esquema: string }>(`
      select n.nspname as esquema, c.relname as nome
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p')
        and ((n.nspname = 'public') or (n.nspname = 'drizzle' and c.relname = '__drizzle_migrations'))
      order by n.nspname, c.relname`)).rows;
    const migracoes = Number((await cliente.query<{ n: string }>(`select count(*)::text as n from drizzle.__drizzle_migrations`).catch(() => ({ rows: [{ n: "0" }] }))).rows[0]!.n);

    let totalLinhas = 0;
    for (const t of listadas) {
      if (!incluirSessoes && t.esquema === "public" && FORA_POR_PADRAO.has(t.nome)) { deixadasDeFora.push(t.nome); continue; }
      const arquivo = `${t.esquema}.${t.nome}.ndjson.gz`;
      const caminho = path.join(pasta, arquivo);
      const gz = zlib.createGzip({ level: 6 });
      const saida = fs.createWriteStream(caminho);
      gz.pipe(saida);
      let linhas = 0;
      // `to_jsonb(t)::text` devolve o texto do JSON já pronto: o driver não reinterpreta números grandes nem datas.
      await cliente.query(`declare cur no scroll cursor for select to_jsonb(t)::text as j from ${aspas(t.esquema)}.${aspas(t.nome)} t`);
      for (;;) {
        const lote = (await cliente.query<{ j: string }>(`fetch forward ${LOTE} from cur`)).rows;
        if (!lote.length) break;
        const pedaco = lote.map((r) => r.j).join("\n") + "\n";
        linhas += lote.length;
        if (!gz.write(pedaco)) await once(gz, "drain");
      }
      await cliente.query("close cur");
      gz.end();
      await once(saida, "finish");
      // Conferência: a contagem do banco, no mesmo retrato, tem que bater com as linhas gravadas.
      const noBanco = Number((await cliente.query<{ n: string }>(`select count(*)::text as n from ${aspas(t.esquema)}.${aspas(t.nome)}`)).rows[0]!.n);
      if (noBanco !== linhas) throw new Error(`A tabela ${t.esquema}.${t.nome} tem ${noBanco} linhas no banco e gravei ${linhas}. Parei: não confie nesta cópia.`);
      manifesto.push({ esquema: t.esquema, nome: t.nome, linhas, arquivo, sha256: await sha256DoArquivo(caminho), bytes: fs.statSync(caminho).size });
      totalLinhas += linhas;
      process.stdout.write(`  ${t.esquema}.${t.nome}: ${linhas} linhas\n`);
    }
    await cliente.query("commit");

    const doManifesto = { versao: 1, criadoEm: agora.toISOString(), servidor: c.servidor, base: c.banco, migracoesAplicadas: migracoes, incluiuSessoes: incluirSessoes, deixadasDeFora, tabelas: manifesto };
    fs.writeFileSync(path.join(pasta, "manifesto.json"), JSON.stringify(doManifesto, null, 2));
    const bytes = manifesto.reduce((s, t) => s + t.bytes, 0);
    console.log(`\nPronto. ${manifesto.length} tabelas, ${totalLinhas} linhas, ${(bytes / 1024 / 1024).toFixed(1)} MB compactados.`);
    console.log(`Cópia guardada em: ${pasta}`);
    if (deixadasDeFora.length) console.log(`Ficaram de fora (de propósito): ${deixadasDeFora.join(", ")}.`);
    console.log("\nGuarde esta pasta num lugar protegido: ela tem dados de pessoas. Nunca no repositório nem numa pasta compartilhada.");
  } catch (err) {
    await cliente.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    await cliente.end();
  }
}

main().catch((err) => {
  console.error("\nParei:", err instanceof Error ? err.message : err);
  process.exit(1);
});
