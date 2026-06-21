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

**Config por tipo de linha (`line.config` jsonb):** FIXED_PERSON `{userId}`; TITULAR_SUBSTITUTE `{titularId, substituteIds[]}`; ROTATION `{memberIds[], executionCounts{}}`; DAY_OF_WEEK `{dayAssignments: Record<weekday,userId>, days:number[]}` (0=Dom..6=Sáb); FUNCTION `{functionLabel}`; CHARACTER `{characterName}`; MANUAL `{}`. Salva via PATCH lines com `changeType:"CONFIG"` (reason opcional → DEFAULT). Editor inline expansível por linha no web-admin; auto-save a cada alteração.

**DAY_OF_WEEK — quem trabalha em cada dia:** o tipo evoluiu de "só escolher dias" (`days:number[]`) para "atribuir uma pessoa por dia da semana" (`dayAssignments` keyed por número do weekday "0".."6"). O editor grava AMBOS: `dayAssignments` (fonte de verdade) e `days` derivado das chaves (compat). Render (summary/incomplete no web e mobile) faz dual-read: usa `dayAssignments` se houver; senão cai pro `days[]` legado pra não marcar linha antiga como vazia/incompleta.
**Why:** linhas antigas só tinham dias sem pessoas; restringir leitura a `dayAssignments` regrediria elas pra "sem dias".
**How to apply:** qualquer leitura de DAY_OF_WEEK deve checar `dayAssignments` primeiro e ter fallback `days[]`. `collectUserIdsFromConfig` (api-server) inclui os valores de `dayAssignments` no memberDirectory.

**Tipos selecionáveis (UI):** o dropdown só oferece 3 — TITULAR_SUBSTITUTE, ROTATION, DAY_OF_WEEK (via `SELECTABLE_LINE_TYPES`/`lineTypeOptions(current)`). Tipos legados (FIXED_PERSON/FUNCTION/CHARACTER/MANUAL) ainda renderizam e o `lineTypeOptions(current)` injeta o tipo atual da linha pra não prendê-la. DEFAULT_LINE_TYPE = TITULAR_SUBSTITUTE.

**memberDirectory:** o GET `/show-books/:id` resolve todos os userIds referenciados nos configs e devolve `memberDirectory: {id,name}[]` em `ShowBookWithTree`.
**Why:** mobile (membro comum) NÃO pode chamar `listUsers` (403), então precisa do diretório embutido para exibir nomes. Web-admin usa `useListUsers` direto (é admin).
**How to apply:** qualquer render read-only de config (mobile) resolve nomes via `memberDirectory`, nunca via listUsers.
