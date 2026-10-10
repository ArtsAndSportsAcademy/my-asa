/** Cadastro aprovado em docs/continuar-daqui.md. Usa as rotas que gravam Registro e versões.
 * Sem --aplicar, apenas confere e mostra o plano. A credencial fica somente no ambiente.
 * Não publica nem altera Livros do Dia já criados.
 */
import { pathToFileURL } from "node:url";

export const regrasNoiteAlema = "Regras da Noite Alemã (conferência manual): Dani (Daniele) ou Daia (Daiane) sempre precisam estar como Frida. Amanda e Daia não podem fazer juntas porque nenhuma das duas fala alemão. Antônio só pode fazer quando está de férias da escola. O rodízio não aplica estas restrições automaticamente; confira a dupla e quem fará Frida antes de publicar o dia.";

export const cadastro = [
  { local: "Buona", show: "Palhacinhos", vagas: ["Palhacinhos 1", "Palhacinhos 2", "Palhacinhos 3"], fila: ["Julia", "Isadora", "Vinícius", "Victor Massalai", "Antônio", "Junior"] },
  { local: "Buona", show: "Antonella", vagas: ["Antonella"], fila: ["Louis", "Amanda", "Cássia", "Luize", "Mariela"] },
  { local: "Bella", show: "Noite Alemã", vagas: ["Frida", "Noite Alemã 2"], fila: ["Daniele", "Daiane", "Julia", "Amanda", "Antônio"] },
  { local: "Bella", show: "Pocket Nonna e Frida", vagas: ["Nonna", "Frida"], fila: ["Daniele", "Daiane", "Izabel", "Amanda", "Esther"] },
  { local: "Bella", show: "Torre do Bella", vagas: ["Torre do Bella 1", "Torre do Bella 2"], fila: ["Daniele", "Daiane", "Izabel", "Amanda", "Esther"] },
  { local: "Bella", show: "Zuca", vagas: ["Zuca"], fila: ["Julia", "Daiane", "Luize"] },
];

const normalizar = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function resolverPessoa(pessoas, nome) {
  const partes = normalizar(nome).split(/\s+/);
  const candidatas = pessoas.filter((p) => p.status === "ACTIVE" && [p.fullName, p.name].filter(Boolean).some((valor) => {
    const palavras = normalizar(valor).split(/\s+/);
    return palavras[0] === partes[0] && partes.slice(1).every((parte) => palavras.includes(parte));
  }));
  if (candidatas.length !== 1) throw new Error(`${nome}: esperava uma pessoa ativa, encontrei ${candidatas.length}. Nada foi escolhido por aproximação.`);
  return candidatas[0].id;
}

export async function preparar(api) {
  const { showBooks } = await api("GET", "/show-books");
  const { users } = await api("GET", "/users");
  const plano = [];
  // Confere os seis shows e todas as pessoas antes da primeira escrita.
  for (const item of cadastro) {
    const livros = showBooks.filter((s) => s.title === item.show && s.locationName === item.local && s.status !== "ARCHIVED");
    if (livros.length !== 1) throw new Error(`${item.local} / ${item.show}: show ausente ou duplicado.`);
    const { showBook: livro } = await api("GET", `/show-books/${livros[0].id}`);
    if (livro.type !== "CHARACTERS_ONLY") throw new Error(`${item.show}: tipo diferente do cadastro conferido.`);
    const memberIds = item.fila.map((nome) => resolverPessoa(users, nome));
    const { characters } = await api("GET", `/characters?locationId=${livro.locationId}`);
    const posicoes = livro.scenes.filter((s) => s.isCastRoster).flatMap((s) => s.blocks.flatMap((b) => b.positions));
    const existentes = new Set();
    for (const posicao of posicoes) {
      const linhas = posicao.lines.filter((l) => l.active !== false);
      const personagem = characters.find((c) => c.id === linhas[0]?.characterId);
      const cast = personagem ? (await api("GET", `/characters/${personagem.id}/cast`)).cast : [];
      const fila = cast.filter((p) => p.active !== false).sort((a, b) => a.order - b.order).map((p) => p.personId);
      if (linhas.length !== 1 || linhas[0].type !== "CHARACTER" || !personagem || personagem.showBookId !== livro.id || personagem.mode !== "rodizio" || !item.vagas.includes(personagem.name) || existentes.has(personagem.name) || JSON.stringify(fila) !== JSON.stringify(memberIds)) {
        throw new Error(`${item.show}: já existe uma vaga diferente do plano. Confira pela tela; o cadastro não sobrescreve ajustes.`);
      }
      existentes.add(personagem.name);
    }
    const vagas = item.vagas.filter((nome) => !existentes.has(nome));
    if (JSON.stringify([...existentes]) !== JSON.stringify(item.vagas.slice(0, existentes.size))) {
      throw new Error(`${item.show}: a ordem das vagas foi alterada. Confira pela tela antes de continuar.`);
    }
    const description = item.show === "Noite Alemã" && !livro.description?.includes(regrasNoiteAlema)
      ? [livro.description, regrasNoiteAlema].filter(Boolean).join("\n\n") : null;
    plano.push({ ...item, id: livro.id, memberIds, vagas, description });
  }
  return plano;
}

export async function aplicar(api, plano) {
  for (const item of plano) {
    // A observação vem antes das vagas para a restrição já estar visível no cadastro.
    if (item.description !== null) await api("PATCH", `/show-books/${item.id}`, { description: item.description, reason: "Regras da Noite Alemã confirmadas em 10/10/2026; conferência manual antes da publicação" });
    for (const name of item.vagas) {
      await api("POST", `/show-books/${item.id}/vagas`, { name, mode: "rodizio", memberIds: item.memberIds });
    }
  }
}

async function main() {
  const base = process.env.MYASA_API_URL;
  const token = process.env.MYASA_ACCESS_TOKEN;
  if (!base || !token) throw new Error("Defina MYASA_API_URL (terminando em /api) e MYASA_ACCESS_TOKEN no ambiente, sem gravar credenciais no repositório.");
  const url = new URL(base);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Use HTTPS ou localhost.");
  const api = async (metodo, caminho, corpo) => {
    const r = await fetch(base.replace(/\/$/, "") + caminho, {
      method: metodo, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    if (!r.ok) throw new Error(`${metodo} ${caminho}: HTTP ${r.status}. Cadastro interrompido; confira o Registro e execute o plano novamente antes de continuar.`);
    return r.status === 204 ? null : r.json();
  };
  const plano = await preparar(api);
  for (const item of plano) console.log(`${item.local} / ${item.show}: ${item.vagas.join(", ") || "vagas já conferidas"}; fila: ${item.fila.join(", ")}${item.description !== null ? "; acrescentar observações" : ""}.`);
  if (process.argv.includes("--aplicar")) {
    await aplicar(api, plano);
    const conferido = await preparar(api);
    if (conferido.some((p) => p.vagas.length || p.description !== null)) throw new Error("A conferência final encontrou pendências.");
    console.log("11 vagas e observações conferidas. Livros do Dia existentes não foram republicados.");
  } else console.log("Somente leitura. Para cadastrar, rode com --aplicar após conferir o plano. Em produção, peça autorização antes.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erro) => { console.error(erro.message); process.exitCode = 1; });
}
