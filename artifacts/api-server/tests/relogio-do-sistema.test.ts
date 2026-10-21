/**
 * Vigia do relógio do sistema (21/10/2026): o ciclo por minuto passa a anotar quando rodou; se passar de 3 minutos, a Administração
 * recebe UM aviso por parada (sino + Registro), o endereço público /api/saude responde 503 e a faixa do Painel liga; ao voltar,
 * a faixa some e a Administração recebe o aviso de que voltou.
 *
 * O ciclo de verdade varre o banco inteiro e é lento demais para um teste: aqui o vigia é chamado como o ciclo o chama
 * (registrarCicloBemSucedido) e a parada é simulada recuando o instante registrado no banco, igual ao que se faz para ver a faixa na tela.
 */
import http from "node:http";
import { eq, inArray } from "drizzle-orm";
import { db, pool, organizationsTable, operationsTable, relogioDoSistemaTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { LIMITE_DO_RELOGIO_SEGUNDOS, registrarCicloBemSucedido, registrarCicloComFalha, registrarInicioDoCiclo } from "../src/services/relogio-do-sistema.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

/** Recua o último ciclo bom (e limpa a marca de parada), como se o relógio tivesse parado há `minutos`. */
const pararHa = (minutos: number) => pool.query(
  `update relogio_do_sistema set ultimo_sucesso_em = now() - make_interval(mins => $1), parado_desde = null where chave = 'ciclo'`, [minutos]);

async function run() {
  const tag = `relogio_${Date.now()}`;
  const inicio = new Date();
  const guardado = (await db.select().from(relogioDoSistemaTable).where(eq(relogioDoSistemaTable.chave, "ciclo")))[0] ?? null;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const mk = async (name: string, role: "ADMIN" | "SUPERVISOR_A" | "DIR" | "MEMBER") => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name, username: `${tag}_${name}`.toLowerCase() }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: operation!.id, role, active: true });
    return u!;
  };
  const admin = await mk("Admin", "ADMIN");
  const sup = await mk("Sup", "SUPERVISOR_A");
  const dir = await mk("Dir", "DIR");
  const mem = await mk("Mem", "MEMBER");
  const everyone = [admin, sup, dir, mem].map((u) => u.id);

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const tokenDe = (u: { id: string; organizationId: string }, role: string) => signAccessToken({ sub: u.id, jti: `${tag}_${Math.random()}`, organizationId: u.organizationId, role, operationIds: [operation!.id] } as any);
    const t = { admin: tokenDe(admin, "ADMIN"), sup: tokenDe(sup, "SUPERVISOR_A"), dir: tokenDe(dir, "DIR"), mem: tokenDe(mem, "MEMBER") };
    const chamar = async (path: string, access?: string) => {
      const r = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(90_000), headers: access ? { authorization: `Bearer ${access}` } : {} });
      const texto = await r.text();
      return { status: r.status, texto, body: (() => { try { return JSON.parse(texto); } catch { return {}; } })() as any };
    };
    const avisosDe = async (tipo: string) => Number((await pool.query(`select count(*)::int n from user_notifications where type = $1 and user_id = $2`, [tipo, admin.id])).rows[0].n);
    const avisosTotais = async (tipo: string) => Number((await pool.query(`select count(*)::int n from user_notifications where type = $1 and created_at >= $2`, [tipo, inicio])).rows[0].n);
    const eventosNaCasa = async (acao: string) => Number((await pool.query(`select count(*)::int n from history_events where org_id = $1 and action = $2`, [org!.id, acao])).rows[0].n);
    const administradoresAtivos = Number((await pool.query(
      `select count(distinct u.id)::int n from users u join user_roles r on r.user_id = u.id where u.status = 'ACTIVE' and r.role = 'ADMIN' and r.active`)).rows[0].n);

    // ── 1. Antes de qualquer ciclo anotado: nada de alarme falso, e o /healthz de sempre continua igual.
    await pool.query(`delete from relogio_do_sistema where chave = 'ciclo'`);
    const vazio = await chamar("/saude");
    assert(vazio.status === 200 && vazio.body.relogio?.situacao === "sem_registro", "sem nenhum ciclo anotado: 200 e 'sem_registro' (não é alarme)");
    assert(await avisosDe("relogio.parou") === 0, "sem registro não avisa a Administração");
    const antigo = await chamar("/healthz");
    assert(antigo.status === 200 && JSON.stringify(antigo.body) === JSON.stringify({ status: "ok" }), "o /healthz continua devolvendo só { status: 'ok' }");

    // ── 2. Um ciclo que começa e termina bem: em dia.
    await registrarInicioDoCiclo();
    assert(await registrarCicloBemSucedido() === null, "ciclo bom sem parada anterior não devolve 'voltou'");
    const emDia = await chamar("/saude");
    assert(emDia.status === 200 && emDia.body.status === "ok" && emDia.body.relogio.situacao === "em_dia", "ciclo recente: /saude responde 200 'ok' e 'em_dia'");
    assert(typeof emDia.body.relogio.segundosDesdeUltimoCiclo === "number" && emDia.body.relogio.segundosDesdeUltimoCiclo < 60, "/saude diz há quantos segundos o ciclo rodou");
    assert(emDia.body.relogio.limiteSegundos === LIMITE_DO_RELOGIO_SEGUNDOS && LIMITE_DO_RELOGIO_SEGUNDOS === 180, "o limite é de 3 minutos");
    assert((await chamar("/painel/relogio", t.admin)).body.parado === false, "Painel: relógio em dia, sem faixa");

    // ── 3. O endereço público não revela nada de pessoas.
    const chaves = (o: object) => Object.keys(o).sort().join(",");
    assert(chaves(emDia.body) === "banco,relogio,status" && chaves(emDia.body.relogio) === "limiteSegundos,segundosDesdeUltimoCiclo,situacao", "/saude só tem os campos combinados");
    assert(![tag, admin.id, org!.id].some((trecho) => emDia.texto.includes(trecho)), "/saude não traz nome, id nem casa de ninguém");

    // ── 4. Falha do ciclo só é anotada: o relógio "bate", mas o erro fica registrado.
    await registrarCicloComFalha();
    const comErro = (await pool.query(`select ultimo_erro_em, ultimo_sucesso_em from relogio_do_sistema where chave = 'ciclo'`)).rows[0];
    assert(Boolean(comErro.ultimo_erro_em) && Boolean(comErro.ultimo_sucesso_em), "falha do ciclo anota o erro sem apagar o último sucesso");

    // ── 5. Parou há 10 minutos: 503, UM aviso por administrador (mesmo com várias chamadas ao mesmo tempo), um evento no Registro.
    await pararHa(10);
    const antesParou = await avisosTotais("relogio.parou");
    const rajada = await Promise.all([chamar("/saude"), chamar("/saude"), chamar("/saude"), chamar("/painel/relogio", t.admin)]);
    assert(rajada[0]!.status === 503 && rajada[0]!.body.status === "relogio_parado" && rajada[0]!.body.relogio.situacao === "parado", "relógio parado: /saude responde 503 'relogio_parado'");
    assert(await avisosDe("relogio.parou") === 1, "a Administração recebe UM aviso, mesmo com quatro verificações ao mesmo tempo");
    assert(await avisosTotais("relogio.parou") - antesParou === administradoresAtivos, "o aviso vai para cada administrador ativo, uma vez só");
    assert(await eventosNaCasa("relogio.parou") === 1, "entrou no Registro da casa, uma vez");
    const aviso = (await pool.query(`select title, message, action_url, category from user_notifications where type = 'relogio.parou' and user_id = $1`, [admin.id])).rows[0];
    assert(/parou há \d+ minutos: check-ins e lembretes podem não ter saído/.test(aviso.message) && aviso.action_url === "/painel", "o aviso diz o que parou, há quanto tempo e leva ao Painel");
    assert(Number(/há (\d+) minutos/.exec(aviso.message)?.[1]) >= 10, "o aviso conta os minutos de verdade (≥ 10 para um ciclo de 10 minutos atrás)");
    await Promise.all([chamar("/saude"), chamar("/saude")]);
    await new Promise((r) => setTimeout(r, 200));
    assert(await avisosDe("relogio.parou") === 1, "mais verificações durante a mesma parada não geram aviso novo (um por parada, não um por minuto)");

    // ── 6. A faixa do Painel: Administração e Direção veem; Supervisão e Elenco recebem um "não" que explica.
    const faixa = await chamar("/painel/relogio", t.admin);
    assert(faixa.status === 200 && faixa.body.parado === true && faixa.body.minutosParado >= 10, "Painel: a faixa liga e diz os minutos parados");
    assert((await chamar("/painel/relogio", t.dir)).body.parado === true, "Painel: a Direção também vê a faixa");
    const recusaSup = await chamar("/painel/relogio", t.sup);
    assert(recusaSup.status === 403 && /Administração|Direção/.test(recusaSup.body.message ?? ""), "Supervisão: 403 com frase que diz quem pode");
    assert((await chamar("/painel/relogio", t.mem)).status === 403, "Elenco: 403");
    assert((await chamar("/painel/relogio")).status === 401, "sem entrar: 401");

    // ── 7. O ciclo volta: faixa some, UM aviso de volta, Registro; o segundo ciclo bom não repete.
    const antesVoltou = await avisosTotais("relogio.voltou");
    const minutos = await registrarCicloBemSucedido();
    assert(minutos !== null && minutos >= 10, "o primeiro ciclo bom depois da parada informa quantos minutos ficou parado");
    assert(await avisosDe("relogio.voltou") === 1 && await avisosTotais("relogio.voltou") - antesVoltou === administradoresAtivos, "a Administração recebe o aviso de que voltou, uma vez");
    assert(await eventosNaCasa("relogio.voltou") === 1, "a volta entra no Registro");
    assert((await chamar("/painel/relogio", t.admin)).body.parado === false, "Painel: a faixa some");
    assert((await chamar("/saude")).status === 200, "/saude volta a 200");
    assert(await registrarCicloBemSucedido() === null && await avisosDe("relogio.voltou") === 1, "o ciclo seguinte não repete o aviso de volta");

    // ── 8. Uma NOVA parada depois da volta avisa de novo (um por parada).
    await pararHa(5);
    await chamar("/saude");
    assert(await avisosDe("relogio.parou") === 2, "uma segunda parada gera o seu próprio aviso");
    assert((await chamar("/saude")).status === 503, "e /saude volta a 503 enquanto durar");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await pool.query(`delete from user_notifications where type in ('relogio.parou','relogio.voltou') and created_at >= $1`, [inicio]);
    await pool.query(`delete from history_events where action in ('relogio.parou','relogio.voltou') and occurred_at >= $1`, [inicio]);
    await pool.query(`delete from relogio_do_sistema where chave = 'ciclo'`);
    if (guardado) await db.insert(relogioDoSistemaTable).values(guardado);
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, everyone));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no vigia do relógio`);
  process.stdout.write(`relogio-do-sistema: ${passed} asserts passed\n`);
}

process.stdout.write("relogio-do-sistema: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
