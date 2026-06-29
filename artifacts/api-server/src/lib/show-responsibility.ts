import { eq, and, isNull, lte, gte, or } from "drizzle-orm";
import { db, delegationsTable, userRolesTable } from "@workspace/db";
import type { DelegatedResponsibility } from "@workspace/db/schema";

// Papéis que, na ausência de um responsável definido por show, mantêm o
// comportamento legado (qualquer gestor da operação pode operar).
const MANAGER_ROLES = new Set(["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"]);

/**
 * Confirma na BD se o utilizador tem um papel SUPERVISOR_A/B ATIVO nesta
 * operação EXATA.
 *
 * IMPORTANTE: não basta `actor.operationIds.includes(opId)`. O token agrega
 * TODAS as operações de TODOS os papéis ativos (inclui operações onde o user é
 * só MEMBER) e `actor.role` é um único papel primário. Logo um supervisor da
 * operação A que também é membro da operação B passaria num check baseado só em
 * `operationIds` — escalada de privilégio cross-operation. Por isso validamos o
 * papel-na-operação na fonte (user_roles).
 */
export async function isSupervisorOfOperation(userId: string, operationId: string): Promise<boolean> {
  const rows = await db
    .select({ id: userRolesTable.id })
    .from(userRolesTable)
    .where(
      and(
        eq(userRolesTable.userId, userId),
        eq(userRolesTable.operationId, operationId),
        eq(userRolesTable.active, true),
        or(eq(userRolesTable.role, "SUPERVISOR_A"), eq(userRolesTable.role, "SUPERVISOR_B")),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Quem pode realizar ações de GESTÃO destrutivas/exclusivas de gestor sobre a
 * operação: ADMIN (global) ou supervisor ATIVO dessa operação exata.
 */
export async function isOperationManager(actor: ActorLite, operationId: string): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  return isSupervisorOfOperation(actor.sub, operationId);
}

export interface ShowResponsibilityRef {
  id: string;
  responsibleId: string | null;
}

interface ActorLite {
  sub: string;
  role: string;
  operationIds: string[];
}

/**
 * Verifica se o utilizador tem uma delegação ATIVA para uma responsabilidade,
 * considerando o escopo por show: uma delegação aplica-se se NÃO tiver showBookId
 * (escopo da operação inteira) OU se o seu showBookId for igual ao show pedido.
 *
 * Quando `requiredDelegatorId` é fornecido (caso o show tenha responsável), só
 * contam delegações concedidas por esse responsável — impede que outro gestor da
 * operação conceda acesso, via delegação ao nível da operação, a um show alheio.
 */
export async function hasActiveResponsibilityForShow(
  userId: string,
  operationId: string,
  responsibility: DelegatedResponsibility,
  showBookId: string | null,
  requiredDelegatorId?: string | null,
): Promise<boolean> {
  const now = new Date();
  const scopeClause = showBookId
    ? or(isNull(delegationsTable.showBookId), eq(delegationsTable.showBookId, showBookId))
    : isNull(delegationsTable.showBookId);
  const conditions = [
    eq(delegationsTable.delegateeId, userId),
    eq(delegationsTable.operationId, operationId),
    isNull(delegationsTable.revokedAt),
    lte(delegationsTable.validFrom, now),
    gte(delegationsTable.validUntil, now),
    scopeClause,
  ];
  if (requiredDelegatorId) {
    conditions.push(eq(delegationsTable.delegatorId, requiredDelegatorId));
  }
  const rows = await db
    .select({ responsibilities: delegationsTable.responsibilities })
    .from(delegationsTable)
    .where(and(...conditions));
  return rows.some((r) => (r.responsibilities as string[]).includes(responsibility));
}

/**
 * Quem pode EDITAR a estrutura do Livro do Show (renomear, cenas, blocos,
 * posições, linhas). Admin pode tudo; se houver responsável definido, só ele
 * (e o admin); se não houver, qualquer gestor DA OPERAÇÃO do show (legado).
 */
export async function canManageShowBook(
  actor: ActorLite,
  show: ShowResponsibilityRef,
  showOperationId: string,
): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  if (show.responsibleId) return show.responsibleId === actor.sub;
  // Legado (sem responsável): qualquer gestor DA OPERAÇÃO, validado por papel
  // SUPERVISOR_A/B ativo nessa operação exata (não só pertença via token).
  return isSupervisorOfOperation(actor.sub, showOperationId);
}

/**
 * Quem pode GERAR/PUBLICAR o Livro do Dia de um show. Admin sempre; se o show
 * tem responsável: o próprio responsável OU um capitão a quem ELE delegou
 * DAILY_BOOK (delegação ao nível da operação ou específica deste show). Sem
 * responsável definido, mantém-se o comportamento legado por operação (gestor da
 * operação OU capitão com delegação ativa nessa operação).
 */
export async function canOperateDailyBook(
  actor: ActorLite,
  operationId: string,
  show: ShowResponsibilityRef | null,
): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  if (show?.responsibleId) {
    if (show.responsibleId === actor.sub) return true;
    // Só vale delegação concedida pelo próprio responsável do show.
    return hasActiveResponsibilityForShow(actor.sub, operationId, "DAILY_BOOK", show.id, show.responsibleId);
  }
  // Legado (sem responsável): gestor da operação (papel SUPERVISOR_A/B ativo
  // nessa operação exata, validado na BD) OU capitão com delegação ativa.
  if (await isSupervisorOfOperation(actor.sub, operationId)) return true;
  return hasActiveResponsibilityForShow(actor.sub, operationId, "DAILY_BOOK", show?.id ?? null);
}

/**
 * Quem pode VER (ler) um Livro do Show (estrutura: cenas, blocos, posições,
 * linhas, versões, refs e a conferência por data). Escopado por operação +
 * responsabilidade:
 * - Admin vê tudo;
 * - Membro (não-gestor) vê os shows da SUA operação (qualquer estado), tal como
 *   hoje no app — o escopo de responsabilidade restringe gestores, não membros;
 * - Supervisor vê apenas os shows que pode operar (o de que é responsável, um
 *   que lhe foi delegado, ou — no legado sem responsável — qualquer show da sua
 *   operação). NÃO vê o show de que outro supervisor é responsável.
 */
export async function canViewShowBook(
  actor: ActorLite,
  show: ShowResponsibilityRef,
  showOperationId: string,
): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  if (!MANAGER_ROLES.has(actor.role)) {
    return actor.operationIds.includes(showOperationId);
  }
  return canOperateDailyBook(actor, showOperationId, { id: show.id, responsibleId: show.responsibleId });
}

/**
 * Quem pode VER (ler) um Livro do Dia. Escopado por show (não por operação):
 * - Admin vê tudo (é quem gere a atribuição de responsáveis);
 * - Supervisor vê apenas os livros que PODE OPERAR — o show de que é responsável,
 *   um show que lhe foi delegado pelo responsável, ou (legado) qualquer show SEM
 *   responsável definido na sua operação. NÃO vê os shows de outro supervisor.
 * - Membro vê apenas livros PUBLICADOS/REPUBLICADOS da SUA operação (só leitura);
 * - Capitão (MEMBER) delegado vê o livro do show que lhe foi delegado, mesmo em
 *   rascunho (via canOperateDailyBook).
 */
export async function canViewDailyBook(
  actor: ActorLite,
  operationId: string,
  status: string,
  show: ShowResponsibilityRef | null,
): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  const inScope = actor.operationIds.includes(operationId);
  const published = status === "PUBLISHED" || status === "REPUBLISHED";
  // Membro (não-gestor): livros publicados da sua operação.
  if (!MANAGER_ROLES.has(actor.role) && inScope && published) return true;
  // Supervisores ficam restritos aos shows que podem operar; capitães (MEMBER)
  // veem o show delegado mesmo em rascunho. Tudo o resto é negado.
  return canOperateDailyBook(actor, operationId, show);
}
