---
name: Fontes virtuais da escala — dedup, escopo e folgas
description: como juntar fontes (agenda, livro do dia, atividades) na escala em tempo de leitura sem duplicar nem vazar entre operações
---

O endpoint de alocações da escala compõe, em tempo de leitura, várias fontes virtuais (participantes da agenda, cast do Livro do Dia, atividades recorrentes) sobre as alocações reais. Para cada nova fonte virtual aplicar SEMPRE três defesas:

1. **Escopo de operação:** só incluir pessoa se pertencer à operação da escala (`opMemberIds` = user_roles ativos na operação). Mesmo que a fonte esteja amarrada à operação (ex.: evento da agenda é da operação), um participante individual pode ser de fora — filtrar à mesma.
2. **Excluir não-escaláveis:** admins e especiais saem via `getNonSchedulableUserIds`.
3. **Dedup contra alocações reais — chave certa por fonte:**
   - Agenda: `userId|agendaEventId` (NÃO `userId|data|positionId`, senão dois eventos no mesmo dia colidem).
   - Livro do Dia: `userId|data|roleId`.
4. **Excluir folgas/restrições ACTIVE (fontes AUTO-DERIVADAS):** atividades recorrentes são geradas automaticamente por dia da semana/data, sem passar pelo line-resolver — por isso DEVEM saltar quem tem folga ACTIVE (qualquer type: DAY_OFF/NO_SHOW/RECESSO/AFASTAMENTO/RESTRICAO/OUTRO) a cobrir a data (`startDate <= ds <= endDate`). Carregar folgas da operação que tocam o período UMA vez (Map userId→intervalos) e filtrar no loop por data. O cast do Livro do Dia já resolve folgas na geração (line-resolver); a agenda é escolha manual explícita, NÃO filtrar.

Calcular `opMemberIds`, `realKeys` (pessoa|data|papel) e `realAgendaKeys` (pessoa|evento) UMA vez no topo, logo após montar as alocações reais, e reutilizar em todas as fontes — evita queries e definições duplicadas.

**Why:** a injeção da agenda existia sem dedup nem escopo, o que duplicava pessoas (quando havia alocação manual) e podia mostrar gente de outra operação. A chave de dedup errada (por data) escondia eventos legítimos.

**How to apply:** ao adicionar qualquer fonte que ponha pessoas na escala, replicar as 3 defesas e escolher a chave de dedup conforme a granularidade da fonte.
