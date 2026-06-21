---
name: Livro do Show — construtor inline
description: Como o Livro do Show (web-admin) edita estrutura inline sem Motivo, e o modelo linha=position+line
---

# Livro do Show — construtor inline

`artifacts/web-admin/src/pages/admin/show-book.tsx` usa edição inline (cards Cena → Bloco → Linha), sem dialogs de adicionar e sem campo "Motivo" para edições estruturais.

**Regra:** create/update/delete de scene/block/position/line NÃO exigem `reason`. O backend usa `req.body.reason || DEFAULT_STRUCTURAL_REASON` e o versionamento/auditoria continuam gravando.
**Why:** o MyASA antigo montava a estrutura sem fricção; exigir motivo a cada clique inviabiliza o construtor.
**How to apply:** ao tocar nessas rotas, mantenha reason opcional. Status update e ShowBookUpdate (título/desc) AINDA exigem reason (intencional).

**Modelo "linha":** uma linha da UI = uma `position` (name + minimumCoverage = "N pessoas") + uma `line` (showBookLines) que carrega o `type` (FIXED_PERSON/TITULAR_SUBSTITUTE/ROTATION/DAY_OF_WEEK/FUNCTION/CHARACTER/MANUAL). Criar linha = POST position, depois POST line com o tipo. O tipo aparece como `position.lines[0].type` na árvore do GET.

**LineUpdate.type:** originalmente LineUpdate só tinha config/order/changeType — NÃO dava para trocar o tipo via PATCH. Foi adicionado `type` ao schema (openapi) e ao handler PATCH lines. Se um position não tiver line ainda, o seletor de tipo cria uma (createLine).

Mobile (`artifacts/mobile/app/(tabs)/show-book.tsx`) é read-only e lê a mesma forma; não precisa mudar quando o web-admin muda.
