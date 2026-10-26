/** Pessoa desligada nas listas de Folgas: nome completo e "(desligado)", para duas "Pessoa" não ficarem iguais. */
import { nomeNaLista } from "../src/lib/nome-na-lista.js";

const falhas: string[] = [];
const confere = (ok: boolean, msg: string) => { if (!ok) { falhas.push(msg); console.error(`  ✗ ${msg}`); } };

confere(nomeNaLista({ name: "Ana", fullName: "Ana Souza", personStatus: "ACTIVE" }) === "Ana", "quem está ativa mantém o nome de sempre");
confere(nomeNaLista({ name: "Pessoa", fullName: "Pessoa R4 desktop", personStatus: "ARCHIVED" }) === "Pessoa R4 desktop (desligado)", "desligada aparece com o nome completo e a marca");
confere(nomeNaLista({ name: "Pessoa", fullName: "Pessoa R4 celular", personStatus: "LEFT" }) !== nomeNaLista({ name: "Pessoa", fullName: "Pessoa R4 desktop", personStatus: "LEFT" }), "duas desligadas com o mesmo primeiro nome se distinguem");
confere(nomeNaLista({ name: "Bia", fullName: null, personStatus: "LEFT" }) === "Bia (desligado)", "sem nome completo, usa o nome curto");
if (falhas.length) { console.error(`${falhas.length} falha(s)`); process.exitCode = 1; } else process.stdout.write("nome-na-lista: 4 asserts passed\n");
