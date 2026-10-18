import http from "node:http";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "development";
process.env.DATABASE_URL ??= "postgresql://localhost/myasa_operation_lifecycle_tests";

let passed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(message);
  console.error(`  ✗ ${message}`);
}

async function run() {
  const {
    canTransitionOperation,
    evaluateOperationReadiness,
    normalizeOperationName,
  } = await import("../src/services/operation-lifecycle.js");

  assert(
    normalizeOperationName("  Snowland   Artística ") === "snowland artística",
    "normaliza espaços e caixa para proteger nomes duplicados",
  );
  assert(canTransitionOperation("DRAFT", "ACTIVE"), "permite ativar uma operação em configuração");
  assert(!canTransitionOperation("DRAFT", "PAUSED"), "não permite pausar uma operação ainda em configuração");
  assert(!canTransitionOperation("ACTIVE", "DRAFT"), "não permite devolver uma operação ativa diretamente ao rascunho");
  assert(canTransitionOperation("ARCHIVED", "ACTIVE"), "permite reativar uma operação arquivada após a revisão");

  const incomplete = evaluateOperationReadiness({
    name: "Snowland",
    description: null,
    clientName: null,
    color: "#6D4AFF",
    icon: "mountain",
    modulesReviewedAt: null,
  }, { teamCount: 0, accessCount: 0, responsibilityCount: 0, linkedLocationCount: 0 });
  assert(!incomplete.ready && incomplete.blockers.length === 4, "bloqueia ativação enquanto faltam dados, equipe, responsáveis e revisão");
  assert(incomplete.items[0]!.message.includes("descrição") && incomplete.items[0]!.message.includes("local aberto"), "o checklist diz item a item o que falta nos dados gerais");

  const complete = evaluateOperationReadiness({
    name: "Snowland",
    description: "Operação artística do parque de neve",
    clientName: "Gramado Parks",
    color: "#6D4AFF",
    icon: "mountain",
    modulesReviewedAt: new Date(),
  }, { teamCount: 0, accessCount: 1, responsibilityCount: 1, linkedLocationCount: 1 });
  assert(complete.ready && complete.blockers.length === 0, "libera ativação quando as cinco etapas estão completas");

  const [{ default: express }, { default: operationsRouter }, { default: locationsRouter }, { signAccessToken }, { pool }] = await Promise.all([
    import("express"),
    import("../src/routes/operations.js"),
    import("../src/routes/areas-locations.js"),
    import("../src/lib/jwt.service.js"),
    import("@workspace/db"),
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api", operationsRouter);
  app.use("/api", locationsRouter);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Não foi possível iniciar o servidor de teste");

  const organizationId = randomUUID();
  // O perfil de acesso é persistido em user_roles. Como o endpoint que o teste
  // exercita cria a operação nova, usamos uma operação de ancoragem somente
  // para que o ADMIN já tenha um perfil válido antes do primeiro request.
  const accessOperationId = randomUUID();
  const adminId = randomUUID();
  const supervisorId = randomUUID();
  const memberId = randomUUID();
  const directorId = randomUUID();
  const semPerfilId = randomUUID();
  const locationIds: string[] = [];
  let createdOperationId: string | null = null;

  try {
    await pool.query(`insert into organizations (id, name) values ($1, $2)`, [organizationId, `Ops Test ${organizationId}`]);
    await pool.query(
      `insert into operations (id, organization_id, name, status) values ($1, $2, $3, 'ACTIVE')`,
      [accessOperationId, organizationId, `Ops Test Access ${organizationId}`],
    );
    await pool.query(
      `insert into users (id, organization_id, nome_completo, nome_de_exibicao, username) values
        ($1, $4, $5, 'Administrador', $6), ($2, $4, $7, 'Supervisor', $8), ($3, $4, $9, 'Membro', $10)`,
      [
        adminId,
        supervisorId,
        memberId,
        organizationId,
        "Administrador Teste",
        `admin.${organizationId}`,
        "Supervisor Teste",
        `supervisor.${organizationId}`,
        "Membro Teste",
        `membro.${organizationId}`,
      ],
    );
    await pool.query(
      `insert into user_roles (user_id, operation_id, role, active) values
        ($1, $4, 'ADMIN', true), ($2, $4, 'SUPERVISOR_A', true), ($3, $4, 'MEMBER', true)`,
      [adminId, supervisorId, memberId, accessOperationId],
    );
    await pool.query(
      `insert into users (id, organization_id, nome_completo, nome_de_exibicao, username) values
        ($1, $3, 'Direção Teste', 'Direção', $4), ($2, $3, 'Sem Perfil Teste', 'Sem perfil', $5)`,
      [directorId, semPerfilId, organizationId, `direcao.${organizationId}`, `semperfil.${organizationId}`],
    );
    await pool.query(`insert into user_roles (user_id, operation_id, role, active) values ($1, $2, 'DIR', true)`, [directorId, accessOperationId]);

    const adminToken = signAccessToken({
      sub: adminId,
      jti: "operation-lifecycle-admin",
      organizationId,
      role: "ADMIN",
      operationIds: [],
    });
    const createResponse = await fetch(`http://127.0.0.1:${address.port}/api/operations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Operação Piloto", status: "ACTIVE" }),
    });
    const createBody = await createResponse.json() as { operation?: { id: string; status: string } };
    createdOperationId = createBody.operation?.id ?? null;
    assert(createResponse.status === 201 && createBody.operation?.status === "DRAFT", "administrador cria operação sempre em configuração");

    const duplicateResponse = await fetch(`http://127.0.0.1:${address.port}/api/operations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "  operação   piloto  " }),
    });
    assert(duplicateResponse.status === 409, "impede nome duplicado mesmo com caixa e espaços diferentes");

    const supervisorToken = signAccessToken({
      sub: supervisorId,
      jti: "operation-lifecycle-supervisor",
      organizationId,
      role: "SUPERVISOR_A",
      operationIds: createdOperationId ? [createdOperationId] : [],
    });
    const supervisorCreateResponse = await fetch(`http://127.0.0.1:${address.port}/api/operations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${supervisorToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Operação do supervisor" }),
    });
    assert(supervisorCreateResponse.status === 403, "supervisor não pode criar operação");

    const memberToken = signAccessToken({
      sub: memberId,
      jti: "operation-lifecycle-member",
      organizationId,
      role: "MEMBER",
      operationIds: createdOperationId ? [createdOperationId] : [],
    });
    const response = await fetch(`http://127.0.0.1:${address.port}/api/operations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Operação sem permissão" }),
    });
    assert(response.status === 403, "membro não pode criar uma operação");

    if (createdOperationId) {
      const supervisorDraftResponse = await fetch(`http://127.0.0.1:${address.port}/api/operations/${createdOperationId}`, {
        headers: { authorization: `Bearer ${supervisorToken}` },
      });
      assert(supervisorDraftResponse.status === 403, "supervisor não enxerga operação ainda em configuração");

      const adminDraftResponse = await fetch(`http://127.0.0.1:${address.port}/api/operations/${createdOperationId}`, {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assert(adminDraftResponse.status === 200, "administrador enxerga operação ainda em configuração");

      const activateResponse = await fetch(`http://127.0.0.1:${address.port}/api/operations/${createdOperationId}/status`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      assert(activateResponse.status === 409, "bloqueia ativação enquanto a configuração está incompleta");

      const base = `http://127.0.0.1:${address.port}/api`;
      const directorToken = signAccessToken({ sub: directorId, jti: "operation-lifecycle-director", organizationId, role: "DIR", operationIds: [accessOperationId] });
      const chamar = async (method: string, path: string, token: string, body?: unknown) => {
        const r = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        return { status: r.status, body: await r.json().catch(() => ({})) as any };
      };

      // Quem vê a tela: Administração e Direção leem, Supervisão e Elenco recebem recusa.
      const visaoAdm = await chamar("GET", "/operations/overview", adminToken);
      assert(visaoAdm.status === 200 && visaoAdm.body.canManage === true, "administração vê a lista de operações e pode alterá-la");
      const piloto = visaoAdm.body.operations?.find((op: any) => op.id === createdOperationId);
      assert(piloto?.status === "DRAFT" && piloto.readiness.items.length === 5 && piloto.readiness.blockers.length === 4, "operação nova aparece em configuração com 4 dos 5 itens do checklist pendentes (a identidade visual já vem com cor e ícone)");
      const visaoDir = await chamar("GET", "/operations/overview", directorToken);
      assert(visaoDir.status === 200 && visaoDir.body.canManage === false, "direção lê a lista, sem poder alterar");
      assert((await chamar("GET", "/operations/overview", supervisorToken)).status === 403, "supervisão não vê a tela de operações");
      assert((await chamar("GET", "/operations/overview", memberToken)).status === 403, "elenco não vê a tela de operações");
      assert((await chamar("PATCH", `/operations/${createdOperationId}`, directorToken, { name: "Direção não edita" })).status === 403, "direção não edita operação");
      assert((await chamar("PATCH", `/operations/${createdOperationId}/status`, directorToken, { status: "ARCHIVED", reason: "x" })).status === 403, "direção não encerra operação");

      // Locais: nascem ligados à operação escolhida, mesmo em configuração, e um local não serve a duas operações.
      const localA = await chamar("POST", "/locations", adminToken, { name: `Local A ${organizationId}`, operationIds: [createdOperationId] });
      const localB = await chamar("POST", "/locations", adminToken, { name: `Local B ${organizationId}`, operationIds: [accessOperationId] });
      assert(localA.status === 201 && localB.status === 201, "cria local já ligado a uma operação em configuração e a uma ativa");
      locationIds.push(localA.body.location.id, localB.body.location.id);
      const roubo = await chamar("PUT", `/operations/${createdOperationId}/locations`, adminToken, { locationIds: [localA.body.location.id, localB.body.location.id] });
      assert(roubo.status === 409 && roubo.body.error === "LOCAL_DE_OUTRA_OPERACAO" && String(roubo.body.message).includes("já é de"), "recusa, com frase clara, ligar a uma operação o local de outra");
      const semUltimo = await chamar("PUT", `/operations/${accessOperationId}/locations`, adminToken, { locationIds: [] });
      assert(semUltimo.status === 409 && semUltimo.body.error === "ULTIMO_LOCAL", "operação ativa não perde o último local aberto");

      // Checklist item a item: some da lista de pendências quando o dado entra.
      await chamar("PATCH", `/operations/${createdOperationId}`, adminToken, { description: "Piloto", clientName: "Cliente Piloto" });
      const acesso = await chamar("POST", `/operations/${createdOperationId}/access`, adminToken, { userIds: [memberId, supervisorId, semPerfilId] });
      assert(acesso.status === 200 && acesso.body.liberadas?.length === 2 && acesso.body.semPerfil?.length === 1, "dá acesso a várias pessoas de uma vez e diz quem ficou de fora por não ter perfil");
      const acessoRepetido = await chamar("POST", `/operations/${createdOperationId}/access`, adminToken, { userIds: [memberId] });
      assert(acessoRepetido.status === 200 && acessoRepetido.body.liberadas.length === 0 && acessoRepetido.body.jaTinham.length === 1, "repetir o acesso não duplica o vínculo");
      assert((await chamar("POST", `/operations/${createdOperationId}/access`, supervisorToken, { userIds: [memberId] })).status === 403, "supervisão não dá acesso a operação");
      await chamar("PATCH", `/operations/${createdOperationId}/setup-review`, adminToken, { reviewed: true });
      const depois = (await chamar("GET", "/operations/overview", adminToken)).body.operations.find((op: any) => op.id === createdOperationId);
      const pendentes = depois.readiness.blockers.map((item: any) => item.key);
      assert(pendentes.length === 1 && pendentes[0] === "RESPONSIBILITIES", "depois de dados, local, pessoas e revisão, só falta a responsabilidade");
      assert(depois.peopleCount === 2 && depois.locationIds.length === 1, "a visão mostra quantas pessoas e quais locais pertencem à operação");

      // Última operação ativa: não dá para pausar ou encerrar.
      const pausarUltima = await chamar("PATCH", `/operations/${accessOperationId}/status`, adminToken, { status: "PAUSED" });
      assert(pausarUltima.status === 409 && pausarUltima.body.error === "LAST_ACTIVE_OPERATION", "não pausa a única operação ativa da casa");

      // Ativar: com o checklist completo a operação vira ativa e quem já existe ganha o perfil nela, sem passo manual.
      const [responsabilidade] = (await pool.query(`insert into responsibilities (org_id, operation_id, owner_id, title, category, active) values ($1, $2, $3, 'Responsável piloto', 'OPERAÇÃO', true) returning id`, [organizationId, createdOperationId, adminId])).rows;
      await pool.query(`insert into responsibility_assignments (responsibility_id, member_id, role, active) values ($1, $2, 'PRIMARY', true)`, [responsabilidade.id, adminId]);
      const ativada = await chamar("PATCH", `/operations/${createdOperationId}/status`, adminToken, { status: "ACTIVE" });
      assert(ativada.status === 200 && ativada.body.operation.status === "ACTIVE", "com o checklist completo, a operação é ativada");
      const papelDaDirecao = await pool.query(`select 1 from user_roles where user_id = $1 and operation_id = $2 and role = 'DIR' and active`, [directorId, createdOperationId]);
      assert(papelDaDirecao.rows.length === 1, "ao ativar, quem já existe na casa ganha o mesmo perfil na operação nova");
      const avisoSupervisao = await pool.query(`select 1 from user_notifications where user_id = $1 and type = 'operation.status'`, [supervisorId]);
      assert(avisoSupervisao.rows.length === 1, "a Supervisão também é avisada quando a operação muda de situação");
      // Fechar o último local aberto de uma operação ativa é recusado, também pela tela Locais.
      const fecharUltimo = await chamar("DELETE", `/locations/${localA.body.location.id}`, adminToken, { reason: "teste" });
      assert(fecharUltimo.status === 409 && fecharUltimo.body.error === "ULTIMO_LOCAL", "não fecha o último local aberto de uma operação ativa");
      const fecharPorPatch = await chamar("PATCH", `/locations/${localA.body.location.id}`, adminToken, { closed: true });
      assert(fecharPorPatch.status === 409, "o mesmo vale ao fechar pela edição do local");

      // Encerrar exige motivo; é lógico (volta); editar encerrada é recusado; reabrir exige motivo.
      assert((await chamar("PATCH", `/operations/${createdOperationId}/status`, adminToken, { status: "ARCHIVED" })).status === 400, "encerrar sem motivo é recusado");
      const encerrada = await chamar("PATCH", `/operations/${createdOperationId}/status`, adminToken, { status: "ARCHIVED", reason: "Piloto cancelado" });
      assert(encerrada.status === 200 && encerrada.body.operation.status === "ARCHIVED", "encerra a operação com motivo");
      assert((await chamar("PATCH", `/operations/${createdOperationId}`, adminToken, { name: "Nome novo" })).status === 409, "operação encerrada não é editada até ser reaberta");
      const verEncerrada = (await chamar("GET", "/operations/overview", adminToken)).body.operations.find((op: any) => op.id === createdOperationId);
      assert(verEncerrada.archivedReason === "Piloto cancelado", "a visão mostra o motivo escrito do encerramento");
      assert((await chamar("PATCH", `/operations/${createdOperationId}/status`, adminToken, { status: "DRAFT" })).status === 400, "reabrir sem motivo é recusado");
      const reaberta = await chamar("PATCH", `/operations/${createdOperationId}/status`, adminToken, { status: "DRAFT", reason: "Voltou a ser planejado" });
      assert(reaberta.status === 200 && reaberta.body.operation.status === "DRAFT", "reabre a operação encerrada, sem perder o que tinha");
      const registro = await pool.query(`select action, metadata from history_events where entity_id = $1 and action like 'operation.status.%' order by created_at`, [createdOperationId]);
      assert(registro.rows.length === 3 && registro.rows.filter((row: any) => row.action !== "operation.status.active").length === 2 && registro.rows.filter((row: any) => row.action !== "operation.status.active").every((row: any) => typeof row.metadata?.reason === "string"), "encerrar e reabrir entraram no Registro, cada um com o motivo");
      const avisos = await pool.query(`select title from user_notifications where user_id = $1 and type = 'operation.status'`, [directorId]);
      assert(avisos.rows.length === 3, "a Direção recebe um aviso por mudança de situação");
      const avisoDoAtor = await pool.query(`select 1 from user_notifications where user_id = $1`, [adminId]);
      assert(avisoDoAtor.rows.length === 0, "quem mudou a situação não recebe aviso dela mesma");
    }
  } finally {
    const todos = [adminId, supervisorId, memberId, directorId, semPerfilId];
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [todos]);
    await pool.query(`delete from security_audit_log where actor_id = any($1::uuid[])`, [todos]);
    // Operações agora gravam no Registro operacional; a fixture remove primeiro
    // as relações e eventos que referenciam seus atores, antes de limpar usuários.
    await pool.query(
      `delete from history_relations where source_event_id in (select id from history_events where org_id = $1 or actor_id = any($2::uuid[]))
        or target_event_id in (select id from history_events where org_id = $1 or actor_id = any($2::uuid[]))`,
      [organizationId, todos],
    );
    await pool.query(
      `delete from history_events where org_id = $1 or actor_id = any($2::uuid[])`,
      [organizationId, todos],
    );
    if (createdOperationId) await pool.query(`delete from responsibilities where operation_id = $1`, [createdOperationId]);
    await pool.query(`delete from operation_locations where location_id = any($1::uuid[])`, [locationIds]);
    await pool.query(`delete from locations where id = any($1::uuid[])`, [locationIds]);
    await pool.query(`delete from user_roles where user_id = any($1::uuid[])`, [todos]);
    if (createdOperationId) {
      await pool.query(`delete from operations where id = $1`, [createdOperationId]);
    }
    await pool.query(`delete from operations where id = $1`, [accessOperationId]);
    await pool.query(`delete from users where id = any($1::uuid[])`, [todos]);
    await pool.query(`delete from organizations where id = $1`, [organizationId]);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }

  if (failures.length > 0) {
    throw new Error(`${failures.length} teste(s) de Operações falharam`);
  }
  console.log(`✓ ${passed} verificações do ciclo de vida de Operações passaram`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
