// Servidor local usado apenas na auditoria descartável via interface.
// Diferente de runtime.ts, não inicia schedulers nem workers de entrega.
import app from "../dist/index.mjs";

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) throw new Error("PORT inválida para QA E2E.");

app.listen(port, () => console.log(`qa-api-listening:${port}`));
