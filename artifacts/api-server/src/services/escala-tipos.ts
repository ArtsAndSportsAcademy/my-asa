/**
 * Tipos de atividade de um local (0084). A lista é do local e só a Administração a mexe; a Programação e a atividade só de hoje
 * escolhem um tipo dela. Aqui ficam as regras que as rotas dividem: os sete tipos prontos e a conferência de "este tipo vale aqui?".
 */
import { and, eq } from "drizzle-orm";
import { db, escalaTiposTable, type CorDeTipo } from "@workspace/db";

type Exec = typeof db;

/** Os sete tipos da planilha de papel. `chave` é também a cor do tipo (as sete primeiras da lista de cores). */
export const TIPOS_PRONTOS: { chave: CorDeTipo; nome: string }[] = [
  { chave: "gelo", nome: "Treinos e aulas" },
  { chave: "ensaio", nome: "Ensaio e preparação" },
  { chave: "show", nome: "Shows" },
  { chave: "inter", nome: "Interação e personagem" },
  { chave: "prod", nome: "Produção e apoio" },
  { chave: "pausa", nome: "Almoço" },
  { chave: "outra", nome: "Outras atividades" },
];

/** Nome de tipo aceito: de 2 a 40 letras, sem espaços sobrando. Devolve o nome limpo, ou null. */
export const nomeDeTipoValido = (valor: unknown): string | null => {
  if (typeof valor !== "string") return null;
  const nome = valor.trim().replace(/\s+/g, " ");
  return nome.length >= 2 && nome.length <= 40 ? nome : null;
};

export const FRASE_NOME_DE_TIPO = "O nome do tipo precisa ter de 2 a 40 letras.";

/**
 * O tipo escolhido num bloco da Programação ou numa atividade só de hoje vale para aquele local?
 * Devolve a frase da recusa, ou null quando vale. Tipo arquivado só passa quando é o que o bloco já tinha (`jaTinha`): editar o horário
 * de um bloco antigo não pode ser barrado por um tipo que a Administração arquivou depois.
 */
export async function recusaDoTipo(tipoId: string, locationId: string | null, jaTinha: string | null = null, executor: Exec = db): Promise<string | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tipoId)) return "Esse tipo de atividade não existe.";
  const [tipo] = await executor.select({ locationId: escalaTiposTable.locationId, active: escalaTiposTable.active, nome: escalaTiposTable.nome })
    .from(escalaTiposTable).where(eq(escalaTiposTable.id, tipoId)).limit(1);
  if (!tipo || (locationId && tipo.locationId !== locationId)) return "Esse tipo de atividade não existe neste local.";
  if (!tipo.active && tipoId !== jaTinha) return `O tipo "${tipo.nome}" está arquivado. Peça à Administração para desarquivar, ou escolha outro.`;
  return null;
}

/** O tipo já existe e está ativo com este nome (sem contar maiúsculas) no local? Ignora o próprio tipo ao renomear. */
export async function nomeDeTipoEmUso(locationId: string, nome: string, exceto: string | null = null, executor: Exec = db): Promise<boolean> {
  const rows = await executor.select({ id: escalaTiposTable.id, nome: escalaTiposTable.nome }).from(escalaTiposTable)
    .where(and(eq(escalaTiposTable.locationId, locationId), eq(escalaTiposTable.active, true)));
  const alvo = nome.toLocaleLowerCase("pt-BR");
  return rows.some((r) => r.id !== exceto && r.nome.toLocaleLowerCase("pt-BR") === alvo);
}
