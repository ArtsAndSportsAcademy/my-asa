/**
 * Aplica as migrações que faltam num banco, com duas fases e freios. Feito para rodar em PRODUÇÃO por quem constrói o app.
 *
 *   --ensaiar   (padrão) só LÊ: diz em que banco está conectado e quais migrações faltam. Não muda nada.
 *   --aplicar   aplica, mas SÓ se o que falta for exatamente o que você pediu com --so=<nome da migração>.
 *
 * Por que existe: o comando `migrate` aplica tudo o que faltar, sem perguntar, e a produção usa a porta 6543 (modo
 * transação, boa para a API) enquanto migração precisa da 5432 (modo sessão). Este script troca a porta sozinho,
 * mostra o que vai fazer e recusa se faltar algo além do esperado.
 *
 * Nunca imprime a URL, o usuário nem a senha: só o servidor, a porta e o nome do banco.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { applyMigrations } from "../src/migration-runner.js";
import { normalizeDatabaseUrl } from "../src/database-url.js";

const { Pool } = pg;
const aqui = path.dirname(fileURLToPath(import.meta.url));
const argumentos = process.argv.slice(2);
const aplicar = argumentos.includes("--aplicar");
const soAlvo = argumentos.find((a) => a.startsWith("--so="))?.slice(5) ?? null;

type EntradaDoDiario = { idx: number; when: number; tag: string };

function conexaoNaPorta5432(urlBruta: string) {
  const url = new URL(normalizeDatabaseUrl(urlBruta));
  const portaOriginal = url.port || "5432";
  // Modo transação (6543) não serve para migração; o modo sessão do mesmo servidor é a 5432.
  if (portaOriginal === "6543") url.port = "5432";
  return { url: url.toString(), portaOriginal, porta: url.port || "5432", servidor: url.hostname, banco: url.pathname.replace(/^\//, "") };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não está definida. Rode com --env-file apontando para o arquivo do banco que você quer migrar.");
  if (aplicar && !soAlvo) throw new Error('Com --aplicar é obrigatório dizer qual migração se espera, por exemplo: --aplicar --so=0075_tentativas_de_acesso');

  const conexao = conexaoNaPorta5432(process.env.DATABASE_URL);
  console.log(`Banco: ${conexao.servidor} · porta ${conexao.porta}${conexao.portaOriginal !== conexao.porta ? ` (o arquivo dizia ${conexao.portaOriginal}; troquei para ${conexao.porta}, que é a da migração)` : ""} · base "${conexao.banco}"`);
  console.log(aplicar ? "Modo: APLICAR (vai mudar o banco)." : "Modo: ENSAIAR (só leitura, não muda nada).");

  const diario = JSON.parse(fs.readFileSync(path.resolve(aqui, "../drizzle/meta/_journal.json"), "utf8")) as { entries: EntradaDoDiario[] };
  const pool = new Pool({ connectionString: conexao.url, connectionTimeoutMillis: 20000 });
  try {
    // O migrador do Drizzle guarda o instante da última migração aplicada; falta tudo o que for mais novo que ele.
    const existe = (await pool.query<{ ok: boolean }>(`select to_regclass('drizzle.__drizzle_migrations') is not null as ok`)).rows[0]!.ok;
    if (!existe) throw new Error("Este banco não tem o registro de migrações do Drizzle (drizzle.__drizzle_migrations). Não é o banco esperado: parei sem tocar em nada.");
    const ultimo = Number((await pool.query<{ ultimo: string | null }>(`select max(created_at)::text as ultimo from drizzle.__drizzle_migrations`)).rows[0]!.ultimo ?? 0);
    const aplicadas = diario.entries.filter((e) => e.when <= ultimo).length;
    const faltam = diario.entries.filter((e) => e.when > ultimo).map((e) => e.tag);
    console.log(`Migrações já aplicadas: ${aplicadas} de ${diario.entries.length}.`);
    console.log(faltam.length ? `Faltam: ${faltam.join(", ")}` : "Faltam: nenhuma. O banco já está em dia.");

    if (!aplicar) {
      console.log(faltam.length ? "\nEnsaio terminado. Nada foi alterado. Para aplicar, rode de novo com: --aplicar --so=" + faltam.join(",") : "\nEnsaio terminado. Nada a fazer.");
      return;
    }
    if (faltam.join(",") !== soAlvo) {
      throw new Error(`Parei sem aplicar nada: você esperava só "${soAlvo}", mas o que falta é "${faltam.join(", ") || "nada"}". Confira antes de continuar.`);
    }
    console.log(`\nAplicando ${soAlvo} ...`);
    await applyMigrations(pool as unknown as Parameters<typeof applyMigrations>[0]);
    const depois = (await pool.query<{ rls: boolean }>(`select relrowsecurity as rls from pg_class where oid = to_regclass('public.tentativas_de_acesso')`)).rows[0];
    console.log(depois ? `Pronto. A tabela tentativas_de_acesso existe${depois.rls ? " e está protegida (RLS ligado)" : " MAS SEM RLS: avise"}.` : "Migração aplicada, mas não achei a tabela esperada: avise antes de continuar.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\nParei:", err instanceof Error ? err.message : err);
  process.exit(1);
});
