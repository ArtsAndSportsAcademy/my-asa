/** Cenário descartável de auditoria via interface.
 *
 * Só funciona com MYASA_E2E_QA=1 e com a URL que .env.test identifica como
 * banco de teste. Recusa a URL do piloto e nunca se conecta a ela.
 */
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { isSupabaseTestDatabaseUrl, sameTestDatabaseOrProject } from "./test-database-identity.mjs";

const tag = "QA_E2E_20260924";
const databaseUrl = process.env.DATABASE_URL;
const testRef = process.env.MYASA_TEST_DATABASE_REF?.trim().toLowerCase();
const pilotUrl = process.env.DATABASE_URL_PILOTO;
const password = process.env.MYASA_QA_E2E_PASSWORD;
if (!password) {
  throw new Error("Defina MYASA_QA_E2E_PASSWORD para criar as contas descartáveis de QA.");
}
if (process.env.MYASA_E2E_QA !== "1" || !isSupabaseTestDatabaseUrl(databaseUrl, testRef)
  || (pilotUrl && sameTestDatabaseOrProject(databaseUrl, pilotUrl, testRef))) {
  throw new Error("Recusado: este utilitário só roda com .env.test e MYASA_E2E_QA=1.");
}

const pool = new Pool({ connectionString: databaseUrl });
const mode = process.argv[2] ?? "seed";
const today = "2026-09-24"; // quinta-feira, a data operacional da prévia local.

async function cleanup(client: import("pg").PoolClient) {
  const org = await client.query<{ id: string }>("select id from organizations where name = $1", [`${tag} · DESCARTAR`]);
  if (!org.rowCount) return;
  const orgId = org.rows[0]!.id;
  const ops = await client.query<{ id: string }>("select id from operations where organization_id = $1", [orgId]);
  const opIds = ops.rows.map((r) => r.id);
  const users = await client.query<{ id: string }>("select id from users where organization_id = $1", [orgId]);
  const userIds = users.rows.map((r) => r.id);

  // Filhos primeiro: é a mesma ordem que as suítes usam e o filtro é sempre
  // limitado à organização temporária.
  // Registro pode referenciar uma mudança operacional. Removemos ambos somente
  // dentro da organização descartável, preservando o histórico de teste normal.
  if (userIds.length) {
    await client.query("delete from history_events where actor_id = any($1::uuid[])", [userIds]);
    await client.query("delete from operational_changes where actor_id = any($1::uuid[])", [userIds]);
    await client.query("delete from security_audit_log where actor_id = any($1::uuid[])", [userIds]);
  }
  await client.query("delete from history_events where org_id = $1", [orgId]);
  if (userIds.length) {
    await client.query("delete from user_notifications where user_id = any($1::uuid[])", [userIds]);
    await client.query("delete from notifications where user_id = any($1::uuid[])", [userIds]);
    await client.query("delete from refresh_tokens where user_id = any($1::uuid[])", [userIds]);
  }
  if (opIds.length) {
    await client.query("delete from escala_confirmacoes where scale_id in (select id from scales where operation_id = any($1::uuid[]))", [opIds]);
    await client.query("delete from escala_areas_prontas where scale_id in (select id from scales where operation_id = any($1::uuid[]))", [opIds]);
    await client.query("delete from escala_bloco_ajustes where scale_id in (select id from scales where operation_id = any($1::uuid[]))", [opIds]);
    await client.query("delete from scale_allocations where scale_id in (select id from scales where operation_id = any($1::uuid[]))", [opIds]);
    await client.query("delete from scales where operation_id = any($1::uuid[])", [opIds]);
    await client.query("delete from daily_books where show_book_id in (select id from show_books where operation_id = any($1::uuid[]))", [opIds]);
    // O Livro do Dia criado pela auditoria referencia o evento interno de
    // Agenda. A ordem é Livro do Dia, evento, Livro do Show — sempre limitada
    // aos shows temporários da organização descartável.
    await client.query("delete from agenda_events where show_book_id in (select id from show_books where operation_id = any($1::uuid[]))", [opIds]);
    await client.query("delete from programacao_blocos where programacao_id in (select id from programacoes where organization_id = $1)", [orgId]);
    await client.query("delete from programacoes where organization_id = $1", [orgId]);
    await client.query("delete from sessions where show_id in (select id from show_books where operation_id = any($1::uuid[]))", [opIds]);
    await client.query("delete from show_book_keyframes where scene_id in (select id from show_book_scenes where show_book_id in (select id from show_books where operation_id = any($1::uuid[])))", [opIds]);
    await client.query("delete from show_book_versions where show_book_id in (select id from show_books where operation_id = any($1::uuid[]))", [opIds]);
    await client.query("delete from show_book_drive_links where show_book_id in (select id from show_books where operation_id = any($1::uuid[]))", [opIds]);
    await client.query("delete from show_book_lines where position_id in (select id from show_book_roles where show_book_id in (select id from show_books where operation_id = any($1::uuid[])))", [opIds]);
    await client.query("delete from show_book_roles where show_book_id in (select id from show_books where operation_id = any($1::uuid[]))", [opIds]);
    await client.query("delete from show_book_blocks where show_book_id in (select id from show_books where operation_id = any($1::uuid[]))", [opIds]);
    await client.query("delete from show_book_scenes where show_book_id in (select id from show_books where operation_id = any($1::uuid[]))", [opIds]);
    await client.query("delete from show_books where operation_id = any($1::uuid[])", [opIds]);
    await client.query("delete from area_local_supervisors where supervisor_id = any($1::uuid[])", [userIds]);
    await client.query("delete from user_roles where operation_id = any($1::uuid[])", [opIds]);
    await client.query("delete from operation_locations where operation_id = any($1::uuid[])", [opIds]);
  }
  await client.query("delete from users where organization_id = $1", [orgId]);
  await client.query("delete from areas where organization_id = $1", [orgId]);
  await client.query("delete from locations where organization_id = $1", [orgId]);
  await client.query("delete from operations where organization_id = $1", [orgId]);
  await client.query("delete from organizations where id = $1", [orgId]);
}

async function seed(client: import("pg").PoolClient) {
  await cleanup(client);
  const hash = await bcrypt.hash(password, 10);
  const org = await client.query<{ id: string }>("insert into organizations(name) values($1) returning id", [`${tag} · DESCARTAR`]);
  const orgId = org.rows[0]!.id;
  const operation = await client.query<{ id: string }>("insert into operations(organization_id,name,status) values($1,$2,'ACTIVE') returning id", [orgId, `${tag} · Snowland`]);
  const operationId = operation.rows[0]!.id;
  const location = await client.query<{ id: string }>("insert into locations(organization_id,name) values($1,'Snowland') returning id", [orgId]);
  const locationId = location.rows[0]!.id;
  await client.query("insert into operation_locations(operation_id,location_id) values($1,$2)", [operationId, locationId]);
  const area = await client.query<{ id: string }>("insert into areas(organization_id,name) values($1,'Patinadores') returning id", [orgId]);
  const areaId = area.rows[0]!.id;
  const makeUser = async (full: string, display: string, username: string, inArea: boolean) => {
    const result = await client.query<{ id: string }>(
      "insert into users(organization_id,nome_completo,nome_de_exibicao,username,password_hash,area_id,default_location_id,status,person_status) values($1,$2,$3,$4,$5,$6,$7,'ACTIVE','ACTIVE') returning id",
      [orgId, full, display, username, hash, inArea ? areaId : null, inArea ? locationId : null],
    );
    return result.rows[0]!.id;
  };
  const adminId = await makeUser("QA Administração", "Admin QA", "qa.admin", false);
  const deborahId = await makeUser("QA Deborah Snowland", "Deborah QA", "qa.deborah", true);
  const juliaId = await makeUser("QA Julia Elenco", "Julia QA", "qa.julia", true);
  await client.query(
    "insert into user_roles(user_id,operation_id,role,active) values($1,$2,'ADMIN',true),($3,$2,'SUPERVISOR_A',true),($4,$2,'MEMBER',true)",
    [adminId, operationId, deborahId, juliaId],
  );
  await client.query("insert into area_local_supervisors(area_id,location_id,supervisor_id) values($1,$2,$3)", [areaId, locationId, deborahId]);

  const show = await client.query<{ id: string }>(
    "insert into show_books(operation_id,location_id,title,type,uses_characters,status,created_by,responsible_id,description) values($1,$2,$3,'SIMPLE',false,'DRAFT',$4,$5,$6) returning id",
    [operationId, locationId, "QA Livro do Dia", adminId, deborahId, "Cenário descartável para auditoria de login."],
  );
  const showId = show.rows[0]!.id;
  const scene = await client.query<{ id: string }>("insert into show_book_scenes(show_book_id,name,\"order\") values($1,'Abertura',0) returning id", [showId]);
  const sceneId = scene.rows[0]!.id;
  const block = await client.query<{ id: string }>("insert into show_book_blocks(show_book_id,scene_id,name,\"order\",zone,prefix) values($1,$2,'Backstage left',0,'BACKSTAGE LEFT','BL') returning id", [showId, sceneId]);
  const role = await client.query<{ id: string }>("insert into show_book_roles(show_book_id,block_id,name,\"order\") values($1,$2,'BL 01',0) returning id", [showId, block.rows[0]!.id]);
  await client.query("insert into show_book_lines(position_id,type,config,\"order\") values($1,'FIXED_PERSON',$2::jsonb,0)", [role.rows[0]!.id, JSON.stringify({ userId: juliaId })]);
  await client.query("insert into sessions(show_id,start_time,end_time,call_time,active) values($1,'10:00','11:00','09:30',true)", [showId]);

  const program = await client.query<{ id: string }>("insert into programacoes(organization_id,location_id,nome,vigencia_inicio,vigencia_fim,created_by) values($1,$2,'QA Auditoria','2026-09-01','2026-12-31',$3) returning id", [orgId, locationId, adminId]);
  await client.query("insert into programacao_blocos(programacao_id,weekday,inicio,fim,rotulo,regra,area_ids,\"order\") values($1,4,'09:00','10:00','TREINO GELO','area',array[$2]::uuid[],0)", [program.rows[0]!.id, areaId]);
  await client.query("insert into programacao_blocos(programacao_id,weekday,inicio,fim,rotulo,regra,show_book_id,\"order\") values($1,4,'10:00','11:00','QA Livro do Dia','livro',$2,1)", [program.rows[0]!.id, showId]);
  await client.query("insert into scales(operation_id,location_id,title,period_start,period_end,status,version,created_by,generated_by,generated_at) values($1,$2,'Escala QA · 24/09',$3,$3,'DRAFT',1,$4,$4,now())", [operationId, locationId, today, adminId]);

  // A senha é deliberadamente ausente da saída: o processo local a conhece
  // para a auditoria visual, mas ela nunca vai para log, Git ou relatório.
  process.stdout.write(JSON.stringify({ tag, orgId, operationId, locationId, areaId, showId, users: { admin: "qa.admin", deborah: "qa.deborah", julia: "qa.julia" } }) + "\n");
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (mode === "cleanup") await cleanup(client);
    else if (mode === "seed") await seed(client);
    else throw new Error("Use seed ou cleanup.");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
