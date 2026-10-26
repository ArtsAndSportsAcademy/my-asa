/**
 * Meu Dia do Elenco quando a pessoa trabalha em dois locais no mesmo dia (treino num, aula noutro):
 * a tela mostrava só um deles. Agora a linha do tempo traz os blocos dos dois, em ordem, dizendo o local,
 * e o check-in aponta a escala do bloco certo. PostgreSQL real de teste.
 */
import { eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, historyEventsTable, locationsTable, operationLocationsTable, operationsTable,
  organizationsTable, pool, programacaoBlocosTable, programacoesTable, scalesTable, userRolesTable, usersTable,
} from "@workspace/db";
import { montarMeuDia } from "../src/services/meu-dia.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `doislocais_${Date.now()}`;
  const date = "2026-10-14";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [area] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Patinadores` }).returning();
  const mkUser = async (name: string, role: "ADMIN" | "SUPERVISOR_A" | "MEMBER", withArea: boolean) => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name, username: `${tag}_${name}`.toLowerCase(), areaId: withArea ? area!.id : null }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: operation!.id, role, active: true });
    return u!;
  };
  const barbara = await mkUser("Barbara", "ADMIN", false);
  const deborah = await mkUser("Deborah", "SUPERVISOR_A", true);
  const julia = await mkUser("Julia", "MEMBER", true);
  const everyone = [barbara, deborah, julia].map((u) => u.id);
  const locais: { id: string; escalaId: string; progId: string }[] = [];
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  for (const [nome, rotulo, inicio, fim] of [["Snowland", "TREINO GELO", "09:40", "11:00"], ["Acquamotion", "AULA PISCINA", "14:00", "15:00"]] as const) {
    const [loc] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_${nome}` }).returning();
    await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: loc!.id });
    await db.insert(areaLocalSupervisorsTable).values({ areaId: area!.id, locationId: loc!.id, supervisorId: deborah.id });
    const [prog] = await db.insert(programacoesTable).values({ organizationId: org!.id, locationId: loc!.id, nome: `${tag}_${nome}`, vigenciaInicio: date, vigenciaFim: date, createdBy: barbara.id }).returning();
    await db.insert(programacaoBlocosTable).values({ programacaoId: prog!.id, weekday: wd, inicio, fim, rotulo, regra: "area" as const, areaIds: [area!.id] });
    const [escala] = await db.insert(scalesTable).values({ operationId: operation!.id, locationId: loc!.id, title: `${tag}_${nome}`, periodStart: date, periodEnd: date, status: "PUBLISHED", publishedAt: new Date(), createdBy: barbara.id }).returning();
    locais.push({ id: loc!.id, escalaId: escala!.id, progId: prog!.id });
  }
  const as = (hhmm: string) => montarMeuDia({ sub: julia.id, organizationId: org!.id, role: "MEMBER" }, "mem", new Date(`${date}T${hhmm}:00-03:00`));
  try {
    const manha = await as("09:20");
    const titulos = manha.linhaDoTempo.itens.map((i) => i.title).join(",");
    assert(titulos === "TREINO GELO,AULA PISCINA", `a linha do tempo traz os dois locais, em ordem (veio "${titulos}")`);
    assert(manha.linhaDoTempo.itens.every((i) => i.sub.includes(`${tag}_`)), "e cada linha diz em que local é, porque são dois");
    assert(manha.proximo?.title === "TREINO GELO" && manha.proximo.chips.join("").includes("Snowland"), "a próxima atividade é a do primeiro local");
    const tarde = await as("12:00");
    const acao = tarde.saudacao.acao as { checkIn?: { scaleId: string } } | null;
    assert(tarde.proximo?.title === "AULA PISCINA" && tarde.proximo.chips.join("").includes("Acquamotion"), "depois do primeiro bloco, a próxima atividade é a do outro local");
    assert(acao?.checkIn?.scaleId === locais[1]!.escalaId, "e o check-in aponta a escala do bloco que vem, não a do primeiro local");
  } finally {
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, everyone)));
    for (const l of locais) {
      await db.delete(scalesTable).where(eq(scalesTable.id, l.escalaId));
      await db.delete(programacaoBlocosTable).where(eq(programacaoBlocosTable.programacaoId, l.progId));
      await db.delete(programacoesTable).where(eq(programacoesTable.id, l.progId));
      await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, l.id));
      await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, l.id));
      await db.delete(locationsTable).where(eq(locationsTable.id, l.id));
    }
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s)`);
  process.stdout.write(`meu-dia-dois-locais: ${passed} asserts passed\n`);
}

try { await run(); } catch (e) { console.error(e); process.exitCode = 1; } finally { await pool.end(); }
