/**
 * Devolve a um momento (quadro-chave) as posições dos círculos guardadas num arquivo feito por ler-posicoes-do-momento.ts.
 * Nada de apagar: as posições que o momento tem hoje e o arquivo NÃO traz continuam; as que o arquivo traz entram por cima.
 *
 *   --arquivo=<caminho do .json>   obrigatório
 *   --aplicar                      sem isto é só o ENSAIO: mostra o que mudaria e não grava nada
 *
 * Ao aplicar, grava as posições e um evento no Registro (com o estado de antes e o de depois), na mesma transação.
 * Nunca imprime a URL, o usuário nem a senha.
 */
import fs from "node:fs";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/database-url.js";

const argumentos = process.argv.slice(2);
const arquivo = argumentos.find((a) => a.startsWith("--arquivo="))?.slice(10);
const aplicar = argumentos.includes("--aplicar");

type Posicoes = Record<string, { x: number; y: number }>;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não está definida. Rode com --env-file apontando para o banco de produção.");
  if (!arquivo) throw new Error("Diga o arquivo: --arquivo=C:\\caminho\\do\\arquivo.json");
  const lido = JSON.parse(fs.readFileSync(arquivo, "utf8")) as { momentoId?: string; posicoes?: Posicoes };
  if (!lido.momentoId || !lido.posicoes || !Object.keys(lido.posicoes).length) throw new Error("O arquivo não tem momentoId e posições.");
  for (const [rotulo, p] of Object.entries(lido.posicoes)) {
    if (!(p && typeof p.x === "number" && typeof p.y === "number" && p.x >= 4 && p.x <= 96 && p.y >= 4 && p.y <= 96)) throw new Error(`Posição inválida em ${rotulo}: precisa estar entre 4% e 96%.`);
  }
  const url = new URL(normalizeDatabaseUrl(process.env.DATABASE_URL));
  console.log(`Conectado em ${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//, "")}${aplicar ? " (VAI GRAVAR)" : " (ensaio: só leitura)"}.`);
  const pool = new pg.Pool({ connectionString: url.toString(), max: 1, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query(aplicar ? "BEGIN" : "BEGIN READ ONLY");
    const achou = (await client.query(
      `select k.id, k.name, k."order" as ordem, k.marker_positions as posicoes, sc.name as cena, sb.id as show_id, sb.title as show, sb.operation_id, o.organization_id
         from show_book_keyframes k join show_book_scenes sc on sc.id = k.scene_id join show_books sb on sb.id = sc.show_book_id join operations o on o.id = sb.operation_id
        where k.id = $1 and k.active`, [lido.momentoId])).rows[0] as { id: string; name: string; ordem: number; posicoes: Posicoes | null; cena: string; show_id: string; show: string; operation_id: string; organization_id: string } | undefined;
    if (!achou) throw new Error("Esse momento não existe mais (ou foi removido).");
    const atual = achou.posicoes ?? {};
    const resultado: Posicoes = { ...atual, ...lido.posicoes };
    console.log(`\n${achou.show} · cena "${achou.cena}" · momento ${achou.ordem + 1} "${achou.name}"`);
    console.log(`Hoje: ${Object.keys(atual).length} círculos com posição (${Object.keys(atual).join(", ") || "nenhum"}).`);
    console.log(`Arquivo: ${Object.keys(lido.posicoes).length} círculos (${Object.keys(lido.posicoes).join(", ")}).`);
    console.log(`Depois: ${Object.keys(resultado).length} círculos (${Object.keys(resultado).join(", ")}).`);
    const trocados = Object.keys(lido.posicoes).filter((r) => atual[r] && (atual[r]!.x !== lido.posicoes![r]!.x || atual[r]!.y !== lido.posicoes![r]!.y));
    if (trocados.length) console.log(`Atenção: hoje já havia outra posição para ${trocados.join(", ")}; o arquivo vai por cima.`);
    if (!aplicar) { console.log("\nEnsaio: nada foi gravado. Para gravar, rode de novo com --aplicar."); return; }
    await client.query(`update show_book_keyframes set marker_positions = $2::jsonb, updated_at = now() where id = $1`, [achou.id, JSON.stringify(resultado)]);
    await client.query(
      `insert into history_events (org_id, category, title, narrative, entity_type, entity_id, actor_type, actor_name, operation_id, action, before_state, after_state, metadata)
       values ($1, 'OPERATIONAL_CHANGE', 'Posições do momento restauradas', $2, 'show_book_keyframe', $3, 'HUMAN', 'Restauração manual', $4, 'show_book.keyframe_positions_restored', $5::jsonb, $6::jsonb, $7::jsonb)`,
      [achou.organization_id, `Show ${achou.show}, momento ${achou.name}: posições dos círculos restauradas a partir do Registro (${Object.keys(lido.posicoes).length} círculos), depois que um arraste substituiu o mapa inteiro.`,
        achou.id, achou.operation_id, JSON.stringify({ markerPositions: atual }), JSON.stringify({ markerPositions: resultado }), JSON.stringify({ showBookId: achou.show_id, reason: "Posições perdidas por um arraste que substituía o mapa inteiro" })]);
    await client.query("COMMIT");
    console.log("\nPronto. Posições restauradas e registradas no Registro.");
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((erro) => { console.error("Erro:", erro instanceof Error ? erro.message : String(erro)); process.exit(1); });
