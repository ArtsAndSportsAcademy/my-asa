import { logger } from "./logger.js";

const log = logger.child({ domain: "bootstrap" });

/**
 * O antigo reset de produção (RESET_PROD_DB=1) zerava TODAS as tabelas e criava um "Administrador"
 * genérico. Foi desligado no D2 do plano de lançamento: nada mais apaga o banco ao subir a API.
 * A primeira conta de Administração agora nasce com `pnpm --filter @workspace/api-server run
 * criar-primeira-administracao` (scripts/criar-primeira-administracao.ts), que não apaga nada e só
 * roda se a organização ainda não tiver Administração.
 */
export async function runProdBootstrap(): Promise<void> {
  if (process.env.RESET_PROD_DB === "1") {
    log.error("RESET_PROD_DB está definido, mas o reset foi desativado e nada foi apagado. Remova a variável; para criar a primeira Administração use o comando criar-primeira-administracao.");
  }
}
