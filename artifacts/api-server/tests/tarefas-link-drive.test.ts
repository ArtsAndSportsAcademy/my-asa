/**
 * Link do Drive — o anexo da tarefa é só link (o Supabase gratuito não comporta arquivo).
 * Cobre: o que é aceito e como abre dentro do app; o que é recusado com uma frase; o aviso de "não compartilhado".
 * Sem banco para a leitura do link; as rotas ficam em tarefas-etapas-links.test.ts.
 */
import { checarCompartilhamento, lerLinkDrive } from "../src/services/drive-link.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };

async function run() {
  // ── Ler o link ────────────────────────────────────────────────────────────────
  const arquivo = lerLinkDrive("https://drive.google.com/file/d/1AbC/view?usp=sharing");
  assert(arquivo.ok && arquivo.kind === "file" && arquivo.embedUrl === "https://drive.google.com/file/d/1AbC/preview", `arquivo do Drive abre embutido: ${JSON.stringify(arquivo)}`);
  const aberto = lerLinkDrive("https://drive.google.com/open?id=1AbCdEf");
  assert(aberto.ok && aberto.embedUrl === "https://drive.google.com/file/d/1AbCdEf/preview", "o formato antigo (open?id=) também abre embutido");
  const documento = lerLinkDrive("https://docs.google.com/document/d/1AbC/edit");
  assert(documento.ok && documento.kind === "document" && documento.embedUrl === "https://docs.google.com/document/d/1AbC/preview", `documento do Google abre embutido: ${JSON.stringify(documento)}`);
  const planilha = lerLinkDrive("https://docs.google.com/spreadsheets/d/1AbC/edit#gid=0");
  assert(planilha.ok && planilha.kind === "spreadsheet" && planilha.embedUrl === "https://docs.google.com/spreadsheets/d/1AbC/preview", "planilha abre embutida");
  const apresentacao = lerLinkDrive("https://docs.google.com/presentation/d/1AbC/edit");
  assert(apresentacao.ok && apresentacao.kind === "presentation" && apresentacao.embedUrl === "https://docs.google.com/presentation/d/1AbC/embed", "apresentação abre embutida");
  const pasta = lerLinkDrive("https://drive.google.com/drive/folders/1AbC");
  assert(pasta.ok && pasta.kind === "folder" && pasta.embedUrl === null, "pasta não abre embutida: a tela mostra \"Abrir no Drive\"");

  // Porta e usuário no endereço não valem: o servidor conectaria onde o endereço mandar.
  for (const ruim of ["https://drive.google.com:8443/file/d/1AbC/view", "https://usuario:senha@drive.google.com/file/d/1AbC/view"]) assert(!lerLinkDrive(ruim).ok, `recusa porta ou usuário no endereço: ${ruim}`);

  // ── Recusar com frase ─────────────────────────────────────────────────────────
  for (const [texto, rotulo] of [["javascript:alert(1)", "javascript:"], ["http://drive.google.com.evil.com/file/d/1AbC/view", "endereço que só parece o Drive"], ["https://evil.com/?https://drive.google.com/file/d/1AbC/view", "Drive escondido em outro endereço"], ["texto solto", "texto solto"], ["https://drive.google.com/", "Drive sem arquivo"], ["http://drive.google.com/file/d/1AbC/view", "sem https"], ["", "vazio"]] as const) {
    const lido = lerLinkDrive(texto);
    assert(!lido.ok && lido.motivo.length > 10 && /Drive|link/i.test(lido.motivo), `recusa ${rotulo} com uma frase: ${JSON.stringify(lido)}`);
  }

  // ── Compartilhamento (melhor esforço) ─────────────────────────────────────────
  const resposta = (status: number, location?: string) => async () => new Response(null, { status, headers: location ? { location } : {} });
  const link = "https://drive.google.com/file/d/1AbC/view";
  assert(await checarCompartilhamento(link, resposta(200) as never) === true, "200: o arquivo está compartilhado");
  assert(await checarCompartilhamento(link, resposta(302, "https://accounts.google.com/ServiceLogin?continue=x") as never) === false, "redireciona para o login: não está compartilhado");
  assert(await checarCompartilhamento(link, resposta(404) as never) === false, "404: o Drive não deixa ver (não compartilhado)");
  assert(await checarCompartilhamento(link, (async () => { throw new Error("rede"); }) as never) === null, "erro de rede: não dá para saber");
  assert(await checarCompartilhamento(link, resposta(500) as never) === null, "erro do Drive: não dá para saber");
  let chamou = false;
  assert(await checarCompartilhamento("https://evil.com/x", (async () => { chamou = true; return new Response(null, { status: 200 }); }) as never) === null && !chamou, "endereço de fora do Drive nunca é consultado pelo servidor");

  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
  console.log(`✓ Link do Drive: ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
