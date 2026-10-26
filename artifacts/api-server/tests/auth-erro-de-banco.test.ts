/**
 * Erro de banco no meio da autenticação não é "sessão vencida".
 * Token ruim continua 401; banco fora responde 503 com frase, para a tela não deslogar ninguém.
 * Chama o middleware direto, trocando por um instante a consulta do usuário por uma que falha.
 */
import jwt from "jsonwebtoken";
import { db, pool } from "@workspace/db";
import { requireAuth } from "../src/middlewares/auth.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function chamar(token: string) {
  const res: { status?: number; body?: { error?: string; message?: string } } = {};
  const resposta = {
    status(code: number) { res.status = code; return resposta; },
    json(body: { error?: string; message?: string }) { res.body = body; return resposta; },
  };
  let seguiu = false;
  await requireAuth({ headers: { authorization: `Bearer ${token}` } } as never, resposta as never, () => { seguiu = true; });
  return { ...res, seguiu };
}

async function run() {
  const lixo = await chamar("isso-nao-e-um-token");
  assert(lixo.status === 401 && !lixo.seguiu, "token que não é token: 401");

  const assinadoPorOutro = await chamar(jwt.sign({ sub: "x", type: "access" }, "outra-chave"));
  assert(assinadoPorOutro.status === 401, "token assinado com outra chave: 401");

  const bom = signAccessToken({ sub: "00000000-0000-4000-8000-000000000001", username: "x", role: "MEMBER", organizationId: null } as never);
  const consulta = db.query.usersTable;
  const original = consulta.findFirst;
  (consulta as { findFirst: unknown }).findFirst = () => { throw new Error("connection terminated unexpectedly"); };
  try {
    const caiu = await chamar(bom);
    assert(caiu.status === 503, `banco fora responde 503 (veio ${caiu.status})`);
    assert(/banco agora/i.test(caiu.body?.message ?? ""), "e a frase fala do banco, em português");
    assert(!caiu.seguiu, "e a chamada não segue");
  } finally {
    (consulta as { findFirst: unknown }).findFirst = original;
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s)`);
  process.stdout.write(`auth-erro-de-banco: ${passed} asserts passed\n`);
}

try { await run(); } catch (e) { console.error(e); process.exitCode = 1; } finally { await pool.end(); }
