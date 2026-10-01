import http from "node:http";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "development";
process.env.DATABASE_URL ??= "postgresql://localhost/myasa_agenda_tests";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const [{ default: express }, { default: agendaRouter }, { signAccessToken }, { pool }] = await Promise.all([
    import("express"), import("../src/routes/agenda.js"), import("../src/lib/jwt.service.js"), import("@workspace/db"),
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api", agendaRouter);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Não foi possível iniciar o servidor de teste");

  const organizationId = randomUUID();
  const operationId = randomUUID();
  const areaId = randomUUID();
  const locationId = randomUUID();
  const memberId = randomUUID();
  const inviteeId = randomUUID();
  const supervisorId = randomUUID();
  let eventId: string | null = null;
  const memberToken = signAccessToken({ sub: memberId, jti: randomUUID(), organizationId, role: "MEMBER", operationIds: [operationId] });
  const inviteeToken = signAccessToken({ sub: inviteeId, jti: randomUUID(), organizationId, role: "MEMBER", operationIds: [operationId] });
  const supervisorToken = signAccessToken({ sub: supervisorId, jti: randomUUID(), organizationId, role: "SUPERVISOR_A", operationIds: [operationId] });
  const request = (path: string, token: string, method = "GET", body?: unknown) => fetch(`http://127.0.0.1:${address.port}/api${path}`, {
    method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  try {
    await pool.query(`insert into organizations (id, name) values ($1, $2)`, [organizationId, `Agenda Group D ${organizationId}`]);
    await pool.query(`insert into operations (id, organization_id, name, status) values ($1, $2, $3, 'ACTIVE')`, [operationId, organizationId, `Agenda ${operationId}`]);
    await pool.query(`insert into areas (id, organization_id, name, active) values ($1, $2, $3, true)`, [areaId, organizationId, `Área ${areaId}`]);
    await pool.query(`insert into locations (id, organization_id, name) values ($1, $2, $3)`, [locationId, organizationId, `Local ${locationId}`]);
    await pool.query(
      `insert into users (id, organization_id, nome_completo, nome_de_exibicao, username, area_id) values
        ($1, $4, 'Membro Teste', 'Membro', $5, $6), ($2, $4, 'Convidada Teste', 'Convidada', $7, $6), ($3, $4, 'Supervisora Teste', 'Supervisora', $8, $6)`,
      [memberId, inviteeId, supervisorId, organizationId, `agenda-member-${memberId}`, areaId, `agenda-invitee-${inviteeId}`, `agenda-supervisor-${supervisorId}`],
    );
    await pool.query(`insert into user_roles (user_id, operation_id, role, active) values
      ($1, $4, 'MEMBER', true), ($2, $4, 'MEMBER', true), ($3, $4, 'SUPERVISOR_A', true)`, [memberId, inviteeId, supervisorId, operationId]);
    await pool.query(`insert into area_local_supervisors (area_id, location_id, supervisor_id, active) values ($1, $2, $3, true)`, [areaId, locationId, supervisorId]);

    const create = await request("/agenda/events", memberToken, "POST", {
      operationId, areaId, type: "MEETING", title: "Alinhamento de teste", date: "2026-10-12",
      startTime: "14:00", endTime: "15:00", participantIds: [memberId, inviteeId], visibility: "OPERATION",
    });
    const created = await create.json() as { event?: { id: string; status: string } };
    eventId = created.event?.id ?? null;
    assert(create.status === 201 && created.event?.status === "PROPOSED", "elenco cria proposta de reunião, sem confirmar automaticamente");

    if (eventId) {
      const decision = await request(`/agenda/events/${eventId}/decision`, supervisorToken, "POST", { decision: "ACCEPT" });
      assert(decision.status === 200, "Supervisão da área consegue aceitar proposta");
      const response = await request(`/agenda/events/${eventId}/respond`, inviteeToken, "POST", { response: "ACCEPTED" });
      assert(response.status === 200, "convidada consegue aceitar reunião confirmada");
      const edit = await request(`/agenda/events/${eventId}`, supervisorToken, "PATCH", { title: "Alinhamento atualizado", participantIds: [memberId, inviteeId] });
      assert(edit.status === 200, "Supervisão consegue editar reunião da área");
      const list = await request(`/agenda/events?from=2026-10-12&to=2026-10-12`, supervisorToken);
      const listed = await list.json() as { events?: Array<{ id: string; participants?: Array<{ id: string; response: string }> }> };
      const invitee = listed.events?.find((event) => event.id === eventId)?.participants?.find((person) => person.id === inviteeId);
      assert(invitee?.response === "ACCEPTED", "edição dos participantes preserva a resposta já registrada");
    }
  } finally {
    if (eventId) await pool.query(`delete from user_notifications where entity_id = $1`, [eventId]);
    await pool.query(`delete from history_relations where source_event_id in (select id from history_events where org_id = $1) or target_event_id in (select id from history_events where org_id = $1)`, [organizationId]);
    await pool.query(`delete from history_events where org_id = $1`, [organizationId]);
    await pool.query(`delete from agenda_events where operation_id = $1`, [operationId]);
    await pool.query(`delete from area_local_supervisors where area_id = $1`, [areaId]);
    await pool.query(`delete from user_roles where user_id = any($1::uuid[])`, [[memberId, inviteeId, supervisorId]]);
    await pool.query(`delete from users where id = any($1::uuid[])`, [[memberId, inviteeId, supervisorId]]);
    await pool.query(`delete from operations where id = $1`, [operationId]);
    await pool.query(`delete from areas where id = $1`, [areaId]);
    await pool.query(`delete from locations where id = $1`, [locationId]);
    await pool.query(`delete from organizations where id = $1`, [organizationId]);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }
  if (failures.length) throw new Error(`${failures.length} teste(s) da Agenda falharam`);
  console.log(`✓ ${passed} verificações da Agenda do Grupo D passaram`);
}

run().catch((error) => { console.error(error); process.exit(1); });
