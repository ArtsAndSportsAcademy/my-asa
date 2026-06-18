# MyASA 2.0 — Fundação da Agenda (S-12)

> **Versão:** 18/06/2026
> **Fase:** Modelagem de Comportamento — anterior a wireframes e mockups
> **Base:** Arquitetura · Governança Organizacional · Escala · Livro do Dia · Livro do Show · Entregas · Ecossistema de IA · 101 decisões formais
> **Superfície modelada:** S-12 Agenda
> **Natureza:** Fundação de produto — sem interface, sem wireframes, sem componentes
> **Status:** 🟢 Pronto para UX

---

## Premissa central

A Agenda é a **dimensão temporal do MyASA**. Ela responde a uma pergunta que nenhuma outra entidade do sistema responde diretamente: **"O que acontece e quando?"**

Sem Agenda, o sistema opera em abstrato — sabe que shows existem, sabe que membros precisam ser alocados, sabe que Livros do Dia precisam ser gerados. Mas não sabe quando. A Agenda é o eixo do tempo ao redor do qual todo o planejamento operacional se organiza.

---

## Definição oficial

A Agenda é o **calendário operacional da organização** — o registro de eventos com data, tipo, contexto e vínculo com as entidades operacionais (Operações, Shows, Equipes) que os tornam relevantes para o sistema.

A Agenda:
- Define quando eventos acontecem
- Conecta eventos às Operações que os produzem
- Dispara necessidades operacionais (Livros do Dia a gerar, Escalas a planejar)
- Registra bloqueios e períodos de indisponibilidade coletiva
- Serve como base temporal para a IA identificar riscos de planejamento

---

## Distinção formal: Agenda · Escala · Livro do Dia · Operação

| | Agenda | Escala | Livro do Dia | Operação |
|---|---|---|---|---|
| **Pergunta respondida** | O que acontece e quando? | Quem está disponível? | Quem faz o quê neste show? | A qual produção este evento pertence? |
| **Dimensão** | Temporal | Pessoal/disponibilidade | Operacional/execução | Organizacional/produção |
| **Nível** | Calendário de eventos | Alocação de membros por período | Plano detalhado de um show específico | Contexto e agrupamento de shows |
| **Criado por** | Admin · Supervisor | Sistema + Supervisor | Sistema + Supervisor | Admin |
| **Impacta** | Livro do Dia · Escala · Entregas · Membro | Candidatos do Livro do Dia | Avisos · MO · Meu Dia do Membro | Livro do Show · Equipes |
| **Temporalidade** | Quando | Quem (por período) | O quê (para esta data) | Agrupamento (conjunto de datas) |

**Relação entre as quatro entidades:**
```
OPERAÇÃO (contexto de produção)
    │
    ├── Livro do Show (como o espetáculo é estruturado)
    │
    └── AGENDA (quando os eventos desta Operação acontecem)
             │
             ├── Evento Show 14/06 ──→ ESCALA (quem está disponível em 14/06)
             │                                │
             │                                └──→ LIVRO DO DIA 14/06 (quem faz o quê)
             │
             └── Evento Show 21/06 ──→ ESCALA (quem está disponível em 21/06)
                                              │
                                              └──→ LIVRO DO DIA 21/06
```

---

## PARTE 1 — TIPOS DE EVENTOS

---

### Classificação completa

---

#### MVP

---

**Tipo 1 — Show**

O evento central do MyASA. Uma apresentação pública ou privada de um espetáculo associado a um Livro do Show.

| Campo | Definição |
|---|---|
| Vínculo | Obrigatoriamente associado a uma Operação Ativa e a um Livro do Show |
| Gera Livro do Dia? | ✅ Sim — é o único tipo que dispara a geração de Livro do Dia |
| Gera necessidade de Escala? | ✅ Sim — a Escala precisa cobrir este evento |
| Campos obrigatórios | Data · Horário de início · Livro do Show associado · Operação associada |
| Campos opcionais | Local · Duração estimada · Observações |
| Visível para Membros? | ✅ Aparece no calendário pessoal do Membro alocado (via Meu Dia) |

---

**Tipo 2 — Ensaio**

Evento de preparação — pode ou não gerar Livro do Dia, dependendo da configuração da Operação.

| Campo | Definição |
|---|---|
| Vínculo | Associado a uma Operação; pode ser associado a um Livro do Show ou não |
| Gera Livro do Dia? | Opcional — configurado pelo Admin por Operação. Se o Ensaio exige cobertura formal (como um show com papéis definidos), gera Livro do Dia. Se é um ensaio livre sem posições fixas, não gera |
| Gera necessidade de Escala? | ✅ Sim — membros precisam estar disponíveis |
| Campos obrigatórios | Data · Horário · Operação associada |
| Campos opcionais | Livro do Show associado · Local · Tipo de ensaio (técnico, geral, passagem) |
| Visível para Membros? | ✅ Aparece no calendário do Membro convocado |

---

**Tipo 3 — Reunião**

Evento de alinhamento operacional — sem Livro do Dia, sem cobertura de posições, mas relevante para a disponibilidade dos membros convocados.

| Campo | Definição |
|---|---|
| Vínculo | Associado a uma Equipe ou Operação |
| Gera Livro do Dia? | ❌ Não |
| Gera necessidade de Escala? | Sim — os membros convocados não estão disponíveis durante aquele período para outros eventos |
| Campos obrigatórios | Data · Horário · Equipe ou Operação associada · Convocados (lista ou "todo o grupo") |
| Campos opcionais | Pauta · Local · Duração estimada |
| Conflito com Show? | ✅ Se um membro convocado está alocado em um Show no mesmo horário, o sistema gera alerta de conflito |
| Visível para Membros? | ✅ Para os convocados |

---

**Tipo 4 — Bloqueio Operacional**

Período em que a organização ou um espaço está indisponível para eventos. Bloqueia a criação de novos eventos no período.

| Campo | Definição |
|---|---|
| Vínculo | Associado à Organização, a uma Operação específica, ou a um local específico |
| Gera Livro do Dia? | ❌ Não |
| Gera necessidade de Escala? | ❌ Não |
| Campos obrigatórios | Data de início · Data de fim · Motivo |
| Comportamento | O sistema impede a criação de eventos de Show ou Ensaio no período bloqueado (alerta se já existir) |
| Casos de uso | Indisponibilidade de palco, reforma, evento externo no espaço, período de recesso |
| Visível para Membros? | Opcional — Admin decide se o motivo é público ou apenas operacional |

---

**Tipo 5 — Férias Coletivas**

Período formal de descanso coletivo — gera folga aprovada automaticamente para todos os membros das Equipes associadas.

| Campo | Definição |
|---|---|
| Vínculo | Associado a uma ou mais Equipes |
| Gera Livro do Dia? | ❌ Não |
| Gera folga automática? | ✅ Sim — todos os membros das Equipes associadas recebem folga aprovada no período |
| Campos obrigatórios | Data de início · Data de fim · Equipes incluídas |
| Comportamento | Durante o período: nenhum membro das Equipes incluídas pode ser alocado em Shows ou Ensaios |
| Conflito com Shows existentes? | ✅ Se há Show confirmado no período, o sistema alerta — o Admin precisa resolver (cancelar o Show, excluir a Equipe das férias, ou manter o conflito com resolução manual) |
| Visível para Membros? | ✅ Visível no calendário pessoal como "Férias Coletivas" |

---

#### Pós-MVP

---

**Tipo 6 — Treinamento (Pós-MVP)**

Evento estruturado de capacitação com presença obrigatória e rastreamento.

Motivo pós-MVP: requer integração com S-07 Entregas (presença como Entrega) e possivelmente com um Tipo de Entrega pós-MVP (Treinamento). Complexidade de modelagem de convocação + rastreamento + conclusão está acima do escopo do MVP.

---

**Tipo 7 — Evento Externo (Pós-MVP)**

Participação da organização em evento fora de sua sede — festival, premiação, intercâmbio.

Motivo pós-MVP: exige modelagem de logística de deslocamento, que não é escopo do MVP.

---

**Tipo 8 — Manutenção Programada (Pós-MVP)**

Manutenção de equipamentos, figurinos ou espaço com impacto operacional específico.

Motivo pós-MVP: requer vínculo com catálogo de equipamentos e espaços — entidade não modelada no MVP.

---

**Tipo 9 — Show Especial / Temporada Especial (Pós-MVP)**

Show com configuração diferente do Livro do Show padrão (elenco reduzido, versão condensada, estreia).

Motivo pós-MVP: pode requerer um Livro do Show alternativo ou configuração de exceção no motor de cobertura. Modelagem de "variantes do Livro do Show" é V2 (LG-02 da Governança).

---

### Tabela resumo de tipos no MVP

| Tipo | Gera Livro do Dia? | Gera Folga Automática? | Bloqueia Período? | Visível ao Membro? |
|---|---|---|---|---|
| Show | ✅ Sempre | ❌ | ❌ | ✅ (se alocado) |
| Ensaio | Opcional | ❌ | ❌ | ✅ (se convocado) |
| Reunião | ❌ | ❌ | ❌ (só para convocados) | ✅ (se convocado) |
| Bloqueio Operacional | ❌ | ❌ | ✅ Período | ✅ Opcional |
| Férias Coletivas | ❌ | ✅ Automático | ✅ Período | ✅ |

---

## PARTE 2 — CICLO DE VIDA DOS EVENTOS

---

### Estados formais

```
RASCUNHO ──────────────────────────────────────────→ [descartado]
    │
    ↓ (Admin/Supervisor confirma)
CONFIRMADO ──────────────────────────────────────→ CANCELADO
    │                                                   │
    ↓ (data passa + evento ocorre)              [estado terminal]
REALIZADO
[estado terminal — imutável]
        ↑
(estado intermediário para Shows)
SUSPENSO ────────────────────────────────────────→ CANCELADO
    │                                                   │
    ↓ (retoma data ou define nova data)         [estado terminal]
CONFIRMADO (retomada)
```

---

### Definição de cada estado

| Estado | Descrição | Terminal? |
|---|---|---|
| **RASCUNHO** | Evento criado mas não publicado para os membros | Não |
| **CONFIRMADO** | Evento publicado e visível para os perfis com acesso | Não |
| **SUSPENSO** | Evento temporariamente pausado — pode ser retomado | Não |
| **CANCELADO** | Evento definitivamente cancelado — não ocorrerá | Sim |
| **REALIZADO** | Evento ocorreu — registro histórico imutável | Sim |

---

### Regras de transição críticas

**RASCUNHO → CONFIRMADO:**
O Supervisor pode criar o evento em RASCUNHO para planejamento interno antes de confirmar. A confirmação publica o evento para os membros relevantes. Se o evento é do tipo Show, a confirmação também dispara a sinalização para gerar o Livro do Dia dentro do horizonte de planejamento.

**CONFIRMADO → CANCELADO:**
O cancelamento de um evento CONFIRMADO tem cascata de efeitos (detalhado na Parte 3). Requer motivo obrigatório. Não pode ser desfeito — se o evento for retomado, cria-se um novo evento.

**CONFIRMADO → SUSPENSO:**
O evento existe mas está temporariamente sem data firme. Não gera Livro do Dia enquanto SUSPENSO. Os membros são notificados da suspensão. O evento não some do sistema — permanece visível como SUSPENSO.

**SUSPENSO → CONFIRMADO:**
O evento retoma com a mesma data ou uma nova data. Se houve mudança de data, o sistema verifica conflitos e sinaliza ao Supervisor.

**→ REALIZADO:**
A transição para REALIZADO é automática — ocorre quando a data do evento passa e o evento estava CONFIRMADO. O Admin pode configurar se a transição é imediata (meia-noite) ou após confirmação manual do Supervisor ("o show aconteceu?"). REALIZADO é imutável — nenhuma alteração é possível após esse estado.

---

### Estados por tipo de evento

| Tipo | RASCUNHO | CONFIRMADO | SUSPENSO | CANCELADO | REALIZADO |
|---|---|---|---|---|---|
| Show | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ensaio | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reunião | ✅ | ✅ | ❌ | ✅ | ✅ |
| Bloqueio Operacional | ✅ | ✅ | ❌ | ✅ | ✅ |
| Férias Coletivas | ✅ | ✅ | ❌ | ✅ | ✅ |

Reunião e Bloqueio não têm estado SUSPENSO — ou estão confirmados ou são cancelados.

---

## PARTE 3 — RELAÇÃO COM A ESCALA

---

### Como um evento da Agenda impacta a Escala

A Escala do MyASA responde: "Quem está disponível para ser alocado, e quando?" Ela é alimentada por dois tipos de dado: as disponibilidades e indisponibilidades dos membros, e os eventos da Agenda que criam demandas ou bloqueios.

**Evento Show (CONFIRMADO):**
Cria uma demanda de cobertura na Escala. O sistema sinaliza ao Supervisor que um Livro do Dia precisa ser gerado para aquela data dentro do horizonte de planejamento. Os membros alocados no Livro do Dia têm aquela data marcada como ocupada na Escala — não ficam disponíveis para outros shows no mesmo horário.

**Evento Ensaio (CONFIRMADO, com Livro do Dia):**
Comportamento idêntico ao Show para fins de Escala — os membros alocados estão ocupados.

**Evento Ensaio (CONFIRMADO, sem Livro do Dia):**
Cria demanda de presença mas sem alocação formal de posições. Os membros convocados ficam marcados como indisponíveis no período na Escala, mas não há Livro do Dia a gerar.

**Evento Reunião (CONFIRMADO):**
Os membros convocados ficam marcados como indisponíveis no período. Se um Show for adicionado no mesmo horário, o sistema alerta sobre o conflito — os convocados da Reunião não estariam disponíveis para o Show.

**Evento Férias Coletivas (CONFIRMADO):**
Gera folga aprovada automática para todos os membros das Equipes incluídas no período inteiro. O motor de cobertura passa a excluir automaticamente esses membros de qualquer candidatura a Shows ou Ensaios no período.

**Evento Bloqueio Operacional (CONFIRMADO):**
Bloqueia a criação de novos eventos de Show ou Ensaio no período. Não altera a disponibilidade individual de membros — apenas sinaliza que a organização não operará naquele período.

---

### Quando gera conflito

| Situação | Conflito gerado |
|---|---|
| Membro convocado para Reunião e alocado em Show no mesmo horário | ✅ Conflito — sistema sinaliza para Supervisor de ambos os eventos |
| Dois Shows da mesma Operação no mesmo dia/horário com os mesmos membros | ✅ Conflito — um membro não pode estar em dois Shows simultaneamente |
| Férias Coletivas declaradas sobre período com Shows CONFIRMADOS | ✅ Conflito — Admin precisa resolver |
| Bloqueio Operacional adicionado sobre Show já CONFIRMADO | ✅ Conflito — Admin precisa resolver |
| Membro com folga individual durante Férias Coletivas | ⚠ Redundância — não é conflito, mas a IA sinaliza que a folga individual é coberta pela coletiva |

---

### Quando gera bloqueio

**Bloqueio de criação:** não é possível criar um evento de Show ou Ensaio dentro de um período de Bloqueio Operacional ou Férias Coletivas confirmados — o sistema impede ou solicita confirmação explícita do Admin.

**Bloqueio de candidatura:** durante Férias Coletivas, os membros das Equipes incluídas são excluídos do pool de candidatos do motor de cobertura. O motor não os vê como disponíveis — sem necessidade de intervenção manual do Supervisor.

---

### Quando gera alerta

| Situação | Tipo de alerta |
|---|---|
| Show CONFIRMADO sem Livro do Dia dentro do horizonte de planejamento | ⚠ Alerta ao Supervisor: "Show em [N] dias sem Livro do Dia gerado" |
| Show com todos os membros da rotação de uma posição em Férias Coletivas | ⚠ Alerta ao Supervisor: cobertura impossível com configuração atual |
| Evento adicionado em período com muitos outros eventos (carga alta) | ◆ Informativo — IA contextualiza a carga do período |
| Evento de Ensaio sem convocados definidos | ⚠ Alerta ao Supervisor: "Ensaio sem convocados — quem precisa comparecer?" |

---

## PARTE 4 — RELAÇÃO COM O LIVRO DO DIA

---

### Quando a Agenda dispara a geração de Livro do Dia

A geração do Livro do Dia só é possível quando:
1. Existe um evento de Show (ou Ensaio com Livro do Dia) **CONFIRMADO** na Agenda
2. O evento está associado a uma Operação **Ativa**
3. O evento está associado a um Livro do Show **configurado e ativo**

Faltando qualquer uma das três condições → Livro do Dia não pode ser gerado.

**O Livro do Dia não existe sem um evento CONFIRMADO na Agenda.** A Agenda é a autoridade temporal: se o show foi cancelado na Agenda, o Livro do Dia perde a razão de existir.

---

### Cascata de mudanças da Agenda para o Livro do Dia

| Mudança na Agenda | Estado do Livro do Dia | O que acontece |
|---|---|---|
| Show CONFIRMADO adicionado | Livro do Dia ainda não existe | Sistema sinaliza que Livro do Dia precisa ser gerado |
| Show muda de data (antes da publicação do Livro) | Livro ainda em construção | Livro é ajustado para a nova data |
| Show muda de data (após publicação do Livro) | Livro PUBLICADO | Livro marcado como DESATUALIZADO · MO gerada · Supervisor precisa republicar com nova data |
| Show CANCELADO (antes da publicação do Livro) | Livro ainda em construção ou não iniciado | Livro é descartado (ou arquivado como CANCELADO) |
| Show CANCELADO (após publicação do Livro) | Livro PUBLICADO | Livro marcado como CANCELADO · Avisos enviados a todos os membros alocados · MO gerada |
| Show SUSPENSO | Livro em qualquer estado | Livro mantém estado mas é sinalizado como "evento suspenso" — sem publicação possível até retomada |

---

### Quando a Agenda apenas informa (sem cascata)

| Mudança na Agenda | Impacto no Livro do Dia |
|---|---|
| Adição de Reunião no mesmo dia de um Show | Nenhum impacto no Livro do Dia — apenas na Escala dos convocados |
| Atualização do local do Show (mesmo horário, mesma data) | Informativo — Livro do Dia não é regenerado, mas o Supervisor recebe o alerta de mudança |
| Adição de Bloqueio Operacional em data futura sem Shows | Nenhum impacto — não há Livro do Dia para aquela data |

---

## PARTE 5 — RELAÇÃO COM A IA

---

### Como a IA interpreta eventos da Agenda

A IA do Supervisor e a IA do Admin têm perspectivas diferentes sobre a Agenda:

**IA do Supervisor — perspectiva de planejamento imediato:**

*"Você tem 3 shows nas próximas 2 semanas. O show de 21/06 ainda não tem Livro do Dia gerado — faltam 3 dias. O show de 28/06 tem cobertura frágil na posição Mensageira: apenas 1 candidato disponível naquele período."*

**IA do Admin — perspectiva de saúde organizacional:**

*"Junho tem 8 shows confirmados — o mês mais denso do trimestre. 2 posições em 3 grupos diferentes têm banco de candidatos abaixo do mínimo recomendado para absorver ausências durante períodos de alta demanda."*

---

### Como a IA identifica riscos

| Padrão identificado | Como a IA comunica |
|---|---|
| Show sem Livro do Dia a menos de 48h | ⚡ Alerta urgente ao Supervisor |
| Período com muitos shows consecutivos sem folgas planejadas para membros | ⚠ "Eduardo tem 6 shows em 10 dias sem dia de descanso planejado" |
| Período de férias coletivas seguido imediatamente por show de grande porte | ⚠ "Retorno das férias em [data] com show em [data +1]. Membros podem não ter tempo de preparação" |
| Ensaio sem convocados definidos 48h antes da data | ⚠ Alerta ao Supervisor: quem comparece? |
| Dois eventos criados no mesmo período para o mesmo grupo sem folga entre eles | ◆ Contextualização de carga |

---

### Como a IA sugere ajustes

A IA do Supervisor pode sugerir:

*"O ensaio de 19/06 está sem convocados definidos. Com base no repertório deste ensaio (Cenas 1 e 2), os membros que precisariam estar presentes são: [lista]. Deseja que eu pré-preencha a convocação?"*

A IA do Admin pode sugerir:

*"Julho tem 3 semanas de intensidade alta (2+ shows por semana). Considere distribuir os ensaios de preparação para junho para reduzir a carga de julho."*

Sugestão: a IA propõe. O Admin ou Supervisor decide e executa.

---

### O que a IA nunca faz na Agenda

| Proibição | Motivo |
|---|---|
| Criar ou cancelar eventos automaticamente | Eventos na Agenda têm impactos em cascata — sempre humano |
| Mover um show de data sem confirmação explícita | Mudança de data de show gera cascata de MOs e Avisos |
| Convocar membros para Ensaio sem confirmação do Supervisor | A convocação é decisão operacional do Supervisor |
| Declarar Férias Coletivas automaticamente | Impacto organizacional — exclusivamente Admin |

---

## PARTE 6 — CASOS LIMITE

---

### Caso 1 — Conflitos múltiplos em um mesmo dia

**Cenário:** Organização com duas Equipes. Show A (Equipe 1) e Show B (Equipe 2) confirmados para o mesmo dia e horário. Cinco membros pertencem às duas Equipes.

**Comportamento:**
1. Os 5 membros comuns aparecem como candidatos em ambos os Livros do Dia
2. Quando o Supervisor do Show A aloca um desses 5 membros e publica o Livro do Dia, o sistema sinaliza para o Supervisor do Show B: *"[Membro] está alocado no Show A no mesmo horário."*
3. O Supervisor do Show B precisa resolver a posição daquele membro — escolher outro candidato ou sobrescrever (com motivo)
4. O sistema não bloqueia — sinaliza. A decisão sobre qual Show tem prioridade é dos Supervisores, coordenados pelo Admin se necessário

**Regra:** o sistema não resolve conflitos de dois eventos simultâneos automaticamente. Ele os expõe com visibilidade máxima.

---

### Caso 2 — Eventos simultâneos (Show + Reunião)

**Cenário:** Reunião obrigatória marcada no mesmo horário de um Ensaio para membros que precisam de ambos.

**Comportamento:**
1. Sistema alerta ao criar a Reunião: *"[N] membros convocados estão também convocados para o Ensaio de [horário]."*
2. Supervisor da Reunião e Supervisor do Ensaio precisam resolver — via Mensagem ou ajuste de horário
3. O sistema preserva ambos os eventos — não cancela automaticamente nenhum
4. Membros que ficaram em conflito recebem Aviso: *"Conflito de agenda identificado: Reunião e Ensaio no mesmo horário. Supervisor está ciente."*

---

### Caso 3 — Evento cancelado com Livro do Dia publicado

**Cenário:** Show de sábado (Livro do Dia publicado, membros alocados e notificados). Cancelamento imprevisto na quinta-feira.

**Comportamento:**
1. Admin ou Supervisor cancela o evento na Agenda com motivo obrigatório
2. O Livro do Dia é marcado como CANCELADO automaticamente
3. MO do tipo "Cancelamento de Show" é gerada
4. Sistema gera Avisos para todos os membros alocados: *"O show de sábado [data] foi cancelado. [Motivo se configurado como público]"*
5. Folgas e Restrições relacionadas ao show não são afetadas — apenas a alocação daquele Livro do Dia específico
6. O Histórico preserva: o evento existiu, foi cancelado, quem estava alocado, quando foi cancelado e por quem

---

### Caso 4 — Mudança de data de última hora

**Cenário:** Show de sábado movido para domingo — decidido na sexta-feira. Livro do Dia já publicado para sábado.

**Comportamento:**
1. Admin ou Supervisor muda a data do evento na Agenda com motivo obrigatório
2. O Livro do Dia de sábado é marcado como CANCELADO (evento não ocorre mais nessa data)
3. Um novo evento é criado para domingo — ou o evento é movido (com registro no Histórico)
4. Para domingo: sistema verifica a Escala — os membros alocados em sábado estão disponíveis em domingo?
5. Se sim: o Supervisor pode gerar novo Livro do Dia para domingo com a mesma estrutura do de sábado como base
6. Se não: há membros indisponíveis para domingo → posições Em Aberto ou Em Risco no novo Livro
7. Avisos são enviados para os membros alocados: *"O show de sábado [data] foi remarcado para domingo [nova data]. Você está alocado. Aguarde confirmação do Supervisor."*
8. A nova alocação só é confirmada quando o Supervisor publicar o Livro do Dia de domingo

---

### Caso 5 — Férias Coletivas declaradas sobre Shows já confirmados

**Cenário:** Admin declara Férias Coletivas para o período 14–28/07. Já existem 3 Shows confirmados no período para a Equipe incluída nas férias.

**Comportamento:**
1. Ao declarar as Férias Coletivas, o sistema identifica os 3 Shows em conflito
2. Sistema alerta o Admin: *"Existem 3 shows confirmados no período das Férias Coletivas: [lista]. Como deseja proceder?"*
3. Admin tem 3 opções para cada Show:
   - Cancelar o Show (com cascata de cancelamento do Livro do Dia e Avisos)
   - Excluir aquela Equipe das Férias Coletivas (a Equipe não tira férias naquele período)
   - Manter o conflito com resolução manual (Admin assume que há outra Equipe ou membros externos que cobrirão o Show)
4. Enquanto o conflito não for resolvido, o sistema mantém o alerta ativo no Painel de Saúde

---

### Caso 6 — Evento SUSPENSO com data indefinida

**Cenário:** Show previsto para agosto é suspenso por motivo de força maior — sem nova data definida.

**Comportamento:**
1. Admin muda o evento para SUSPENSO com motivo
2. Livro do Dia associado (se já gerado) é marcado como "Evento Suspenso — aguardando retomada"
3. O evento some do calendário ativo dos membros — mas permanece no sistema como SUSPENSO
4. Quando uma nova data for definida:
   - Se o evento retoma: atualiza a data, volta para CONFIRMADO
   - Se não retoma: muda para CANCELADO

---

## PARTE 7 — AUDITORIA DE CONSISTÊNCIA

---

### Existe sobreposição com a Escala?

**Não — dimensões diferentes.**

A Escala responde "quem está disponível?". A Agenda responde "o que acontece e quando?". A Escala alimenta o Livro do Dia com os candidatos disponíveis; a Agenda alimenta o Livro do Dia com a data e o contexto do Show.

A única interseção é funcional e esperada: um evento na Agenda que usa membros cria indisponibilidade na Escala para aquele período. Essa interseção é intencional — não é sobreposição.

---

### Existe sobreposição com Operação?

**Não — mas a relação é estreita e precisa ser clara.**

A Operação é o contexto organizacional de produção ("Temporada 2026 — Musical"). A Agenda contém os eventos específicos dessa Operação ("Show de 14/06", "Ensaio de 12/06"). Uma Operação pode ter dezenas de eventos na Agenda. Um evento na Agenda pertence a uma Operação.

A sobreposição possível é conceitual: *"o show de 14/06 é uma Operação ou um evento da Agenda?"* — Resposta: é um evento da Agenda dentro de uma Operação. A Operação é o agrupador; o evento é a unidade temporal.

---

### Existe sobreposição com Livro do Dia?

**Não — relação de causa e efeito.**

O evento Show na Agenda **causa** o Livro do Dia. Sem evento na Agenda, não há Livro do Dia. O Livro do Dia é o documento operacional detalhado para um evento específico — mas não é o evento em si.

Confundir os dois seria como confundir o calendário com o plano de trabalho. O calendário diz "reunião na quarta". O plano de trabalho diz "na reunião de quarta, pauta: X, responsáveis: Y".

---

## PARTE 8 — FUNDAÇÃO OFICIAL DA AGENDA

---

### Inventário de decisões produzidas

| # | Decisão |
|---|---|
| AGN-D01 | A Agenda é o eixo temporal do MyASA — responde "o que acontece e quando?" sem duplicar as funções da Escala, do Livro do Dia ou da Operação |
| AGN-D02 | 5 tipos de eventos no MVP: Show · Ensaio · Reunião · Bloqueio Operacional · Férias Coletivas. Treinamento, Evento Externo, Manutenção e Show Especial são Pós-MVP |
| AGN-D03 | Um Livro do Dia só pode existir se há um evento Show (ou Ensaio com Livro do Dia configurado) CONFIRMADO na Agenda — a Agenda é a autoridade temporal do Livro do Dia |
| AGN-D04 | Férias Coletivas geram folga aprovada automática para todos os membros das Equipes incluídas — sem necessidade de solicitação individual |
| AGN-D05 | Cancelamento de Show com Livro do Dia publicado gera cascata: Livro marcado como CANCELADO + MO + Avisos para todos os membros alocados. Sempre requer motivo obrigatório |
| AGN-D06 | SUSPENSO é um estado válido para Shows e Ensaios — o evento existe no sistema sem data firme, sem gerar Livro do Dia, visível ao Supervisor mas fora do calendário ativo dos membros |
| AGN-D07 | O sistema nunca resolve conflitos entre eventos simultâneos automaticamente — expõe com visibilidade máxima e deixa a decisão para o Supervisor ou Admin |
| AGN-D08 | Férias Coletivas declaradas sobre Shows confirmados geram alerta obrigatório ao Admin com 3 opções por evento em conflito: cancelar, excluir a equipe das férias, ou manter com resolução manual |
| AGN-D09 | A transição para REALIZADO é automática após a data do evento — configurável como imediata (meia-noite) ou por confirmação manual do Supervisor. REALIZADO é imutável |
| AGN-D10 | A IA não cria, cancela nem move eventos. Identifica riscos de planejamento, sugere ajustes e alerta sobre Shows sem Livro do Dia — mas toda ação na Agenda é humana |

---

### Total acumulado de decisões formais do MyASA 2.0

| Série | Quantidade | Documento |
|---|---|---|
| D-01 a D-20 | 20 | Ciclos operacionais |
| UX-01 a UX-10 | 10 | UX Integrado |
| WF-01 a WF-10 | 10 | Wireframes Ciclo de Comunicação |
| AU-01 a AU-04 | 4 | Auditoria de Encerramento |
| LS-C01 a LS-C12 | 12 | Recuperação Arquitetural |
| LS-D01 a LS-D05 | 5 | Fechamento de Lacunas |
| WLS-D01 a WLS-D10 | 10 | Wireframes S-13 |
| IA-D01 a IA-D10 | 10 | Ecossistema de IA |
| GOV-D01 a GOV-D10 | 10 | Governança Organizacional |
| ENT-D01 a ENT-D10 | 10 | Ciclo de Entregas |
| **AGN-D01 a AGN-D10** | **10** | **Agenda** |
| **Total: 111 decisões formais** | | |

---

## 🟢 Pronto para UX

A Agenda está completamente modelada:

- **Definição** com distinção precisa de Escala, Livro do Dia e Operação
- **5 tipos de eventos no MVP** com comportamento específico de geração de Livro do Dia, folga automática e bloqueio de período
- **5 estados formais** com regras de transição — incluindo SUSPENSO como estado válido distinto de CANCELADO
- **Cascata de mudanças** documentada: o que a Agenda impacta no Livro do Dia em cada estado
- **IA integrada** com perspectivas distintas para Supervisor (planejamento imediato) e Admin (saúde organizacional)
- **6 casos limite** modelados com comportamento específico — incluindo conflitos múltiplos, férias sobre shows e suspensão indefinida
- **3 pontos de auditoria** verificados — sem sobreposição com Escala, Operação ou Livro do Dia

---

*Documento elaborado por Product Designer Sênior — MyASA 2.0*
*Fundação produzida em 18/06/2026*
*Base: arquitetura completa · núcleo operacional · ecossistema de IA · governança · 101 decisões anteriores*
