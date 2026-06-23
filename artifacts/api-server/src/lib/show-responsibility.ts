import { eq, and, isNull, lte, gte, or } from "drizzle-orm";
import { db, delegationsTable } from "@workspace/db";
import type { DelegatedResponsibility } from "@workspace/db/schema";

// Papéis que, na ausência de um responsável definido por show, mantêm o
// comportamento legado (qualquer gestor da operação pode operar).
const MANAGER_ROLES = new Set(["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"]);

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
export function canManageShowBook(
  actor: ActorLite,
  show: ShowResponsibilityRef,
  showOperationId: string,
): boolean {
  if (actor.role === "ADMIN") return true;
  if (show.responsibleId) return show.responsibleId === actor.sub;
  return MANAGER_ROLES.has(actor.role) && actor.operationIds.includes(showOperationId);
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
  if (MANAGER_ROLES.has(actor.role) && actor.operationIds.includes(operationId)) return true;
  return hasActiveResponsibilityForShow(actor.sub, operationId, "DAILY_BOOK", show?.id ?? null);
}
