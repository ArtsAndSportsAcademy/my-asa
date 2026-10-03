// Guarda só na memória desta aba a senha provisória digitada na entrada, para o
// primeiro acesso pedir apenas a senha nova (desenho 01). Nada vai para o disco:
// ao recarregar a página ela some e a tela volta a pedir a senha provisória.
let senha: string | null = null;

export const lembrarSenhaDaEntrada = (valor: string) => { senha = valor; };
export const senhaDaEntrada = () => senha;
export const esquecerSenhaDaEntrada = () => { senha = null; };

/** Regra da senha (desenho 01 e servidor): pelo menos 8 caracteres, com uma letra e um número. */
export const regrasDaSenha = (nova: string, repetida: string) => [
  { ok: nova.length >= 8, texto: "pelo menos 8 caracteres" },
  { ok: /\p{L}/u.test(nova) && /\d/.test(nova), texto: "uma letra e um número" },
  { ok: nova.length > 0 && nova === repetida, texto: "as duas iguais" },
];
