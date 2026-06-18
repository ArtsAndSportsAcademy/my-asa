# MyASA 2.0 — Modelagem da Entidade Mudança Operacional

> **Versão:** 18/06/2026
> **Fase:** Modelagem de Entidade — anterior a wireframes de novas superfícies
> **Base:** Arquitetura MyASA 2.0 · Ciclo de Planejamento Operacional · Bloco 1 · S-06 · Pesquisas dos 3 perfis · Jornadas aprovadas
> **Status:** 🟢 Entidade consistente — pronta para guiar design de S-05, S-08, S-11 e S-10

---

## PARTE 1 — DEFINIÇÃO

---

### O que é uma Mudança Operacional?

Uma **Mudança Operacional** é a entidade transversal que representa qualquer alteração no estado oficial da operação que:

1. **Afeta a programação publicada de pelo menos um membro** — papel, horário, alocação, disponibilidade ou presença em atividade
2. **Foi tornada oficial** — por publicação de Escala, republicação de Livro do Dia, aprovação de Solicitação, ou ação direta de Supervisor/Admin
3. **Tem destinatários definidos** — membros que precisam saber e/ou confirmar
4. **Deixa rastro auditável** — registrada no Histórico como entidade única, não como série de eventos isolados

Uma Mudança Operacional não é um evento técnico. É um fato operacional com consequências para quem executa a operação.

**Definição oficial:**

> *Uma Mudança Operacional é toda alteração ao estado publicado da operação que impacta o que um membro faz, quando faz, como faz ou se faz — e que, por esse motivo, precisa ser comunicada, confirmada e registrada.*

---

### O que não é uma Mudança Operacional?

| Evento | Por que não é Mudança Operacional |
|---|---|
| Solicitação em análise (ainda não decidida) | Não é oficial — é processo interno |
| Rascunho de Escala não publicado | Não afetou ninguém ainda |
| Análise de impacto pelo Supervisor | Fase de avaliação, não de mudança |
| Aviso geral (sem alteração de programação) | Comunicação, não alteração de estado |
| Mudança no Livro do Show (estrutura base) | Não propaga automaticamente para Livros do Dia existentes |
| Compromisso pessoal do Membro | Sem impacto operacional |
| Solicitação Administrativa aprovada | Sem impacto na Escala ou programação |
| Entrega criada ou atualizada | Paralela à operação — não altera programação |
| Restrição aprovada mas ainda não registrada | Não tem efeito operacional até o registro oficial |

---

### Quais eventos geram uma Mudança Operacional?

| Evento gerador | Tipo de Mudança |
|---|---|
| Solicitação de Folga aprovada | Mudança de Pessoa (disponibilidade) |
| Solicitação de Restrição aprovada + Restrição registrada | Mudança de Restrição |
| Troca de Folga aprovada | Mudança de Cobertura (bidirecional) |
| Chegada Tardia aprovada | Mudança de Horário |
| Saída Antecipada aprovada | Mudança de Horário |
| Ajuste de Escala aprovado | Mudança de Papel ou Mudança de Horário |
| Solicitação Excepcional aprovada com impacto operacional | Mudança de Pessoa ou Mudança de Escala |
| Substituição confirmada pelo Supervisor (no-show, emergência) | Mudança de Pessoa |
| Supervisor altera alocação diretamente na Escala | Mudança de Escala |
| Cancelamento de show | Mudança de Show |
| Adição de show à Agenda | Mudança de Show |
| Publicação inicial do Livro do Dia | Mudança de Livro do Dia |
| Republicação do Livro do Dia | Mudança de Livro do Dia |
| Restrição encerrada ou renovada pelo Supervisor | Mudança de Restrição |
| Admin reconfigura Grupo Operacional | Mudança de Estrutura |

---

### Quais eventos NÃO geram uma Mudança Operacional?

| Evento | Razão |
|---|---|
| Solicitação Administrativa aprovada | Sem impacto operacional |
| Aviso geral criado pelo Supervisor | Comunicação; não altera programação |
| Mensagem direta entre usuários | Canal conversacional, não operacional |
| Entrega criada, revisada ou avaliada | Ciclo de Entrega é paralelo à Escala |
| Mudança no Livro do Show | Estrutura base; não propaga retroativamente |
| Restrição Médica atingiu data de revisão sem encerramento | Alerta, não mudança — aguarda ação do Supervisor |
| Lembrete ou compromisso pessoal do Membro | Privado; sem impacto operacional |
| Admin altera configurações da Operação (nome, fuso, etc.) | Configuração, não mudança de estado operacional |

---

## PARTE 2 — TIPOS

---

### Tipo 1 — Mudança de Pessoa

**Definição:** A posição permanece a mesma, mas a pessoa alocada muda. Quem cobre determinado papel ou atividade é diferente do que estava publicado.

**Origem:**
- Folga aprovada → posição descoberta → substituto alocado
- No-show → Supervisor confirma substituição (JS-03)
- Solicitação Excepcional aprovada com movimento de pessoa

**Impacto:** Alto. O membro que sai precisa saber que está liberado. O membro que entra precisa saber que foi alocado. A operação precisa garantir que o entrante está preparado (capacidade artística, técnica, física).

**Destinatários:**
- Membro que sai da posição: notificação de que foi substituído (ou liberado)
- Membro que entra na posição: notificação de nova alocação — exige confirmação
- Supervisor: visibilidade de que ambos confirmaram

**Necessidade de confirmação:** Obrigatória para o membro que entra. Recomendada (mas não bloqueante) para o membro que sai.

---

### Tipo 2 — Mudança de Papel

**Definição:** Mesma pessoa, mesma atividade, mesmo horário — mas o papel ou função atribuída muda. O membro sabia que trabalharia, mas não o que faria.

**Origem:**
- Ajuste de Escala aprovado (Tipo 5 de S-06)
- Revisão do Livro do Dia pelo Supervisor
- Substituição parcial (Supervisor mantém o membro mas muda sua função)

**Impacto:** Médio a alto, dependendo do papel. Troca de papel de figurante para protagonista: alto. Mudança de posição dentro de um bloco: médio.

**Destinatários:**
- Membro com papel alterado: notificação com comparativo (era: X → agora: Y)

**Necessidade de confirmação:** Obrigatória. O membro precisa se preparar de forma diferente.

---

### Tipo 3 — Mudança de Horário

**Definição:** Mesma pessoa, mesmo papel — mas o horário de entrada, saída ou duração da atividade muda.

**Origem:**
- Chegada Tardia aprovada
- Saída Antecipada aprovada
- Alteração de horário na Agenda (Admin ou Supervisor)

**Impacto:** Baixo a médio. Depende do quanto o horário varia e se há atividades afetadas na janela de diferença.

**Destinatários:**
- Membro com horário alterado
- (Se a mudança cria conflito com outra atividade) Supervisor: alerta de cobertura descoberta

**Necessidade de confirmação:** Obrigatória. Horário é dado operacional crítico.

---

### Tipo 4 — Mudança de Cobertura

**Definição:** O estado de cobertura de uma posição muda — de coberta para em aberto, de em risco para coberta, ou de em aberto para coberta. Não necessariamente muda quem está alocado — pode ser que a posição fique vaga.

**Origem:**
- Folga aprovada sem substituto definido → posição em aberto
- Restrição registrada → membro excluído de posição → em aberto
- Troca de Folga (bidirecional: data X volta a ser coberta; data Y descobre)
- Substituição confirmada → posição que estava em aberto volta a estar coberta

**Impacto:** Crítico quando a posição em aberto é de papel exclusivo (sem substituto disponível). Médio quando há alternativas.

**Destinatários:**
- Supervisor: responsável por resolver posições em aberto — alertado imediatamente
- Admin: monitoramento quando posição crítica persiste além do limiar
- Membros: apenas quando a cobertura é resolvida e uma nova alocação é publicada

**Necessidade de confirmação:** O Supervisor confirma a resolução. Membros afetados pela resolução confirmam individualmente.

---

### Tipo 5 — Mudança de Estrutura

**Definição:** A estrutura organizacional que define quem gerencia quem muda — Grupos Operacionais reconfigurados, membros movidos entre grupos, escopo de Supervisor alterado.

**Origem:**
- Admin reconfigura Grupos Operacionais
- Admin move membro entre grupos
- Admin altera Supervisores de um grupo

**Impacto:** Sistêmico. Afeta futuras gerações de Escala, acesso de Supervisores, cálculo de cobertura por grupo, análise de acumulado de folgas.

**Destinatários:**
- Supervisores afetados (mudança de escopo)
- Membros movidos de grupo (para ciência)
- Admin: confirmação de que a reconfiguração está correta

**Necessidade de confirmação:** Supervisor confirma novo escopo. Membros recebem aviso informativo (sem confirmação obrigatória).

---

### Tipo 6 — Mudança de Show

**Definição:** Um evento com impacto operacional na Agenda é adicionado, modificado ou cancelado. Isso altera o que existe para ser coberto — antes mesmo de alterar quem cobre.

**Origem:**
- Admin ou Supervisor cancela show na Agenda
- Admin ou Supervisor adiciona show
- Admin ou Supervisor altera data/horário de show existente

**Impacto:** Crítico em cancelamento (atividade deixa de existir; todos os alocados são liberados ou realocados). Alto em adição (nova demanda de cobertura). Médio em mudança de horário.

**Destinatários:**
- Cancelamento: todos os membros alocados no show
- Adição: Supervisor (nova demanda a ser coberta)
- Alteração de horário: todos os alocados

**Necessidade de confirmação:** Obrigatória e de nível Crítico em cancelamentos. Obrigatória em alterações de horário.

---

### Tipo 7 — Mudança de Livro do Dia

**Definição:** O Livro do Dia de um show específico em uma data específica é publicado pela primeira vez ou republicado com alterações. O Livro publicado é o documento oficial que define exatamente quem faz o quê naquele show.

**Origem:**
- Aprovação do Livro do Dia pelo Supervisor (publicação inicial)
- Supervisor republica após revisão motivada por: folga, restrição, substituição, ajuste operacional

**Impacto:** Variável — depende do delta entre versões. Uma publicação inicial com tudo como esperado tem impacto baixo (confirmação de certeza). Uma republicação que muda 3 posições tem impacto alto.

**Destinatários:**
- Todos os membros com posição no Livro publicado
- O sistema calcula individualmente o delta de cada membro — quem não teve mudança não recebe aviso de alteração

**Necessidade de confirmação:** Proporcional ao nível do delta de cada membro. Membro com nova alocação: confirmação obrigatória. Membro sem alteração: sem confirmação necessária.

---

### Tipo 8 — Mudança de Restrição

**Definição:** Uma restrição ativa no perfil de um membro é registrada, encerrada, renovada ou alterada. Isso modifica quais posições o membro pode ocupar em todas as datas dentro do período da restrição.

**Origem:**
- Supervisor registra Restrição após aprovar Solicitação de Restrição
- Supervisor encerra Restrição (membro recuperado)
- Supervisor renova Restrição (data de revisão atingida)
- Admin registra Restrição diretamente

**Impacto:** Persistente e temporal. Diferente de todos os outros tipos — não é pontual. Afeta um intervalo inteiro de datas e pode impactar múltiplos Livros do Dia já gerados.

**Destinatários:**
- Membro: ciência de que a restrição está registrada / encerrada / renovada
- Supervisor: lista de Livros do Dia afetados que precisam de revisão (quando restrição nova ou encerrada)

**Necessidade de confirmação:** Membro confirma ciência da restrição. Supervisor confirma os Livros revisados individualmente (não é uma única confirmação).

---

### Tipo 9 — Mudança de Escala

**Definição:** O Supervisor altera diretamente a Escala — sem origem em Solicitação de Membro. Acontece em emergências (no-show), ajustes preventivos, ou reorganizações operacionais diretas.

**Origem:**
- JS-03 (Substituição Emergencial) — Supervisor confirma movimento de membro
- Supervisor age proativamente antes de uma data crítica
- Supervisor corrige erro em alocação já publicada

**Impacto:** Variável. Uma substituição de emergência tem impacto alto e urgência máxima. Um ajuste preventivo para uma data distante tem impacto médio e urgência baixa.

**Destinatários:**
- Membro que sai de uma posição
- Membro que entra em uma posição
- Supervisor: rastreamento de confirmações

**Necessidade de confirmação:** Obrigatória para membro com nova alocação. Nível de urgência proporcional à proximidade do horário.

---

### Resumo comparativo dos tipos

| Tipo | Pontual? | Persistente? | Urgência típica | Quem age primeiro |
|---|---|---|---|---|
| Mudança de Pessoa | Sim | Não | Alta | Sistema (automático) |
| Mudança de Papel | Sim | Não | Alta | Sistema (automático) |
| Mudança de Horário | Sim | Não | Média | Sistema (automático) |
| Mudança de Cobertura | Sim | Não | Crítica | Supervisor (ação necessária) |
| Mudança de Estrutura | Sim | Sim | Baixa a média | Admin |
| Mudança de Show | Sim | Não | Crítica (cancelamento) | Sistema (automático) |
| Mudança de Livro do Dia | Sim | Não | Variável | Supervisor |
| Mudança de Restrição | Sim | Sim (duração) | Média | Supervisor |
| Mudança de Escala | Sim | Não | Alta a Crítica | Supervisor |

---

## PARTE 3 — CICLO DE VIDA

---

### Estados oficiais

```
                    ┌──────────┐
        [Evento]    │          │
        ──────────► │  CRIADA  │
                    │          │
                    └────┬─────┘
                         │ Sistema calcula impacto [automático]
                         ▼
                    ┌──────────┐
                    │          │
                    │ANALISADA │
                    │          │
                    └────┬─────┘
                         │ Sistema aplica na Escala [automático]
                         │ (ou Supervisor registra Restrição)
                         ▼
                    ┌──────────┐
                    │          │
                    │ APLICADA │
                    │          │
                    └────┬─────┘
                         │ Supervisor publica Escala/Livro do Dia
                         ▼
                    ┌──────────┐
                    │          │       ┌─────────────┐
                    │PUBLICADA │──────►│   REVOGADA  │
                    │          │       └─────────────┘
                    └────┬─────┘   (Supervisor reverte)
                         │ Sistema envia Avisos [automático]
                         │ Sistema atualiza Meu Dia [automático]
                         ▼
                    ┌──────────┐
                    │          │
                    │COMUNICADA│
                    │          │
                    └────┬─────┘
                         │ Membros confirmam individualmente
                         ▼
                    ┌───────────────────────┐
                    │                       │
                    │ PARCIALMENTE          │
                    │ CONFIRMADA            │
                    │ (1..n-1 confirmados)  │
                    │                       │
                    └────┬──────────────────┘
                         │ Todos confirmaram
                         ├────────────────────────► CONFIRMADA [FIM]
                         │
                         │ Tempo esgotado sem confirmação completa
                         └────────────────────────► EXPIRADA
                                                          │
                                                    Supervisor age
                                                          │
                                                    (pode gerar nova
                                                   Mudança ou registrar
                                                   exceção no Histórico)
```

---

### Estados ausentes na especificação original — identificados e justificados

| Estado novo | Justificativa |
|---|---|
| **PARCIALMENTE CONFIRMADA** | É o estado mais comum em grupos grandes. Entre COMUNICADA e CONFIRMADA existe um intervalo onde alguns membros confirmaram e outros não. Esse estado precisa existir explicitamente para que o Supervisor saiba que ainda há pendências — sem precisar calcular manualmente. |
| **EM RESOLUÇÃO** | Para Mudanças de Cobertura: quando uma posição ficou em aberto e o Supervisor está ativamente buscando substituto. Diferente de APLICADA (já resolvida) e CRIADA (só detectada). Permite que o sistema monitore o tempo que uma posição fica em aberto. |

**Total de estados oficiais: 9**
CRIADA · ANALISADA · APLICADA · PUBLICADA · COMUNICADA · PARCIALMENTE CONFIRMADA · CONFIRMADA · EXPIRADA · REVOGADA

*(EM RESOLUÇÃO é estado interno de Mudança de Cobertura — não se aplica a todos os tipos.)*

---

### Quem move cada estado?

| Transição | Quem move | Automático? |
|---|---|---|
| → CRIADA | Sistema (evento gatilho detectado) | Sim |
| CRIADA → ANALISADA | Sistema (cálculo de impacto pela IA) | Sim |
| ANALISADA → APLICADA | Sistema (atualização da Escala) | Sim — exceto Restrição (exige registro manual) |
| APLICADA → PUBLICADA | Supervisor | Não — ação explícita de publicação |
| PUBLICADA → COMUNICADA | Sistema (envio de Avisos + atualização do Meu Dia) | Sim |
| COMUNICADA → PARCIALMENTE CONFIRMADA | Sistema (quando 1º membro confirma) | Sim |
| PARCIALMENTE CONFIRMADA → CONFIRMADA | Sistema (quando último membro confirma) | Sim |
| COMUNICADA → EXPIRADA | Sistema (limiar de tempo atingido) | Sim |
| PARCIALMENTE CONFIRMADA → EXPIRADA | Sistema (limiar + atividade já ocorreu) | Sim |
| PUBLICADA → REVOGADA | Supervisor | Não — ação explícita |

---

### Quem audita?

| Perfil | Escopo de auditoria |
|---|---|
| **Supervisor** | Mudanças dentro do seu Grupo Operacional |
| **Admin** | Todas as Mudanças de todas as Operações |
| **IA** | Agregação e identificação de padrões em qualquer escopo |
| **Membro** | Apenas as Mudanças que o afetam diretamente (via Meu Dia e Histórico pessoal) |

---

### Quem pode reverter um estado?

| Estado | Pode reverter? | Quem | Para qual estado | Impacto |
|---|---|---|---|---|
| CRIADA | Não aplicável | — | — | — |
| ANALISADA | Não | — | — | Análise não é reversível — é snapshot automático |
| APLICADA | Sim | Supervisor | → nova Mudança (a revogação cria uma nova Mudança Operacional inversa) | Requer nova publicação |
| PUBLICADA | Sim | Supervisor | → REVOGADA | Gera nova rodada de Avisos de nível Crítico |
| COMUNICADA | Não diretamente | — | — | Aviso já foi entregue; revogação gera nova Mudança |
| CONFIRMADA | Não | — | — | Estado final; revogação só como nova Mudança |
| EXPIRADA | Sim (parcialmente) | Supervisor | Supervisor pode publicar uma resolução tardia | O Histórico registra o atraso |

**Regra fundamental:** uma revogação não "desfaz" uma Mudança Operacional já registrada. Ela cria uma **nova Mudança Operacional** do tipo inverso. O Histórico mantém ambas — a mudança original e a revogação — como narrativa completa.

---

## PARTE 4 — PROPAGAÇÃO

---

### Quando uma Mudança Operacional nasce, o que acontece em cada superfície?

---

#### Escala (S-04)

| Momento | O que acontece |
|---|---|
| CRIADA → ANALISADA | Sistema recalcula cobertura de posições afetadas; classifica como Coberta / Em Risco / Em Aberto |
| ANALISADA → APLICADA | Sistema atualiza a disponibilidade do membro afetado e o estado das posições impactadas |
| APLICADA | A Escala contém a mudança, mas não está publicada — é estado interno do Supervisor |
| PUBLICADA | Escala passa a ser a fonte de verdade oficial; alimenta o Livro do Dia e o Meu Dia |

**O que a Escala nunca faz:** republicar-se automaticamente. Toda publicação é ação explícita do Supervisor.

---

#### Livro do Dia (S-05)

| Estado da Mudança | Comportamento do Livro do Dia |
|---|---|
| CRIADA | Livros do Dia afetados são flagged automaticamente como "Revisão Necessária" |
| APLICADA | Se Livro ainda não publicado: posições recalculadas em rascunho. Se Livro publicado: estado muda para "Desatualizado" — visível para o Supervisor |
| PUBLICADA | Livro republicado com delta da mudança; versão anterior preservada no Histórico de versões do Livro |
| REVOGADA | Livro precisa ser revisado e republicado novamente — a revogação gera flag de revisão imediato |

**Regra absoluta:** Livro do Dia publicado jamais é alterado silenciosamente. Toda mudança em Livro publicado = nova versão = nova publicação = nova rodada de comunicação.

---

#### Avisos (S-08)

| Gatilho | Aviso gerado? | Nível | Automático? |
|---|---|---|---|
| PUBLICADA (publicação inicial da Escala) | Sim | Informativo | Sim |
| PUBLICADA (republicação com mudança de alocação) | Sim | Importante | Sim |
| PUBLICADA (republicação com posição crítica em aberto) | Sim (para Supervisor) | Crítico | Sim |
| REVOGADA | Sim | Crítico | Sim |
| EXPIRADA (membro não confirmou; atividade próxima) | Sim (para Supervisor) | Crítico | Sim |
| Mudança de Cobertura: posição em aberto sem candidato | Sim (para Supervisor) | Crítico | Sim |

**O que nunca gera Aviso:**
- Estados intermediários internos (CRIADA, ANALISADA, APLICADA)
- Análise de impacto pelo Supervisor
- Rascunho de Escala

---

#### Meu Dia (S-01)

| Evento | O que aparece no Meu Dia |
|---|---|
| PUBLICADA — membro com nova alocação | Card "ALTERAÇÃO" no topo com comparativo (era → agora) · Exige confirmação |
| PUBLICADA — membro liberado de atividade | Card "REMOVIDO" com explicação · Confirmação recomendada |
| PUBLICADA — membro sem mudança | Nenhum card de alteração · Meu Dia estável |
| REVOGADA — membro impactado | Card "ALTERAÇÃO URGENTE" no topo · Nível Crítico · Exige confirmação obrigatória |
| CONFIRMADA pelo membro | Card desce da posição de destaque · Permanece acessível como histórico de alterações |
| EXPIRADA | Card permanece visível com label "Não confirmada" · Registrado no Histórico |

**Hierarquia visual quando existem múltiplas Mudanças Operacionais não confirmadas:**
```
1. REVOGADA não confirmada (sempre primeiro)
2. CRÍTICO não confirmado
3. IMPORTANTE não confirmado
4. Próxima atividade (informação do dia)
5. Linha do tempo
```

---

#### Histórico (S-11)

| Momento | O que é registrado |
|---|---|
| CRIADA | Evento gerador com timestamp e origem (Solicitação ID, ação do Supervisor, etc.) |
| ANALISADA | Snapshot do impacto calculado pela IA |
| APLICADA | Quais campos da Escala foram alterados, valores antes e depois |
| PUBLICADA | Quem publicou, quando, quais versões do Livro do Dia foram geradas |
| COMUNICADA | Quantos Avisos foram enviados, para quem, em qual nível |
| (PARCIALMENTE) CONFIRMADA | Quem confirmou, em qual horário, quanto tempo após o Aviso |
| EXPIRADA | Quantos membros não confirmaram, quais atividades ocorreram sem confirmação |
| REVOGADA | Quem revogou, quando, motivo declarado, qual Mudança inversa foi gerada |

**Tudo agrupado sob uma única entidade Mudança Operacional — não como eventos isolados.**

---

#### IA (S-10)

| Momento | Papel da IA |
|---|---|
| CRIADA → ANALISADA | Calcula impacto total; identifica papéis exclusivos; detecta acumulado de folgas; classifica candidatos por risco (4 camadas) |
| ANALISADA → APLICADA | Simula efeito cascata de cada candidato a substituto antes da confirmação |
| APLICADA | Gera proposta atualizada de Livro do Dia; destaca delta entre versões |
| PUBLICADA → COMUNICADA | Verifica se todos os destinatários estão corretos; confirma que o nível do Aviso é proporcional ao impacto |
| COMUNICADA → CONFIRMADA | Monitora status de confirmação em tempo real; alerta Supervisor por proximidade de horário |
| EXPIRADA | Alerta escalado para Supervisor e Admin; registra membro e atividade no Histórico |
| REVOGADA | Gera nova análise de impacto para a Mudança inversa |
| Qualquer estado | Responde perguntas em linguagem natural sobre o estado atual da Mudança |

---

## PARTE 5 — CONFIRMAÇÃO

---

### Quando exige confirmação

| Critério | Exige confirmação? |
|---|---|
| Nova alocação do membro (papel, atividade, data) | Sim — obrigatória |
| Mudança de papel na atividade que já estava alocado | Sim — obrigatória |
| Mudança de horário de atividade | Sim — obrigatória |
| Cancelamento de atividade onde estava alocado | Sim — obrigatória |
| Revogação de aprovação que afeta o membro | Sim — obrigatória, nível Crítico |
| Aviso informativo sem impacto na programação pessoal | Não |
| Membro liberado de atividade (folga aprovada para si) | Não (ele solicitou — já tem ciência) |
| Mudança de Estrutura (reconfiguração de grupo) | Sim para Supervisor; Informativo para Membro |

**Regra de design:** a confirmação é apresentada sempre após o membro ter **visto o delta** — o que era antes e o que é agora. O botão "Confirmar" só aparece após a visualização explícita do comparativo. Confirmação mecânica (tocar sem ler) é mitigada por design.

---

### Quem confirma

| Papel | Confirmações que faz |
|---|---|
| **Membro** | Toda mudança que afeta sua programação individual — nova alocação, mudança de papel, mudança de horário, cancelamento |
| **Supervisor** | Confirma que a resolução de uma posição em aberto foi bem-sucedida; confirma o Livro do Dia revisado antes de publicar |
| **Admin** | Confirma mudanças de Estrutura; recebe escaladas quando o Supervisor não agiu |

---

### Quem monitora

| Quem monitora | O que monitora | Onde vê |
|---|---|---|
| **Supervisor** | Quem confirmou / quem não confirmou por atividade e por Aviso | S-08 (lista de confirmações) + S-02 (Painel Operacional) |
| **Sistema** | Status de confirmação em tempo real; proximidade de limiar | Alimenta os alertas proativos |
| **IA** | Padrão de não-confirmação; membros que consistentemente não confirmam a tempo | S-10 + S-11 (narrativa de risco) |
| **Admin** | Confirmações pendentes em estados EXPIRADA | S-03 (Painel de Saúde como indicador de saúde) |

---

### Quando escala

| Condição | Escalada |
|---|---|
| Membro não confirmou e atividade começa em < 2h | Re-notificação automática ao membro (nível Crítico) + alerta ao Supervisor |
| Membro não confirmou e atividade começa em < 30min | Alerta ao Supervisor com instrução de contato direto ou ação de contingência |
| Supervisor não publicou Livro do Dia e data é véspera | Alerta ao Admin (Livro crítico em aberto) |
| Posição em aberto e show em < 24h sem resolução | Alerta ao Admin |
| Supervisor não registrou Restrição após aprovar Solicitação em > 4h | Alerta ao Admin |

---

### Quando vira risco operacional

Uma Mudança Operacional entra em **estado de risco operacional** quando:

1. Está no estado EXPIRADA com atividade ainda futura — há membros que executarão sem ter confirmado
2. Está no estado PUBLICADA mas o Livro do Dia correspondente ainda está "Desatualizado" — inconsistência entre Escala e Livro
3. Está no estado APLICADA mas o Supervisor não publicou e a data se aproxima — informação correta está presa em rascunho

**Definição formal de risco operacional:**

> *Uma Mudança Operacional representa risco operacional quando existe diferença entre o que o sistema sabe (estado oficial) e o que o membro sabe (confirmado pelo membro) — e a atividade afetada está próxima o suficiente para que essa diferença impacte a execução.*

---

## PARTE 6 — HISTÓRICO

---

### Princípio de agrupamento

Cada Mudança Operacional gera múltiplos eventos técnicos em superfícies diferentes. Sem agrupamento, o Histórico se tornaria uma lista de centenas de registros isolados impossível de interpretar.

**Regra de agrupamento:** todos os eventos técnicos causados pela mesma Mudança Operacional são agrupados sob uma única entidade no Histórico, identificada por:

```
ID da Mudança Operacional
├── Tipo: [Mudança de Pessoa / Papel / Horário / etc.]
├── Origem: [Solicitação ID / Ação direta / Evento]
├── Data/hora de criação
├── Membro(s) afetado(s)
├── Atividade(s) afetada(s)
└── [eventos agrupados cronologicamente]
```

---

### Como o Histórico agrupa múltiplos eventos

**Exemplo — Folga com substituição e republicação:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MUDANÇA OPERACIONAL #MO-0047
Tipo: Mudança de Pessoa + Mudança de Cobertura
Origem: Solicitação de Folga #SOL-0213 (Amanda Souza · 21/06)
Criada: 17/06 · 18h00 | Resolvida: 17/06 · 18h40

RESUMO [gerado pela IA]
Amanda Souza obteve folga em 21/06. Beatriz Lima foi alocada no Bloco 3
do Ensaio das 16h. A posição de Astrid no Musical das 12h30 permaneceu
em aberto — única posição não resolvida desta mudança.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EVENTOS

17/06 18h00  CRIADA         Solicitação de Folga #SOL-0213 aprovada · Escala atualizada
17/06 18h00  ANALISADA      [IA] Musical 12h30 Astrid: em aberto · Ensaio 16h Bloco 3: Beatriz disponível
17/06 18h00  APLICADA       Amanda marcada como indisponível em 21/06 · 2 posições recalculadas
17/06 18h15  EM RESOLUÇÃO   Beatriz Lima: Bloco 3 Ensaio 16h → alocada
17/06 18h20  APLICADA       Livro do Dia 21/06 revisado: Beatriz no Bloco 3 · Astrid em aberto
17/06 18h22  PUBLICADA      Livro do Dia 21/06 republicado por Ana Silva
17/06 18h22  COMUNICADA     Avisos enviados: Beatriz Lima (nova alocação), Amanda Souza (folga confirmada)
17/06 18h35  PARCIALMENTE   Beatriz Lima confirmou nova alocação
             CONFIRMADA
17/06 18h40  CONFIRMADA     Amanda Souza visualizou confirmação de folga

POSIÇÃO NÃO RESOLVIDA
Astrid · Musical 12h30 · 21/06 → Em Aberto (sem candidato com risco baixo disponível)
Registrado como item pendente para o Supervisor em 17/06 às 18h22.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Regras de agrupamento

**O que fica dentro da mesma Mudança Operacional:**
- Todos os eventos de Escala, Livro do Dia, Avisos e Meu Dia causados pela mesma decisão original
- Todas as confirmações dos membros afetados por essa decisão
- Todos os ajustes de resolução feitos pelo Supervisor em resposta à mesma mudança

**O que gera uma nova Mudança Operacional separada:**
- Uma revogação (sempre nova entidade — a Mudança inversa)
- Uma segunda decisão do Supervisor em resposta à mesma situação mas em data diferente
- Uma substituição de emergência que aconteceu dias após a folga original ser aprovada

**Vinculação entre Mudanças:**
- Uma Mudança pode estar vinculada a outra como "Origem" ou como "Resposta a"
- O Histórico preserva essa cadeia de causalidade

---

### Objetivo: evitar registros isolados e criar narrativa

Sem agrupamento:
```
[18h00] Escala atualizada — Amanda Souza · 21/06
[18h00] Posição Astrid recalculada → Em Aberto
[18h00] Posição Bloco 3 recalculada → Em Risco
[18h15] Beatriz Lima alocada no Bloco 3
[18h20] Livro do Dia 21/06 v2 gerado
[18h22] Aviso enviado para Beatriz Lima
[18h22] Aviso enviado para Amanda Souza
[18h22] Meu Dia de Beatriz Lima atualizado
[18h22] Meu Dia de Amanda Souza atualizado
[18h35] Beatriz Lima confirmou
[18h40] Amanda Souza confirmou
```
→ 10 registros isolados sem contexto. Impossível de ler.

Com agrupamento:
```
#MO-0047 · Folga de Amanda · 21/06 · Concluída com 1 posição em aberto
→ Narrativa completa em 1 entidade. Consultável em segundos.
```

---

## PARTE 7 — IA

---

### Como a IA interpreta Mudanças Operacionais

A IA não é usuária passiva das Mudanças Operacionais — é participante ativa em cada estado do ciclo. Ela atua em três modos:

**Modo Analítico:** calcula, classifica, projeta
**Modo Narrativo:** resume, traduz, contextualiza
**Modo Vigilante:** monitora, alerta, escalada

---

### Participação por estado

| Estado | Modo | O que a IA faz |
|---|---|---|
| CRIADA | Analítico | Identifica o tipo da Mudança; determina quais superfícies serão afetadas |
| ANALISADA | Analítico | Calcula impacto completo; classifica candidatos (4 camadas); simula cascata; detecta acúmulo |
| APLICADA | Analítico | Verifica se a Escala foi atualizada corretamente; identifica posições residualmente em aberto |
| PUBLICADA | Narrativo | Gera resumo do que mudou para o Supervisor antes de publicar; confirma que o delta de cada membro é preciso |
| COMUNICADA | Vigilante | Inicia monitoramento de confirmações; registra timestamp de entrega |
| PARCIALMENTE CONFIRMADA | Vigilante | Monitora pendências em tempo real; alerta progressivamente por proximidade de horário |
| CONFIRMADA | Narrativo | Fecha a narrativa no Histórico; detecta padrões se for reincidência |
| EXPIRADA | Vigilante + Narrativo | Alerta Supervisor e Admin; registra no Histórico com contexto de risco |
| REVOGADA | Analítico + Narrativo | Recalcula impacto da revogação; gera nova análise para Mudança inversa |

---

### As 6 perguntas obrigatórias

A IA deve ser capaz de responder estas 6 perguntas em qualquer momento do ciclo, para qualquer Mudança Operacional ativa:

---

**1. O que mudou?**

> Resposta esperada (exemplo):
> "Amanda Souza obteve folga no dia 21/06. A posição de Astrid no Musical das 12h30 ficou em aberto. Beatriz Lima foi alocada no Bloco 3 do Ensaio das 16h."

Formato: 1-3 frases. Linguagem operacional. Sem jargão técnico. Referência a papéis e atividades pelo nome, não por ID.

---

**2. Quem foi impactado?**

> Resposta esperada:
> "Diretamente: Amanda Souza (folga) e Beatriz Lima (nova alocação). Indiretamente: Supervisora Ana Silva (posição de Astrid ainda em aberto para resolver)."

Formato: distinção clara entre impacto direto (programação alterada) e indireto (ação necessária).

---

**3. Quem confirmou?**

> Resposta esperada:
> "Beatriz Lima confirmou às 18h35. Amanda Souza confirmou às 18h40."

Formato: lista de confirmados com timestamp. Se todos confirmaram: "Todos confirmaram."

---

**4. Quem não confirmou?**

> Resposta esperada:
> "Todos confirmaram nesta Mudança. Porém: posição de Astrid ainda está em aberto — nenhum membro foi alocado para confirmar."

Formato: lista de pendentes com tempo decorrido desde o Aviso. Distinção entre "membro não confirmou" e "posição sem membro alocado".

---

**5. Existe risco?**

> Resposta esperada:
> "Sim. Astrid no Musical das 12h30 de 21/06 está em aberto. Nenhum candidato com risco baixo disponível. O show acontece em 4 dias. Recomendo ação antes de 19/06."

Formato: risco específico (qual posição, qual atividade, qual data), distância temporal, recomendação de prazo.

---

**6. A operação continua coberta?**

> Resposta esperada:
> "Parcialmente. Bloco 3 do Ensaio está coberto (Beatriz Lima, confirmado). Astrid no Musical está em aberto. A operação do dia 21/06 está em risco até que Astrid seja resolvida."

Formato: status por posição afetada. Resposta binária por atividade: coberta / em risco / em aberto.

---

### O que a IA nunca faz em Mudanças Operacionais

| Proibição | Razão |
|---|---|
| Aprovar ou negar Solicitações | Responsabilidade do Supervisor |
| Confirmar substituições sem ação do Supervisor | Toda execução exige confirmação humana |
| Publicar Escala ou Livro do Dia | Publicação é decisão operacional do Supervisor |
| Revogar Mudanças Operacionais | Revogação tem consequências que exigem julgamento humano |
| Enviar Avisos antes da publicação | Avisos são consequência de estado PUBLICADO, não de análise |
| Alterar silenciosamente qualquer dado operacional | Toda ação da IA é apresentada como proposta antes de ser executada |

---

## PARTE 8 — AUDITORIA

---

### A1 — Existe alguma superfície que depende de Mudança Operacional mas não a representa?

**S-09 Mensagens:**
Mensagens contextuais dentro de Solicitações e Entregas são geradas em resposta a Mudanças Operacionais (ex.: Supervisor envia mensagem após negar folga; Membro envia mensagem questionando mudança de papel). A superfície S-09 não representa a Mudança Operacional — ela é um canal de comunicação que pode existir ao redor dela.

**Lacuna identificada:** quando uma mensagem está vinculada a uma Mudança Operacional, essa vinculação precisa ser preservada no Histórico. Hoje S-09 conecta para o Histórico como registro de conversa, mas não como elemento da entidade Mudança Operacional.

**Resolução:** Mensagens vinculadas a uma Mudança Operacional devem aparecer no agrupamento do Histórico como "Comunicação associada" — não como evento da Mudança, mas como contexto recuperável.

---

**S-07 Entregas:**
Entregas são independentes de Mudanças Operacionais. Uma Entrega pode ser criada em paralelo a uma Mudança, mas não é causada por ela nem depende dela. Correto — sem lacuna.

---

**S-03 Painel de Saúde (Admin):**
O Painel de Saúde agrega Mudanças Operacionais como indicadores de tendência (tempo médio de resolução, frequência de posições em aberto, reincidências). Ele não representa Mudanças individuais — representa padrões extraídos delas.

**Sem lacuna** — esse é o comportamento correto para o Painel de Saúde.

---

### A2 — Existe alguma duplicação?

**Duplicação potencial identificada: Aviso + Meu Dia**

Quando uma Mudança Operacional é PUBLICADA, o sistema gera um Aviso (S-08) e atualiza o Meu Dia (S-01). Em ambas as superfícies, o membro vê a informação sobre a mudança. Isso é duplicação?

**Veredito: não é duplicação — são papéis diferentes.**
- S-08 Avisos: canal de broadcast operacional. Registro permanente. O Aviso fica no histórico de Avisos mesmo após confirmação.
- S-01 Meu Dia: visão individual operacional do dia. O card de alteração some do topo após confirmação. Serve para a pergunta "o que mudou para mim hoje?"

Os dados são os mesmos, mas a intenção e o comportamento são distintos. O Meu Dia é contextual ao dia. O Aviso é registro permanente.

**Sem duplicação real.**

---

**Duplicação potencial: Histórico de Livro do Dia + Histórico de Mudança Operacional**

O Livro do Dia possui histórico de versões próprio (quem publicou, quando, o que mudou). A Mudança Operacional também registra a publicação do Livro. Dois registros sobre o mesmo evento?

**Veredito: papéis diferentes.**
- Histórico de versões do Livro do Dia: granular, centrado no documento (quais posições mudaram, versão N vs versão N+1)
- Histórico da Mudança Operacional: centrado no evento (por que o Livro mudou, quem foi impactado, quem confirmou)

**Sem duplicação real — perspectivas complementares.**

---

### A3 — Existe alguma lacuna?

**Lacuna L-01: estado visual de "Livro Desatualizado"**
Quando uma Mudança Operacional atinge o estado APLICADA e o Livro do Dia já estava publicado, o Livro fica em estado de inconsistência com a Escala. Esse estado não tem nome formal na arquitetura atual.

**Resolução:** formalizar "Livro Desatualizado" como estado intermediário do Livro do Dia — diferente de "Rascunho" (nunca publicado) e "Publicado" (em dia). Este estado deve ser visível para o Supervisor no Painel Operacional como item de ação pendente.

---

**Lacuna L-02: Mudanças de Cobertura sem resolução rastreada**
Quando uma posição fica em aberto (Mudança de Cobertura), o sistema cria um alerta. Mas se o Supervisor resolve a posição fora do sistema (substituição por canal informal, cancelamento da atividade), a Mudança de Cobertura nunca atinge o estado CONFIRMADA — fica em estado suspenso indefinidamente.

**Resolução:** o Supervisor deve poder "encerrar manualmente" uma Mudança de Cobertura com motivo (ex.: "atividade cancelada", "resolvido fora do sistema"). O encerramento manual é registrado no Histórico.

---

**Lacuna L-03: Mudanças geradas por Admin sem visibilidade para Supervisores**
Quando o Admin faz uma Mudança de Estrutura (reconfigura um Grupo), os Supervisores afetados precisam saber. Hoje o fluxo de comunicação para Mudanças originadas pelo Admin não está tão detalhado quanto para Mudanças originadas em Solicitações.

**Resolução:** Mudanças de Estrutura geradas pelo Admin devem seguir o mesmo ciclo de vida da Mudança Operacional — com PUBLICADA, COMUNICADA e confirmação do Supervisor afetado.

---

### A4 — Existe algum conflito com decisões anteriores?

**Verificação contra decisões do Ciclo de Planejamento Operacional:**

| Decisão anterior | Status |
|---|---|
| D-01: Atualização da Escala é automática pós-aprovação | ✅ Confirmada — estado APLICADA é automático |
| D-02: Livro publicado nunca alterado silenciosamente | ✅ Confirmada — PUBLICADA exige ação explícita do Supervisor |
| D-03: Avisos gerados pós-publicação; nível pelo sistema | ✅ Confirmada — Avisos são consequência de PUBLICADA |
| D-04: Card de alteração persiste até confirmação explícita | ✅ Confirmada — estado PARCIALMENTE CONFIRMADA modela isso |
| D-05: Confirmação exige visualização do delta antes do botão | ✅ Confirmada — regra de design de confirmação |
| D-06: Revogação tem nível Crítico | ✅ Confirmada — REVOGADA → Aviso Crítico |
| D-07: Administrativa sem impacto na Escala | ✅ Confirmada — Tipo 8 (Administrativa) não gera Mudança Operacional |
| D-08: IA nunca decide | ✅ Confirmada — IA propõe; Supervisor executa |
| D-09: Histórico é narrativa | ✅ Confirmada — agrupamento por Mudança Operacional com resumo narrativo |
| D-10: Escalada ao Admin gera notificação ao Supervisor | ✅ Confirmada — estado EXPIRADA escala com visibilidade para todos |

**Nenhum conflito identificado.**

---

## PARTE 9 — VEREDITO

---

### Especificação Oficial da Entidade Mudança Operacional

---

#### Identidade

| Campo | Valor |
|---|---|
| **Nome** | Mudança Operacional |
| **Tipo** | Entidade transversal — existe dentro de múltiplas superfícies, nunca exclusiva de uma |
| **Criada por** | Sistema (automaticamente) ao detectar evento gerador |
| **Gerenciada por** | Supervisor (decisões e publicações) · Sistema (automações) · IA (análise e monitoramento) |
| **Auditada por** | Admin · Supervisor (escopo próprio) · IA |

---

#### Propriedades da entidade

| Propriedade | Tipo | Descrição |
|---|---|---|
| `id` | String | Identificador único — ex: `MO-0047` |
| `tipo` | Enum | Pessoa / Papel / Horário / Cobertura / Estrutura / Show / LivroDoDia / Restrição / Escala |
| `estado` | Enum | Criada / Analisada / Aplicada / Publicada / Comunicada / ParcialmenteConfirmada / Confirmada / Expirada / Revogada |
| `origem` | Referência | Solicitação ID · Ação do Supervisor · Evento da Agenda |
| `criadaEm` | Timestamp | Momento da criação |
| `publicadaEm` | Timestamp | Momento da publicação (quando state = Publicada) |
| `confirmaçãoCompleta` | Boolean | True quando todos os destinatários confirmaram |
| `membrosAfetados` | Lista | Membros com programação alterada |
| `atividadesAfetadas` | Lista | Shows, ensaios, eventos impactados |
| `deltaEscala` | Objeto | O que mudou na Escala (antes → depois) |
| `deltaLivroDoDia` | Lista de versões | Versões do Livro do Dia afetadas |
| `avisosSendados` | Lista | Avisos gerados, nível, destinatários |
| `confirmações` | Lista | Quem confirmou, quando |
| `posiçõesEmAberto` | Lista | Posições não resolvidas (Mudança de Cobertura) |
| `vinculaçãoAnterior` | Referência | Mudança Operacional que originou esta (em caso de revogação ou resposta) |
| `resumoIA` | Texto | Narrativa gerada pela IA para o Histórico |
| `padrãoDetectado` | Texto | Reincidência ou padrão identificado pela IA |

---

#### Relações com outras entidades

```
Solicitação ──────────────────► Mudança Operacional
                                      │
                    ┌─────────────────┼──────────────────────────────────────┐
                    │                 │                                       │
                    ▼                 ▼                                       ▼
                  Escala        Livro do Dia                            Aviso
                  (S-04)           (S-05)                               (S-08)
                    │                 │                                       │
                    └─────────────────┴───────────────────────────────────────┘
                                      │
                              ┌───────┴──────┐
                              │              │
                              ▼              ▼
                           Meu Dia       Histórico
                           (S-01)         (S-11)
                                            │
                                            ▼
                                           IA
                                          (S-10)
```

---

### 3 lacunas resolvidas por esta modelagem

| Lacuna | Solução |
|---|---|
| L-01: "Livro Desatualizado" sem nome formal | Estado intermediário formalizado: Livro em inconsistência com a Escala tem estado próprio visível para o Supervisor |
| L-02: Mudanças de Cobertura sem encerramento rastreado | Supervisor pode encerrar manualmente com motivo — registrado no Histórico |
| L-03: Mudanças de Admin sem ciclo de comunicação | Mudanças de Estrutura seguem o mesmo ciclo de vida da Mudança Operacional |

---

### Classificação final

## 🟢 Consistente

A entidade Mudança Operacional é estruturalmente coerente com toda a arquitetura existente. Ela:

- **Resolve a fragmentação** do Histórico (múltiplos eventos isolados → uma narrativa agrupada)
- **Formaliza a propagação** entre superfícies (o que acontece em S-04 propaga para S-05, S-08, S-01 e S-11 de forma previsível)
- **Define 9 estados claros** com responsáveis e transições automáticas/manuais bem delimitadas
- **Não conflita com nenhuma decisão anterior** (D-01 a D-10 do Ciclo de Planejamento Operacional)
- **Fecha 3 lacunas** identificadas na auditoria

**A entidade Mudança Operacional está pronta para ser usada como fundação do design de:**
- S-05 Livro do Dia — estados do Livro derivados dos estados da Mudança
- S-08 Avisos — Avisos como consequência formal do estado PUBLICADA
- S-11 Histórico — Histórico como narrativa agrupada por Mudança Operacional
- S-10 IA — IA como participante em cada estado do ciclo

---

*Documento elaborado por Product Designer Sênior — MyASA 2.0*
*Base: Arquitetura v17/06/2026 · Ciclo de Planejamento Operacional v18/06/2026 · Especificação S-06 v2 · Bloco 1 · Pesquisas dos 3 perfis · Jornadas aprovadas*
