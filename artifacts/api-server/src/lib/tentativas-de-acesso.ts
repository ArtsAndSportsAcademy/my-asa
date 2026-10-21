import { and, eq, inArray } from "drizzle-orm";
import { db, tentativasDeAcessoTable, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import { writeHistoryEvent } from "./history-helper.js";
import { recordAudit } from "./audit.service.js";

/**
 * Limite de tentativas de senha (20/10/2026). Oito erros dentro de 15 minutos pausam a chave por 15 minutos.
 *
 * A chave é `login:<usuário em minúsculas>` no login (vale também para usuário que não existe: a resposta é a mesma e quem
 * tenta adivinhar não descobre quais usuários existem) e `troca:<id da pessoa>` na troca de senha (senha atual errada).
 * O servidor é sem estado (Vercel), então a contagem mora no banco. Acertar a senha zera; a Administração redefinindo a senha
 * de alguém também zera, para a pessoa não ficar presa depois de receber a provisória.
 */
export const LIMITE_DE_ERROS = 8;
export const JANELA_DE_ERROS_MS = 15 * 60_000;
export const PAUSA_APOS_LIMITE_MS = 15 * 60_000;

/**
 * Limite por origem (21/10/2026, decisão 2 da revisão de segurança). O limite por usuário protege uma conta de quem adivinha a senha dela, mas não de quem
 * tenta muitos usuários diferentes a partir do mesmo lugar (e quem sabe o login de alguém também consegue pausar a conta dele de propósito). Aqui se conta o erro
 * de senha por conexão, em qualquer usuário: 30 erros em 15 minutos pausam a conexão por 15 minutos. O número é folgado porque o elenco usa o mesmo wi-fi do parque;
 * MYASA_LIMITE_DE_SENHA_POR_ORIGEM muda o número e 0 desliga (a chave de emergência, caso a Vercel mostre a mesma conexão para todo mundo).
 * A origem vem do cabeçalho que a Vercel preenche (x-vercel-forwarded-for, senão o primeiro de x-forwarded-for); sem esses cabeçalhos (teste, máquina local) não há
 * origem e este limite não se aplica: nunca se usa o endereço do proxy, que seria o mesmo para todo mundo.
 */
export function limiteDeErrosPorOrigem(): number {
  const bruto = process.env.MYASA_LIMITE_DE_SENHA_POR_ORIGEM;
  if (bruto === undefined || bruto.trim() === "") return 30;
  const n = Number(bruto);
  return Number.isInteger(n) && n >= 0 ? n : 30;
}

export function origemDaRequisicao(cabecalhos: Record<string, string | string[] | undefined>): string | null {
  const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(",")[0]?.trim() || null;
  const ip = primeiro(cabecalhos["x-vercel-forwarded-for"]) ?? primeiro(cabecalhos["x-forwarded-for"]);
  return ip && ip.length <= 64 && /^[0-9a-fA-F:.]+$/.test(ip) ? ip.toLowerCase() : null;
}

export const chaveDeOrigem = (origem: string) => `origem:${origem}`;

export const chaveDeLogin = (usernameEmMinusculas: string) => `login:${usernameEmMinusculas}`;
export const chaveDeTroca = (userId: string) => `troca:${userId}`;

/** A frase vai para a tela: diz o que houve, por quanto tempo, e o que a pessoa pode fazer. */
export function fraseDoBloqueio(ate: Date, agora = new Date()): string {
  const minutos = Math.max(1, Math.ceil((ate.getTime() - agora.getTime()) / 60_000));
  return `Muitas tentativas de senha erradas. Por segurança, esta conta fica pausada por mais ${minutos} ${minutos === 1 ? "minuto" : "minutos"}. ` +
    `Se você esqueceu a senha, toque em "Esqueci minha senha" ou peça à Administração uma senha provisória.`;
}

/** Frase da pausa por origem: a pessoa pode estar só no mesmo wi-fi de quem errou muito. */
export function fraseDoBloqueioPorOrigem(ate: Date, agora = new Date()): string {
  const minutos = Math.max(1, Math.ceil((ate.getTime() - agora.getTime()) / 60_000));
  return `Houve senhas erradas demais vindas desta conexão. Por segurança, ela fica pausada por mais ${minutos} ${minutos === 1 ? "minuto" : "minutos"}. Se você está no wi-fi do parque, tente pelo 4G ou espere; se precisar entrar já, peça ajuda à Administração.`;
}

/** Até quando a chave está pausada, ou null se pode tentar. */
export async function consultarBloqueio(chave: string, agora = new Date()): Promise<Date | null> {
  const [linha] = await db.select({ bloqueadoAte: tentativasDeAcessoTable.bloqueadoAte }).from(tentativasDeAcessoTable).where(eq(tentativasDeAcessoTable.chave, chave)).limit(1);
  return linha?.bloqueadoAte && linha.bloqueadoAte > agora ? linha.bloqueadoAte : null;
}

/** Quem é a pessoa por trás da chave, quando existe (para o Registro e o aviso à Administração). */
export type PessoaDoBloqueio = { id: string; organizationId: string; nome: string; username: string | null };

/**
 * Conta um erro de senha. Devolve até quando a chave ficou pausada (só quando ESTE erro foi o que passou do limite).
 * Dois erros ao mesmo tempo são contados um de cada vez (trava de linha), então ninguém passa do limite por corrida.
 */
export async function registrarErroDeSenha(chave: string, origem: "login" | "troca" | "origem", pessoa: PessoaDoBloqueio | null, limite = LIMITE_DE_ERROS): Promise<Date | null> {
  const agora = new Date();
  const bloqueouAgora = await db.transaction(async (tx) => {
    await tx.insert(tentativasDeAcessoTable).values({ chave, falhas: 0, janelaInicio: agora }).onConflictDoNothing();
    const [linha] = await tx.select().from(tentativasDeAcessoTable).where(eq(tentativasDeAcessoTable.chave, chave)).for("update").limit(1);
    if (!linha) return null;
    // Já pausada: o erro não estende a pausa (e quem chama deveria ter recusado antes).
    if (linha.bloqueadoAte && linha.bloqueadoAte > agora) return null;
    const janelaVenceu = agora.getTime() - linha.janelaInicio.getTime() > JANELA_DE_ERROS_MS || Boolean(linha.bloqueadoAte);
    const falhas = janelaVenceu ? 1 : linha.falhas + 1;
    const janelaInicio = janelaVenceu ? agora : linha.janelaInicio;
    const passou = falhas >= limite;
    const bloqueadoAte = passou ? new Date(agora.getTime() + PAUSA_APOS_LIMITE_MS) : null;
    await tx.update(tentativasDeAcessoTable).set({ falhas, janelaInicio, bloqueadoAte, updatedAt: agora }).where(eq(tentativasDeAcessoTable.chave, chave));
    if (!passou) return null;

    // Passou do limite agora: Registro e um aviso à Administração (um por pausa, não um por erro).
    if (pessoa) {
      const minutos = PAUSA_APOS_LIMITE_MS / 60_000;
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "user.access_locked", title: "Acesso pausado por senhas erradas",
        narrative: `A conta de ${pessoa.nome} ficou pausada por ${minutos} minutos depois de ${LIMITE_DE_ERROS} senhas erradas seguidas${origem === "troca" ? " na troca de senha" : " no login"}.`,
        entityType: "user", entityId: pessoa.id, actorId: pessoa.id, orgId: pessoa.organizationId,
        metadata: { falhas, minutos, origem },
      }, tx as any);
      const admins = await tx.selectDistinct({ id: usersTable.id }).from(usersTable)
        .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
        .where(and(eq(usersTable.organizationId, pessoa.organizationId), eq(usersTable.status, "ACTIVE"), eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true)));
      const quem = pessoa.username ? `${pessoa.nome} (${pessoa.username})` : pessoa.nome;
      if (admins.length) await tx.insert(userNotificationsTable).values(admins.map((admin) => ({
        userId: admin.id, type: "user.access_locked", title: "Acesso pausado por senhas erradas",
        message: `${quem} errou a senha ${LIMITE_DE_ERROS} vezes e a conta ficou pausada por ${minutos} minutos. Se foi a própria pessoa, gere uma senha provisória em Pessoas e acessos.`,
        priority: "IMPORTANT" as const, category: "system" as const, entityType: "user", entityId: pessoa.id, actionUrl: "/pessoas",
      })));
    }
    return bloqueadoAte;
  });
  if (bloqueouAgora) {
    await recordAudit({
      actorId: pessoa?.id, action: "INVALID_ACCESS_ATTEMPT", targetResource: origem === "login" ? "login" : origem === "origem" ? "login_por_origem" : "troca_de_senha",
      metadata: { reason: "account_locked", falhas: limite, minutos: PAUSA_APOS_LIMITE_MS / 60_000, conhecido: Boolean(pessoa) },
    });
  }
  return bloqueouAgora;
}

/** Acertou a senha (ou a Administração redefiniu): a contagem recomeça do zero. */
export async function limparErrosDeSenha(...chaves: string[]): Promise<void> {
  if (!chaves.length) return;
  await db.delete(tentativasDeAcessoTable).where(inArray(tentativasDeAcessoTable.chave, chaves));
}
