# MyASA 2.0 — Ciclo de Planejamento Operacional

> **Versão:** 18/06/2026
> **Fase:** Modelagem de Ciclo Completo — anterior a wireframes de novas superfícies
> **Escopo:** S-06 Solicitações → S-04 Escala → S-05 Livro do Dia → S-08 Avisos → S-01 Meu Dia → S-11 Histórico → S-10 IA
> **Status:** 🟢 Ciclo consistente — pronto para guiar design de novas superfícies

---

## Premissa do Ciclo

O Ciclo de Planejamento Operacional começa no momento em que uma Solicitação recebe decisão em S-06 e termina quando:

1. Toda superfície afetada foi atualizada com a informação correta
2. Todos os membros afetados confirmaram a mudança
3. O sistema possui registro auditável completo do que aconteceu

Este é o ciclo que conecta **intenção individual** (o Membro pede) com **realidade operacional** (a operação absorve, recalcula e confirma). Nenhuma etapa pode falhar silenciosamente.

---

## PARTE 1 — MAPA DO CICLO

### Visão Geral

```
SOLICITAÇÃO DECIDIDA (S-06)
          │
          ├──► APROVADA ──────────────────────────────────────────────┐
          │                                                            │
          └──► NEGADA / REVOGADA ────► Notificação ao Membro ────► FIM
                                                                       │
                                    ┌──────────────────────────────────┘
                                    │
                                    ▼
                        ESCALA ATUALIZADA (S-04)
                        [automático para Tipos 1, 2*, 3, 4, 5]
                        [nenhum impacto para Tipo 8 — Administrativa]
                                    │
                                    ▼
                        LIVRO DO DIA AFETADO (S-05)
                        [flagged para revisão automática]
                        [Supervisor revisa → aprova → republica]
                                    │
                                    ▼
                        AVISOS GERADOS (S-08)
                        [automáticos pós-publicação]
                        [nível: Informativo / Importante / Crítico]
                                    │
                                    ▼
                        MEU DIA ATUALIZADO (S-01)
                        [automático após publicação]
                        [persiste com flag de ALTERAÇÃO até confirmação]
                                    │
                                    ▼
                        CONFIRMAÇÃO DOS AFETADOS
                        [rastreável por membro e por atividade]
                                    │
                                    ▼
                        HISTÓRICO REGISTRADO (S-11)
                        [narrativa completa do ciclo]
                                    │
                                    ▼
                        IA MONITORA CADA ETAPA (S-10)
                        [participa em cada nó do ciclo]
```

*Tipo 2 (Restrição): a atualização da Escala é indireta — ocorre após o Supervisor registrar a Restrição oficial na ficha do membro.

---

### CASO 1 — FOLGA APROVADA

**Contexto:** Membro solicita ausência completa em uma ou mais datas. Supervisor aprova após análise de impacto.

---

#### O que acontece primeiro?

O sistema executa automaticamente duas ações em sequência:

1. **Escala:** marca o membro como indisponível para todas as atividades nas datas aprovadas
2. **Notificação ao Membro:** envia confirmação com o estado "✓ Aprovada" + motivo (quando fornecido pelo Supervisor)

Essas ações ocorrem **imediatamente após a decisão do Supervisor** em S-06 — sem ação manual adicional.

---

#### O que muda na Escala?

| Antes da aprovação | Após a aprovação |
|---|---|
| Membro aparece como disponível para todas as atividades da data | Membro marcado como "De Folga" — removido de todas as posições |
| Posições que ele cobria aparecem como "Cobertas" | Posições que ele cobria recalculadas: "Em Risco" (substituto disponível) ou "Em Aberto" (sem substituto) |
| Motor de candidatos inclui o membro normalmente | Motor de candidatos exclui o membro para essa data |

**Efeito em cascata automático:**
- Se existem outros membros dependentes das posições que ele cobre (ex.: bloco de atividade que exige 2 posições da mesma pessoa), o sistema recalcula e sinaliza novas descobertas.
- O Supervisor é alertado sobre posições que ficaram descobertas — não precisa descobrir manualmente.

**Atenção — decisão arquitetural:** a Escala é atualizada automaticamente, mas não é republicada automaticamente. A republicação exige decisão do Supervisor.

---

#### O que muda no Livro do Dia?

Comportamento diferente conforme o estado do Livro do Dia para a data em questão:

| Estado do Livro do Dia | Comportamento |
|---|---|
| **Ainda não gerado** | A próxima geração já considerará a folga automaticamente. Nenhuma ação necessária. |
| **Gerado mas não publicado** | O sistema reflag o Livro como "Revisão Necessária". As posições do membro aparecem como "Em Risco" ou "Em Aberto". O Supervisor é alertado para revisar antes de publicar. |
| **Publicado** | O sistema marca o Livro como "Desatualizado". Supervisor precisa revisar e **republicar**. A republicação gera Avisos automáticos para todos os membros afetados. |

**Regra inegociável:** um Livro do Dia publicado nunca é alterado silenciosamente. Toda mudança em Livro já publicado exige revisão explícita do Supervisor e nova publicação — registrada no Histórico com timestamp e autor.

---

#### O que gera Aviso?

| Evento | Gera Aviso? | Nível | Quem recebe |
|---|---|---|---|
| Folga aprovada | Sim | Informativo | Apenas o membro solicitante |
| Livro do Dia republicado após aprovação | Sim | Importante | Todos os membros afetados pela mudança de cobertura |
| Posição crítica descoberta (sem substituto disponível) | Sim | Crítico | Supervisor do grupo |
| Substituição confirmada e Livro republicado | Sim | Importante | Membro substituído + Membro substituto |

**Não gera Aviso:**
- A análise do Supervisor em S-06 (processo interno)
- A atualização automática da Escala (sem publicação)
- O flagging automático do Livro para revisão

---

#### O que aparece no Meu Dia?

**Para o membro que tirou a folga:**
- Na data da folga: programação do dia mostra "Folga Aprovada · [data]" — sem atividades listadas
- Notificação de confirmação persiste até ele abrir e visualizar
- Na lista de Solicitações (S-06): estado atualizado para ✓ Aprovada

**Para o membro substituído (caso S-01 do substituto):**
- Atividade nova aparece no topo com flag "ALTERAÇÃO — [atividade] adicionada"
- O que era antes → O que é agora (comparativo visual)
- Exige confirmação explícita (obrigatória — não desaparece até confirmar)
- Prazo de confirmação: proporcional ao tempo até o início da atividade

**Para membros sem impacto:** nenhuma mudança no Meu Dia.

---

#### O que vai para o Histórico?

O Histórico de S-11 registra a narrativa completa:

```
[DATA/HORA] Amanda Souza criou solicitação de folga para 21/06.
[DATA/HORA] Solicitação EM ANÁLISE — Supervisora Ana Silva.
[DATA/HORA] IA calculou impacto: Musical 12h30 Astrid — sem substituto direto. Ensaio 16h Bloco 3 — Beatriz disponível.
[DATA/HORA] Supervisora Ana Silva APROVOU. Escala atualizada automaticamente.
[DATA/HORA] Livro do Dia de 21/06 flagged para revisão (já havia versão publicada).
[DATA/HORA] Supervisora Ana Silva revisou e republicou Livro do Dia de 21/06 — Beatriz alocada no Bloco 3. Astrid permanece em aberto.
[DATA/HORA] Avisos enviados: Beatriz Lima (nova alocação), Carlos Neto (nenhuma mudança para ele).
[DATA/HORA] Beatriz Lima confirmou recebimento.
[DATA/HORA] Amanda Souza visualizou confirmação de aprovação.
[DATA/HORA] [STATUS] Posição Astrid — Musical 12h30 — ainda em aberto.
```

---

#### Como a IA participa?

| Etapa | Papel da IA |
|---|---|
| **Análise do Supervisor (S-06)** | Calcula impacto total antes de apresentar as opções Aprovar/Negar; identifica papéis exclusivos sem substituto; mostra acumulado de folgas na mesma data |
| **Aprovação → Atualização da Escala** | Identifica posições que ficaram descobertas; sugere candidatos a substituto com classificação por risco (4 camadas) |
| **Revisão do Livro do Dia** | Gera proposta atualizada de Livro com as mudanças; destaca diferenças em relação à versão anterior |
| **Pós-publicação** | Monitora quem ainda não confirmou; alerta o Supervisor por proximidade de horário (*"Carlos não confirmou. Show em 15 min."*) |
| **Investigação (S-11)** | Resume a narrativa completa caso o Admin precise investigar; detecta padrão de reincidência |

---

### CASO 2 — RESTRIÇÃO APROVADA

**Contexto:** Membro solicita registro de limitação de disponibilidade ou capacidade (médica, física, operacional, técnica). Supervisor analisa e registra a Restrição oficial.

---

#### O que acontece primeiro?

A diferença fundamental em relação à Folga: **a Restrição não é aplicada automaticamente pelo sistema após a aprovação da Solicitação**. O fluxo é em duas etapas:

1. **Solicitação aprovada em S-06** → Supervisor sinaliza que a restrição é válida
2. **Supervisor registra a Restrição oficial na ficha do membro** → somente nesse momento o sistema aplica o impacto na Escala

Razão: a Restrição exige que o Supervisor defina parâmetros precisos (tipo, período, atividades afetadas). A Solicitação é a intenção; o Registro é o dado operacional.

**Para Restrições Médicas:** registro obrigatório de data de revisão. Sem data de revisão, o sistema não permite concluir o registro.

---

#### O que muda na Escala?

Após registro da Restrição na ficha do membro:

- **Motor de candidatos atualizado imediatamente:** membro excluído de posições que violem sua restrição em todas as datas futuras dentro do período declarado
- **Livros do Dia futuros:** a próxima geração já excluirá o membro das posições restritas automaticamente
- **Livros do Dia já gerados** para datas dentro do período: flagged como "Revisão Necessária" se o membro estiver alocado em posição que viola a restrição
- **Escala atual:** posições cobertas pelo membro nas datas afetadas recalculadas como "Em Risco" ou "Em Aberto"

**Alcance temporal da restrição:** diferente da folga (pontual), a restrição persiste até a data de término declarada ou até o Supervisor encerrá-la manualmente. Isso impacta a Escala de forma contínua.

---

#### O que muda no Livro do Dia?

O sistema identifica automaticamente todos os Livros do Dia já publicados ou gerados dentro do período de restrição onde o membro está alocado em posição conflitante. Para cada um:

1. Livro é flagged como "Revisão Necessária"
2. Supervisor recebe lista de Livros afetados com a posição conflitante destacada
3. Supervisor revisa cada um → ajusta a cobertura → republica

**Volume pode ser alto:** uma restrição de 30 dias pode afetar múltiplos Livros do Dia já publicados. O sistema deve apresentar isso como lista gerenciável, não como 30 alertas individuais.

---

#### O que gera Aviso?

| Evento | Gera Aviso? | Nível | Quem recebe |
|---|---|---|---|
| Restrição registrada e ativa | Sim | Informativo | Apenas o membro (confirmação de que foi registrada) |
| Livro do Dia republicado com nova alocação | Sim | Importante | Membros cujas posições mudaram |
| Data de revisão da Restrição Médica atingida sem revisão | Sim | Importante | Supervisor responsável |
| Restrição encerrada pelo Supervisor | Sim | Informativo | O membro |

---

#### O que aparece no Meu Dia?

**Para o membro com restrição:**
- Card de contexto persistente: "Você está com [tipo de restrição] registrada até [data]" — visível como contexto, não como alerta urgente
- Nas datas afetadas: atividades que violam a restrição não aparecem na sua programação (ele não é mais alocado nelas)
- Nas datas afetadas: atividades compatíveis com a restrição aparecem normalmente

**Para substitutos em atividades reconfiguradas:**
- Igual ao Caso 1: flag de ALTERAÇÃO, exige confirmação

---

#### O que vai para o Histórico?

```
[DATA/HORA] Carlos Neto criou Solicitação de Restrição — Médica — 19/06 a indefinido.
[DATA/HORA] Solicitação EM ANÁLISE — Supervisora Ana Silva.
[DATA/HORA] Supervisora Ana Silva solicitou documento de suporte.
[DATA/HORA] Carlos Neto respondeu com documento.
[DATA/HORA] Supervisora Ana Silva registrou Restrição Médica oficial — início 19/06, revisão 18/07 — atividades restritas: acrobacia alta e contorção.
[DATA/HORA] Motor de candidatos atualizado. 12 Livros do Dia futuros flagged para revisão.
[DATA/HORA] Supervisora Ana Silva revisou e republicou 12 Livros do Dia [lista específica].
[DATA/HORA] 18/07 — Restrição Médica de Carlos atingiu data de revisão. Alerta enviado à Supervisora Ana Silva.
[DATA/HORA] [PENDENTE] Supervisora Ana Silva ainda não revisou a restrição.
```

---

#### Como a IA participa?

| Etapa | Papel da IA |
|---|---|
| **Registro da Restrição** | Identifica todas as datas e atividades afetadas; estima o número de Livros do Dia que precisarão ser revisados |
| **Revisão dos Livros do Dia afetados** | Sugere substituições para cada posição conflitante; prioriza a fila de revisão por data de ocorrência |
| **Monitoramento contínuo** | Alerta ao aproximar a data de revisão da Restrição Médica; detecta se o membro está sendo alocado inconsistentemente em posições restritas |
| **Histórico** | Identifica padrão: *"Carlos é o 3º membro com restrição médica em acrobacia alta neste trimestre"* |

---

### CASO 3 — TROCA APROVADA

**Contexto:** Membro tem folga agendada na data X e propõe trabalhar em X, folgar em Y.

---

#### O que acontece primeiro?

O sistema executa **duas atualizações simultâneas e atômicas** na Escala:

1. **Data X (original da folga):** disponibilidade do membro **restaurada** — ele volta a estar disponível para todas as atividades
2. **Data Y (nova folga):** disponibilidade do membro **bloqueada** — folga registrada

Ambas acontecem no mesmo instante. O sistema não permite que apenas uma delas ocorra.

---

#### O que muda na Escala?

| Data | Antes | Depois |
|---|---|---|
| Data X (original da folga) | Membro como "De Folga" | Membro disponível; posições recalculadas; substitutos anteriores podem ser liberados |
| Data Y (nova folga) | Membro disponível | Membro como "De Folga"; posições recalculadas como em risco ou em aberto |

**Complexidade adicional:** se a data X já tinha substitutos alocados no Livro do Dia publicado (em função da folga original), o Supervisor precisa decidir:
- Manter o substituto (member X fica disponível como "extra" naquele dia) — menos disruptivo
- Atualizar a escala com o membro original de volta — mais preciso, mas gera nova rodada de Avisos

Esta é uma decisão do Supervisor, não automática. O sistema apresenta as duas opções.

---

#### O que muda no Livro do Dia?

Ambas as datas (X e Y) têm seus Livros do Dia flagged para revisão, se existirem.

A prioridade de revisão é determinada pela proximidade temporal: se X está em 2 dias e Y está em 2 semanas, a revisão de X é urgente.

---

#### O que gera Aviso?

Para a troca, podem ser gerados até **3 conjuntos de Avisos**:

1. Ao membro: confirmação da troca aprovada (ambas as datas)
2. Para membros afetados na data X (quando escala original é restaurada e outro membro tinha sido previamente alocado como substituto)
3. Para membros afetados na data Y (novas alocações por ausência do membro)

O Supervisor precisa controlar esses 3 conjuntos para evitar comunicação contraditória — o sistema agrupa e apresenta como ação única de revisão.

---

#### O que vai para o Histórico?

```
[DATA/HORA] Pedro Faria criou Solicitação de Troca de Folga — folga 30/06 por folga em 05/07.
[DATA/HORA] EM ANÁLISE — Supervisor João Costa. IA verificou cobertura nas duas datas.
[DATA/HORA] Supervisor João Costa APROVOU.
[DATA/HORA] Escala atualizada atomicamente: 30/06 → disponível; 05/07 → de folga.
[DATA/HORA] Livros do Dia de 30/06 e 05/07 flagged para revisão.
[DATA/HORA] Supervisor João Costa revisou 30/06: manteve Júlia como substituta (membro original disponível como extra).
[DATA/HORA] Supervisor João Costa revisou 05/07: Fabio alocado no lugar de Pedro. Livro republicado.
[DATA/HORA] Avisos enviados: Júlia Lima (nenhuma mudança confirmada), Fabio Melo (nova alocação em 05/07).
```

---

#### Como a IA participa?

| Etapa | Papel da IA |
|---|---|
| **Análise (S-06)** | Verifica cobertura nas duas datas simultaneamente; detecta se a data Y está em risco antes mesmo de verificar X |
| **Pós-aprovação** | Apresenta o estado de cada Livro do Dia afetado com prioridade por data; sugere se convém manter ou desfazer substituições existentes na data X |
| **Monitoramento** | Confirma que as duas atualizações foram processadas corretamente; detecta inconsistência se apenas uma data foi atualizada |

---

### CASO 4 — AJUSTE OPERACIONAL APROVADO

**Escopo:** Chegada Tardia, Saída Antecipada, Ajuste de Escala (mudança de papel ou horário em atividade específica).

**Contexto:** mudança pontual que afeta uma ou poucas atividades específicas — não o dia inteiro.

---

#### O que acontece primeiro?

O sistema atualiza automaticamente a alocação do membro na atividade específica indicada na solicitação.

- **Chegada Tardia:** horário de entrada ajustado → se existir atividade entre o horário original e o novo, a posição é sinalizada como "Descoberta até [novo horário]"
- **Saída Antecipada:** horário de saída ajustado → se existir atividade após o novo horário, a posição é sinalizada como "Descoberta a partir de [horário saída]"
- **Ajuste de Escala (papel):** o papel do membro é substituído pelo novo papel indicado → o papel anterior fica sem cobertura, a ser resolvido pelo Supervisor

---

#### O que muda na Escala?

| Tipo | Mudança na Escala |
|---|---|
| Chegada Tardia | Membro indisponível nas atividades antes do horário aprovado |
| Saída Antecipada | Membro indisponível nas atividades após o horário aprovado |
| Ajuste de papel | Posição anterior fica em aberto; nova posição alocada para o membro |

A mudança é pontual — apenas a atividade específica é afetada. As demais atividades do membro no mesmo dia permanecem inalteradas.

---

#### O que muda no Livro do Dia?

O Livro do Dia correspondente ao show/ensaio/evento específico é flagged para revisão. Se já publicado, exige republicação.

Para Chegada Tardia ou Saída Antecipada que descobre uma posição: o sistema apresenta ao Supervisor a posição descoberta com candidatos disponíveis — dentro do fluxo de revisão do Livro do Dia.

---

#### O que gera Aviso?

| Evento | Gera Aviso? | Nível |
|---|---|---|
| Ajuste aprovado | Sim — para o membro solicitante | Informativo |
| Livro do Dia republicado com mudança | Sim — para membros afetados | Importante |
| Posição descoberta por ajuste de horário | Sim — para Supervisor | Importante |

---

#### O que vai para o Histórico?

Exemplo para Chegada Tardia:

```
[DATA/HORA] Beatriz Lima solicitou Chegada Tardia — 19/06 — entrada às 14h (prevista 10h).
[DATA/HORA] EM ANÁLISE — Supervisora Ana Silva. IA verificou: ensaio das 10h-12h não é coberto por Beatriz. Risco baixo.
[DATA/HORA] Aprovada — Supervisora Ana Silva.
[DATA/HORA] Escala ajustada: Beatriz disponível a partir de 14h em 19/06.
[DATA/HORA] Livro do Dia de 19/06 flagged para revisão — Beatriz não cobre ensaio das 10h.
[DATA/HORA] Supervisora Ana Silva revisou: ensaio das 10h mantido sem Beatriz (dentro do mínimo de cobertura).
[DATA/HORA] Livro republicado. Beatriz notificada com confirmação de aprovação.
```

---

#### Como a IA participa?

| Etapa | Papel da IA |
|---|---|
| **Análise** | Verifica se o período de ausência descobre alguma atividade que o membro cobre |
| **Revisão do Livro** | Calcula se a cobertura sem o membro no período específico é suficiente; sugere ajustes apenas onde necessário |
| **Monitoramento** | Confirma que a mudança foi comunicada ao membro e que o Meu Dia foi atualizado corretamente |

---

### CASO 5 — SOLICITAÇÃO ADMINISTRATIVA APROVADA

**Contexto:** pedido sem impacto operacional — documentos, dados cadastrais, benefícios, pagamentos.

---

#### O que acontece primeiro?

O Supervisor resolve a solicitação (ou encaminha ao Admin). A ação é registrada em S-06.

**Não existe impacto automático** em nenhuma outra superfície operacional.

---

#### O que muda na Escala? Nada.
#### O que muda no Livro do Dia? Nada.

---

#### O que gera Aviso?

Aviso é gerado apenas se o Supervisor optar por comunicar o resultado: ex: *"Seu documento foi processado."* Não é automático — é decisão do Supervisor.

Para Urgência Alta (conforme S-06 L-13): push notification ao Supervisor no recebimento. Mas a resolução não gera Aviso automático para o membro — apenas a notificação de que a solicitação foi decidida dentro de S-06.

---

#### O que aparece no Meu Dia? Nada.

Solicitações Administrativas não têm reflexo no Meu Dia — ele é exclusivamente operacional.

---

#### O que vai para o Histórico?

```
[DATA/HORA] Júlia Costa criou Solicitação Administrativa — Urgência Alta — solicitação de documento.
[DATA/HORA] Push enviado à Supervisora Ana Silva (urgência alta).
[DATA/HORA] Supervisora Ana Silva resolveu: documento emitido e enviado para o e-mail da Júlia.
[DATA/HORA] Júlia Costa notificada: solicitação resolvida.
```

---

## PARTE 2 — RESPONSABILIDADES

### Mapa de Responsabilidades por Etapa

| Etapa | Quem inicia? | Quem valida? | Quem executa? | Quem é informado? | Quem confirma? | Quem audita? |
|---|---|---|---|---|---|---|
| **Criação da Solicitação** | Membro | — | Membro | Supervisor (notificação) | — | Admin (via indicadores S-10) |
| **Análise de Impacto** | Sistema (automático) | Supervisor | Sistema (cálculo) | — | — | — |
| **Decisão (Aprovar/Negar/Propor)** | Supervisor | — | Supervisor | Membro (notificação) | — | Admin |
| **Atualização da Escala** | Sistema (automático pós-aprovação) | — | Sistema | Supervisor (alerta de posições descobertas) | — | — |
| **Revisão do Livro do Dia** | Sistema (flag automático) | Supervisor | Supervisor | — | — | Admin |
| **Publicação da Escala/Livro** | Supervisor | Sistema (validações) | Supervisor | — | — | Admin |
| **Geração de Avisos** | Sistema (automático pós-publicação) | — | Sistema | Membros afetados | Membros afetados | Supervisor (rastreamento) |
| **Atualização do Meu Dia** | Sistema (automático pós-publicação) | — | Sistema | — | Membro (confirmação explícita) | Supervisor (quem não confirmou) |
| **Monitoramento de Confirmação** | Sistema (alerta proativo) | Supervisor | Supervisor | — | — | Admin |
| **Registro no Histórico** | Sistema (automático) | — | Sistema | — | — | Admin |

---

### Identificação de Momentos Sem Responsável

**⚠️ Momento de risco 1 — Registro da Restrição Oficial:**
A Solicitação de Restrição é aprovada, mas a Restrição oficial só entra em vigor quando o Supervisor a registra na ficha do membro. **Existe um gap entre a aprovação da Solicitação e o registro da Restrição.** Nesse gap, o membro pode ser alocado em posições incompatíveis. O sistema deve alertar o Supervisor sobre essa pendência com prazo definido.

**Resolução proposta:** após aprovar Solicitação de Restrição, o sistema apresenta automaticamente o formulário de Registro de Restrição pré-preenchido. O Supervisor conclui na mesma sessão ou é alertado persistentemente até fazê-lo.

**⚠️ Momento de risco 2 — Revisão de Livros do Dia afetados por Restrição com grande alcance temporal:**
Quando uma restrição de longa duração (30+ dias) afeta múltiplos Livros do Dia já gerados, a responsabilidade de revisão recai totalmente no Supervisor sem prazo definido. Livros para datas próximas são urgentes; para datas distantes, podem ser esquecidos.

**Resolução proposta:** o sistema prioriza a fila de revisão por data de ocorrência e envia alertas progressivos conforme cada data se aproxima.

**⚠️ Momento de risco 3 — Membros afetados que não confirmaram:**
O sistema monitora confirmações, mas a decisão de agir (renotificar, contato direto) cabe ao Supervisor sem prazo ou protocolo automático definido.

**Resolução proposta:** escalada automática ao Admin após limiar de tempo sem confirmação de membro em atividade crítica (definir limiar por tipo de atividade — show: 1h antes; ensaio: 3h antes).

---

## PARTE 3 — LIVRO DO DIA

### 3.1 Quando o Livro do Dia precisa ser atualizado

| Evento | Aciona revisão? | Urgência |
|---|---|---|
| Folga aprovada para data com Livro gerado | Sim | Alta se publicado; Normal se só gerado |
| Folga aprovada para data sem Livro gerado | Não (próxima geração já considerará) | — |
| Restrição registrada para data com Livro gerado | Sim | Proporcional à proximidade da data |
| Troca aprovada | Sim (ambas as datas, se com Livro gerado) | Proporcional à proximidade da data mais próxima |
| Ajuste Operacional aprovado | Sim (atividade específica) | Alta se publicado e data próxima |
| Solicitação Administrativa aprovada | Não | — |
| Substituição confirmada pelo Supervisor (fora do ciclo S-06) | Sim (automático) | Alta |
| Cancelamento de show (via Agenda) | Sim — Livro marcado como "Cancelado" | Crítica |

---

### 3.2 O que atualiza automaticamente

| Ação | Atualização automática |
|---|---|
| Folga aprovada → Livro existente não publicado | Posições do membro reflagged como "Em Risco" / "Em Aberto". Nenhuma alocação é alterada automaticamente. |
| Substituição confirmada pelo Supervisor na Escala | Livro do Dia da data correspondente atualizado com nova alocação. |
| Restrição registrada → geração de novo Livro | Novo Livro já excluirá o membro das posições restritas automaticamente. |
| Ajuste de horário aprovado → Livro não publicado | Horário do membro na atividade específica atualizado automaticamente no Livro em rascunho. |

**O que NUNCA atualiza automaticamente:**
- Livro do Dia já **publicado** (toda mudança em Livro publicado exige revisão explícita do Supervisor + nova publicação)
- Mudanças no Livro do Show não propagam para Livros do Dia já gerados
- Restrição registrada após geração do Livro não altera retroativamente o Livro já gerado

---

### 3.3 O que exige validação do Supervisor

1. Toda revisão de Livro do Dia (rascunho ou publicado) antes de publicar ou republicar
2. A escolha de substituto para posições descobertas
3. A decisão de publicar com posições ainda em aberto (sistema permite, mas exige ciência explícita)
4. A decisão de manter ou desfazer alocações anteriores após aprovação de Troca de Folga

---

### 3.4 O que exige republicação

O Livro do Dia já **publicado** exige republicação quando:

1. **Posição coberta muda** — novo membro alocado em lugar do membro original
2. **Posição descoberta** — membro anteriormente alocado ficou indisponível
3. **Horário de atividade muda** (ajuste de horário aprovado)
4. **Instrução operacional do show muda** (ex.: mudança de figurino, cenário)

**Não exige republicação:**
- Mudanças administrativas sem impacto operacional
- Atualização do status de confirmação dos membros (isso é acompanhamento, não publicação)
- Correções de metadado (labels, observações internas do Supervisor)

---

### 3.5 O que gera confirmação para membros

| Evento | Confirmação necessária? | Prazo sugerido |
|---|---|---|
| Livro do Dia publicado pela primeira vez | Sim — todos os membros alocados | 24h antes do show |
| Livro do Dia republicado (mudança de alocação) | Sim — apenas membros afetados pela mudança | Proporcional à proximidade |
| Livro republicado (mudança que não afeta posição do membro) | Não | — |
| Aviso de cancelamento de show | Sim — todos os membros do grupo | Imediato |

**Confirmação como ação explícita:** o membro não confirma apenas "lendo" — ele toca em "Confirmar" no Meu Dia. Esse toque é registrado no sistema com timestamp e é visível para o Supervisor em tempo real.

---

## PARTE 4 — AVISOS

### 4.1 Quando um evento gera Aviso

**Regra principal:** Aviso é gerado apenas quando uma informação operacional **publicada** (ou seja, oficial) afeta membros que precisam agir ou saber. Avisos não são notificações de processo interno.

| Evento | Gera Aviso | Nível |
|---|---|---|
| Publicação inicial da Escala | Sim | Informativo |
| Republicação da Escala com mudança de alocação | Sim | Importante |
| Republicação com posição crítica em aberto | Sim | Crítico |
| Cancelamento de show | Sim | Crítico |
| Solicitação aprovada para o membro | Sim | Informativo |
| Solicitação negada para o membro | Sim | Informativo (com motivo) |
| Substituição confirmada pelo Supervisor | Sim | Importante |
| Restrição Médica atingiu data de revisão | Sim (para Supervisor) | Importante |
| Escala não publicada chega à véspera de uma data crítica com posição em aberto | Sim (para Supervisor) | Crítico |

---

### 4.2 Quando NÃO gera Aviso

| Situação | Razão |
|---|---|
| Análise do Supervisor de uma solicitação | Processo interno; Membro já sabe que está "Em Análise" pelo estado em S-06 |
| Atualização automática da Escala (sem publicação) | Escala não publicada = não oficial; Aviso sobre não-oficial geraria confusão |
| Flagging de Livro do Dia para revisão | Alerta interno ao Supervisor; membros não veem o Livro em rascunho |
| Solicitação Administrativa decidida sem ação pública | Resolvida dentro de S-06; não afeta operação |
| Mudança em Livro do Show (estrutura base) | Não propaga para Livros do Dia existentes |
| Confirmação de leitura de um membro | Evento de tracking interno; não gera Aviso para outros |

---

### 4.3 Quem recebe cada nível de Aviso

| Nível | Quando | Quem recebe | Comportamento no app |
|---|---|---|---|
| **Informativo** | Mudança que afeta o membro mas não exige ação | Membro afetado | Aparece no feed de Avisos; não exige confirmação; badge no ícone |
| **Importante** | Mudança que afeta a programação do membro; nova alocação | Membros afetados | Aparece em destaque no Meu Dia; exige confirmação explícita; persiste até confirmar |
| **Crítico** | Cancelamento; posição em aberto com show em < 24h; ausência de cobertura | Supervisor + Admin | Aparece no topo do Painel Operacional; push obrigatório; sem possibilidade de descartar sem ação |

---

### 4.4 Tipos de Aviso por comportamento no Meu Dia

| Tipo | Comportamento |
|---|---|
| **Aviso Simples** | Aparece no feed de Avisos (S-08). Não aparece no Meu Dia. Informativo puro. Exemplo: "Escala de sábado publicada." |
| **Aviso Importante** | Aparece no feed de Avisos (S-08) + card no Meu Dia (S-01). Exige confirmação. Desaparece do topo após confirmação; permanece acessível no feed. Exemplo: "Você foi alocado em Bloco 3 no sábado." |
| **Alteração Operacional Persistente** | Aparece no **topo** do Meu Dia com comparativo visual (o que era antes → o que é agora). Bloqueia visualmente o restante até confirmação. Persiste em todos os acessos até confirmação explícita. Desaparece do topo após confirmação; fica acessível no histórico de alterações do Meu Dia. Exemplo: "Seu papel no show de sábado mudou de Mensageira para Astrid." |

**Regra de escalada:** o nível do Aviso nunca é escolhido pelo Supervisor — é determinado pelo sistema com base no impacto da mudança. O Supervisor pode adicionar um Aviso manual (via S-08), mas os Avisos automáticos têm nível calculado.

---

## PARTE 5 — MEU DIA

### 5.1 Como a alteração chega ao Membro

A alteração chega ao Meu Dia **somente após a publicação (ou republicação) da Escala/Livro do Dia** pelo Supervisor. Nunca antes.

Fluxo técnico:
1. Supervisor publica/republica → sistema calcula delta (o que mudou para cada membro)
2. Meu Dia de cada membro afetado é atualizado com o delta
3. Push notification enviada para o membro
4. Na próxima abertura do app: Meu Dia já mostra a versão atualizada com flag de alteração

---

### 5.2 O que muda visualmente

| Cenário | Mudança visual no Meu Dia |
|---|---|
| Nova atividade adicionada (ex.: substituição) | Card novo no topo com label "ADICIONADO" + badge de alteração |
| Atividade existente com mudança de papel | Card existente com flag "ALTERADO" + comparativo: "Era: Mensageira → Agora: Astrid" |
| Atividade removida (ex.: folga aprovada) | Card marcado como "REMOVIDO" com explicação; não desaparece silenciosamente |
| Horário alterado | Card com flag "ALTERADO" + comparativo horário |
| Folga aprovada para o dia | Programação do dia vazia + card "Folga aprovada" com data |

**Princípio de design:** nenhuma mudança chega silenciosamente. Toda alteração que afeta o membro tem representação visual diferenciada do estado normal — até confirmação explícita.

---

### 5.3 Quando aparece no topo

A alteração sobe para o **topo absoluto do Meu Dia** (acima da próxima atividade) quando:

1. É a primeira abertura após uma publicação que afeta o membro, OU
2. A alteração ainda não foi confirmada, OU
3. O nível é "Crítico" (ex.: cancelamento de show, substituição de última hora)

**A hierarquia de urgência:**
```
TOPO: Alteração não confirmada [Crítico]
  ↓
TOPO: Alteração não confirmada [Importante]
  ↓
Próxima atividade
  ↓
Linha do tempo do dia
  ↓
Avisos informativos não lidos
  ↓
Pendências menores (solicitações, entregas)
```

---

### 5.4 Quando exige confirmação

| Situação | Confirmação obrigatória? |
|---|---|
| Nova alocação (o membro foi escalado em atividade que antes não estava) | Sim |
| Mudança de papel em atividade que já estava escalado | Sim |
| Cancelamento de atividade onde estava alocado | Sim |
| Mudança de horário de atividade | Sim |
| Aviso informativo geral (não afeta diretamente o membro) | Não |
| Folga aprovada para o próprio membro | Não (ele solicitou — já sabe) |

---

### 5.5 Quando desaparece do topo

O card de alteração **sai do topo** apenas após confirmação explícita do membro (toque em "Confirmar" ou "Entendi").

Após confirmação:
- O card desce para a posição normal na linha do tempo
- O estado "ALTERADO" permanece visível na atividade (mas sem urgência visual)
- O Supervisor vê em tempo real que esse membro confirmou

**O card NUNCA desaparece automaticamente por tempo.** A passagem do tempo não substitui confirmação. Se o show passou e o membro nunca confirmou, o Histórico registra isso.

---

### 5.6 Como garantir que o Membro não entre em operação com informação desatualizada

**Camada 1 — Visual persistente:** alteração permanece no topo até confirmação, impedindo que o membro ignore.

**Camada 2 — Push notification:** push enviado no momento da publicação. Se o push não foi entregue (app sem conexão), o card de alteração ainda aparecerá na próxima abertura.

**Camada 3 — Alerta proativo do sistema:** se o membro não confirmou e a atividade se aproxima (limiar definido por tipo), o sistema re-notifica o Supervisor (*"Carlos não confirmou a mudança. Show em 15 minutos."*) E re-notifica o membro.

**Camada 4 — Rastreamento pelo Supervisor:** o Supervisor vê em tempo real quem confirmou e quem não confirmou na lista de acompanhamento de Avisos (S-08) e no Painel Operacional (S-02).

**Camada 5 — Histórico:** o sistema registra o estado de cada confirmação. Um membro que executou uma atividade sem ter confirmado a programação fica registrado — permite investigação e correção de processo futuro.

---

## PARTE 6 — HISTÓRICO

### 6.1 Princípio fundador

O Histórico no MyASA não é log de sistema. É narrativa operacional. A diferença é fundamental:

| Log de sistema | Narrativa do Histórico |
|---|---|
| `2026-06-19T11:05:32Z REQUEST_ID=7823 STATUS=REVOKED USER_ID=ANA_SILVA` | "Supervisora Ana Silva revogou a aprovação de Amanda Souza em 19/06 às 11h05" |
| `ESCALA_UPDATE: member=BEATRIZ, position=BLOCO3, date=2026-06-21` | "Beatriz Lima foi alocada no Bloco 3 do ensaio de 21/06 como substituta de Amanda" |
| `NOTIFICATION_SENT: 8 recipients, read_count=6, confirmed=6` | "Livro do Dia republicado. 8 membros notificados. 6 confirmaram. 2 pendentes: Carlos e Débora." |

**Quem lê o Histórico:** Admin investigando um problema, Supervisor verificando o que aconteceu, IA construindo contexto para responder perguntas.

---

### 6.2 Estrutura narrativa de cada ciclo

Para cada Ciclo de Planejamento Operacional completo, o Histórico deve responder:

**Pergunta 1:** *"O que aconteceu?"*
→ Resumo IA em 2-4 frases na abertura do registro. Escrito em linguagem natural. Pré-gerado, não exige que o Admin construa manualmente.

**Pergunta 2:** *"Quem fez o quê?"*
→ Lista de atores com suas ações e timestamps.

**Pergunta 3:** *"O que mudou na operação?"*
→ Delta visual: antes → depois, para Escala, Livro do Dia e Meu Dia.

**Pergunta 4:** *"Todos ficaram sabendo?"*
→ Status de confirmação de cada membro afetado (confirmou / não confirmou / atividade já ocorreu sem confirmação).

**Pergunta 5:** *"Existe algum padrão?"*
→ Indicador de reincidência calculado pela IA: "3ª solicitação de folga de Amanda para o sábado nas últimas 4 semanas."

---

### 6.3 Exemplo narrativo completo — Folga com revogação posterior

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESUMO  [gerado pela IA]
Amanda Souza solicitou folga para 21/06. Aprovada pela Supervisora Ana Silva em 17/06.
Revogada em 19/06 após nova restrição de Beatriz eliminar a cobertura de Astrid.
Impacto: Livro do Dia republicado. Amanda restaurada como titular de Astrid.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LINHA DO TEMPO

17/06 · 10h14   Amanda Souza criou Solicitação de Folga · 21/06 · Dia inteiro
17/06 · 10h14   Sistema calculou impacto: Musical 12h30 Astrid [DESCOBERTA]; Ensaio 16h Bloco 3 [EM RISCO — Beatriz disponível]
17/06 · 16h02   Supervisora Ana Silva abriu para análise → EM ANÁLISE
17/06 · 18h00   Supervisora Ana Silva APROVOU
17/06 · 18h00   Escala atualizada: Amanda indisponível em 21/06
17/06 · 18h15   Supervisora Ana Silva revisou Livro do Dia de 21/06: Beatriz alocada no Bloco 3; Astrid em aberto
17/06 · 18h22   Livro do Dia de 21/06 republicado
17/06 · 18h22   Avisos enviados: Beatriz Lima (nova alocação Bloco 3), Amanda Souza (folga aprovada)
17/06 · 18h40   Beatriz Lima confirmou nova alocação
17/06 · 18h55   Amanda Souza visualizou confirmação

19/06 · 08h47   Carlos Neto — Restrição Médica aprovada: acrobacia e contorção restrita
19/06 · 09h22   Sistema detectou: Beatriz Lima cobre posição de acrobacia no Musical de 21/06 → incompatível com restrição de Carlos [incorreto — reflagging por precaução]
                [SISTEMA]: Beatriz Lima sem restrição; verificação OK. Carlos não cobre Astrid. Astrid permanece em aberto.
                [SISTEMA]: Beatriz Lima registrou restrição própria (Operacional — ombro) · início 19/06
                Astrid Musical 12h30 de 21/06 → Beatriz não disponível como substituta de Astrid

19/06 · 09h45   Sistema reflagged Livro do Dia 21/06: Bloco 3 com Beatriz agora incompatível
19/06 · 10h01   Supervisora Ana Silva alertada: Beatriz indisponível — Bloco 3 em aberto; Astrid continua em aberto
19/06 · 11h05   Supervisora Ana Silva REVOGOU aprovação de Amanda
                Motivo: "Beatriz tem restrição de ombro que a impede de cobrir Astrid e Bloco 3. Não há cobertura suficiente para 21/06."
19/06 · 11h05   Escala revertida: Amanda restaurada como disponível em 21/06
19/06 · 11h15   Livro do Dia de 21/06 revisado e republicado: Amanda restaurada em Astrid e Bloco 3
19/06 · 11h18   Avisos enviados: Amanda Souza (folga revogada, motivo comunicado), Beatriz Lima (alocação cancelada)
19/06 · 11h30   Amanda Souza confirmou
19/06 · 11h45   Beatriz Lima confirmou

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PADRÃO DETECTADO [IA]
3ª solicitação de folga de Amanda para sábado nas últimas 4 semanas.
Amanda é titular de Astrid — função única no Musical. Folga em dia de show exige cobertura que raramente existe.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## PARTE 7 — IA

### 7.1 Participação da IA em cada etapa

| Etapa | Onde | O que a IA faz |
|---|---|---|
| **Criação da solicitação** | S-06 (Membro) | Sugere o tipo correto de solicitação baseado na descrição livre do Membro (ex.: "vou chegar mais tarde" → sugere Chegada Tardia) |
| **Análise de impacto** | S-06 (Supervisor) | Calcula automaticamente o impacto operacional; apresenta antes das opções Aprovar/Negar; identifica papéis exclusivos vs. com cobertura |
| **Acumulado de folgas** | S-06 (Supervisor) | Detecta quando múltiplas folgas aprovadas para a mesma data, individualmente gerenciáveis, coletivamente tornam-se críticas |
| **Atualização da Escala** | S-04 | Detecta posições descobertas após aprovação; classifica candidatos a substituto por risco (4 camadas); simula efeito cascata de cada candidato |
| **Revisão do Livro do Dia** | S-05 | Gera proposta atualizada de Livro com as novas alocações; destaca diferenças em relação à versão anterior; aponta posições ainda em aberto |
| **Monitoramento de Avisos** | S-08 | Monitora status de confirmação por membro; alerta o Supervisor quando membro não confirmou com atividade se aproximando |
| **Meu Dia** | S-01 | Traduz a mudança em linguagem pessoal para o membro ("O que mudou no show de hoje?"); responde dúvidas contextuais sem navegar para outras telas |
| **Histórico e Investigação** | S-11 | Resume a narrativa completa de cada ciclo; detecta padrões de reincidência; responde perguntas do Admin ("O que aconteceu com Amanda neste mês?") |

---

### 7.2 As 5 perguntas que a IA deve responder em cada ciclo

**1. O que mudou?**
> "Amanda solicitou folga para 21/06. Aprovada. Escala atualizada: Amanda removida de Astrid (Musical 12h30) e Bloco 3 (Ensaio 16h). Beatriz foi alocada no Bloco 3. Astrid permanece em aberto."

**2. Quem foi impactado?**
> "Diretamente: Amanda (folga) e Beatriz (nova alocação). Indiretamente: todos os membros do Musical de 21/06 — a posição de Astrid ainda está sem cobertura."

**3. Existe risco?**
> "Sim. Astrid no Musical de 21/06 está em aberto sem candidato com risco baixo disponível. Únicas opções: Júlia (sem preparo artístico para Astrid, risco alto) ou negociar com Amanda data alternativa."

**4. Quem ainda não confirmou?**
> "Beatriz Lima ainda não confirmou a nova alocação. Aviso enviado há 47 minutos. O ensaio começa em 3 horas."

**5. A operação continua coberta?**
> "Parcialmente. Bloco 3 está coberto. Astrid está em aberto. A operação do Musical de 21/06 está em risco até que a posição de Astrid seja resolvida."

---

### 7.3 O que a IA NUNCA faz

| Proibição | Razão |
|---|---|
| Tomar a decisão de aprovar ou negar | Responsabilidade do Supervisor |
| Confirmar uma substituição sem aprovação explícita | Toda execução exige confirmação humana |
| Enviar Avisos sem publicação | Avisos automáticos ocorrem somente pós-publicação |
| Alterar o Livro do Dia publicado sem ação do Supervisor | Publicação é decisão operacional |
| Revogar uma aprovação | Revogação é decisão de alta consequência — sempre do Supervisor |
| Responder como se fosse o Supervisor em conversas com membros | A IA não representa o Supervisor |

---

## PARTE 8 — AUDITORIA DE INTEGRAÇÃO

---

### Q1 — Existe informação duplicada?

**Risco identificado:** Folga aprovada aparece em S-06 (estado da solicitação), na Escala S-04 (membro indisponível), no Meu Dia S-01 do membro (folga confirmada) e no Histórico S-11.

**Veredito:** Não é duplicação — é propagação correta. Cada superfície apresenta o mesmo dado em **contexto diferente**:
- S-06: processo da decisão
- S-04: impacto operacional no grupo
- S-01: realidade individual do membro
- S-11: registro auditável

A duplicação real seria se o mesmo dado precisasse ser **inserido manualmente** em mais de um lugar. Neste ciclo, não existe: o dado é inserido uma vez (decisão em S-06) e propagado automaticamente.

**Status: ✅ Sem duplicação real.**

---

### Q2 — Existe atualização manual desnecessária?

**Risco identificado:** Após folga aprovada, o Supervisor precisa manualmente revisar e republicar o Livro do Dia. Isso é intencional?

**Veredito:** Sim, é intencional e correto. A revisão do Livro do Dia pelo Supervisor não é burocracia — é a etapa onde ele decide como resolver as posições descobertas. O sistema não pode decidir automaticamente quem cobre Astrid: essa é uma decisão operacional que exige julgamento.

**O que pode ser otimizado:** o sistema já pré-seleciona candidatos e gera proposta atualizada. O Supervisor revisa e aprova — não constrói do zero. O trabalho manual é reduzido ao mínimo sem eliminar a decisão.

**Status: ✅ Sem atualização manual desnecessária.**

---

### Q3 — Existe risco de inconsistência entre superfícies?

**Risco crítico identificado: janela de inconsistência.**

Após aprovação de uma Solicitação:
1. A Escala é atualizada automaticamente (S-04) — imediato
2. O Livro do Dia é flagged para revisão — imediato
3. O Supervisor ainda não republicou o Livro do Dia — pode demorar horas

Durante essa janela:
- A Escala diz que o membro está de folga
- O Livro do Dia publicado ainda diz que o membro está alocado
- O Meu Dia do membro ainda mostra a atividade (Livro publicado não foi atualizado)

**Esse é o principal ponto de inconsistência do ciclo.**

**Resolução:** o sistema deve sinalizar visualmente esse estado de inconsistência para o Supervisor (no Painel Operacional: "Livro do Dia de [data] desatualizado — revisão pendente") e bloquear a distribuição do Livro para membros enquanto está em estado de inconsistência com a Escala. O Supervisor não pode "esquecer" de revisar — o Painel mostra como item pendente com urgência proporcional à data.

**Status: ⚠️ Risco identificado e mitigável por design.**

---

### Q4 — Existe silêncio operacional?

**Silêncio operacional:** momento onde algo mudou mas nenhum usuário foi informado ou nenhum sistema foi acionado.

**Risco identificado: Solicitação de Restrição aprovada → gap antes do registro oficial.**

Conforme identificado na Parte 2 (Momento de Risco 1): entre a aprovação da Solicitação de Restrição e o registro da Restrição oficial pelo Supervisor, existe uma janela onde o membro pode ser alocado em posições incompatíveis sem que o sistema saiba. Se o Supervisor demorar a registrar a restrição formal, a operação acontece com dado desatualizado.

**Resolução:** alertas persistentes ao Supervisor após aprovação de Solicitação de Restrição; apresentação automática do formulário de Registro na mesma sessão; limitação de prazo antes de escalada ao Admin.

**Status: ⚠️ Risco identificado. Mitigável por UX.**

---

### Q5 — Existe alguma etapa sem dono?

Conforme mapeado na Parte 2, foram identificados 3 momentos de risco com proprietário parcial ou ausente:

| Momento | Status atual | Resolução proposta |
|---|---|---|
| Registro da Restrição após aprovação da Solicitação | Supervisor responsável sem prazo | Formulário automático + prazo com escalada |
| Revisão de múltiplos Livros do Dia afetados por Restrição longa | Supervisor responsável sem fila priorizada | Fila gerenciada pelo sistema por data de ocorrência |
| Membro não confirma mudança crítica | Supervisor acionado sem protocolo definido | Escalada automática ao Admin por limiar temporal |

**Status: ⚠️ Momentos sem dono identificados. Resoluções propostas.**

---

### Q6 — Existe alguma confirmação perdida?

**Risco identificado:** após revogação de aprovação, o membro precisa confirmar que recebeu a notificação de revogação — e que está ciente de que voltará a estar alocado. Se o membro não abrir o app e não confirmar, o sistema não tem garantia de que ele saberá que a folga foi revogada.

Esse é um cenário de alto risco operacional: membro espera folga, não aparece, operação comprometida.

**Resolução:** após revogação, o sistema deve:
1. Enviar push de nível Crítico (não apenas Importante)
2. Adicionar card no topo do Meu Dia com flag "ALTERAÇÃO URGENTE — Sua folga foi revogada"
3. Exigir confirmação explícita (mesmo protocolo de substituição crítica)
4. Se não confirmado em [X horas], alertar Supervisor e escalar para contato direto

**Status: ⚠️ Risco identificado. Protocolo de revogação precisa de nível de alerta Crítico.**

---

### Q7 — Existe algum ponto onde o membro pode ficar desatualizado?

Três pontos identificados:

**Ponto 1 — Janela de inconsistência Escala/Livro do Dia (Q3 acima):**
O Livro publicado e o Meu Dia do membro estão corretos, mas a Escala já foi atualizada. O membro está com informação correta até aqui — o risco é para o Supervisor, não para o membro neste momento.

**Ponto 2 — Push não entregue:**
Se o membro está sem conexão quando a mudança é publicada, o push não chega. Na próxima abertura do app, o Meu Dia já estará atualizado — mas o membro pode abrir o app offline (cache). Solução: indicador visual de "última sincronização" no Meu Dia; conteúdo em cache claramente identificado como "última versão disponível — pode estar desatualizado."

**Ponto 3 — Confirmação como garantia falsa:**
O membro confirma mas não lê o conteúdo (toca em "Confirmar" mecanicamente). O sistema registra a confirmação, mas o membro pode não ter absorvido a mudança.

**Resolução para o Ponto 3:** a confirmação deve exibir a informação-chave de forma incontornável antes de apresentar o botão de confirmação (o que mudou → confirmar). Não é possível confirmar sem ver o delta.

**Status: ⚠️ 3 pontos identificados. Ponto 2 e 3 mitigáveis por UX.**

---

### Q8 — Existe algum ponto onde o Supervisor perde visibilidade?

**Risco identificado: visibilidade após escalada ao Admin.**

Quando uma solicitação escala para o Admin (Supervisor não respondeu dentro do limiar), o Admin assume. Nesse momento, o Supervisor pode:
a) Não saber que o Admin assumiu
b) Tentar agir em paralelo (conflito de decisões)
c) Ficar sem notificação de que a situação foi resolvida

**Resolução:** ao escalar para o Admin, o Supervisor deve receber:
- Notificação de que a solicitação foi escalada (com motivo: inatividade por X horas)
- Status em tempo real do que o Admin decidiu
- Registro no Histórico de que a decisão foi tomada pelo Admin, não pelo Supervisor

**Segunda visibilidade perdida: Membro que não confirma após o Supervisor agir.**
Identificado em Q6: o Supervisor envia aviso, membro não confirma, atividade está próxima. Se o sistema não alerta proativamente, o Supervisor assume que o membro sabe — e o membro pode não saber.

**Status: ⚠️ 2 riscos identificados. Mitigáveis por protocolo de escalada e monitoramento proativo.**

---

## PARTE 9 — VEREDITO E MAPA OFICIAL

---

### Mapa Oficial do Ciclo de Planejamento Operacional

```
══════════════════════════════════════════════════════════════════
CICLO DE PLANEJAMENTO OPERACIONAL — MyASA 2.0
══════════════════════════════════════════════════════════════════

GATILHO: Solicitação decidida em S-06

┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 1 — DECISÃO (S-06)                                    │
│                                                              │
│  Membro cria ──► Supervisor analisa ──► Decide              │
│                       ↑                                      │
│                    [IA calcula impacto]                      │
│                                                              │
│  Saídas:                                                     │
│  ├── APROVADA ──────────────────────────────────► (continua)│
│  ├── NEGADA ──────► Notificação ao Membro ──────► FIM        │
│  ├── REVOGADA ──────► Notificação ao Membro ────► (reinicia)│
│  └── PROPOSTA ALTERNATIVA ──► Membro decide ───► (continua) │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 2 — ESCALA (S-04)                                     │
│                                                              │
│  [Automático] Sistema atualiza disponibilidade do membro    │
│                                                              │
│  Posições afetadas classificadas como:                       │
│  ├── COBERTA (substituto disponível e alocado)              │
│  ├── EM RISCO (candidato disponível mas não confirmado)     │
│  └── EM ABERTO (sem candidato — ação urgente)               │
│                                                              │
│  [IA] Classifica candidatos por 4 camadas de risco          │
│  [IA] Simula cascata antes de cada candidato                 │
│                                                              │
│  ! Exceção: Restrição requer registro manual antes deste   │
│  nível. Gap de risco entre aprovação e registro.            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 3 — LIVRO DO DIA (S-05)                               │
│                                                              │
│  [Automático] Livros afetados flagged para revisão          │
│                                                              │
│  Comportamento por estado do Livro:                          │
│  ├── Não gerado → próxima geração já considera mudança     │
│  ├── Gerado, não publicado → revisão antes de publicar     │
│  └── Publicado → revisão obrigatória + republicação        │
│                                                              │
│  [Supervisor] Revisa → ajusta cobertura → aprova → publica  │
│  [IA] Gera proposta atualizada; destaca delta da versão     │
│  anterior; aponta posições ainda em aberto                   │
│                                                              │
│  ! Risco principal do ciclo: janela de inconsistência entre│
│  Escala atualizada e Livro ainda publicado na versão antiga │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 4 — AVISOS (S-08)                                     │
│                                                              │
│  [Automático pós-publicação] Sistema calcula delta de      │
│  impacto por membro → envia aviso no nível correto         │
│                                                              │
│  Níveis:                                                     │
│  ├── INFORMATIVO → feed de Avisos; sem confirmação         │
│  ├── IMPORTANTE → Meu Dia + feed; exige confirmação        │
│  └── CRÍTICO → topo absoluto + push; sem descarte          │
│                                                              │
│  [Sistema] Nível determinado por impacto; não pelo Supervisor│
│  [IA] Monitora quem não confirmou; alerta por proximidade  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 5 — MEU DIA (S-01)                                    │
│                                                              │
│  [Automático pós-publicação] Meu Dia atualizado com delta  │
│                                                              │
│  Hierarquia visual dinâmica:                                │
│  ├── Topo: Alteração não confirmada (CRÍTICO/IMPORTANTE)   │
│  ├── Próxima atividade                                       │
│  └── Linha do tempo do dia                                   │
│                                                              │
│  Card de alteração persiste até confirmação explícita.     │
│  Confirmação mostra delta obrigatório antes do botão.       │
│                                                              │
│  3 camadas de proteção:                                      │
│  1. Visual persistente até confirmação                       │
│  2. Push notification                                        │
│  3. Re-notificação proativa por proximidade de horário      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 6 — CONFIRMAÇÃO                                       │
│                                                              │
│  Membro confirma explicitamente no Meu Dia (toque)         │
│  Supervisor vê em tempo real no Painel Operacional          │
│                                                              │
│  Se não confirmado antes do limiar:                          │
│  ├── Re-notificação ao membro                               │
│  ├── Alerta ao Supervisor                                    │
│  └── Escalada ao Admin (se crítico e próximo do horário)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 7 — HISTÓRICO (S-11)                                  │
│                                                              │
│  [Automático] Registro de cada ação com timestamp e autor   │
│  [IA] Narrativa resumida do ciclo completo                   │
│  [IA] Detecção de padrão de reincidência                    │
│                                                              │
│  Disponível para: Supervisor (revisão), Admin (auditoria)  │
│  Pergunta respondida: "O que aconteceu, quem fez, todos    │
│  confirmaram, existe padrão?"                               │
└─────────────────────────────────────────────────────────────┘

══════════════════════════════════════════════════════════════════
```

---

### Resumo dos Riscos Identificados e Status

| # | Risco | Severidade | Status |
|---|---|---|---|
| R1 | Gap entre aprovação de Restrição e Registro oficial | Alta | Mitigável por UX — formulário automático pós-aprovação |
| R2 | Janela de inconsistência Escala/Livro do Dia | Alta | Mitigável por design — Livro publicado deve mostrar estado "Desatualizado" visualmente |
| R3 | Revogação sem nível de alerta Crítico | Alta | Mitigável por protocolo — nível Crítico obrigatório em revogações |
| R4 | Membro sem conexão não recebe push | Média | Mitigável por UX — indicador de sincronização no Meu Dia |
| R5 | Confirmação mecânica sem absorção do conteúdo | Média | Mitigável por UX — delta obrigatório antes do botão Confirmar |
| R6 | Supervisor perde visibilidade após escalada ao Admin | Média | Mitigável por protocolo — notificação de escalada + status em tempo real |
| R7 | Livros do Dia de longa restrição sem fila priorizada | Baixa | Mitigável por sistema — fila ordenada por data de ocorrência |

---

### Veredito

## 🟢 Ciclo consistente

O Ciclo de Planejamento Operacional do MyASA está estruturalmente correto. As 7 superfícies formam uma cadeia coerente sem sobreposição de responsabilidades e sem silêncio operacional estrutural. Os 7 riscos identificados são todos mitigáveis por decisões de UX e protocolo — nenhum deles representa contradição arquitetural.

**O ciclo está pronto para guiar o design de S-05 (Livro do Dia), S-08 (Avisos), S-11 (Histórico) e S-10 (IA)** como próximas superfícies do Bloco 2.

---

### Decisões confirmadas por este ciclo

| # | Decisão |
|---|---|
| D-01 | Atualização da Escala é automática pós-aprovação para tipos Folga, Troca, Ajuste e Restrição (após registro oficial) |
| D-02 | Nenhum Livro do Dia publicado é alterado silenciosamente — toda mudança exige revisão + republicação pelo Supervisor |
| D-03 | Avisos são gerados automaticamente pós-publicação; nível determinado pelo sistema, não pelo Supervisor |
| D-04 | Card de alteração no Meu Dia persiste até confirmação explícita — o tempo não substitui confirmação |
| D-05 | Confirmação exige visualização do delta antes do botão — impossível confirmar sem ver o que mudou |
| D-06 | Revogação de aprovação tem nível de alerta Crítico — igual a cancelamento de show |
| D-07 | Restrição Administrativa não tem impacto na Escala — Meu Dia não é alterado |
| D-08 | A IA nunca toma decisões operacionais — apenas calcula, sugere, alerta e narra |
| D-09 | Histórico é narrativa, não log — gerado pela IA com linguagem natural a partir dos eventos do ciclo |
| D-10 | Escalada ao Admin gera notificação ao Supervisor com status em tempo real da decisão do Admin |

---

*Documento elaborado por Product Designer Sênior — MyASA 2.0*
*Base: Arquitetura v17/06/2026, Pesquisas dos 3 perfis, Jornadas aprovadas, Especificação S-06 v2, Bloco 1 completo*
