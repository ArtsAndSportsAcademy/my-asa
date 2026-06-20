---
name: Asa — multi-membro e operações em lote
description: Convenção para estender as ferramentas da Asa com resolução de múltiplos nomes e ações em lote
---

# Asa — multi-membro e operações em lote

A Asa (`artifacts/api-server/src/routes/asa.ts`) tem helpers compartilhados logo após o array `ASA_TOOLS`:
`splitMemberQueries`, `resolveOneMember`, `loadOrgMembersAndMemories`, cores (`coreCriarTarefa`,
`coreRegistrarAusencia`, `coreCriarReconhecimento`, `coreCriarEntradaEscala`), e o runner `runBatch` + `summarizeBatch`.

**Regra:** ao adicionar nova ação (single OU lote), escreva a lógica de insert num "core" reutilizável
e faça tanto a ferramenta single quanto a `_lote` chamarem o mesmo core. Não duplique validação/insert.

**Why:** evita divergência entre o caminho single e o lote (foi exatamente o problema que motivou extrair os cores).

**How to apply:**
- `consultar_membros` aceita lista ("João, Pedro e Ana"). Para 1 nome mantém o shape legado
  (`found/ambiguous/member/members`); para vários retorna `multi:true` + `resultados[]` + `membrosResolvidos[]`.
- Ferramentas de lote NUNCA abortam no primeiro erro — `runBatch` coleta `{ref, ok, id, error}` por item e segue.
- Participantes de evento não têm tabela dedicada: reusa `coreCriarEntradaEscala` passando `agendaEventId`
  (precisa de uma escala ativa cobrindo a data do evento).
- O system prompt exige resumo + confirmação explícita antes de chamar qualquer ferramenta `_lote`.
- **Desfazer lote** (`desfazer_lote`): a Asa "lembra" os IDs porque o resultado do lote (`tipo` + `itens[].id`)
  fica no histórico da conversa (persistido em `aiMessages`); não há estado server-side. O modelo passa `tipo`+`ids`
  de volta. O handler reusa cores de cancelamento (`coreCancelarTarefa`/`coreCancelarAusencia`/`coreRemoverEntradaEscala`/
  `coreRemoverReconhecimento`) via `runBatch` (continua em falha). Mesma regra dos cores de criação: cancelamentos
  single E o desfazer chamam o mesmo core — não duplicar lógica de validação/delete.
- Reconhecimento não tem "cancelar" — desfazer = DELETE da linha em `recognitionsTable`. Entrada de escala só remove
  se status `MANUAL_OVERRIDE` (lotes criam com esse status, então OK).
