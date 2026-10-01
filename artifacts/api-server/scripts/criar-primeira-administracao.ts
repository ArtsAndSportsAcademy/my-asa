/**
 * D2 — cria a primeira conta de Administração num banco novo, sem apagar nada.
 *
 * Uso (com DATABASE_URL do banco alvo no ambiente):
 *   pnpm --filter @workspace/api-server run criar-primeira-administracao -- \
 *     --organizacao "Arts and Sports Academy" --operacao "Snowland" --nome "Nome Completo" [--nome-de-uso "Nome"] [--email x@y]
 *
 * Mostra o usuário e a senha provisória uma única vez. Se a organização já tiver Administração, não faz nada.
 */
import { pool } from "@workspace/db";
import { criarPrimeiraAdministracao, JaTemAdministracao } from "../src/services/primeira-administracao.js";

function arg(nome: string) {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const organizacao = arg("organizacao"), operacao = arg("operacao"), nome = arg("nome");
if (!organizacao || !operacao || !nome) {
  console.error('Faltou argumento. Use: --organizacao "…" --operacao "…" --nome "Nome Completo" [--nome-de-uso "…"] [--email …]');
  process.exit(2);
}

try {
  const r = await criarPrimeiraAdministracao({ organizacao, operacao, nomeCompleto: nome, nomeDeUso: arg("nome-de-uso"), email: arg("email") });
  console.log("Primeira Administração criada. Anote agora — a senha não aparece de novo:");
  console.log(`  usuário: ${r.username}`);
  console.log(`  senha provisória: ${r.senhaProvisoria}`);
  console.log("No primeiro login, o app pede para trocar a senha.");
} catch (error) {
  if (error instanceof JaTemAdministracao) { console.error(error.message); process.exitCode = 1; }
  else { console.error("Não consegui criar:", (error as Error).message); process.exitCode = 1; }
} finally {
  await pool.end();
}
