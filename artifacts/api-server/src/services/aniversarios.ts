/** Aniversários do Mural (28 Perfil): só dia e mês, obedecendo o que cada pessoa escolheu (off | lista | mural). */
import { and, eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

/** Dia e mês em São Paulo, n dias à frente — nunca o ano. */
function diaMes(now: Date, somar = 0) {
  const d = new Date(now.getTime() + somar * 86_400_000);
  const [dd, mm] = d.toLocaleDateString("en-GB", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).split("/");
  return `${mm}-${dd}`;
}

export async function aniversariosDaCasa(organizationId: string, now = new Date()) {
  const pessoas = await db.select({ id: usersTable.id, nome: usersTable.name, birthDate: usersTable.birthDate, privacidade: usersTable.privacidade })
    .from(usersTable).where(and(eq(usersTable.organizationId, organizationId), eq(usersTable.status, "ACTIVE")));
  const hojeMD = diaMes(now);
  const proximos = new Map(Array.from({ length: 7 }, (_, i) => [diaMes(now, i + 1), i + 1] as const));
  const hoje: { id: string; nome: string }[] = [];
  const semana: { id: string; nome: string; dia: string; emDias: number }[] = [];
  for (const p of pessoas) {
    if (!p.birthDate || p.privacidade?.bday === "off") continue;
    const md = p.birthDate.slice(5, 10);
    // "mural": sobe para o alto do mural no dia; "lista": só aparece na lista da semana, sem subir.
    if (md === hojeMD && p.privacidade?.bday !== "lista") hoje.push({ id: p.id, nome: p.nome });
    const emDias = md === hojeMD ? 0 : proximos.get(md);
    if (emDias !== undefined) semana.push({ id: p.id, nome: p.nome, dia: `${md.slice(3)}/${md.slice(0, 2)}`, emDias });
  }
  semana.sort((a, b) => a.emDias - b.emDias || a.nome.localeCompare(b.nome, "pt-BR"));
  return { hoje, semana };
}
