import assert from "node:assert/strict";
import { selectAsaLibraryCitation } from "../src/services/asa-library-citations.ts";

const citations = [
  { pageNumber: 12, excerpt: "Em caso de gelo, use o equipamento de proteção antes de entrar na pista." },
  { pageNumber: 3, excerpt: "O equipamento deve ser conferido diariamente." },
  { pageNumber: 0, excerpt: "Equipamento de proteção na pista." },
];
assert.deepEqual(selectAsaLibraryCitation("segurança no gelo equipamento", citations), citations[0]);
assert.deepEqual(selectAsaLibraryCitation("equipamento", citations), citations[1]);
assert.equal(selectAsaLibraryCitation("procedimento de evacuação", citations), null);
assert.equal(selectAsaLibraryCitation("", citations), null);
assert.equal(selectAsaLibraryCitation("segurança equipamento evacuação", [{ pageNumber: 2, excerpt: "O equipamento deve ser conferido diariamente." }]), null);
process.stdout.write("ASA library page citation tests passed.\n");
