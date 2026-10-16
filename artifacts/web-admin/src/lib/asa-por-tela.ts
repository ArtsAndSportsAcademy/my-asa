/**
 * A ASA "mora" em cada tela: os pedidos prontos (chips) mudam com a tela e com quem está usando,
 * e a pose dela acompanha o que está acontecendo na conversa.
 * Toda frase aqui precisa ser uma que o motor (api-server/services/asa-command-engine.ts) entende.
 */

export type ChipsDaTela = { todos: string[]; gerencia?: string[] };

const AQUI = "O que tenho aqui?";

/** Telas atuais do site. Quem é da gerência (Administração, Supervisão, Direção) ganha os pedidos da equipe. */
const CHIPS: Record<string, ChipsDaTela> = {
  "/meu-dia": { todos: [AQUI, "Minhas tarefas pendentes", "Tenho notificações não lidas?"], gerencia: [AQUI, "Quem está de folga hoje?", "Mostra os check-ins da equipe hoje"] },
  "/escalas": { todos: [AQUI, "Mostra minha escala dessa semana"], gerencia: [AQUI, "Quem está de folga hoje?", "Mostra minha escala dessa semana"] },
  "/folgas": { todos: [AQUI, "Quais são minhas folgas?", "Minhas solicitações"], gerencia: [AQUI, "Quem está de folga hoje?", "Quais são minhas folgas?"] },
  "/solicitacoes": { todos: [AQUI, "Minhas solicitações", "Quais são minhas folgas?"], gerencia: [AQUI, "Quem está de folga hoje?", "Minhas solicitações"] },
  "/livro-do-dia": { todos: [AQUI, "Mostra o Livro do Dia de hoje"] },
  "/shows": { todos: [AQUI, "Quais Livros do Show estão disponíveis?"] },
  "/check-in": { todos: [AQUI, "Meu check-in hoje"], gerencia: [AQUI, "Mostra os check-ins da equipe hoje", "Meu check-in hoje"] },
  "/painel": { todos: [AQUI, "Mostra o Livro do Dia de hoje"], gerencia: [AQUI, "Mostra os check-ins da equipe hoje", "Quem está de folga hoje?"] },
  "/responsabilidades": { todos: [AQUI, "Quais são minhas tarefas pendentes?"], gerencia: [AQUI, "Mostra as tarefas pendentes da equipe", "Mostre as responsabilidades da equipe"] },
  "/agenda": { todos: [AQUI, "Mostra a agenda", "Quais são minhas propostas de reunião?"] },
  "/pessoas": { todos: [AQUI, "Quem está de folga hoje?"] },
  "/areas": { todos: [AQUI, "Mostrar locais"] },
  "/locais": { todos: [AQUI, "Mostrar locais"] },
  "/mural": { todos: [AQUI, "Mostra o Mural"] },
  "/mensagens": { todos: ["Minhas mensagens não lidas", AQUI] },
  "/biblioteca": { todos: ["Quais leituras estão pendentes na Biblioteca?", "Buscar na biblioteca"] },
  "/registro": { todos: ["Mostra o Mural", "Minhas notificações não lidas"] },
  "/perfil": { todos: ["Quais são minhas tarefas?", "Tenho notificações não lidas?"] },
};

/** Chips da tela, ou `null` quando a tela não tem lista própria (o assistente usa a lista antiga). */
export function chipsDaTela(rota: string, gerencia: boolean): string[] | null {
  const tela = CHIPS[rota];
  if (!tela) return null;
  return (gerencia && tela.gerencia) || tela.todos;
}

/** Nome do arquivo da pose em /asa/ (sem extensão). */
export type PoseDaAsa = "atencao" | "aviso-importante" | "bom-dia" | "consultando" | "duvida" | "estudando" | "lembrete" | "oi"
  | "olhos-de-estrela" | "pensativa" | "sonolenta" | "tarefa-concluida" | "travessa" | "vencemos";

/** Primeira abertura da conversa: saúda conforme a hora (a hora vem de getAsaPresenceState). */
export function poseDeSaudacao(presenca: string): PoseDaAsa {
  return presenca === "bomdia" ? "bom-dia" : presenca === "boanoite" ? "sonolenta" : "oi";
}

type Mensagem = { content: string; pending?: boolean; failed?: boolean; proposal?: { state: string; expiresAt: string } };

/**
 * Pose da resposta da ASA, por momento:
 * buscando → consultando · prévia esperando o "sim" → duvida · feito → tarefa-concluida ·
 * prévia cancelada ou vencida → pensativa · não entendi → pensativa · deu erro → atencao · o resto → oi.
 */
export function poseDaResposta(mensagem: Mensagem, agora = Date.now()): PoseDaAsa {
  if (mensagem.pending) return "consultando";
  if (mensagem.failed) return "atencao";
  const proposta = mensagem.proposal;
  if (proposta) {
    if (proposta.state === "CONFIRMED") return "tarefa-concluida";
    if (proposta.state === "PENDING" && Date.parse(proposta.expiresAt) > agora) return "duvida";
    return "pensativa";
  }
  if (/^Ainda não sei/.test(mensagem.content)) return "pensativa";
  return "oi";
}
