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
    locations: [],
    color: "#6D4AFF",
    icon: "mountain",
    modulesReviewedAt: null,
  }, 0, 0);
  assert(!incomplete.ready && incomplete.blockers.length === 4, "bloqueia ativação enquanto faltam dados, equipe, responsáveis e revisão");

  const complete = evaluateOperationReadiness({
    name: "Snowland",
    description: "Operação artística do parque de neve",
    clientName: "Gramado Parks",
    locations: ["Snowland"],
    color: "#6D4AFF",
    icon: "mountain",
    modulesReviewedAt: new Date(),
  }, 1, 1);
  assert(complete.ready && complete.blockers.length === 0, "libera ativação quando as cinco etapas estão completas");

  const [{ default: express }, { default: operationsRouter }, { signAccessToken }, { pool }] = await Promise.all([
    import("express"),
    import("../src/routes/operations.js"),
    import("../src/lib/jwt.service.js"),
    import("@workspace/db"),
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api", operationsRouter);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Não foi possível iniciar o servidor de teste");

  const organizationId = randomUUID();
  const adminId = randomUUID();
  const supervisorId = randomUUID();
  const memberId = randomUUID();
  let createdOperationId: string | null = null;

  try {
    await pool.query(`insert into organizations (id, name) values ($1, $2)`, [organizationId, `Ops Test ${organizationId}`]);
    await pool.query(
      `insert into users (id, organization_id, name, username) values ($1, $4, $5, $6), ($2, $4, $7, $8), ($3, $4, $9, $10)`,
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
    }
  } finally {
    await pool.query(`delete from security_audit_log where actor_id = any($1::uuid[])`, [[adminId, supervisorId, memberId]]);
    if (createdOperationId) {
      await pool.query(`delete from operations where id = $1`, [createdOperationId]);
    }
    await pool.query(`delete from users where id = any($1::uuid[])`, [[adminId, supervisorId, memberId]]);
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
