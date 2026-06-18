# MyASA 2.0 — Fundação do Ciclo de Entregas (S-07)

> **Versão:** 18/06/2026
> **Fase:** Modelagem de Comportamento — anterior a wireframes e mockups
> **Base:** Arquitetura · Pesquisas de campo · Jornadas · S-01 · S-06 · S-10 · S-11 · Governança Organizacional · 91 decisões formais
> **Superfície modelada:** S-07 Entregas
> **Natureza:** Fundação de produto — sem interface, sem wireframes, sem componentes
> **Status:** 🟢 Pronto para UX

---

## Premissa desta modelagem

O MyASA tem quatro canais de comunicação e ação: Avisos, Mensagens, Solicitações e Entregas. Cada um resolve um problema diferente. S-07 Entregas é o único que resolve este:

**"Preciso ter certeza de que todos leram, assistiram e confirmaram — antes do show."**

Isso não é um Aviso (unidirecional, sem confirmação obrigatória). Não é uma Mensagem (conversa, sem estado de conclusão). Não é uma Solicitação (o membro pede algo ao Supervisor, não o contrário). Não é a Biblioteca (acesso por demanda, sem prazo, sem rastreamento individual).

S-07 existe porque a operação artística exige compliance verificável — e o sistema precisa de evidência, não de presunção.

---

## PARTE 1 — DEFINIÇÃO

---

### O que é uma Entrega

Uma Entrega é uma **atribuição formal com prazo e estado verificável**. O Supervisor ou Admin cria, atribui a destinatários específicos e precisa saber — com evidência — quem completou e quem não completou.

Uma Entrega:
- Tem destinatário(s) definido(s)
- Tem prazo (obrigatório ou opcional por tipo)
- Tem estado per-destinatário (cada membro tem seu próprio estado)
- Exige ação ativa do destinatário (ler, assistir, confirmar, completar)
- Gera registro no Histórico do destinatário e do Supervisor

---

### O que NÃO é uma Entrega

| Situação | Por que não é uma Entrega |
|---|---|
| "Preciso avisar que o ensaio mudou de horário" | É um Aviso — informação unidirecional, sem conclusão exigida |
| "Tenho uma dúvida sobre o figurino de amanhã" | É uma Mensagem — conversa bilateral |
| "Quero pedir folga para o dia 28" | É uma Solicitação — o membro pede, o Supervisor responde |
| "Queremos disponibilizar o manual do espetáculo para consulta" | É a Biblioteca — acesso por demanda, sem rastreamento, sem prazo |
| "Preciso verificar se alguém pode fazer a segunda sessão" | É uma pergunta operacional — Mensagem ou Aviso com resposta esperada |

---

### Tabela comparativa: Aviso · Mensagem · Solicitação · Entrega

| Dimensão | Aviso | Mensagem | Solicitação | Entrega |
|---|---|---|---|---|
| **Direção** | Supervisor → Membro | Bilateral | Membro → Supervisor | Supervisor/Admin → Membro(s) |
| **Ação exigida do Membro** | Nenhuma (informação) | Resposta opcional/obrigatória | Aguarda resposta | Conclusão obrigatória |
| **Estado de conclusão** | Não — entregue/lido | Não — apenas lido | Sim — aprovado/negado | Sim — por destinatário |
| **Prazo** | Não | Não | Sim (do Supervisor responder) | Sim (do Membro completar) |
| **Rastreamento individual** | Não (em massa) | Não aplicável | Sim — uma solicitação por vez | Sim — estado per-destinatário |
| **Evidência de compliance** | Não | Não | N/A | Sim — registro permanente |
| **Quem inicia** | Supervisor | Qualquer | Membro | Supervisor · Admin |
| **Contexto típico** | Mudança de alocação publicada | Dúvida operacional | Pedido de folga | Briefing obrigatório pré-show |

---

### O problema que a Entrega resolve

Em operações artísticas, "já mandei mensagem para todo mundo" não é evidence — é esperança. A Entrega transforma o processo de disseminação de informação obrigatória em um ciclo rastreável:

```
Supervisor precisa que todos os membros
confirmem o novo protocolo de entrada antes do show de sábado
                  ↓
Cria Entrega do tipo "Leitura Obrigatória"
Atribui ao grupo completo
Define prazo: sexta-feira às 18h
                  ↓
Sistema notifica os membros
                  ↓
Cada membro abre, lê e confirma
                  ↓
Supervisor vê em tempo real: 8 de 11 concluídas
3 pendentes — manda lembrete
                  ↓
Show de sábado: 11 de 11 confirmadas
Registro permanente no Histórico
```

Sem S-07, esse processo é feito por grupo de WhatsApp, e-mail ou comunicação verbal — sem evidência, sem estado, sem rastreamento.

---

## PARTE 2 — TIPOS DE ENTREGA

---

### Classificação completa

---

#### MVP

Tipos que entram no produto inicial.

---

**Tipo 1 — Leitura Obrigatória**

Conteúdo textual que o membro deve ler e confirmar que leu.

| Campo | Definição |
|---|---|
| Conteúdo | Texto nativo no sistema (ou link externo com confirmação manual) |
| Conclusão | Membro clica em "Li e confirmo" após abrir |
| Prazo | Obrigatório |
| Casos de uso | Briefing pré-show, nova coreografia, atualização de regras, protocolo de segurança |
| Estado mínimo para "concluída" | Abertura + confirmação explícita |

---

**Tipo 2 — Vídeo Obrigatório**

Conteúdo audiovisual que o membro deve assistir.

| Campo | Definição |
|---|---|
| Conteúdo | Link de vídeo (YouTube, Vimeo, link interno) |
| Conclusão | Membro clica em "Assisti e confirmo" após abrir a Entrega |
| Prazo | Obrigatório |
| Casos de uso | Demonstração de coreografia, treinamento de segurança, orientação de figurino |
| Limitação do MVP | O sistema NÃO rastreia tempo de vídeo assistido — a confirmação é manual ("assistirei e confirmarei") |
| Estado mínimo para "concluída" | Abertura + confirmação explícita |

**Nota sobre a limitação:** rastreamento de progresso de vídeo requer integração técnica com o player — complexidade de V2. No MVP, a confirmação é declaratória, não técnica. O Supervisor aceita a declaração do membro como evidência suficiente.

---

**Tipo 3 — Atualização Operacional**

Mudança na operação que requer ciência explícita do membro afetado.

| Campo | Definição |
|---|---|
| Conteúdo | Descrição da mudança com contexto (o quê, por quê, o que muda para o membro) |
| Conclusão | Membro clica em "Entendi e confirmo" |
| Prazo | Obrigatório |
| Casos de uso | Mudança de posição permanente, nova regra de substituição, mudança de horário de entrada, nova exigência de figurino |
| Relação com MO | Uma MO pode gerar automaticamente uma Entrega do tipo Atualização Operacional para o membro afetado — mas não é obrigatório. O Supervisor decide se a MO justifica uma Entrega formal ou apenas um Aviso |

---

**Tipo 4 — Checklist**

Lista de itens que o membro deve confirmar individualmente antes de um show ou ensaio.

| Campo | Definição |
|---|---|
| Conteúdo | Lista de itens criados pelo Supervisor (ex.: "figurino retirado", "passagem de bloco realizada", "equipamento inspecionado") |
| Conclusão | Todos os itens marcados + confirmação final |
| Prazo | Obrigatório |
| Casos de uso | Checklist pré-show, checklist de retirada de equipamento, checklist de preparação de cena |
| Estado "em andamento" | Membro começou a marcar itens mas não concluiu todos |

---

#### Pós-MVP

Tipos que entram no produto após validação do MVP.

---

**Tipo 5 — Treinamento (Pós-MVP)**

Conteúdo estruturado em múltiplos passos, com progressão obrigatória entre etapas.

| Complexidade | Por que Pós-MVP |
|---|---|
| Requer controle de progressão entre etapas | Complexidade de UX e lógica significativamente maior |
| Pode combinar Leitura, Vídeo e Checklist em sequência | Tipo composto — exige modelagem própria |
| Pode ter múltiplos autores de conteúdo | Fluxo editorial mais complexo |

---

**Tipo 6 — Validação de Conhecimento (Pós-MVP)**

Quiz ou questionário para verificar entendimento após Leitura ou Vídeo.

| Complexidade | Por que Pós-MVP |
|---|---|
| Requer criação de perguntas e respostas | Interface de criação mais complexa |
| Exige critério de aprovação (nota mínima, todas corretas) | Lógica de avaliação fora do escopo do MVP |
| Pode gerar retentativa com novo conteúdo | Fluxo ramificado complexo |

---

**Tipo 7 — Documento com Assinatura Digital (Pós-MVP)**

Documento formal que exige assinatura digital rastreável do membro.

| Complexidade | Por que Pós-MVP |
|---|---|
| Requer integração com sistema de assinatura digital | Infraestrutura de terceiros |
| Tem implicações legais | Requer revisão jurídica |
| Diferentes legislações por país | Complexidade de compliance internacional |

---

#### Nunca

Tipos que não entram no produto em nenhuma versão — fora do escopo do MyASA.

| Tipo descartado | Por que nunca |
|---|---|
| Tarefas genéricas de projeto (tipo Trello/Jira) | O MyASA não é gerenciador de projetos; tarefas sem relação com shows e operações não são escopo |
| Avaliações de desempenho | Domínio de RH — fora do escopo operacional |
| Aprovações financeiras | Domínio financeiro — fora do escopo operacional |
| Pesquisas de satisfação | Não é uma Entrega operacional — é outra categoria de produto |
| Obrigações contratuais | Requer contexto jurídico que o sistema não tem |

---

### Tabela resumo de tipos no MVP

| Tipo | Prazo obrigatório? | Confirmação | Tem estado "Em andamento"? |
|---|---|---|---|
| Leitura Obrigatória | ✅ | "Li e confirmo" | Não |
| Vídeo Obrigatório | ✅ | "Assisti e confirmo" | Não |
| Atualização Operacional | ✅ | "Entendi e confirmo" | Não |
| Checklist | ✅ | Todos os itens + "Confirmo" | ✅ Sim |

---

## PARTE 3 — CICLO DE VIDA

---

### Estados formais

```
CRIADA
   ↓
PUBLICADA ────────────────────────────→ CANCELADA
   │                                        │
   ↓ (por destinatário)                     ↓ (todos os destinatários)
RECEBIDA                              [estado terminal]
   │
   ↓ (membro abre)
VISUALIZADA
   │                    ↓ (prazo venceu antes de concluir)
   ↓ (checklist)    ATRASADA ──────────→ EXPIRADA
EM ANDAMENTO           │               [estado terminal]
   │                   ↓ (membro ainda pode concluir — ver regra abaixo)
   ↓               CONCLUÍDA FORA DO PRAZO
CONCLUÍDA               │
   │                    ↓
[estado terminal]  [estado terminal]
```

---

### Definição de cada estado

| Estado | Quem transita | Como transita | Terminal? |
|---|---|---|---|
| **CRIADA** | — | Entrega criada mas não enviada aos destinatários | Não |
| **PUBLICADA** | Admin · Supervisor | Entrega publicada e enviada aos destinatários | Não |
| **RECEBIDA** | Sistema (automático) | Entrega chegou ao Meu Dia do destinatário | Não |
| **VISUALIZADA** | Membro | Membro abriu a Entrega | Não |
| **EM ANDAMENTO** | Membro | Membro iniciou checklist mas não concluiu | Não (apenas Checklist) |
| **CONCLUÍDA** | Membro | Membro completou e confirmou | Sim |
| **ATRASADA** | Sistema (automático) | Prazo venceu e Entrega não foi concluída | Não |
| **EXPIRADA** | Sistema ou Supervisor | Prazo final passou; Entrega não pode mais ser concluída | Sim |
| **CONCLUÍDA FORA DO PRAZO** | Membro | Concluída após o prazo — se o Supervisor permitiu extensão | Sim |
| **CANCELADA** | Admin · Supervisor | Cancelada antes da conclusão | Sim |

---

### Regras de transição críticas

**ATRASADA não é EXPIRADA:**
Quando o prazo vence, a Entrega entra em ATRASADA — não em EXPIRADA imediatamente. O Supervisor decide: (a) permite que o membro ainda conclua (com registro de CONCLUÍDA FORA DO PRAZO), (b) cancela, (c) aguarda até que o sistema archive automaticamente como EXPIRADA após N dias configurado.

O sistema não expira automaticamente no instante em que o prazo vence — dá espaço para o Supervisor agir.

**VISUALIZADA não é CONCLUÍDA:**
Um membro pode abrir uma Entrega e fechar sem confirmar. O estado VISUALIZADA registra que o membro teve acesso ao conteúdo — mas não confirma ciência. Somente CONCLUÍDA tem valor de compliance.

**CANCELADA preserva o histórico anterior:**
Se uma Entrega está em VISUALIZADA ou CONCLUÍDA e é cancelada, o estado anterior é preservado no Histórico. Não é possível "apagar" a evidência de que um membro já havia concluído ou visualizado.

---

### Extensão de prazo

O Supervisor pode estender o prazo de uma Entrega ATRASADA:

1. Define nova data de prazo
2. Membro recebe notificação de "prazo estendido"
3. Estado volta de ATRASADA para PUBLICADA/VISUALIZADA/EM ANDAMENTO (o que era antes)
4. Novo prazo contabiliza normalmente

Extensão é registrada no Histórico com motivo obrigatório.

---

## PARTE 4 — RESPONSABILIDADES

---

### Supervisor

| Ação | Descrição |
|---|---|
| **Cria** | Cria Entregas para os membros do seu grupo — não pode criar para grupos de outros Supervisores |
| **Atribui** | Define destinatários: membro individual, subgrupo, toda a Equipe |
| **Define prazo** | Prazo obrigatório para todos os tipos do MVP |
| **Publica** | Envia a Entrega aos destinatários (transição CRIADA → PUBLICADA) |
| **Acompanha** | Vê em tempo real: quantos concluíram, quem está pendente, quem está atrasado |
| **Lembra** | Envia lembrete manual para destinatários RECEBIDA/VISUALIZADA/ATRASADA |
| **Estende prazo** | Com motivo obrigatório |
| **Cancela** | Com motivo obrigatório; registrado no Histórico |
| **Reemite** | Cria nova versão da Entrega se o conteúdo mudou (substitui a anterior) |
| **Audita** | Consulta histórico de conclusões para fins de compliance |

---

### Admin

| Ação | Descrição |
|---|---|
| **Cria Entregas organizacionais** | Entregas de escopo toda a organização (ex.: política de segurança que todos os membros de todos os grupos precisam confirmar) |
| **Cria templates** | Templates de Entregas reutilizáveis que os Supervisores instanciam para seus grupos |
| **Define Entregas obrigatórias por Operação** | Entregas que todo membro de uma Operação precisa completar antes da primeira participação |
| **Audita compliance** | Vê taxas de conclusão por grupo, por tipo, por período |
| **Intervém em Entregas organizacionais** | Pode cancelar ou estender Entregas que criou |
| **Não interfere em Entregas de Supervisores** | As Entregas criadas pelo Supervisor para seu grupo são de responsabilidade do Supervisor |

---

### Membro

| Ação | Descrição |
|---|---|
| **Recebe** | Entrega aparece no Meu Dia quando publicada |
| **Visualiza** | Abre e consome o conteúdo |
| **Completa** | Confirma conclusão com ação explícita ("Li e confirmo", etc.) |
| **Não pode rejeitar** | Não existe "negar uma Entrega" — o membro conclui, deixa expirar ou atrasa |
| **Não pode criar** | Membros não criam Entregas |
| **Não pode ver Entregas de outros membros** | O estado de conclusão de outros membros é invisível ao Membro (o Supervisor vê, o Membro não) |
| **Pode perguntar sobre o conteúdo** | Via Mensagem ao Supervisor ou via IA (dentro do escopo do conteúdo da Entrega) |

---

## PARTE 5 — RELAÇÃO COM MEU DIA

---

### Como uma Entrega aparece no Meu Dia

O Meu Dia (S-01) é organizado por urgência e contexto temporal. As Entregas vivem em uma zona específica do Meu Dia — não misturada com a alocação de shows nem com Avisos.

**Zona de Entregas no Meu Dia:**

```
MEU DIA — [data]
├── [Alocação do dia — show/ensaio]
│
├── ENTREGAS PENDENTES
│   ├── ⚡ [URGENTE] — prazo hoje ou amanhã
│   ├── ⚠ [ATRASADA] — prazo vencido
│   └── ◆ [PENDENTE] — prazo em mais de 2 dias
│
└── [Avisos recentes]
```

---

### Quando uma Entrega sobe para o topo do Meu Dia

| Condição | Posição no Meu Dia |
|---|---|
| Prazo nas próximas 24h | Topo da zona de Entregas, marcada como URGENTE |
| Entrega ATRASADA | Topo da zona de Entregas, marcada como ATRASADA com banner de alerta |
| Entrega nova (recém-publicada) com prazo longo | Zona de Entregas, posição padrão |
| Entrega relacionada ao show do dia (mesma data) | Sinalizadora especial: "Esta Entrega é pré-requisito para o show de hoje" |

---

### Quando uma Entrega desaparece do Meu Dia

Uma Entrega CONCLUÍDA some da zona de Entregas pendentes — mas permanece acessível na seção "Entregas concluídas" dentro do Histórico do Membro.

Uma Entrega CANCELADA ou EXPIRADA some do Meu Dia sem ação do Membro.

O Membro nunca precisa "arquivar" ou "fechar" uma Entrega — o sistema gerencia a visibilidade baseado no estado.

---

### Quando gera atenção e risco

| Estado da Entrega | Impacto no Meu Dia |
|---|---|
| RECEBIDA ou VISUALIZADA com prazo nas próximas 24h | Banner de atenção — amarelo |
| ATRASADA | Banner de alerta persistente — o Membro não pode ignorar facilmente |
| Entrega de Checklist EM ANDAMENTO com prazo próximo | "X de Y itens concluídos — prazo: [hora]" |
| ATRASADA + é pré-requisito de show no dia | Estado de risco — não bloqueia o show (o Membro pode participar), mas o Supervisor é notificado |

**Regra de design:** a Entrega nunca bloqueia a participação do Membro no show. O sistema informa, o Supervisor decide o que fazer com um membro que não completou. O sistema não tem autoridade para barrar o membro.

---

## PARTE 6 — RELAÇÃO COM IA

---

### O que a IA faz nas Entregas

**Resumo de conteúdo:**
A IA pode resumir uma Entrega do tipo Leitura Obrigatória antes de o membro abrir o conteúdo completo. O resumo é informativo — não substitui a leitura. A confirmação "Li e confirmo" só aparece após o membro ter acesso ao conteúdo completo.

*"Esta Entrega cobre 3 tópicos: (1) nova sequência de entrada para o Bloco 2, (2) atualização do protocolo de equipamento, (3) confirmação de que o figurino deve ser retirado até sexta. Tempo estimado de leitura: 3 minutos."*

**Resposta a dúvidas sobre o conteúdo:**
Se um membro não entende algo em uma Entrega de Leitura Obrigatória, pode perguntar à IA. A IA responde com base no conteúdo da Entrega.

*"A Entrega diz 'entrada pela lateral esquerda'. Qual é a lateral esquerda em relação ao palco?"*
→ A IA responde se o conteúdo da Entrega (ou o Livro do Show associado) esclarece isso; se não, direciona para o Supervisor.

**Acompanhamento para o Supervisor:**
*"8 de 11 membros concluíram. Os 3 pendentes são: Eduardo (VISUALIZADA há 2h), Fernanda (RECEBIDA — não abriu), Carlos (ATRASADA). Show em 18 horas."*

**Alerta pré-show:**
*"Há 1 membro com Entrega obrigatória não concluída para o show de amanhã: Carlos Andrade. Prazo era hoje às 18h. Deseja enviar um lembrete agora?"*

---

### O que a IA não faz nas Entregas

| Proibição | Motivo |
|---|---|
| Marcar uma Entrega como concluída no lugar do Membro | A confirmação precisa ser do próprio membro — a IA não pode substituir a ciência |
| Confirmar que o membro "entendeu" o conteúdo | Entendimento não é verificável pela IA com os dados disponíveis |
| Decidir se um membro com Entrega não concluída pode ou não participar do show | Decisão do Supervisor — nunca do sistema |
| Revelar para um membro quais outros membros completaram ou não | O estado de outros membros é invisível ao Membro |
| Resumir o conteúdo de uma Entrega de outro grupo | Escopo restrito ao grupo operacional do usuário |

---

### Pode a IA validar entendimento?

No MVP: não — a IA responde perguntas sobre o conteúdo, mas não aplica quiz nem avalia se o membro demonstrou compreensão. Isso é o Tipo 6 (Validação de Conhecimento) do Pós-MVP.

No MVP, o sistema aceita a confirmação declaratória do membro como evidência de ciência — não de entendimento. Essa distinção é explícita: o sistema registra que o membro confirmou ter lido, não que o membro compreendeu. A responsabilidade de validar o entendimento na prática é do Supervisor, na operação.

---

## PARTE 7 — RELAÇÃO COM HISTÓRICO

---

### O que vai para o Histórico

**Nível da Entrega (Supervisor e Admin veem):**

| Evento | Registrado no Histórico? |
|---|---|
| Criação da Entrega | ✅ Com autor, timestamp, tipo, destinatários |
| Publicação | ✅ Com autor e timestamp |
| Cada conclusão por destinatário | ✅ Com membro, timestamp, estado |
| Cada visualização (abriu mas não concluiu) | ✅ Com membro e timestamp |
| Atrasadas: quem estava pendente no momento do prazo | ✅ Snapshot do estado no vencimento |
| Cancelamento | ✅ Com autor, motivo, timestamp, estados individuais preservados |
| Extensão de prazo | ✅ Com autor, motivo e novo prazo |
| Lembrete enviado | ✅ Com autor e destinatários |

**Nível do Membro (o próprio Membro e o Supervisor veem):**

| Evento | Registrado? |
|---|---|
| Recebimento | ✅ |
| Abertura | ✅ |
| Conclusão | ✅ Com timestamp |
| Conclusão fora do prazo | ✅ Com flag de "fora do prazo" |
| Não conclusão até expiração | ✅ Permanente — "Entrega expirada sem conclusão" |

---

### O que merece narrativa no Histórico

A IA do Supervisor pode gerar narrativa contextualizada para situações relevantes:

*"Show de 21/06 — Briefing Obrigatório de Segurança: 10 de 11 membros concluíram antes do prazo. 1 membro (Carlos Andrade) concluiu com 2h de atraso após lembrete do Supervisor."*

Isso contrasta com eventos triviais que não merecem narrativa: abertura e fechamento de uma Entrega concluída normalmente, dentro do prazo, sem incidentes.

---

### Quando uma Entrega vira algo relevante para investigação

| Situação | Por que é relevante para investigação |
|---|---|
| Entrega de segurança expirada sem conclusão + incidente posterior | O registro evidencia que o membro não havia confirmado o protocolo antes do incidente |
| Padrão de um membro nunca completar Entregas no prazo | Pode indicar desengajamento ou sobrecarga — Admin/Supervisor pode investigar |
| Entrega concluída mas membro demonstra desconhecimento do conteúdo na prática | O registro mostra que a confirmação foi feita, mas o Supervisor pode questionar o processo de validação |
| Supervisor enviou Entrega obrigatória mas ela foi cancelada antes de o grupo completar | Investigação de por que foi cancelada — especialmente se houve incidente relacionado ao conteúdo |

---

## PARTE 8 — CASOS LIMITE

---

### Caso 1 — Entrega nunca aberta

**Cenário:** Membro recebeu a Entrega. Não abriu. Prazo venceu.

**Comportamento:**
- Estado: RECEBIDA → ATRASADA → EXPIRADA (após N dias)
- Histórico registra: "Entrega expirada. Nunca visualizada pelo destinatário."
- A IA do Supervisor sinaliza: *"Carlos Andrade nunca abriu esta Entrega. Diferente de membros que visualizaram mas não confirmaram."*
- O Supervisor pode: enviar lembrete (se ainda ATRASADA), estender prazo, cancelar

**Distinção importante:** nunca aberta é diferente de aberta mas não concluída. A distinção é registrada porque as implicações são diferentes — uma indica que o membro nunca teve acesso ao conteúdo; a outra indica que o membro teve acesso mas não confirmou.

---

### Caso 2 — Entrega aberta e não concluída

**Cenário:** Membro abriu, leu parcialmente (ou visualizou o vídeo), fechou sem confirmar. Prazo venceu.

**Comportamento:**
- Estado: VISUALIZADA → ATRASADA → EXPIRADA
- Histórico registra: "Entrega expirada. Visualizada em [data/hora] mas não concluída."
- A IA distingue: *"Fernanda abriu a Entrega em [hora] mas não confirmou a leitura antes do vencimento."*
- Operacionalmente: Fernanda teve acesso ao conteúdo — mas não gerou evidência de ciência

---

### Caso 3 — Entrega concluída após prazo

**Cenário:** Prazo venceu, Supervisor estendeu o prazo. Membro conclui na extensão.

**Comportamento:**
- Estado: ATRASADA → (Supervisor estende prazo) → PUBLICADA/VISUALIZADA → CONCLUÍDA FORA DO PRAZO
- Histórico registra: "Concluída em [data] — após prazo original de [data]. Prazo estendido por [Supervisor] com motivo: [motivo]."
- A Entrega tem estado de conclusão válido para fins de compliance — mas com o flag de "fora do prazo" para auditoria

---

### Caso 4 — Entrega cancelada

**Cenário A — Cancelada antes de qualquer membro abrir:**
- Todos os destinatários recebem notificação de cancelamento
- Entrega some do Meu Dia de todos
- Histórico registra cancelamento com motivo

**Cenário B — Cancelada com alguns membros já concluídos:**
- Estado dos membros que já concluíram: preservado no Histórico ("Concluída em [data] · Entrega posteriormente cancelada por [Supervisor]")
- Entrega some do Meu Dia dos membros que não haviam concluído
- Os membros que já concluíram recebem notificação: "Esta Entrega foi cancelada pelo Supervisor."
- O registro de conclusão não é apagado — a evidência de ciência permanece mesmo com cancelamento

---

### Caso 5 — Entrega substituída por outra

**Cenário:** O conteúdo da Entrega mudou (ex.: protocolo atualizado). O Supervisor precisa cancelar a Entrega atual e criar uma nova versão.

**Comportamento:**
- Supervisor cancela a Entrega atual com motivo: "Substituída por versão atualizada"
- Supervisor cria nova Entrega (o sistema permite vincular como "substitui [Entrega anterior]")
- Histórico da Entrega anterior registra: "Cancelada e substituída por [referência da nova Entrega]"
- Histórico da nova Entrega registra: "Substitui [referência da Entrega anterior]"
- Membros que já concluíram a Entrega anterior: recebem a nova Entrega (conteúdo mudou — precisam confirmar o novo)
- A conclusão da Entrega anterior não vale como conclusão da nova

---

### Caso 6 — Membro desligado com Entregas pendentes

**Cenário:** Membro é removido da Equipe (desligamento, transferência) com Entregas pendentes.

**Comportamento:**
- Entregas pendentes do membro entram em EXPIRADA automaticamente
- O membro não aparece mais como destinatário pendente na visão do Supervisor
- Histórico preserva: "Entrega expirada — destinatário desligado da Equipe em [data]"
- Se o membro for reativado ou transferido: a Entrega expirada não é reaberta automaticamente — o Supervisor decide se reemite

---

### Caso 7 — Supervisor removido durante acompanhamento

**Cenário:** Supervisor que criou as Entregas ativas é removido da Equipe.

**Comportamento:**
- Entregas publicadas permanecem ativas para os destinatários — a Entrega não é cancelada pelo fato de o Supervisor ter saído
- A responsabilidade de acompanhar passa para: (a) outro Supervisor do mesmo grupo, (b) o Admin
- Admin recebe alerta: "Supervisor [nome] removido. Existem [N] Entregas ativas sem responsável. Designar novo responsável."
- O Admin pode designar outro Supervisor como responsável pelas Entregas orfãs
- As Entregas orfãs sem responsável permanecem com estados ativos, mas sem alertas de acompanhamento até que um novo responsável seja designado

---

## PARTE 9 — AUDITORIA DE CONSISTÊNCIA

---

### Existe sobreposição com Solicitações?

**Não.** A direção é oposta:
- **Solicitação:** Membro → Supervisor (o Membro pede, o Supervisor decide)
- **Entrega:** Supervisor/Admin → Membro (o Supervisor/Admin atribui, o Membro confirma)

São direções, propósitos e estados completamente diferentes. Não há risco de sobreposição.

---

### Existe sobreposição com Avisos?

**Baixa — e a distinção é clara.**

| | Aviso | Entrega |
|---|---|---|
| Requer confirmação do membro? | Não | Sim |
| Tem prazo para o membro? | Não | Sim |
| Gera evidência de compliance? | Não | Sim |
| O Supervisor sabe quem leu? | Não | Sim |

Um Aviso informa. Uma Entrega verifica. O critério é: "Preciso ter evidência de que cada pessoa individualmente confirmou?" — se sim, é Entrega. Se não, é Aviso.

---

### Existe sobreposição com Biblioteca?

**Não.** A Biblioteca é repositório passivo por demanda. A Entrega é atribuição ativa com prazo.

O mesmo documento pode existir nos dois lugares:
- Na Biblioteca: disponível para consulta quando o membro quiser
- Como Entrega: o Supervisor atribui formalmente, define prazo e rastreia quem leu

Não são canais competitivos — são contextos de acesso diferentes ao mesmo conteúdo.

---

### Existe risco de S-07 virar um gerenciador de tarefas genérico?

**Sim — e a mitigação é a definição restritiva de tipos.**

O risco é real: "vou criar uma Entrega para o membro confirmar que ajustou o figurino", "vou criar uma Entrega para o membro avisar que chegou ao teatro", "vou criar uma Entrega para o membro confirmar que ensaiou o solo".

O freio são os **tipos do MVP**. Todos os 4 tipos do MVP são sobre **ciência de informação operacional** — não sobre execução de tarefas físicas ou logísticas. O sistema não é um sistema de rastreamento de presença, nem um gerenciador de to-do list.

**Regra de fronteira:** se a Entrega pede que o membro confirme que *sabe algo*, é uma Entrega. Se pede que o membro confirme que *fez algo físico fora do sistema*, está no limite. O checklist é a exceção controlada — é uma lista de confirmações que o Supervisor define, não tarefas genéricas abertas.

Essa distinção precisa ser comunicada no onboarding do Admin/Supervisor — não é apenas técnica, é editorial.

---

### Existe risco de gerar carga administrativa desnecessária?

**Sim — e a mitigação é a responsabilidade do Supervisor.**

O sistema não limita o número de Entregas que um Supervisor pode criar. Um Supervisor excessivamente cauteloso pode criar uma Entrega para cada micro-atualização, gerando fadiga no Membro ("mais uma coisa para confirmar").

**Mitigação estrutural:**
1. A IA do Supervisor pode sinalizar alta frequência de Entregas para o mesmo grupo em pouco tempo: *"Você criou 4 Entregas nos últimos 7 dias para este grupo. Membros com alta carga de Entregas tendem a concluir com mais atraso."*
2. O Admin pode ver, no Painel de Saúde, a taxa de Entregas por grupo — padrões de sobrecarga são visíveis
3. O produto educa: a diferença entre Entrega (ciência obrigatória verificável) e Aviso (informação) precisa ser clara no onboarding

---

## PARTE 10 — FUNDAÇÃO OFICIAL DO CICLO DE ENTREGAS

---

### Definição oficial da entidade Entrega

> Uma Entrega é uma atribuição formal de conteúdo obrigatório, criada pelo Supervisor ou Admin, atribuída a destinatários específicos, com prazo definido e estado verificável por destinatário. Seu propósito é garantir evidência rastreável de que cada membro individualmente confirmou ciência de informação operacional crítica — antes de shows, após mudanças importantes ou como parte de processos obrigatórios da organização.

---

### Inventário de decisões produzidas

| # | Decisão |
|---|---|
| ENT-D01 | Uma Entrega é uma atribuição formal com prazo e estado per-destinatário. Não é Aviso (sem confirmação), Mensagem (bilateral), Solicitação (bottom-up) nem Biblioteca (passiva) |
| ENT-D02 | 4 tipos no MVP: Leitura Obrigatória · Vídeo Obrigatório · Atualização Operacional · Checklist. Treinamento, Validação de Conhecimento e Assinatura Digital são Pós-MVP |
| ENT-D03 | O MVP não rastreia progresso de vídeo tecnicamente — a confirmação de vídeo é declaratória ("Assisti e confirmo"). Rastreamento de progresso é V2 |
| ENT-D04 | ATRASADA não é EXPIRADA — o Supervisor tem janela para intervir após o vencimento do prazo antes de o sistema arquivar como EXPIRADA |
| ENT-D05 | A Entrega nunca bloqueia a participação do membro no show. O sistema informa; o Supervisor decide |
| ENT-D06 | VISUALIZADA não é CONCLUÍDA — o membro pode abrir sem confirmar. Apenas CONCLUÍDA tem valor de compliance |
| ENT-D07 | Cancelamento de Entrega não apaga registros anteriores de visualização ou conclusão — a evidência de ciência é preservada mesmo com cancelamento |
| ENT-D08 | Entrega substituída por nova versão: conclusão da versão anterior não vale para a nova — o membro precisa confirmar o conteúdo atualizado |
| ENT-D09 | Supervisor removido: Entregas ativas permanecem para destinatários; Admin é alertado e designa novo responsável; Entregas sem responsável permanecem ativas mas sem acompanhamento |
| ENT-D10 | A IA pode resumir o conteúdo de uma Entrega e responder dúvidas sobre ela — mas não pode marcar como concluída nem confirmar entendimento pelo membro |

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
| **ENT-D01 a ENT-D10** | **10** | **Ciclo de Entregas** |
| **Total: 101 decisões formais** | | |

---

## 🟢 Pronto para UX

O Ciclo de Entregas está completamente modelado:

- **Definição** com distinção precisa de Aviso, Mensagem, Solicitação e Biblioteca
- **4 tipos de MVP** com comportamento de conclusão, prazo e estado per-destinatário
- **9 estados formais** com regras de transição e distinção crítica entre ATRASADA/EXPIRADA e VISUALIZADA/CONCLUÍDA
- **Responsabilidades** separadas por Supervisor, Admin e Membro — sem ambiguidade
- **Relação com Meu Dia** — zona dedicada com hierarquia de urgência
- **Relação com IA** — resumo, perguntas e acompanhamento; limites de autonomia definidos
- **Relação com Histórico** — o que registra, o que merece narrativa, quando é relevante para investigação
- **7 casos limite** modelados com comportamento específico
- **4 riscos de sobreposição** auditados e mitigados; risco de carga administrativa identificado com mitigação estrutural

O produto MyASA 2.0 alcança **101 decisões formais** — fundação completa para todas as superfícies do produto.

---

*Documento elaborado por Product Designer Sênior — MyASA 2.0*
*Fundação produzida em 18/06/2026*
*Base: núcleo operacional completo · Ecossistema de IA · Governança Organizacional · pesquisas de campo · 91 decisões anteriores*
