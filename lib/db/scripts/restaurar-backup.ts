/**
 * Restaura uma cópia feita por backup-producao.ts. Pensado para o pior dia: por isso é conservador.
 *
 *   --pasta=<pasta da cópia>   obrigatório (a que tem o manifesto.json)
 *   --ensaiar   (padrão) só confere a cópia: o manifesto, a impressão digital (sha256) de cada arquivo e o número de linhas. Não precisa de banco.
 *   --aplicar --para-schema=<nome>   carrega a cópia no banco, numa ÁREA SEPARADA com esse nome (por exemplo restauracao_20261023).
 *                                    A área é criada nova: se já existir, o script para. NUNCA escreve por cima das tabelas do app.
 *                                    Dali você traz de volta só o que precisa (veja docs/backup-e-restauracao.md).
 *   --aplicar --para-schema=public   desastre total: carrega nas tabelas do app, num banco NOVO que já passou pelas migrações. Só carrega se
 *                                    TODAS as tabelas do app estiverem vazias; senão para sem mexer em nada.
 *
 * Sempre confere no fim que cada tabela tem o mesmo número de linhas que o manifesto. Nunca imprime a URL nem a senha do banco.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/database-url.js";

const { Client } = pg;
const argumentos = process.argv.slice(2);
const valorDe = (nome: string) => argumentos.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3) ?? null;
const aplicar = argumentos.includes("--aplicar");
const LOTE = 500;
const aspas = (nome: string) => `"${nome.replace(/"/g, '""')}"`;

type EntradaDoManifesto = { esquema: string; nome: string; linhas: number; arquivo: string; sha256: string; bytes: number };
type Manifesto = { versao: number; criadoEm: string; servidor: string; base: string; migracoesAplicadas: number; incluiuSessoes: boolean; deixadasDeFora: string[]; tabelas: EntradaDoManifesto[] };

async function sha256DoArquivo(arquivo: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  await new Promise<void>((resolve, reject) => fs.createReadStream(arquivo).on("data", (d) => hash.update(d)).on("end", () => resolve()).on("error", reject));
  return hash.digest("hex");
}

async function conferirACopia(pasta: string): Promise<Manifesto> {
  const arquivoManifesto = path.join(pasta, "manifesto.json");
  if (!fs.existsSync(arquivoManifesto)) throw new Error(`Não achei manifesto.json em ${pasta}. Uma cópia sem manifesto está incompleta (o backup parou no meio): não use.`);
  const manifesto = JSON.parse(fs.readFileSync(arquivoManifesto, "utf8")) as Manifesto;
  console.log(`Cópia de ${manifesto.criadoEm} (banco "${manifesto.base}" em ${manifesto.servidor}), ${manifesto.migracoesAplicadas} migrações, ${manifesto.tabelas.length} tabelas.`);
  let defeitos = 0;
  for (const t of manifesto.tabelas) {
    const caminho = path.join(pasta, t.arquivo);
    if (!fs.existsSync(caminho)) { console.log(`  FALTA o arquivo ${t.arquivo}`); defeitos++; continue; }
    const hash = await sha256DoArquivo(caminho);
    if (hash !== t.sha256) { console.log(`  ESTRAGADO ${t.arquivo}: a impressão digital não bate`); defeitos++; continue; }
    let linhas = 0;
    const leitor = readline.createInterface({ input: fs.createReadStream(caminho).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    for await (const l of leitor) if (l.trim()) linhas++;
    if (linhas !== t.linhas) { console.log(`  LINHAS ${t.arquivo}: o manifesto diz ${t.linhas} e o arquivo tem ${linhas}`); defeitos++; continue; }
  }
  if (defeitos) throw new Error(`${defeitos} arquivo(s) com problema: esta cópia NÃO é confiável. Use uma cópia anterior.`);
  console.log(`Cópia conferida: ${manifesto.tabelas.length} arquivos íntegros, ${manifesto.tabelas.reduce((s, t) => s + t.linhas, 0)} linhas.`);
  return manifesto;
}

async function main() {
  const pasta = valorDe("pasta");
  if (!pasta) throw new Error("Diga qual cópia: --pasta=<pasta que tem o manifesto.json>");
  const manifesto = await conferirACopia(path.resolve(pasta));
  if (!aplicar) { console.log("\nEnsaio terminado. Nada foi carregado em banco nenhum. Para restaurar, use --aplicar --para-schema=<nome>."); return; }

  const destino = valorDe("para-schema");
  if (!destino || !/^[a-z_][a-z0-9_]*$/.test(destino)) throw new Error("Com --aplicar, diga a área de destino com --para-schema=<nome> (só letras minúsculas, números e _; ou public para um desastre total).");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não está definida. Rode com --env-file apontando para o banco onde carregar.");
  const url = new URL(normalizeDatabaseUrl(process.env.DATABASE_URL));
  if ((url.port || "5432") === "6543") url.port = "5432";
  console.log(`\nBanco de destino: ${url.hostname} · porta ${url.port || "5432"} · base "${url.pathname.replace(/^\//, "")}" · área "${destino}"`);

  const cliente = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 20000 });
  await cliente.connect();
  // O registro de migrações do Drizzle é do banco de destino (já tem as migrações dele): não é carregado.
  const tabelas = manifesto.tabelas.filter((t) => t.esquema === "public");
  try {
    await cliente.query("begin");
    if (destino === "public") {
      for (const t of tabelas) {
        const existe = (await cliente.query<{ ok: boolean }>(`select to_regclass($1) is not null as ok`, [`public.${t.nome}`])).rows[0]!.ok;
        if (!existe) throw new Error(`O banco de destino não tem a tabela public.${t.nome}. Rode as migrações nele antes (scripts/migrar-producao.ts).`);
        const n = Number((await cliente.query<{ n: string }>(`select count(*)::text as n from public.${aspas(t.nome)}`)).rows[0]!.n);
        if (n > 0) throw new Error(`public.${t.nome} já tem ${n} linhas. Para um desastre total o banco de destino tem que estar VAZIO. Parei sem mexer em nada.`);
      }
      // Os dados já são consistentes entre si; carregar sem conferir a ordem das chaves estrangeiras evita ter de ordenar as tabelas.
      await cliente.query("set local session_replication_role = replica").catch(() => { throw new Error("Este usuário do banco não pode carregar sem checar chaves estrangeiras (session_replication_role). Use o usuário postgres do projeto."); });
    } else {
      const jaExiste = (await cliente.query<{ ok: boolean }>(`select exists(select 1 from pg_namespace where nspname = $1) as ok`, [destino])).rows[0]!.ok;
      if (jaExiste) throw new Error(`A área "${destino}" já existe. Escolha outro nome (por exemplo restauracao_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}) ou apague a área antiga.`);
      await cliente.query(`create schema ${aspas(destino)}`);
      await cliente.query(`revoke all on schema ${aspas(destino)} from public, anon, authenticated`).catch(() => undefined);
      for (const t of tabelas) await cliente.query(`create table ${aspas(destino)}.${aspas(t.nome)} (like public.${aspas(t.nome)} including defaults)`);
    }

    let total = 0;
    for (const t of tabelas) {
      const alvo = `${aspas(destino)}.${aspas(t.nome)}`;
      const leitor = readline.createInterface({ input: fs.createReadStream(path.join(path.resolve(pasta), t.arquivo)).pipe(zlib.createGunzip()), crlfDelay: Infinity });
      let lote: string[] = [];
      let carregadas = 0;
      const descarregar = async () => {
        if (!lote.length) return;
        // A tabela de destino diz o tipo de cada coluna: jsonb_populate_recordset converte o JSON de volta (datas, uuid, listas, bytea).
        await cliente.query(`insert into ${alvo} select * from jsonb_populate_recordset(null::${alvo}, $1::jsonb)`, [`[${lote.join(",")}]`]);
        carregadas += lote.length;
        lote = [];
      };
      for await (const linha of leitor) {
        if (!linha.trim()) continue;
        lote.push(linha);
        if (lote.length >= LOTE) await descarregar();
      }
      await descarregar();
      if (carregadas !== t.linhas) throw new Error(`${t.nome}: carreguei ${carregadas} e o manifesto diz ${t.linhas}.`);
      total += carregadas;
      process.stdout.write(`  ${t.nome}: ${carregadas} linhas\n`);
    }
    // Conferência final no banco, tabela por tabela.
    for (const t of tabelas) {
      const n = Number((await cliente.query<{ n: string }>(`select count(*)::text as n from ${aspas(destino)}.${aspas(t.nome)}`)).rows[0]!.n);
      if (n !== t.linhas) throw new Error(`${t.nome}: o banco tem ${n} linhas e o manifesto diz ${t.linhas}. Desfiz tudo.`);
    }
    await cliente.query("commit");
    console.log(`\nPronto. ${tabelas.length} tabelas e ${total} linhas carregadas em "${destino}", todas conferidas com o manifesto.`);
    if (destino !== "public") console.log(`Nada do app foi alterado. Para trazer de volta só o que precisa, veja docs/backup-e-restauracao.md. Quando terminar, apague a área com: drop schema ${destino} cascade;`);
    else console.log("Faltam as tabelas que ficam fora da cópia por padrão (sessões e tentativas de senha): todo mundo apenas entra de novo.");
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
