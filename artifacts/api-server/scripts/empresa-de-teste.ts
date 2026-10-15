/**
 * Empresa de teste: uma organização inteira, inventada, no banco de TESTE, para conferir as telas com servidor de
 * verdade (Administração, Direção, Supervisão e Elenco), como no celular.
 *
 * - Só roda com MYASA_E2E_QA=1 e com a URL que o .env.test identifica como banco de teste (MYASA_TEST_DATABASE_REF).
 *   Recusa qualquer outra URL.
 * - Os nomes são inventados ("Teste Elenco 07"): nenhuma pessoa real, nenhum nome do elenco.
 * - A senha é sorteada a cada execução e gravada SÓ no arquivo indicado em MYASA_SENHAS_ARQUIVO (fora do
 *   repositório). Nunca sai no terminal, no log nem no Git.
 * - Rodar de novo não duplica: se a empresa já existe, o script avisa e para. Para recomeçar, apague a organização
 *   "EMPRESA DE TESTE · My ASA" do banco de teste.
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, folgasTable, libraryDocumentVersionsTable, libraryDocumentsTable, locationsTable,
  operationLocationsTable, operationsTable, organizationsTable, pool, responsibilitiesTable, userRolesTable, usersTable,
} from "@workspace/db";
import { isSupabaseTestDatabaseUrl } from "./test-database-identity.mjs";

const NOME_DA_EMPRESA = "EMPRESA DE TESTE · My ASA";
const arquivoDeSenhas = process.env.MYASA_SENHAS_ARQUIVO;
if (process.env.MYASA_E2E_QA !== "1" || !isSupabaseTestDatabaseUrl(process.env.DATABASE_URL, process.env.MYASA_TEST_DATABASE_REF?.trim().toLowerCase())) {
  throw new Error("Recusado: este utilitário só roda no banco de teste (.env.test) e com MYASA_E2E_QA=1.");
}
if (!arquivoDeSenhas) throw new Error("Defina MYASA_SENHAS_ARQUIVO: o arquivo (fora do repositório) onde a senha sorteada será gravada.");

const hoje = new Date();
const iso = (dias = 0) => { const d = new Date(hoje); d.setDate(d.getDate() + dias); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

async function main() {
  const [existente] = await db.select({ id: organizationsTable.id }).from(organizationsTable).where(eq(organizationsTable.name, NOME_DA_EMPRESA)).limit(1);
  if (existente) { console.log("A empresa de teste já existe; nada foi alterado."); return; }

  const senha = randomBytes(9).toString("base64url");
  const hash = await bcrypt.hash(senha, 10);
  const [org] = await db.insert(organizationsTable).values({ name: NOME_DA_EMPRESA }).returning();
  const orgId = org!.id;

  const [opSnow, opAcqua] = await db.insert(operationsTable).values([
    { organizationId: orgId, name: "Snowland (teste)", status: "ACTIVE" },
    { organizationId: orgId, name: "Acquamotion (teste)", status: "ACTIVE" },
  ]).returning();
  const [teatro, rinque, piscina, rinqueAntigo] = await db.insert(locationsTable).values([
    { organizationId: orgId, name: "Teatro (teste)", operatingDays: [0, 1, 2, 3, 4, 5, 6] },
    { organizationId: orgId, name: "Rinque (teste)", operatingDays: [0, 1, 2, 3, 4, 5, 6] },
    { organizationId: orgId, name: "Piscina (teste)", operatingDays: [0, 1, 2, 3, 4, 5, 6] },
    { organizationId: orgId, name: "Rinque antigo (teste)", closed: true, closedReason: "Obra" },
  ]).returning();
  await db.insert(operationLocationsTable).values([
    { operationId: opSnow!.id, locationId: teatro!.id }, { operationId: opSnow!.id, locationId: rinque!.id }, { operationId: opAcqua!.id, locationId: piscina!.id },
  ]);
  const [patinadores, bailarinos, producao, antiga] = await db.insert(areasTable).values([
    { organizationId: orgId, name: "Patinadores (teste)" }, { organizationId: orgId, name: "Bailarinos (teste)" },
    { organizationId: orgId, name: "Produção (teste)" }, { organizationId: orgId, name: "Atores antigos (teste)", active: false },
  ]).returning();

  const usuario = async (login: string, nome: string, areaId: string | null, extra: Partial<typeof usersTable.$inferInsert> = {}) =>
    (await db.insert(usersTable).values({ organizationId: orgId, fullName: nome, name: nome, username: login, passwordHash: hash, mustChangePassword: false, areaId, status: "ACTIVE", personStatus: "ACTIVE", ...extra }).returning())[0]!;
  const admin = await usuario("teste.admin", "Teste Administração", null);
  const direcao = await usuario("teste.direcao", "Teste Direção", null);
  const sup1 = await usuario("teste.sup1", "Teste Supervisão Patinadores", patinadores!.id);
  const sup2 = await usuario("teste.sup2", "Teste Supervisão Bailarinos", bailarinos!.id);
  const elenco = [];
  for (let i = 1; i <= 30; i++) {
    const area = i <= 12 ? patinadores! : i <= 22 ? bailarinos! : producao!;
    elenco.push(await usuario(`teste.elenco${String(i).padStart(2, "0")}`, `Teste Elenco ${String(i).padStart(2, "0")}`, area.id));
  }
  const desligada = await usuario("teste.desligada", "Teste Desligada 01", patinadores!.id, { status: "INACTIVE", personStatus: "ARCHIVED" });

  const papeis: { userId: string; operationId: string; role: "ADMIN" | "DIR" | "SUPERVISOR_A" | "MEMBER"; active: boolean }[] = [
    { userId: admin.id, operationId: opSnow!.id, role: "ADMIN", active: true },
    { userId: direcao.id, operationId: opSnow!.id, role: "DIR", active: true },
    { userId: sup1.id, operationId: opSnow!.id, role: "SUPERVISOR_A", active: true },
    { userId: sup2.id, operationId: opSnow!.id, role: "SUPERVISOR_A", active: true },
    { userId: desligada.id, operationId: opSnow!.id, role: "MEMBER", active: false },
  ];
  // Elenco 01 a 27 em Snowland; 28 a 30 só em Acquamotion (para conferir o filtro por operação nos convites).
  elenco.forEach((pessoa, indice) => papeis.push({ userId: pessoa.id, operationId: indice < 27 ? opSnow!.id : opAcqua!.id, role: "MEMBER", active: true }));
  await db.insert(userRolesTable).values(papeis);
  // Produção fica SEM supervisão de propósito: a proposta de reunião do Elenco dessa área deve cair na Administração.
  await db.insert(areaLocalSupervisorsTable).values([
    { areaId: patinadores!.id, locationId: teatro!.id, supervisorId: sup1.id }, { areaId: patinadores!.id, locationId: rinque!.id, supervisorId: sup1.id },
    { areaId: bailarinos!.id, locationId: teatro!.id, supervisorId: sup2.id },
  ]);
  // Elenco 03 está de folga hoje e amanhã: serve para o ensaio que chama alguém de folga.
  await db.insert(folgasTable).values({ userId: elenco[2]!.id, operationId: opSnow!.id, type: "DAY_OFF", startDate: iso(0), endDate: iso(1), status: "ACTIVE", createdBy: admin.id });

  await db.insert(responsibilitiesTable).values({ orgId, operationId: opSnow!.id, areaId: patinadores!.id, ownerId: sup1.id, title: "Elenco pronto para o show (teste)" });
  const [documento] = await db.insert(libraryDocumentsTable).values({
    orgId, title: "Regras do camarim (teste)", type: "RULES_AND_POLICIES", summary: "Como usar o camarim.", body: "Texto de teste do documento.", requiresConfirmation: true,
    scopeType: "HOUSE", status: "PUBLISHED", version: 1, createdBy: admin.id, publishedAt: new Date(),
  }).returning();
  await db.insert(libraryDocumentVersionsTable).values({ documentId: documento!.id, version: 1, title: documento!.title, body: documento!.body, summary: documento!.summary, createdBy: admin.id });

  writeFileSync(arquivoDeSenhas, JSON.stringify({ senha, logins: { administracao: "teste.admin", direcao: "teste.direcao", supervisao: "teste.sup1", supervisaoSemElenco: "teste.sup2", elenco: "teste.elenco01", elencoDeFolga: "teste.elenco03", elencoDeProducao: "teste.elenco25" } }, null, 2));
  // A senha NÃO é impressa. Só o que foi criado.
  console.log(JSON.stringify({ organizacao: NOME_DA_EMPRESA, orgId, operacoes: 2, locais: 4, areas: 4, pessoas: 5 + elenco.length - 1 + 1 }));
}

main().catch((erro) => { console.error(erro); process.exit(1); }).finally(() => pool.end());
