import http from "node:http";

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

  try {
    const memberToken = signAccessToken({
      sub: "00000000-0000-4000-8000-000000000001",
      jti: "operation-lifecycle-member",
      organizationId: "00000000-0000-4000-8000-000000000002",
      role: "MEMBER",
      operationIds: [],
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
  } finally {
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
