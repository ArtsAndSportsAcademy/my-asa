/**
 * Filtro do que sai do app para o serviço de alerta de erros (Sentry), usado pelo servidor e pelo site.
 *
 * A regra de ouro: um alerta de erro diz ONDE quebrou (tipo do erro, frase técnica, trecho do código, qual tela), nunca QUEM era a
 * pessoa nem O QUE ela escreveu. Por isso o filtro é uma lista do que SOBREVIVE, não do que se apaga: cabeçalhos, cookies, corpo da
 * requisição, endereço com query, usuário, dados extras, migalhas de pão e variáveis locais não entram, em hipótese alguma.
 * Do texto da frase do erro saem ainda e-mail, token, senha, documento, telefone, códigos longos, os parâmetros de uma consulta
 * ao banco que falhou e o "Key (campo)=(valor)" do Postgres.
 *
 * Não depende do Sentry: recebe e devolve o evento como objeto simples, para poder ser testado sem enviar nada.
 */

const SUBSTITUICOES: [RegExp, string][] = [
  // Parâmetros de consulta que falhou (o Drizzle põe "params: ..." no fim da frase; ali ficam senha, mensagem, motivo de falta).
  [/\s*params:[\s\S]*$/i, " params: [ocultos]"],
  // Detalhe do Postgres: Key (email)=(fulano@x.com) already exists.
  [/Key \([^)]*\)=\([^)]*\)/gi, "Key ([campo])=([valor])"],
  [/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{4,}/g, "[token]"],
  [/\bBearer\s+[\w.~+/=-]+/gi, "Bearer [oculto]"],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail]"],
  [/\b(senha|password|passwd|secret|token|authorization|chave|apikey|api_key)(["']?\s*[:=]\s*)["']?[^\s,;"'}]+/gi, "$1$2[oculto]"],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[documento]"],
  [/(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, "[telefone]"],
  // Códigos longos (chaves, hashes, ids): 32 ou mais letras/números/-/_ seguidos.
  [/[A-Za-z0-9+/_-]{32,}={0,2}/g, "[código]"],
];

export function limparTexto(texto: string): string {
  return SUBSTITUICOES.reduce((atual, [padrao, troca]) => atual.replace(padrao, troca), texto);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Só o caminho do endereço: sem ?query, sem #fragmento, e id de pessoa/coisa vira ":id". */
export function limparEndereco(url: string): string {
  const semQuery = url.split(/[?#]/)[0] ?? "";
  return semQuery.replace(UUID, ":id");
}

type Objeto = Record<string, unknown>;
const ehObjeto = (valor: unknown): valor is Objeto => typeof valor === "object" && valor !== null && !Array.isArray(valor);

/** Do contexto só o que descreve a máquina (sistema, navegador, versão), nada que descreva a pessoa. */
const CONTEXTOS_QUE_FICAM = ["os", "runtime", "browser", "device", "app", "culture", "trace"];
/** Etiquetas que o próprio app coloca; as outras (que podem trazer quem fez a coisa) saem. */
const ETIQUETAS_QUE_FICAM = ["environment", "release", "runtime", "runtime.name", "browser", "browser.name", "os", "os.name", "handled", "mechanism", "level", "server_name_hidden", "transaction"];

function limparExcecoes(excecao: unknown): unknown {
  if (!ehObjeto(excecao) || !Array.isArray(excecao.values)) return excecao;
  return {
    ...excecao,
    values: excecao.values.map((valor) => {
      if (!ehObjeto(valor)) return valor;
      const limpo: Objeto = { ...valor };
      if (typeof limpo.value === "string") limpo.value = limparTexto(limpo.value);
      if (ehObjeto(limpo.stacktrace) && Array.isArray(limpo.stacktrace.frames)) {
        limpo.stacktrace = { ...limpo.stacktrace, frames: limpo.stacktrace.frames.map((quadro) => {
          if (!ehObjeto(quadro)) return quadro;
          const { vars: _variaveis, pre_context: _antes, post_context: _depois, context_line: _linha, ...resto } = quadro;
          return resto;
        }) };
      }
      return limpo;
    }),
  };
}

/** Devolve uma cópia do evento só com o que pode sair. Nunca devolve o objeto original alterado. */
export function limparErroParaEnvio<T>(evento: T): T {
  if (!ehObjeto(evento)) return evento;
  const limpo: Objeto = { ...evento };

  // Tudo o que descreve a pessoa ou o que ela mandou.
  for (const campo of ["user", "extra", "breadcrumbs", "sdkProcessingMetadata", "attachments", "spans", "request_session", "debug_meta"]) delete limpo[campo];
  limpo.breadcrumbs = [];

  if (ehObjeto(limpo.request)) {
    const url = typeof limpo.request.url === "string" ? limparEndereco(limpo.request.url) : undefined;
    limpo.request = { ...(url ? { url } : {}), ...(typeof limpo.request.method === "string" ? { method: limpo.request.method } : {}) };
  }
  if (ehObjeto(limpo.contexts)) {
    limpo.contexts = Object.fromEntries(Object.entries(limpo.contexts).filter(([nome]) => CONTEXTOS_QUE_FICAM.includes(nome)));
  }
  if (ehObjeto(limpo.tags)) {
    limpo.tags = Object.fromEntries(Object.entries(limpo.tags).filter(([nome]) => ETIQUETAS_QUE_FICAM.includes(nome)));
  }
  if (typeof limpo.message === "string") limpo.message = limparTexto(limpo.message);
  if (ehObjeto(limpo.logentry)) {
    limpo.logentry = { ...limpo.logentry, ...(typeof limpo.logentry.message === "string" ? { message: limparTexto(limpo.logentry.message) } : {}), params: undefined };
  }
  if (typeof limpo.transaction === "string") limpo.transaction = limparEndereco(limpo.transaction);
  if ("exception" in limpo) limpo.exception = limparExcecoes(limpo.exception);
  // O nome do computador não diz nada de útil e, em máquina de pessoa, costuma ser o nome dela.
  delete limpo.server_name;
  return limpo as T;
}

/**
 * Erros que o app já espera e mostra à pessoa com uma frase (recusa, validação, rede fora do ar) não são defeito de código:
 * não vão para o alerta. Além de cortar ruído, impede que a frase de uma recusa (que pode citar um nome) saia do app.
 */
const FRASES_DE_REDE = /^(failed to fetch|load failed|networkerror|the network connection was lost|network request failed|resizeobserver loop)/i;
export function erroEsperadoDoApp(evento: unknown): boolean {
  if (!ehObjeto(evento) || !ehObjeto(evento.exception) || !Array.isArray(evento.exception.values)) return false;
  return evento.exception.values.some((valor) => {
    if (!ehObjeto(valor)) return false;
    const tipo = typeof valor.type === "string" ? valor.type : "";
    const frase = typeof valor.value === "string" ? valor.value : "";
    return tipo === "ApiError" || tipo === "AbortError" || FRASES_DE_REDE.test(frase);
  });
}
