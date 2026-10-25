/**
 * Só LÊ. Mostra, para os shows com o nome pedido, cada momento (quadro-chave) com quantos círculos têm posição guardada hoje e, no Registro,
 * quantos tinham antes de cada mudança de coordenadas. Serve para achar a formação de antes de uma perda de posições (o Registro guarda o
 * estado anterior de cada momento). Grava, na pasta pedida, um arquivo por estado antigo, para depois restaurar com calma.
 *
 *   node --env-file=../../.env.producao ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/ler-posicoes-do-momento.ts --show=Montanha
 *
 * Nunca imprime a URL, o usuário nem a senha. A conexão é aberta em modo só leitura.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/database-url.js";

const argumentos = process.argv.slice(2);
const nomeDoShow = argumentos.find((a) => a.startsWith("--show="))?.slice(7) ?? "Montanha";
const pastaDeSaida = argumentos.find((a) => a.startsWith("--pasta="))?.slice(8) ?? path.join(process.env.USERPROFILE ?? ".", "Backups-MyASA", "posicoes-dos-momentos");

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não está definida. Rode com --env-file apontando para o banco de produção.");
  const url = new URL(normalizeDatabaseUrl(process.env.DATABASE_URL));
  console.log(`Conectado em ${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//, "")} (só leitura).`);
  const pool = new pg.Pool({ connectionString: url.toString(), max: 1, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const shows = (await client.query("select id, title from show_books where title ilike $1 order by title", [`%${nomeDoShow}%`])).rows as { id: string; title: string }[];
    if (!shows.length) { console.log(`Nenhum show com "${nomeDoShow}" no nome.`); return; }
    fs.mkdirSync(pastaDeSaida, { recursive: true });
    for (const show of shows) {
      console.log(`\n=== ${show.title} ===`);
      const momentos = (await client.query(
        `select k.id, k.name, k."order" as ordem, sc.name as cena, k.marker_positions as posicoes
           from show_book_keyframes k join show_book_scenes sc on sc.id = k.scene_id
          where sc.show_book_id = $1 and k.active order by sc."order", k."order"`, [show.id])).rows as { id: string; name: string; ordem: number; cena: string; posicoes: Record<string, unknown> | null }[];
      for (const m of momentos) {
        console.log(`\nCena "${m.cena}", momento ${m.ordem + 1} "${m.name}": hoje ${Object.keys(m.posicoes ?? {}).length} círculos com posição guardada.`);
        const eventos = (await client.query(
          `select occurred_at, action, before_state, after_state from history_events
            where entity_type = 'show_book_keyframe' and entity_id = $1 order by occurred_at asc`, [m.id])).rows as { occurred_at: Date; action: string; before_state: { markerPositions?: Record<string, unknown> } | null; after_state: { markerPositions?: Record<string, unknown> } | null }[];
        if (!eventos.length) { console.log("   Sem mudanças no Registro."); continue; }
        let n = 0;
        for (const e of eventos) {
          const antes = Object.keys(e.before_state?.markerPositions ?? {}).length, depois = Object.keys(e.after_state?.markerPositions ?? {}).length;
          n += 1;
          console.log(`   ${n}. ${new Date(e.occurred_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${e.action} · antes ${antes} círculos, depois ${depois}${depois < antes ? "  <-- PERDEU POSIÇÕES" : ""}`);
          if (e.before_state?.markerPositions && antes > depois) {
            const arquivo = path.join(pastaDeSaida, `${show.title.replace(/[^a-z0-9]+/gi, "-")}_${m.cena.replace(/[^a-z0-9]+/gi, "-")}_momento${m.ordem + 1}_antes-da-mudanca-${n}.json`);
            fs.writeFileSync(arquivo, JSON.stringify({ momentoId: m.id, posicoes: e.before_state.markerPositions }, null, 2), "utf8");
            console.log(`      guardei o estado de antes em: ${arquivo}`);
          }
        }
      }
    }
    console.log("\nPronto. Nada foi alterado no banco.");
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((erro) => { console.error("Erro:", erro instanceof Error ? erro.message : String(erro)); process.exit(1); });
