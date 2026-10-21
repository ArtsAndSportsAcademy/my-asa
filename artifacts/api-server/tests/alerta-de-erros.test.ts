/**
 * Alerta de erros (Sentry), 21/10/2026: só liga com a chave no ambiente, nunca envia nos testes, e o que sai não leva corpo de
 * requisição, senha, token, cabeçalho de autorização, usuário, nem nome ou mensagem de pessoa.
 *
 * Nada aqui fala com a internet: o transporte do Sentry é trocado por um que só guarda o que SERIA enviado, e o teste lê esse
 * conteúdo procurando os segredos. Não usa o banco.
 */
import express from "express";
import http from "node:http";
import * as Sentry from "@sentry/node";
import { limparErroParaEnvio, erroEsperadoDoApp, limparEndereco } from "@workspace/shared";
import { logger } from "../src/lib/logger.js";
import { alertaDeErrosAtivo, capturarErroNaoTratado, desligarAlertaDeErros, enviarErrosAntesDeResponder, enviarPendentes, iniciarAlertaDeErros } from "../src/lib/alerta-de-erros.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

const SEGREDOS = [
  "Segredo123", "ana.silva@exemplo.com", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.assinaturaMuitoLonga", "Bearer abc.def.ghi",
  "Oi Maria, te vejo no show de sábado", "Quero trocar a folga porque meu filho está doente", "joana-supervisora", "senha-do-login-123",
  "529.982.247-25", "(11) 98765-4321", "cookie-de-sessao-valor", "cabecalho-autorizacao-valor",
];
const vazou = (texto: string) => SEGREDOS.filter((segredo) => texto.includes(segredo));

class ApiError extends Error { constructor(m: string) { super(m); this.name = "ApiError"; } }

async function run() {
  // ── 1. Sem chave nada liga; no teste, nem com chave (sem transporte falso).
  delete process.env.SENTRY_DSN;
  assert(iniciarAlertaDeErros() === false && !alertaDeErrosAtivo(), "sem SENTRY_DSN o alerta não liga");
  process.env.SENTRY_DSN = "https://chavefalsa@o0.ingest.sentry.io/0";
  assert(process.env.MYASA_TEST_RUNNER === "1" && iniciarAlertaDeErros() === false && !alertaDeErrosAtivo(), "no teste, com chave mas sem transporte falso, o alerta não liga (testes nunca enviam)");
  delete process.env.SENTRY_DSN;
  // Sem ligar, capturar não faz nada nem lança.
  logger.error({ err: new Error("não deve ir a lugar nenhum") }, "erro com o alerta desligado");
  assert(true, "erro registrado com o alerta desligado não lança");

  // ── 2. O filtro, direto: um erro de login e um erro de mensagem, cheios de coisa que não pode sair.
  const eventoDeLogin = {
    event_id: "1", level: "error", server_name: "DESKTOP-JOANA",
    exception: { values: [{ type: "Error", value: "Falha ao entrar: ana.silva@exemplo.com senha=Segredo123 Bearer abc.def.ghi", stacktrace: { frames: [{ filename: "auth.ts", lineno: 10, vars: { password: "Segredo123" }, context_line: "const senha = 'Segredo123'", pre_context: ["x"], post_context: ["y"] }] } }] },
    request: { url: "https://my-asa.vercel.app/api/auth/login?token=cabecalho-autorizacao-valor", method: "POST", headers: { authorization: "Bearer abc.def.ghi", cookie: "sessao=cookie-de-sessao-valor" }, cookies: { sessao: "cookie-de-sessao-valor" }, data: { username: "joana-supervisora", password: "senha-do-login-123" }, query_string: "token=cabecalho-autorizacao-valor" },
    user: { email: "ana.silva@exemplo.com", username: "joana-supervisora", ip_address: "10.0.0.1" },
    extra: { corpo: "Oi Maria, te vejo no show de sábado" },
    breadcrumbs: [{ category: "ui.click", message: "Oi Maria, te vejo no show de sábado" }],
    contexts: { os: { name: "Linux" }, perfil: { nome: "Joana" } },
    tags: { environment: "production", pessoa: "joana-supervisora" },
    sdkProcessingMetadata: { normalizedRequest: { headers: { authorization: "Bearer abc.def.ghi" } } },
  };
  const limpoLogin = limparErroParaEnvio(eventoDeLogin) as any;
  const textoLogin = JSON.stringify(limpoLogin);
  assert(vazou(textoLogin).length === 0, `erro de login: nada sensível sobrou (vazou: ${vazou(textoLogin).join(" | ")})`);
  assert(limpoLogin.exception.values[0].type === "Error" && /Falha ao entrar/.test(limpoLogin.exception.values[0].value), "erro de login: o tipo e a frase técnica continuam, para dar para consertar");
  assert(limpoLogin.exception.values[0].stacktrace.frames[0].filename === "auth.ts" && limpoLogin.exception.values[0].stacktrace.frames[0].lineno === 10, "erro de login: o trecho do código (arquivo e linha) continua");
  assert(!("vars" in limpoLogin.exception.values[0].stacktrace.frames[0]) && !("context_line" in limpoLogin.exception.values[0].stacktrace.frames[0]), "variáveis locais e linhas do código-fonte saem");
  assert(limpoLogin.request.url === "https://my-asa.vercel.app/api/auth/login" && !limpoLogin.request.headers && !limpoLogin.request.data && !limpoLogin.request.cookies, "endereço sem a query; sem cabeçalho, corpo nem cookie");
  assert(!limpoLogin.user && !limpoLogin.extra && limpoLogin.breadcrumbs.length === 0 && !limpoLogin.server_name, "sem usuário, dados extras, migalhas de pão nem nome do computador");
  assert(Boolean(eventoDeLogin.request.headers.authorization) && Boolean(eventoDeLogin.user.email), "o filtro devolve uma cópia: o evento original não foi alterado");

  const eventoDeMensagem = {
    level: "error", message: "Falha ao gravar mensagem de Maria",
    exception: { values: [{ type: "DrizzleQueryError", value: 'Failed query: insert into "messages" ("body") values ($1)\nparams: Oi Maria, te vejo no show de sábado,joana-supervisora' }, { type: "error", value: 'duplicate key value violates unique constraint. Key (email)=(ana.silva@exemplo.com) already exists.' }] },
    request: { url: "https://my-asa.vercel.app/api/conversations/3fa85f64-5717-4562-b2fc-2c963f66afa6/messages", method: "POST", data: { text: "Quero trocar a folga porque meu filho está doente" } },
  };
  const limpoMensagem = limparErroParaEnvio(eventoDeMensagem) as any;
  const textoMensagem = JSON.stringify(limpoMensagem);
  assert(vazou(textoMensagem).length === 0, `erro de mensagem: nada sensível sobrou (vazou: ${vazou(textoMensagem).join(" | ")})`);
  assert(/Failed query: insert into "messages"/.test(limpoMensagem.exception.values[0].value) && /params: \[ocultos\]/.test(limpoMensagem.exception.values[0].value), "erro de mensagem: a consulta que falhou fica, os parâmetros viram [ocultos]");
  assert(/Key \(\[campo\]\)=\(\[valor\]\)/.test(limpoMensagem.exception.values[1].value), "o valor do Postgres ('Key (campo)=(valor)') é escondido");
  assert(limpoMensagem.request.url.endsWith("/api/conversations/:id/messages"), "id da conversa na URL vira :id");
  assert(limparEndereco("/a/b?x=1#z") === "/a/b", "endereço: query e fragmento saem");
  assert(erroEsperadoDoApp({ exception: { values: [{ type: "ApiError", value: "Sem permissão" }] } }) && erroEsperadoDoApp({ exception: { values: [{ type: "TypeError", value: "Failed to fetch" }] } }) && !erroEsperadoDoApp({ exception: { values: [{ type: "TypeError", value: "x is undefined" }] } }), "erro esperado do app (recusa, rede fora) não vai para o alerta; defeito de código vai");

  // ── 3. Ponta a ponta com transporte falso: tudo o que o Sentry ia enviar fica guardado e é inspecionado.
  const enviados: unknown[] = [];
  const ligou = iniciarAlertaDeErros({
    dsn: "https://chavefalsa@o0.ingest.sentry.io/0",
    transport: () => ({ send: async (envelope: unknown) => { enviados.push(envelope); return { statusCode: 200 }; }, flush: async () => true }),
  });
  assert(ligou && alertaDeErrosAtivo(), "com chave e transporte de teste o alerta liga");

  // Sujeira de propósito em tudo o que o Sentry coleta por conta própria.
  Sentry.setUser({ email: "ana.silva@exemplo.com", username: "joana-supervisora" });
  Sentry.setExtra("corpo", "Oi Maria, te vejo no show de sábado");
  Sentry.setTag("pessoa", "joana-supervisora");
  Sentry.addBreadcrumb({ category: "http", message: "Quero trocar a folga porque meu filho está doente", data: { authorization: "Bearer abc.def.ghi" } });
  Sentry.getIsolationScope().setSDKProcessingMetadata({ normalizedRequest: { headers: { authorization: "Bearer abc.def.ghi", cookie: "sessao=cookie-de-sessao-valor" }, data: { password: "senha-do-login-123" } } });

  // O caminho real do servidor: um log.error({ err }) vira alerta.
  logger.error({ err: new Error("Falha ao entrar: ana.silva@exemplo.com senha=Segredo123 Bearer abc.def.ghi"), senha: "senha-do-login-123", corpo: "Oi Maria, te vejo no show de sábado" }, "login falhou");
  const erroDeConsulta = new Error('Failed query: insert into "messages" ("body") values ($1)\nparams: Oi Maria, te vejo no show de sábado');
  erroDeConsulta.name = "DrizzleQueryError";
  logger.error({ err: erroDeConsulta }, "mensagem falhou");
  logger.error({ err: new ApiError("Recusado: joana-supervisora") }, "erro esperado");
  await enviarPendentes(5000);
  const tudo = JSON.stringify(enviados);
  assert(enviados.length >= 2, `os dois erros reais foram para o transporte (enviados: ${enviados.length})`);
  assert(tudo.includes("Falha ao entrar") && tudo.includes("DrizzleQueryError"), "o que sai diz o que quebrou");
  assert(vazou(tudo).length === 0, `ponta a ponta: nada sensível no que seria enviado (vazou: ${vazou(tudo).join(" | ")})`);
  // `modules` é só a lista de pacotes e versões do app (ex.: "cookie-parser"); não é dado de pessoa e fica de fora desta checagem.
  const semModulos = JSON.stringify(enviados, (chave, valor) => chave === "modules" ? undefined : valor);
  assert(!/"user"\s*:/.test(semModulos) && !/authorization/i.test(semModulos) && !/cookie/i.test(semModulos), "ponta a ponta: sem usuário, sem cabeçalho de autorização, sem cookie");
  assert(!tudo.includes("Recusado: joana"), "erro esperado do app (ApiError) não vai");

  // ── 4. Na Vercel a resposta espera o envio: quando a resposta chega, o erro já está no transporte.
  const antes = enviados.length;
  const app = express();
  app.use(enviarErrosAntesDeResponder);
  app.get("/boom", () => { throw new Error("explodiu de verdade"); });
  app.get("/ok", (_req, res) => { res.json({ ok: true }); });
  app.use(capturarErroNaoTratado);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(500).json({ error: "ERRO" }); });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const porta = (server.address() as { port: number }).port;
  try {
    const resposta = await fetch(`http://127.0.0.1:${porta}/boom`);
    assert(resposta.status === 500 && enviados.length > antes && JSON.stringify(enviados).includes("explodiu de verdade"), "erro não tratado: a resposta só termina depois de o erro ser enviado");
    const normal = await fetch(`http://127.0.0.1:${porta}/ok`);
    assert(normal.status === 200 && (await normal.json() as { ok: boolean }).ok === true, "requisição sem erro responde normalmente, sem espera");
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  await desligarAlertaDeErros();
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no alerta de erros`);
  process.stdout.write(`alerta-de-erros: ${passed} asserts passed\n`);
}

process.stdout.write("alerta-de-erros: starting\n");
run().catch((error) => { console.error(error); process.exitCode = 1; });
