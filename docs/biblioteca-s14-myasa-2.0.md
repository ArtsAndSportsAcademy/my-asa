# MyASA 2.0 — Fundação da Biblioteca (S-14)

> **Versão:** 18/06/2026
> **Fase:** Modelagem de Comportamento — anterior a wireframes e mockups
> **Base:** Arquitetura · Núcleo Operacional · Ecossistema de IA · Governança Organizacional · Agenda · Entregas · Livro do Show · 111 decisões formais
> **Superfície modelada:** S-14 Biblioteca
> **Natureza:** Fundação de produto — sem interface, sem wireframes, sem componentes
> **Status:** 🟢 Pronto para UX

---

## Premissa central

O MyASA tem superfícies que **empurram** informação ao membro (Avisos, Entregas) e superfícies que **registram** o que aconteceu (Histórico, MO). A Biblioteca é diferente das duas: ela **armazena** o conhecimento permanente da organização, disponível para consulta **quando necessário** — sem prazo, sem obrigação, sem expiração.

A Biblioteca existe porque toda organização artística acumula saber operacional que não pertence a nenhum show específico, a nenhum evento passado, a nenhuma notificação — mas que precisa estar disponível, atualizado e acessível. Sem ela, esse saber fica disperso em arquivos, grupos de mensagem e memória individual. Com ela, o saber é um ativo gerenciado.

---

## Definição oficial

A Biblioteca é o **repositório de conhecimento permanente da organização** — o acervo de documentos, procedimentos, referências e políticas que existem independentemente de shows específicos, eventos passados ou notificações transientes. É uma superfície de **consulta por demanda** — o membro vai à Biblioteca quando precisa; a Biblioteca não vai até o membro.

A Biblioteca é:
- **Referência permanente** — conteúdo que não expira com o fim de um show ou temporada
- **Repositório ativo** — gerenciado, versionado e com responsável explícito
- **Base de conhecimento da IA** — a IA consulta a Biblioteca para responder perguntas operacionais
- **Ponto de origem de Entregas** — conteúdo da Biblioteca pode ser transformado em Entrega quando o Supervisor decide que a leitura é obrigatória para um grupo específico

---

## Por que a Biblioteca existe se já existem Livro do Show, Entregas, Avisos, Histórico e IA

| Entidade existente | Por que não substitui a Biblioteca |
|---|---|
| **Livro do Show** | É um template operacional de cobertura para um espetáculo específico — não é um repositório de conhecimento geral da organização |
| **Entregas** | São atribuições com prazo e estado per-destinatário — conteúdo obrigatório empurrado ao membro. A Biblioteca é consulta passiva, sem prazo, disponível a todos |
| **Avisos** | São notificações transientes de mudanças operacionais — não são repositório permanente |
| **Histórico** | É um log do que aconteceu — não é um acervo de procedimentos e referências |
| **IA** | É o assistente que interpreta e contextualiza — mas ela precisa de uma fonte para consultar. A Biblioteca é essa fonte. Sem Biblioteca, a IA responde do zero ou erra |

A Biblioteca é a fundação de conhecimento que alimenta a IA e que o membro consulta diretamente quando a IA não é suficiente ou quando quer ver a fonte original.

---

## PARTE 1 — DEFINIÇÃO

---

### O que a Biblioteca é

A Biblioteca é uma combinação de três camadas de conteúdo:

**Camada 1 — Conhecimento Permanente**
Conteúdo que define como a organização funciona — regras, políticas, procedimentos. Muda raramente, quando muda é por decisão deliberada do Admin. Exemplos: Política de Restrições, Procedimento de Segurança de Palco, Regras de Convivência.

**Camada 2 — Documentação Operacional**
Conteúdo que descreve como operar em contextos específicos da produção — manuais de personagem, referências de figurino, guias de posição. Muda a cada nova temporada ou revisão de produção. Conecta-se ao Livro do Show mas vive de forma independente na Biblioteca. Exemplos: Manual do Personagem X, Guia de Figurino do Espetáculo Y, Procedimento de Entrada de Cena do Bloco 2.

**Camada 3 — Referência de Onboarding**
Conteúdo para novos membros ou Supervisores — o que precisam saber antes de começar. Muda com baixa frequência. Exemplos: Guia de Boas-Vindas, Manual do Membro, Como Usar o MyASA, Fluxo de Solicitações.

---

### O que a Biblioteca não é

| O que não é | Por quê |
|---|---|
| Um gerenciador de tarefas | Tarefas têm responsável, prazo e estado — a Biblioteca não |
| Um sistema de aprovação de documentos | Aprovação de mudanças é fluxo de governança, não repositório |
| Um arquivo de shows passados | Shows passados vivem no Histórico — a Biblioteca é o presente e o permanente |
| Um canal de comunicação | A Biblioteca não envia conteúdo — o membro vai até ela |
| Um repositório de documentos pessoais | Conteúdo pessoal (contratos individuais, avaliações) não é escopo |
| Um backup de conversas da IA | A IA é efêmera por design; o que vale preservar vai para Histórico ou Biblioteca por ação humana |

---

## PARTE 2 — TIPOS DE CONTEÚDO

---

### MVP

---

**Tipo 1 — Procedimentos Operacionais**

Documentos que descrevem como executar uma ação operacional passo a passo.

| Campo | Definição |
|---|---|
| Exemplos | Procedimento de emergência em palco, Protocolo de substituição de último minuto, Fluxo de saída de cena |
| Formato | Texto nativo no sistema (com suporte a listas estruturadas) |
| Versionamento | ✅ Cada atualização gera nova versão; versão anterior arquivada com acesso histórico |
| Escopo | Organizacional (todos) ou por Equipe |
| Responsável obrigatório | ✅ Admin ou Supervisor designado |

---

**Tipo 2 — Regras e Políticas**

Documentos que definem as regras de convivência, operação e comportamento da organização.

| Campo | Definição |
|---|---|
| Exemplos | Política de restrições e folgas, Regras de atraso e ausência, Código de conduta do elenco |
| Formato | Texto nativo |
| Versionamento | ✅ Alteração de regra gera nova versão datada |
| Escopo | Sempre organizacional — regras valem para todos |
| Responsável obrigatório | ✅ Admin |
| Relação com Entregas | Uma atualização de regra gera tipicamente uma Entrega de "Atualização Operacional" para que todos confirmem ciência da mudança |

---

**Tipo 3 — Referência de Personagens e Figurinos**

Documentos de referência para posições artísticas — o que o personagem é, como é o figurino, quais são as marcações.

| Campo | Definição |
|---|---|
| Exemplos | Ficha do Personagem Arlequim, Especificação de Figurino — Cena 3, Guia de Maquiagem do Espetáculo Y |
| Formato | Texto nativo + imagens referenciadas |
| Versionamento | ✅ Revisões de produção geram nova versão |
| Escopo | Por Operação ou por Livro do Show |
| Responsável obrigatório | ✅ Admin ou Supervisor com delegação |
| Relação com Livro do Show | O Livro do Show **referencia** a ficha do personagem da Biblioteca — não duplica |

---

**Tipo 4 — Materiais de Onboarding**

Conteúdo para integração de novos membros ou Supervisores — o que precisam saber ao entrar na organização.

| Campo | Definição |
|---|---|
| Exemplos | Guia de Boas-Vindas ao Membro, Como funciona o MyASA, Fluxo de solicitação de folga, O que é o Livro do Dia |
| Formato | Texto nativo |
| Versionamento | ✅ Com baixa frequência — quando o produto ou os processos mudam |
| Escopo | Organizacional — todos os novos membros |
| Responsável obrigatório | ✅ Admin |
| Relação com Entregas | Material de onboarding é tipicamente atribuído como Entrega de Leitura Obrigatória para novos membros no início |

---

**Tipo 5 — Procedimentos de Segurança**

Conteúdo que define o comportamento esperado em situações de emergência ou risco.

| Campo | Definição |
|---|---|
| Exemplos | Procedimento de evacuação do palco, Protocolo de acidente com equipamento, Contatos de emergência |
| Formato | Texto nativo (linguagem direta, estrutura clara) |
| Versionamento | ✅ Qualquer mudança gera nova versão e deve gerar Entrega para confirmação |
| Escopo | Organizacional |
| Responsável obrigatório | ✅ Admin — não delegável para Supervisor |
| Revisão periódica | ✅ Admin configura periodicidade de revisão obrigatória (ex.: anual) |

---

### Pós-MVP

---

**Tipo 6 — Vídeos de Referência (Pós-MVP)**

Conteúdo em vídeo armazenado ou referenciado na Biblioteca — não como Entrega obrigatória, mas como referência consultável.

Motivo pós-MVP: exige gestão de links externos e monitoramento de disponibilidade do vídeo (link quebrado = item da Biblioteca inválido). A infraestrutura de verificação de links e vídeos embarcados é V2.

---

**Tipo 7 — Materiais de Produção Visual (Pós-MVP)**

Referências de imagem: fotos de palco, plantas de cena, mapas de posicionamento, storyboards.

Motivo pós-MVP: requer gerenciamento de arquivos de imagem com peso, resolução e formatos variados. Infraestrutura de armazenamento de mídia pesada é V2 (Object Storage).

---

**Tipo 8 — Repositório de Mídia de Shows Passados (Pós-MVP)**

Gravações de ensaios e shows, fotos de produção como referência histórica.

Motivo pós-MVP: infraestrutura de mídia pesada + gestão de direitos de imagem e som. Fora do MVP.

---

### Nunca

| Tipo descartado | Por que nunca |
|---|---|
| Contratos individuais de membros | Documentos pessoais — domínio de RH, não operacional |
| Folha de pagamento e registros financeiros | Domínio financeiro — fora do escopo do MyASA |
| Avaliações de desempenho individual | Domínio de RH — fora do escopo |
| Correspondências externas (contratos com fornecedores, acordos com espaços) | Domínio jurídico/administrativo — fora do escopo |

---

### Tabela resumo de tipos no MVP

| Tipo | Versionamento | Responsável | Gera Entrega automaticamente? | Escopo |
|---|---|---|---|---|
| Procedimentos Operacionais | ✅ | Admin · Supervisor | Não (decisão do Supervisor) | Organização · Equipe |
| Regras e Políticas | ✅ | Admin | Tipicamente sim (atualização de regra) | Organização |
| Referência de Personagens/Figurinos | ✅ | Admin · Supervisor (delegação) | Não | Operação · Show |
| Materiais de Onboarding | ✅ | Admin | Sim (novo membro) | Organização |
| Procedimentos de Segurança | ✅ | Admin | Sim (mudança de procedimento) | Organização |

---

## PARTE 3 — RELAÇÃO COM A IA

---

### Quando a IA consulta a Biblioteca

A IA consulta a Biblioteca quando a pergunta do usuário pode ser respondida por conteúdo existente no acervo organizacional.

**Exemplos de consulta:**

*Membro pergunta:* "Qual é o protocolo se eu me machucar durante um ensaio?"
→ A IA localiza o Procedimento de Segurança relevante na Biblioteca e responde com base nele, citando a fonte.

*Supervisor pergunta:* "Quais são as regras para restrição por gravidez?"
→ A IA localiza a Política de Restrições na Biblioteca e responde.

*Membro pergunta:* "Como funciona o pedido de folga?"
→ A IA localiza o Material de Onboarding relevante e guia o membro.

---

### Quando a IA prefere responder diretamente

A IA responde diretamente (sem consultar a Biblioteca) quando a pergunta é sobre dados operacionais do próprio sistema — não sobre conhecimento da organização.

*"Quando é meu próximo show?"* → resposta vem da Escala e Agenda — não da Biblioteca.
*"Quem está alocado na minha posição amanhã?"* → resposta vem do Livro do Dia.
*"Minha solicitação de folga foi aprovada?"* → resposta vem de S-06.

---

### Quando a IA referencia documentos da Biblioteca

A IA cita a fonte sempre que a resposta vem de um documento da Biblioteca — e sempre que o usuário precisa ter acesso ao documento completo, não apenas ao trecho relevante.

*"Esta resposta é baseada no Procedimento de Segurança de Palco (versão 3, atualizado em 15/05/2026). Acesse o documento completo na Biblioteca para mais detalhes."*

**Por que a citação é obrigatória:**
- Transparência: o usuário sabe que a resposta não é opinião da IA — é política da organização
- Verificabilidade: o usuário pode ir à fonte e confirmar o contexto completo
- Responsabilidade: a IA não está interpretando — está referenciando

---

### Quando a IA precisa citar a fonte

| Situação | IA cita a fonte? |
|---|---|
| Responde com base em documento da Biblioteca | ✅ Sempre |
| Responde com base em dados operacionais do sistema (Escala, Agenda) | ❌ Não — são dados, não documentos |
| Responde a pergunta contextual sem base documental | ❌ — mas sinaliza quando não há fonte na Biblioteca |
| Detecta que a Biblioteca não tem resposta para a pergunta | ✅ — informa explicitamente: "Não encontrei informação sobre isso na Biblioteca. Consulte seu Supervisor." |

---

### O que a IA nunca faz com a Biblioteca

| Proibição | Motivo |
|---|---|
| Criar ou editar conteúdo na Biblioteca | Autoria é humana — Admin e Supervisor |
| Resumir um documento e apresentar o resumo como equivalente ao original | O original precisa estar acessível — o resumo é auxiliar, não substituto |
| Responder com confiança quando o documento está desatualizado (ARQUIVADO) | A IA sinaliza: "Este documento foi arquivado. Pode haver uma versão mais recente ou o procedimento pode ter mudado." |
| Usar conteúdo da Biblioteca de um grupo para responder membro de outro grupo | Escopo de acesso é respeitado — a IA não atravessa escopos |

---

## PARTE 4 — RELAÇÃO COM ENTREGAS

---

### Quando um item da Biblioteca vira uma Entrega

Um item da Biblioteca pode se tornar uma Entrega quando o Supervisor ou Admin decide que a leitura não é mais opcional — precisa ser confirmada por destinatários específicos, com prazo.

**Gatilhos típicos:**

| Situação | Tipo de Entrega gerada |
|---|---|
| Novo membro entra na Equipe | Entrega de Leitura Obrigatória: "Material de Onboarding — Leia antes do primeiro show" |
| Procedimento de Segurança é atualizado | Entrega de Atualização Operacional: "Protocolo de segurança revisado — confirme ciência" |
| Regra organizacional muda | Entrega de Atualização Operacional: "Nova política de restrições — efetiva a partir de [data]" |
| Supervisor quer garantir que o grupo leu a ficha de um novo personagem | Entrega de Leitura Obrigatória: "Ficha do Personagem X — temporada 2026" |

**A Entrega aponta para o item da Biblioteca** — não duplica o conteúdo. O membro clica na Entrega, é direcionado ao documento na Biblioteca, lê o original e então confirma.

---

### Como evitar duplicação de conteúdo

**Regra anti-duplicação:** o conteúdo vive na Biblioteca. A Entrega é o veículo de atribuição — não um segundo repositório.

| Situação errada | Situação correta |
|---|---|
| Supervisor copia o conteúdo do procedimento e cola na Entrega | Supervisor cria Entrega que referencia o Procedimento da Biblioteca |
| Admin cria um novo documento dentro da Entrega para "não precisar criar na Biblioteca" | Admin cria o documento na Biblioteca e então cria a Entrega que referencia esse documento |

**Consequência da regra:** quando o documento é atualizado na Biblioteca, a Entrega que o referencia aponta automaticamente para a versão mais recente (ou o Supervisor é alertado que o documento base foi atualizado e precisa revisar a Entrega).

---

### Quando uma Entrega aponta para a Biblioteca

Toda Entrega dos tipos Leitura Obrigatória e Atualização Operacional pode ter um item da Biblioteca como origem do conteúdo.

O Supervisor, ao criar a Entrega, pode:
1. Escrever o conteúdo diretamente na Entrega (conteúdo pontual e não reutilizável)
2. Selecionar um documento existente da Biblioteca como conteúdo da Entrega

A opção 2 é preferida quando o conteúdo é uma política ou procedimento permanente — porque ele já existe na Biblioteca, já está versionado, e qualquer atualização futura no documento será propagada.

---

## PARTE 5 — RELAÇÃO COM LIVRO DO SHOW

---

### O Livro do Show pertence à Biblioteca?

**Não.** O Livro do Show é infraestrutura operacional — é o template que o motor de cobertura usa para gerar Livros do Dia. Ele vive em S-13 e é gerenciado como entidade operacional, não como documento de referência.

A distinção é de natureza:
- O Livro do Show **faz algo** — gera Livros do Dia, alimenta a Escala, define posições de cobertura
- A Biblioteca **registra algo** — armazena conhecimento para consulta

---

### Como Livro do Show e Biblioteca se conectam

O Livro do Show **referencia** itens da Biblioteca para informação adicional — não os replica.

| No Livro do Show | Referencia na Biblioteca |
|---|---|
| Linha "Arlequim" — posição artística | Ficha do Personagem Arlequim (Referência de Personagem) |
| Linha "Maquinista" — posição técnica | Procedimento de Equipamento de Palco (Procedimento Operacional) |
| Linha "Bloco 2 — Abertura" | Marcação da Cena de Abertura (Referência Operacional) |

O Supervisor, ao montar um Livro do Show, pode vincular linhas a documentos da Biblioteca. Isso enriquece o Livro do Show sem duplicar o conteúdo — e qualquer atualização do documento na Biblioteca é refletida automaticamente no contexto do Livro do Show.

---

### Como personagens, figurinos, procedimentos e materiais se conectam

```
BIBLIOTECA
    ├── Referência de Personagens/Figurinos
    │       └── "Ficha: Arlequim v3"
    │               ↑ referenciada por
    │       LIVRO DO SHOW — linha "Arlequim"
    │               ↑ alimenta
    │       MOTOR DE COBERTURA — posição candidata
    │
    └── Procedimentos Operacionais
            └── "Protocolo de Entrada Bloco 2"
                    ↑ referenciado por
            LIVRO DO SHOW — Bloco 2, instruções operacionais
                    ↑ imprime no
            LIVRO DO DIA — informações de contexto da posição
```

A Biblioteca é a fonte. O Livro do Show é o consumidor. O Livro do Dia é o executor.

---

## PARTE 6 — GOVERNANÇA DA BIBLIOTECA

---

### Admin

| Ação | Descrição |
|---|---|
| **Cria** | Cria qualquer conteúdo na Biblioteca, em qualquer categoria |
| **Define categorias** | Cria e gerencia a estrutura de categorias da Biblioteca (a taxonomia do acervo) |
| **Publica** | Publica conteúdo para todos os perfis com acesso |
| **Edita** | Pode editar qualquer conteúdo, incluindo o de outros autores |
| **Arquiva** | Arquiva conteúdo obsoleto ou substituído |
| **Define responsável** | Designa um Supervisor como responsável por categorias específicas (delegação editorial) |
| **Audita** | Vê o histórico de versões de qualquer documento |
| **Define revisão periódica** | Para Procedimentos de Segurança, define periodicidade de revisão obrigatória |

---

### Supervisor

| Ação | Acesso padrão | Com delegação do Admin |
|---|---|---|
| **Cria** | Conteúdo no escopo do seu grupo (Referência de Personagens, Procedimentos específicos do grupo) | Pode criar em categorias além do grupo |
| **Edita** | Conteúdo que criou ou pelo qual é responsável designado | Categorias designadas pelo Admin |
| **Publica** | Para o escopo do seu grupo | Conforme delegação |
| **Arquiva** | Conteúdo que criou ou pelo qual é responsável | Conforme delegação |
| **Cria Entregas a partir da Biblioteca** | ✅ Sempre — para o seu grupo | N/A |
| **Vê conteúdo organizacional** | ✅ Pode ler toda a Biblioteca (não apenas do grupo) | N/A |

---

### Membro

| Ação | Acesso |
|---|---|
| **Lê** | ✅ Documentos publicados no escopo da sua Equipe e documentos organizacionais |
| **Cria** | ❌ Membros não criam conteúdo na Biblioteca |
| **Edita** | ❌ Membros não editam conteúdo |
| **Sugere correção** | Via Mensagem ao Supervisor — não há mecanismo de "sugestão de edição" no MVP |
| **Vê documentos de outros grupos** | ❌ Escopo restrito à própria Equipe e ao conteúdo organizacional |

---

### Responsável obrigatório

Todo documento na Biblioteca tem um responsável explícito — Admin ou Supervisor designado. Um documento sem responsável é um risco operacional (ninguém sabe se está atualizado, ninguém recebe alertas de revisão).

**Quando o responsável é removido:** os documentos que eram de sua responsabilidade ficam marcados como "sem responsável designado" no Painel de Saúde do Admin — alerta de Atenção imediato.

---

## PARTE 7 — CICLO DE VIDA DOS DOCUMENTOS

---

### Estados formais

```
RASCUNHO
    │
    ↓ (responsável publica)
PUBLICADO ──────────────────────────────────────→ ARQUIVADO
    │                                              [estado terminal]
    ↓ (nova versão criada)
ATUALIZADO (nova versão publicada)
    │
    ↓ (versão anterior)
ARQUIVADO (versão antiga — preservada, consultável)
```

---

### Definição de cada estado

| Estado | Descrição | Terminal? |
|---|---|---|
| **RASCUNHO** | Documento criado mas não publicado — visível apenas para o responsável e Admin | Não |
| **PUBLICADO** | Documento ativo — visível para os perfis com escopo de acesso | Não |
| **ATUALIZADO** | Uma nova versão foi publicada — estado informativo aplicado à versão mais recente por um período de destaque | Não (temporário) |
| **ARQUIVADO** | Documento fora de circulação — preservado para consulta histórica mas não aparece na navegação principal | Sim |

---

### Regras de ciclo de vida

**Versionamento:**
Quando um documento PUBLICADO é editado e republicado, o sistema cria automaticamente uma nova versão. A versão anterior é arquivada com data, hora e autor da mudança. O Histórico do documento mostra todas as versões, quem as criou e o que mudou (se o autor registrar o sumário de mudança).

**Arquivamento:**
Não é exclusão — é retirada de circulação com preservação. Um documento ARQUIVADO continua acessível via Histórico e via busca avançada. Ele não aparece na navegação principal nem é consultado pela IA como referência ativa.

**Versões arquivadas como fonte de auditoria:**
Se um incidente ocorreu em uma data em que o procedimento tinha uma determinada versão, a versão arquivada com aquela data está disponível para auditoria. Exemplo: "O procedimento de segurança vigente no dia do incidente [data] era a versão 2 — acesse aqui."

---

## PARTE 8 — CASOS LIMITE

---

### Caso 1 — Documento substituído

**Cenário:** O Procedimento de Emergência versão 2 é substituído pela versão 3 após auditoria de segurança.

**Comportamento:**
1. Admin cria a versão 3 em RASCUNHO
2. Revisão interna, ajustes
3. Admin publica a versão 3
4. Versão 2 é automaticamente ARQUIVADA com timestamp
5. Sistema marca a versão 3 como ATUALIZADO por um período de destaque (configurável — ex.: 7 dias)
6. Se havia Entregas apontando para o Procedimento v2: o Supervisor responsável recebe alerta — "O documento base desta Entrega foi atualizado. Revise a Entrega."
7. Admin pode criar Entrega de Atualização Operacional para o grupo confirmar ciência da nova versão

---

### Caso 2 — Documento contraditório

**Cenário:** Dois documentos na Biblioteca têm informações conflitantes sobre o mesmo procedimento — um diz "entrada pela esquerda", outro diz "entrada pela direita".

**Comportamento:**
1. A contradição pode ser detectada pela IA ao responder uma pergunta — ela sinaliza: *"Encontrei informações conflitantes entre dois documentos. Consulte o Supervisor para confirmar qual é a referência atual."*
2. No MVP, o sistema não detecta contradições automaticamente por análise semântica — a identificação é manual ou via IA ao contexto de resposta
3. O Admin ou Supervisor responsável resolve: arquiva o documento desatualizado, atualiza o correto
4. A resolução fica registrada no Histórico de ambos os documentos

---

### Caso 3 — Material obsoleto não arquivado

**Cenário:** Um documento sobre o espetáculo da temporada 2024 ainda está PUBLICADO em 2026. O espetáculo não existe mais.

**Comportamento:**
1. A IA pode sinalizar ao Supervisor ou Admin: *"Este documento (Ficha de Personagem — Temporada 2024) é de uma Operação arquivada. Considere arquivar também o documento."*
2. No Painel de Saúde do Admin: documentos PUBLICADOS de Operações ARQUIVADAS são listados como candidatos a arquivamento
3. O Admin decide: arquiva, mantém como referência histórica ou reatribui a uma Operação ativa
4. O sistema não arquiva automaticamente — a decisão é humana

---

### Caso 4 — Vídeo removido (link quebrado)

**Cenário:** Um documento do tipo Vídeo de Referência (Pós-MVP) aponta para um vídeo no YouTube que foi removido.

**Comportamento MVP:**
- No MVP, vídeos na Biblioteca existem apenas como links externos em documentos de texto
- O sistema não monitora a disponibilidade de links externos no MVP
- Um link quebrado é descoberto quando o membro tenta acessar e a página não carrega
- O membro notifica o Supervisor via Mensagem — o Supervisor atualiza o documento

**Comportamento Pós-MVP:**
- O sistema monitora links externos e sinaliza ao responsável quando um link está indisponível
- O documento é marcado com alerta de "conteúdo inacessível" até que o link seja atualizado

---

### Caso 5 — Conteúdo obrigatório que deixou de ser válido

**Cenário:** Um Procedimento de Segurança estava em vigor como base de Entregas obrigatórias. A legislação mudou e o procedimento precisa ser completamente revisado — mas a revisão ainda não foi concluída.

**Comportamento:**
1. Admin arquiva o Procedimento antigo
2. Cria rascunho do novo Procedimento
3. Cria um Aviso para todos: *"O Procedimento de Segurança anterior foi arquivado. Novo procedimento em revisão. Até publicação, consultar Supervisor direto."*
4. Entregas que apontavam para o documento arquivado ficam com alerta: "Documento base arquivado — esta Entrega pode estar desatualizada"
5. O Supervisor responsável pelas Entregas revisa e cancela ou atualiza cada uma
6. Quando o novo Procedimento for publicado: Admin cria novas Entregas baseadas no documento atualizado

---

### Caso 6 — Biblioteca sem responsável

**Cenário:** Único Admin da organização é removido e todos os documentos ficam sem responsável.

**Comportamento:**
1. O Painel de Saúde entra em estado de Risco: *"N documentos na Biblioteca sem responsável designado."*
2. Os documentos continuam PUBLICADOS e acessíveis — o conteúdo não desaparece
3. A IA continua consultando a Biblioteca normalmente — o responsável ser desconhecido não invalida o conteúdo
4. Quando o novo Admin for designado, ele assume a responsabilidade de todos os documentos sem responsável e redistribui conforme necessário
5. Nenhum documento é arquivado ou alterado automaticamente durante o período sem responsável

---

## PARTE 9 — AUDITORIA DE CONSISTÊNCIA

---

### Existe sobreposição com Entregas?

**Não — mas a relação é complementar e precisa ser gerenciada ativamente.**

A Biblioteca é o repositório passivo. A Entrega é a atribuição ativa. O mesmo conteúdo pode existir nos dois contextos simultaneamente — sem sobreposição, porque os papéis são diferentes.

O risco não é sobreposição técnica — é sobreposição editorial: o Supervisor cria a Entrega com o conteúdo do documento duplicado em vez de referenciar a Biblioteca. A mitigação é a regra anti-duplicação (Parte 4): **o conteúdo vive na Biblioteca; a Entrega referencia.**

---

### Existe sobreposição com Livro do Show?

**Não — relação de referência, não de duplicação.**

O Livro do Show referencia a Biblioteca para enriquecer o contexto das posições. A Biblioteca armazena o conteúdo de referência. São entidades com funções distintas que se complementam por referência — nenhuma contém a outra.

---

### Existe sobreposição com a IA?

**Não — relação de dependência, não de competição.**

A IA consulta a Biblioteca para responder perguntas. Sem Biblioteca, a IA depende do contexto da conversa — e falha em perguntas sobre procedimentos organizacionais. A Biblioteca é a fonte; a IA é o acessador inteligente. Eliminar a Biblioteca para "deixar a IA resolver" criaria um sistema sem memória organizacional persistente.

---

### Existe risco de virar um repositório morto?

**Sim — e é o maior risco desta superfície.**

O repositório morto é a versão mais comum de fracasso de uma Biblioteca organizacional: documentos publicados uma vez, nunca atualizados, que ninguém lê porque estão desatualizados, e que ficam lá como "alibi" de que a organização documentou algo.

**Mitigações estruturais:**

| Mitigação | Como funciona |
|---|---|
| **Responsável obrigatório** | Todo documento tem dono — alguém é responsável pela atualização |
| **Revisão periódica configurável** | Para Procedimentos de Segurança: Admin define periodicidade. Sistema alerta o responsável quando a revisão está vencida |
| **IA como feedback ativo** | Quando a IA responde uma pergunta e o documento está desatualizado ou não cobre o assunto, ela sinaliza ao Admin — o gap vira visibilidade |
| **Alerta de documentos de Operações arquivadas** | Painel de Saúde lista documentos publicados de Operações finalizadas — candidatos a revisão |
| **Rastreamento de acesso** (Pós-MVP) | Documentos nunca acessados em N meses são sinalizados ao responsável — "este documento existe mas ninguém lê" |

---

### Existe risco de conteúdo sem responsável?

**Sim — e a mitigação é a obrigatoriedade de responsável em toda publicação.**

No MVP, o sistema não permite publicar um documento sem um responsável designado. Se o responsável sai da organização, o sistema alerta o Admin imediatamente — os documentos ficam em limbo até redistribuição, mas nunca ficam silenciosamente sem responsável.

---

## PARTE 10 — FUNDAÇÃO OFICIAL DA BIBLIOTECA

---

### Definição oficial da Biblioteca

> A Biblioteca é o repositório de conhecimento permanente da organização no MyASA — o acervo de procedimentos, regras, políticas, referências de produção e materiais de onboarding que existem independentemente de shows específicos, eventos passados ou notificações transientes. É uma superfície de consulta por demanda, versionada, com responsável explícito, que alimenta a IA e que pode ser transformada em Entrega quando o conteúdo precisa de confirmação obrigatória.

---

### Inventário de decisões produzidas

| # | Decisão |
|---|---|
| BIB-D01 | A Biblioteca é repositório de consulta por demanda — o membro vai até ela, ela não vai até o membro. Isso a distingue de Avisos (push unidirecional) e Entregas (push com confirmação obrigatória) |
| BIB-D02 | 5 tipos de conteúdo no MVP: Procedimentos Operacionais · Regras e Políticas · Referência de Personagens/Figurinos · Materiais de Onboarding · Procedimentos de Segurança |
| BIB-D03 | O conteúdo vive na Biblioteca; a Entrega referencia. Duplicar conteúdo do documento dentro da Entrega é proibido por design — o conteúdo tem uma única fonte de verdade |
| BIB-D04 | O Livro do Show referencia itens da Biblioteca para enriquecer posições — não pertence à Biblioteca nem a duplica |
| BIB-D05 | A IA cita a fonte sempre que responde com base em documento da Biblioteca. Quando a Biblioteca não tem a resposta, a IA informa explicitamente em vez de inferir |
| BIB-D06 | Todo documento na Biblioteca tem responsável obrigatório — publicação sem responsável é bloqueada pelo sistema |
| BIB-D07 | Arquivamento não é exclusão — é retirada de circulação com preservação histórica. Versões arquivadas são acessíveis para auditoria e para investigação de incidentes |
| BIB-D08 | Procedimentos de Segurança têm revisão periódica obrigatória configurável pelo Admin — o sistema alerta o responsável quando a revisão está vencida |
| BIB-D09 | Documentos publicados de Operações arquivadas são sinalizados no Painel de Saúde como candidatos a arquivamento — mitigação do repositório morto |
| BIB-D10 | Quando o responsável por um documento é removido, o Admin recebe alerta imediato — os documentos não ficam silenciosamente sem dono |

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
| AGN-D01 a AGN-D10 | 10 | Agenda |
| **BIB-D01 a BIB-D10** | **10** | **Biblioteca** |
| **Total: 121 decisões formais** | | |

---

## 🟢 Pronto para UX

A Biblioteca está completamente modelada:

- **Definição** com distinção precisa de Entregas, Livro do Show, Avisos, Histórico e IA
- **5 tipos de conteúdo no MVP** com versionamento, responsável obrigatório e escopo
- **Relação com IA** — quando consulta, quando cita, quando admite ausência de fonte
- **Relação com Entregas** — regra anti-duplicação: a Entrega referencia a Biblioteca, não duplica
- **Relação com Livro do Show** — referência enriquecida, não pertencimento
- **Governança** por perfil — Admin, Supervisor com e sem delegação, Membro somente leitura
- **4 estados** de ciclo de vida com versionamento e arquivamento não-destrutivo
- **6 casos limite** modelados
- **5 riscos** de sobreposição e repositório morto auditados com mitigações estruturais

---

## Encerramento da Fundação Comportamental do MyASA 2.0

Com a Biblioteca, o último grande pilar da fundação comportamental foi modelado. O MyASA 2.0 tem agora:

| Pilar | Superfícies modeladas | Status |
|---|---|---|
| **Núcleo Operacional** | S-04 Escala · S-05 Livro do Dia · S-06 Solicitações | 🟢 |
| **Espetáculo** | S-13 Livro do Show | 🟢 |
| **Comunicação** | S-06 Solicitações · S-11 Histórico (Comunicação) | 🟢 |
| **Entregas** | S-07 | 🟢 |
| **Agenda** | S-12 | 🟢 |
| **Biblioteca** | S-14 | 🟢 |
| **IA** | S-10 (3 contextos: Membro · Supervisor · Admin) | 🟢 |
| **Governança** | S-03 Saúde · S-15 Equipes · S-16 Operações · S-17 Administração | 🟢 |

**121 decisões formais. Fundação comportamental completa. Pronto para auditoria final e início de UX.**

---

*Documento elaborado por Product Designer Sênior — MyASA 2.0*
*Fundação produzida em 18/06/2026*
*Base: arquitetura completa · 111 decisões anteriores · todos os pilares operacionais modelados*
