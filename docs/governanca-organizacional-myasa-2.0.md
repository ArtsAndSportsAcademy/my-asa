# MyASA 2.0 — Fundação da Governança Organizacional

> **Versão:** 18/06/2026
> **Fase:** Modelagem de Comportamento — anterior a wireframes e mockups
> **Base:** Núcleo operacional completo · Ecossistema de IA · Pesquisas de campo · Jornadas · 81 decisões formais
> **Superfícies modeladas:** S-03 Painel de Saúde · S-15 Equipes · S-16 Operações · S-17 Administração
> **Natureza:** Fundação de produto — sem interface, sem wireframes, sem componentes
> **Status:** 🟢 Pronto para UX

---

## Premissa central

O núcleo operacional modelado até aqui — S-04 Escala, S-05 Livro do Dia, S-06 Solicitações, S-13 Livro do Show — opera dentro de uma estrutura que ainda não foi formalizada: a **Governança Organizacional**.

Governança não é administração burocrática. É a infraestrutura que define:
- Quem pode fazer o quê (S-17)
- Como os grupos de pessoas estão organizados (S-15)
- Quais produções existem e em qual estado estão (S-16)
- Se o todo está saudável ou degradando (S-03)

Sem governança, o núcleo operacional é um conjunto de superfícies sem estrutura. Com governança, o núcleo operacional tem contexto, escopo e responsabilidade.

---

## PARTE 1 — PAPEL DO ADMIN

---

### O que significa administrar o ecossistema

Administrar o ecossistema do MyASA significa **configurar a infraestrutura que a operação diária usa — mas não operar dia a dia**.

O Admin define as regras. O Supervisor joga dentro dessas regras. O Membro cumpre seu papel dentro do jogo.

O Admin é responsável por:

| Dimensão | Responsabilidade |
|---|---|
| **Estrutura de espetáculos** | Criar e manter os Livros do Show (S-13) — os templates permanentes |
| **Estrutura de equipes** | Definir quais grupos existem, quem os supervisa, quais membros pertencem a cada grupo (S-15) |
| **Estrutura de operações** | Criar e arquivar Operações — as produções em andamento ou finalizadas (S-16) |
| **Estrutura de permissões** | Definir quem tem acesso a quê e com qual escopo (S-17) |
| **Saúde da organização** | Monitorar degradação operacional e intervir antes de crises (S-03) |
| **Governança de mudanças** | Aprovar ou negar Solicitações Administrativas enviadas por Supervisores |
| **Catálogo de tags** | Criar e manter as tags de exigência operacional (CAT-01 a CAT-11) |

---

### O que significa governar a operação

Governar é diferente de operar. O Admin governa quando:

- Define que uma posição de cobertura crítica (CAT-11) nunca pode ficar Em Aberto — e o motor de cobertura respeita isso
- Define as regras de substituição (CAT-10) que o Supervisor não pode sobrescrever
- Define qual Supervisor tem escopo em qual grupo — e o que esse Supervisor pode e não pode fazer
- Arquiva uma Operação quando uma temporada encerra — e o histórico é preservado
- Delega temporariamente sua autoridade quando vai se ausentar

A diferença entre governar e operar:

| Governança (Admin) | Operação (Supervisor) |
|---|---|
| Define as regras do rodízio (Livro do Show) | Executa o rodízio em cada show |
| Define quem pode ser Titular de uma posição | Decide quem vai naquele dia específico |
| Define que uma posição precisa de liberação médica (CAT-04) | Não pode sobrescrever essa exigência |
| Arquiva a temporada | Publica o Livro do Dia do último show |

---

### O que não pertence ao Admin

O Admin não opera shows. Quando o Admin tenta operar no nível de Supervisor, ele cria um gargalo — uma única pessoa de autoridade máxima decide coisas que deveriam ser delegadas.

**Não pertence ao Admin:**

| Ação | Pertence a |
|---|---|
| Publicar um Livro do Dia específico | Supervisor |
| Aprovar a folga de um membro específico | Supervisor |
| Enviar Aviso de mudança de alocação | Supervisor |
| Resolver posições Em Aberto de um show | Supervisor |
| Responder solicitações pessoais de membros | Supervisor |
| Decidir quem vai em que posição show a show | Supervisor |

**Regra de fronteira:** se uma ação acontece toda semana para cada show — é do Supervisor. Se uma ação acontece uma vez e vale para todos os shows futuros — é do Admin.

---

## PARTE 2 — SAÚDE ORGANIZACIONAL (S-03)

---

### Definição de saúde

A saúde organizacional do MyASA é medida em quatro dimensões:

1. **Cobertura** — os shows e ensaios têm posições resolvidas?
2. **Processo** — Supervisores estão operando dentro dos prazos e fluxos esperados?
3. **Capacidade** — a organização tem membros suficientes para cobrir as demandas futuras?
4. **Estrutura** — o Livro do Show está atualizado e as equipes estão configuradas corretamente?

---

### Sinais de cada estado

---

#### ✅ Estado Saudável

| Sinal | Indicador |
|---|---|
| Cobertura | Taxa de cobertura ≥ limiar configurado nos últimos N shows |
| Cobertura | Posições Em Aberto < X% do total, resolvidas pelo Supervisor antes da publicação |
| Processo | Livros do Dia publicados dentro da janela de antecedência configurada |
| Processo | Solicitações Administrativas respondidas pelo Admin dentro do prazo |
| Capacidade | Nenhuma posição com banco de candidatos abaixo de 2 membros elegíveis |
| Capacidade | Nenhum membro acumulando posições críticas acima do limite configurado |
| Estrutura | Todos os grupos têm Supervisor ativo |
| Estrutura | Nenhum Livro do Show com configuração incompleta (Linhas sem Padrão configurado) |

---

#### ⚠ Estado Atenção

| Sinal | Indicador |
|---|---|
| Cobertura | Taxa de cobertura caindo, mas ainda acima do limiar mínimo |
| Cobertura | 1–2 posições Em Aberto recorrentes no mesmo Show |
| Processo | Livros do Dia publicados com atraso em ≥ 2 shows consecutivos por um Supervisor |
| Processo | Solicitações Administrativas acumulando sem resposta |
| Capacidade | 1–2 posições com banco de candidatos = 2 (mínimo crítico) |
| Capacidade | 1 membro com carga acumulada alta sem folga planejada |
| Estrutura | 1 grupo com Supervisor sem atividade recente |

---

#### 🚨 Estado Risco

| Sinal | Indicador |
|---|---|
| Cobertura | Posição com CAT-11 (Cobertura Crítica) Em Aberto sem candidato disponível |
| Cobertura | Show publicado com ≥ 3 posições Em Aberto |
| Processo | Supervisor não publicou Livro do Dia para show que já ocorreu (Livro nunca publicado) |
| Capacidade | Posição com banco de candidatos = 1 (ruptura iminente se esse membro ficar indisponível) |
| Capacidade | Múltiplas restrições do mesmo tipo em membros diferentes (potencial risco de lesão ligado ao trabalho) |
| Estrutura | Grupo sem Supervisor ativo — ninguém pode publicar o Livro do Dia |
| Estrutura | Livro do Show com Linhas sem Padrão configurado e shows nas próximas 72h |

---

#### 🔴 Estado Degradação

| Sinal | Indicador |
|---|---|
| Cobertura | Taxa de cobertura abaixo do limiar mínimo por ≥ 3 semanas consecutivas |
| Cobertura | Padrão crescente de Em Aberto em posições que antes eram sempre cobertas |
| Processo | Múltiplos Supervisores com padrão de publicação tardia — não é caso isolado |
| Capacidade | Banco de candidatos de múltiplas posições abaixo do mínimo — erosão sistêmica |
| Capacidade | Saída de membros sem reposição — a capacidade da organização está diminuindo |
| Estrutura | Múltiplos grupos sem Supervisor ativo |

---

### Limiares configuráveis pelo Admin

Os limiares que definem os estados não são fixos pelo sistema — o Admin configura com base na realidade da sua organização:

| Limiar | Padrão sugerido | Configurável? |
|---|---|---|
| Taxa de cobertura mínima saudável | 95% | ✅ |
| Antecedência mínima para publicação do Livro do Dia | 48h | ✅ |
| Número mínimo de candidatos por posição | 2 | ✅ |
| Janela de análise de padrão (shows recentes) | 6 shows | ✅ |
| Prazo máximo para resposta de Solicitação Administrativa | 72h | ✅ |
| Limite de carga acumulada por membro (shows consecutivos sem folga) | 4 shows | ✅ |

---

### Como a saúde é calculada

A saúde não é calculada em tempo real — é calculada em ciclos, configurados pelo Admin (ex.: diariamente às 6h, ou após cada publicação de Livro do Dia). O Painel de Saúde apresenta o resultado do último ciclo, com timestamp.

**O Painel de Saúde não é um dashboard de métricas brutas.** É um diagnóstico interpretado pela IA do Admin (IA-D02), que converte os dados em linguagem acionável:

*"A cobertura geral está saudável, mas o Show Musical B tem padrão recorrente de Em Aberto na posição Contrarregra há 3 shows consecutivos. O banco de candidatos tem apenas 1 membro elegível disponível."*

Não: *"Taxa de cobertura: 94.3% · Em Aberto: 2.1% · Índice de saúde: 87."*

---

## PARTE 3 — EQUIPES (S-15)

---

### O que é uma Equipe

Uma Equipe é o **grupo organizacional fundamental** que conecta Membros, Supervisores e Operações. É a unidade de escopo do Supervisor: o Supervisor vê e opera dentro da sua Equipe.

Uma Equipe define:
- Quais membros pertencem ao grupo
- Quem são os Supervisores responsáveis
- Quais Operações e Shows este grupo está associado
- Se o grupo está ativo ou arquivado

---

### Estrutura de uma Equipe

| Campo | Definição | Quem configura |
|---|---|---|
| **Nome** | Nome operacional do grupo (ex.: "Elenco Principal", "Equipe Técnica Norte") | Admin |
| **Tipo** | Artístico · Técnico · Híbrido · Administrativo | Admin |
| **Supervisores** | Um ou mais Supervisores responsáveis pelo grupo | Admin |
| **Membros** | Lista de membros ativos neste grupo | Admin · Supervisor (por delegação) |
| **Operações associadas** | Quais Operações este grupo suporta | Admin |
| **Shows associados** | Quais Livros do Show este grupo alimenta | Admin |
| **Status** | Ativo · Inativo · Arquivado | Admin |

---

### Relação Membro–Equipe

Um Membro pode pertencer a **múltiplas Equipes**. Isso é comum em organizações com mais de uma produção simultânea.

| Situação | Comportamento |
|---|---|
| Membro em duas Equipes com shows na mesma data | O motor de cobertura verifica conflito e sinaliza para o Supervisor relevante |
| Membro saindo de uma Equipe | Removido da rotação de candidatos dos Shows associados àquela Equipe — as alocações históricas são preservadas |
| Membro entrando em uma Equipe | Não é automaticamente candidato em nenhuma posição — precisa ter as tags/qualificações configuradas pelo Admin ou Supervisor |
| Membro inativo (ex.: licença médica longa) | Pode ser marcado como Inativo na Equipe sem ser removido — o motor de cobertura o ignora enquanto inativo |

---

### Relação Supervisor–Equipe

Um Supervisor pode **gerenciar múltiplas Equipes**. Quando gerencia mais de uma, seu painel agrega as informações de todas as Equipes que supervisionam.

| Situação | Comportamento |
|---|---|
| Uma Equipe com dois Supervisores | Ambos têm escopo igual sobre o grupo — qualquer um pode publicar Livros do Dia |
| Uma Equipe sem Supervisor ativo | Estado de Risco — o Admin recebe alerta; nenhum Livro do Dia pode ser publicado até que um Supervisor seja designado |
| Supervisor removido de uma Equipe | Perde acesso ao escopo daquela Equipe — histórico de ações permanece registrado |
| Supervisor adicionado a uma Equipe nova | Começa com acesso imediato ao escopo da Equipe; não herda responsabilidade retroativa por ações passadas |

---

### Restrições organizacionais de Equipes

| Restrição | Regra |
|---|---|
| Membro alocável | Um Membro só pode ser candidato a posições de Shows se pertencer à Equipe associada àquele Show |
| Equipe ativa | Uma Equipe precisa ter ao menos um Supervisor ativo para ser operacional |
| Equipe arquivada | Não aceita novos Livros do Dia; histórico preservado e consultável; membros mantêm vínculo histórico |
| Escopo de Supervisor | O Supervisor só pode acessar membros e Livros da(s) Equipe(s) que gerencia — sem exceção |
| Delegação | Um Supervisor pode ter escopo temporariamente ampliado por delegação do Admin (Parte 5) |

---

### Ciclo de vida de uma Equipe

```
CRIAÇÃO
Admin cria a Equipe, define tipo, associa Supervisores e Operações
           ↓
POPULAÇÃO
Admin (ou Supervisor por delegação) adiciona Membros
Admin configura tags, qualificações e restrições de cada Membro
           ↓
OPERAÇÃO ATIVA
Equipe alimenta Shows e Operações
Supervisores publicam Livros do Dia
Membros participam de shows e enviam solicitações
           ↓
TRANSIÇÃO
Mudanças na composição (entradas, saídas, mudança de Supervisor)
Expansão para novas Operações
           ↓
ARQUIVAMENTO
Temporada encerra ou grupo se dissolve
Equipe arquivada — somente leitura
Histórico preservado indefinidamente
```

---

## PARTE 4 — OPERAÇÕES (S-16)

---

### O que é uma Operação

Uma Operação é a **unidade de produção** do MyASA. Ela agrupa:
- Os Shows que serão apresentados
- As Equipes que darão suporte
- O período de vigência
- A Agenda de eventos

Exemplos de Operações:
- *"Temporada 2026 — Musical Grandes Clássicos"* (produção de longa duração)
- *"Turnê Nacional — Circo Amador — Jul a Set 2026"* (produção com datas distribuídas)
- *"Ensaios Regulares — 2º Semestre 2026"* (operação de preparação)
- *"Festival Especial — Dezembro 2026"* (produção pontual)

---

### Estrutura de uma Operação

| Campo | Definição | Quem configura |
|---|---|---|
| **Nome** | Nome operacional da produção | Admin |
| **Tipo** | Temporada · Turnê · Ensaios · Evento pontual | Admin |
| **Período** | Data de início e data de encerramento prevista | Admin |
| **Livros do Show associados** | Quais espetáculos compõem esta Operação | Admin |
| **Equipes associadas** | Quais Equipes darão suporte a esta Operação | Admin |
| **Agenda de eventos** | Calendário de shows e ensaios desta Operação | Admin · Supervisor |
| **Status** | Rascunho · Ativo · Pausado · Arquivado | Admin |

---

### Ciclo de vida de uma Operação

---

#### RASCUNHO

A Operação existe no sistema mas não está ativa. Livros do Dia não podem ser gerados. O Admin está configurando a estrutura: definindo Shows, associando Equipes, ajustando os Livros do Show.

**Transição para Ativo:** Admin ativa explicitamente quando a estrutura está pronta.

---

#### ATIVO

A Operação está em execução. Livros do Dia podem ser gerados para as datas da Agenda. Supervisores operam normalmente.

**O que pode mudar durante a atividade:**
- Datas podem ser adicionadas ou removidas da Agenda
- Membros podem entrar ou sair das Equipes
- O Livro do Show pode ser atualizado (gerando versionamento — LS-D04)
- Novas Equipes podem ser associadas

**O que não pode mudar durante a atividade sem atenção:**
- O tipo da Operação (mudança de Temporada para Turnê requer revisão estrutural)
- A desassociação de uma Equipe enquanto há Livros do Dia futuros gerados para ela (requer confirmação do Admin)

---

#### PAUSADO

A Operação está temporariamente suspensa (ex.: pausa forçada por circunstância externa). Novos Livros do Dia não podem ser gerados. Os Livros já publicados são mantidos. Membros continuam na Equipe.

**Uso típico:** pausa técnica, emergência, recesso programado.

---

#### ARQUIVADO

A Operação encerrou. Estado permanente e imutável. Todo o histórico é preservado: Livros do Dia executados, Solicitações processadas, Mudanças Operacionais registradas. A Operação arquivada é acessível para consulta e auditoria histórica.

**O que não pode ser alterado em uma Operação Arquivada:**
- Qualquer dado de execução passada
- Alocações históricas
- Registros de MO

---

### Evolução de uma Operação

Uma Operação pode evoluir durante seu ciclo de vida sem ser arquivada e recriada. A evolução é sempre documentada no Histórico da Operação.

| Tipo de evolução | Exemplo | Quem executa |
|---|---|---|
| Extensão de período | Temporada prorrogada por mais 2 meses | Admin |
| Adição de Show à Operação | Um novo espetáculo entra no repertório durante a temporada | Admin |
| Adição de Equipe | Nova equipe técnica adicionada para suportar o novo espetáculo | Admin |
| Atualização do Livro do Show | Coreografia revisada → nova versão do template (LS-D04) | Admin |
| Mudança de Supervisor | Supervisor responsável é substituído | Admin |

---

### Relação Operação–Agenda

A Agenda do MyASA contém os eventos. Uma Operação é o **contexto organizacional** de um conjunto de eventos da Agenda.

```
OPERAÇÃO "Temporada 2026"
     │
     ├── Show 14/06 (sábado)  ← evento da Agenda + Livro do Dia
     ├── Ensaio 15/06 (domingo) ← evento da Agenda + Livro do Dia
     ├── Show 21/06 (sábado)
     └── ... (n eventos)
```

Quando um evento é criado na Agenda associado a uma Operação Ativa, o sistema sinaliza para o Supervisor que um Livro do Dia precisa ser gerado para aquela data — dentro do horizonte de planejamento configurado.

---

### Múltiplas Operações simultâneas

Uma organização pode ter múltiplas Operações ativas ao mesmo tempo. Exemplo: a Cia X está rodando "Temporada Musical" e "Ensaios para Novo Espetáculo" em paralelo.

| Situação | Comportamento |
|---|---|
| Membro em Equipes de duas Operações com datas conflitantes | O motor de cobertura detecta o conflito e sinaliza para os Supervisores de ambas as Operações |
| Mesmo Livro do Show em duas Operações | Possível — as duas Operações usam o mesmo template, com versões independentes por Operação |
| Mesmo Supervisor em duas Operações | Possível — o Supervisor gerencia os grupos de ambas |

---

## PARTE 5 — ADMINISTRAÇÃO (S-17)

---

### Usuários e Perfis

O sistema MyASA tem três perfis nativos: Admin, Supervisor, Membro. Esses perfis são a base de toda a estrutura de permissões.

---

#### Perfil Admin

| Dimensão | Definição |
|---|---|
| **Escopo padrão** | Toda a organização (todas as Equipes, todas as Operações, todos os Shows) |
| **O que pode fazer** | Tudo — configura a estrutura, governa a operação, aprova mudanças estruturais |
| **O que não pode fazer** | Publicar Livros do Dia por outros Supervisores sem assumir temporariamente o escopo (via delegação reversa) |
| **Quantos por organização** | 1 ou mais — recomendado mínimo 2 para continuidade operacional |
| **Visibilidade** | Visível aos Supervisores como autoridade final; invisível aos Membros como categoria |

**Admin Principal vs. Admin Delegado (MVP):**
No MVP, todos os Admins têm escopo igual. O sistema não hierarquiza Admins entre si na versão inicial. A hierarquia entre Admins é uma decisão de V2.

---

#### Perfil Supervisor

| Dimensão | Definição |
|---|---|
| **Escopo padrão** | As Equipes às quais está associado |
| **O que pode fazer** | Operar dentro das regras configuradas pelo Admin para suas Equipes |
| **O que não pode fazer** | Acessar Equipes de outros Supervisores; fazer mudanças estruturais no Livro do Show; criar ou arquivar Operações |
| **Quantos por organização** | N — um por grupo ou compartilhado entre grupos |
| **Visibilidade** | Visível aos Membros como ponto de contato operacional |

---

#### Perfil Membro

| Dimensão | Definição |
|---|---|
| **Escopo padrão** | Próprio — só vê suas próprias informações |
| **O que pode fazer** | Consultar Meu Dia, enviar Solicitações, registrar restrições |
| **O que não pode fazer** | Acessar qualquer dado de outros membros; editar qualquer Livro; ver a estrutura operacional |
| **Quantos por organização** | N — sem limite no sistema |
| **Visibilidade** | Invisível para outros Membros como entidade — exceto no contexto de comunicação (S-11) |

---

### Permissões

O modelo de permissões do MyASA é a interseção de três dimensões:

```
PERMISSÃO = PERFIL × ESCOPO × TIPO DE AÇÃO
```

**PERFIL:** Admin · Supervisor · Membro

**ESCOPO:** organização toda · grupo específico · próprio

**TIPO DE AÇÃO:** Estrutural (Tipo A) · Configuração (Tipo B) · Consulta

---

#### Matriz de permissões por superfície

| Superfície | Admin | Supervisor (escopo) | Membro |
|---|---|---|---|
| S-03 Painel de Saúde | ✅ Completo | 👁 Resumo do grupo | ❌ |
| S-04 Escala | ✅ Completo | ✅ Escopo do grupo | 👁 Própria |
| S-05 Livro do Dia | ✅ Completo | ✅ Gera e publica | 👁 Fatia própria |
| S-06 Solicitações | ✅ Admin tipo | ✅ Operacional | ✅ Envia |
| S-11 Comunicação | ✅ Completo | ✅ Envia e recebe | 👁 Recebe |
| S-13 Livro do Show | ✅ Estrutural + Config | ✅ Config (Tipo B) | ❌ |
| S-15 Equipes | ✅ Completo | 👁 Consulta | ❌ |
| S-16 Operações | ✅ Completo | 👁 Consulta | ❌ |
| S-17 Administração | ✅ Completo | 👁 Próprio perfil | 👁 Próprio perfil |

---

### Delegações

A delegação é o mecanismo pelo qual um usuário **temporariamente amplia o escopo** de outro usuário — sem alterar o perfil permanentemente.

---

#### Tipos de delegação

**Delegação de Admin para Admin (cobertura de ausência):**
Quando um Admin estará ausente, pode delegar seu escopo a outro Admin existente ou a um Supervisor que atuará como Admin interino.

**Delegação de Supervisor para Supervisor (cobertura de grupo):**
Quando um Supervisor estará ausente, outro Supervisor assume temporariamente o escopo daquele grupo.

**Delegação de Admin para Supervisor (escopo expandido):**
O Admin pode expandir temporariamente o escopo de um Supervisor para incluir ações de Configuração (Tipo B) em grupos que normalmente não são seus.

---

#### Estrutura de uma delegação

| Campo | Definição |
|---|---|
| **De** | Quem está delegando (delegante) |
| **Para** | Quem recebe a delegação (delegado) |
| **Escopo** | Quais grupos, Operações ou ações estão sendo delegados |
| **Período** | Data de início e data de encerramento da delegação |
| **Tipo** | Cobertura de ausência · Escopo expandido · Emergência |
| **Motivo** | Obrigatório — registrado no Histórico |

---

#### Regras de delegação

| Regra | Descrição |
|---|---|
| **Não-transferível** | O delegado não pode re-delegar — a delegação termina nele |
| **Temporária por design** | Toda delegação tem data de encerramento obrigatória |
| **Registro permanente** | Toda ação realizada durante uma delegação é registrada com o contexto "em delegação de [delegante]" |
| **Revogável** | O delegante pode revogar a delegação antes do prazo configurado |
| **Sem escalonamento automático** | Quando a delegação expira, o escopo retorna ao delegante — o sistema não prorroga automaticamente |

---

#### O que o delegado pode fazer

| Situação | Delegado pode? |
|---|---|
| Publicar Livro do Dia do grupo coberto | ✅ Sim |
| Aprovar folgas de membros do grupo coberto | ✅ Sim |
| Fazer mudanças de Configuração (Tipo B) no Livro do Show | ✅ Se delegação inclui esse escopo |
| Fazer mudanças Estruturais (Tipo A) no Livro do Show | ❌ Não — requer Admin permanente |
| Criar ou arquivar Operações | ❌ Não — exceto se o delegado é Admin interino |
| Criar novas delegações | ❌ Não — delegação não é transferível |

---

### Substituições de Supervisor

A substituição de Supervisor é operacional — diferente da delegação, que é administrativa.

**Delegação:** Admin delega escopo a outro usuário para cobrir ausência — estrutural, planejada.

**Substituição:** Supervisor não aparece no dia do show — outro Supervisor ou Admin cobre emergencialmente — pontual, imediata.

| Dimensão | Delegação | Substituição |
|---|---|---|
| Planejada? | Sim | Não necessariamente |
| Duração | Período configurado | Um evento ou período curto |
| Autoridade | Definida na delegação | Limitada ao evento coberto |
| Registro | Delegação formal no S-17 | MO de tipo "Substituição de Supervisor" |
| Quem define | Admin | Admin ou Supervisor designado |

---

### Remoção de usuário

Quando um usuário é removido do sistema (ex.: membro que saiu da organização):

| Tipo | O que acontece |
|---|---|
| **Membro removido** | Removido de todas as Equipes ativas; retirado de todas as rotações futuras; histórico de alocações preservado como "Membro externo [nome]" |
| **Supervisor removido** | Grupos sem Supervisor entram em estado de Risco — Admin precisa designar substituto; histórico de ações do Supervisor preservado |
| **Admin removido** | Se era o único Admin: sistema entra em modo de contingência — nenhuma mudança estrutural pode ser feita até que novo Admin seja designado pelo sistema |

---

### Onboarding de novos usuários

O sistema não tem auto-cadastro. Todo usuário é criado pelo Admin (para Supervisor ou Membro) ou pelo Supervisor com permissão delegada (para Membros do seu grupo).

| Etapa | Ação |
|---|---|
| 1 | Admin ou Supervisor cria o usuário com perfil e escopo |
| 2 | Usuário recebe credenciais de acesso |
| 3 | Para Membros: Admin ou Supervisor adiciona à(s) Equipe(s) e configura qualificações |
| 4 | Para Supervisores: Admin associa às Equipes que irão gerenciar |
| 5 | Usuário ativo — aparece como candidato (Membro) ou com acesso (Supervisor) |

O onboarding de um Membro não é automaticamente uma disponibilidade para shows. O Membro precisa ser:
1. Adicionado à Equipe associada ao Show
2. Ter as qualificações (CAT-07, CAT-09) configuradas para as posições que pode ocupar
3. Ter as tags de exigência cruzadas com seu perfil de habilidades

---

## PARTE 6 — IA DO ADMIN: INTEGRAÇÃO COM A GOVERNANÇA

---

### Como a IA do Admin opera nas 4 superfícies da Governança

---

#### S-03 Painel de Saúde — Modo proativo

A IA do Admin alimenta o Painel de Saúde com diagnóstico interpretado (IA-D02). Ao abrir o painel, o Admin vê um resumo narrativo, não um dashboard de números.

Estrutura do resumo proativo:

```
ESTADO GERAL: [Saudável / Atenção / Risco / Degradação]

DESTAQUE POSITIVO:
"[O que está funcionando bem e por que]"

DESTAQUE DE ATENÇÃO:
"[O que está mudando e qual é a tendência]"

AÇÃO RECOMENDADA (se aplicável):
"[O que o Admin pode fazer para endereçar a atenção/risco]"
[botão de ação ou link contextual]
```

---

#### S-15 Equipes — Alertas estruturais

A IA do Admin monitora:
- Equipes sem Supervisor ativo → alerta de Risco
- Equipes com banco de candidatos frágil por posição → alerta de Atenção
- Equipes com membros inativos há X dias sem comunicado → sinalização

A IA não reorganiza Equipes. Apresenta o dado, o Admin decide.

---

#### S-16 Operações — Alertas de ciclo de vida

A IA do Admin monitora:
- Operações com data de encerramento passada mas status Ativo → sinalização de inconsistência
- Operações com shows futuros sem Livro do Dia iniciado dentro do horizonte de planejamento → alerta para Supervisores
- Operações com múltiplos Livros TEMPLATE DESATUALIZADO acumulados → alerta de gestão de template

---

#### S-17 Administração — Alertas de governança

A IA do Admin monitora:
- Delegações próximas de expirar → alerta preventivo (Admin decide se prorroga)
- Usuários sem atividade por período configurado → sinalização
- Solicita Administrativa acumulando sem resposta além do prazo → alerta de processo

---

### O que a IA do Admin não faz na Governança

| Proibição | Motivo |
|---|---|
| Reorganizar Equipes automaticamente | Mudança estrutural — Admin decide |
| Arquivar Operações automaticamente | Decisão administrativa — Admin executa |
| Revogar delegações automaticamente | Autoridade administrativa — Admin executa |
| Criar usuários automaticamente | Controle de acesso — Admin executa |
| Avaliar o desempenho de Supervisores com linguagem avaliativa | IA apresenta dados; Admin interpreta (IA-D10) |

---

## PARTE 7 — AUDITORIA DA GOVERNANÇA

---

### Dependências identificadas

**D-GOV-01: Equipes são pré-requisito de tudo.**
Antes de qualquer Livro do Dia, Livro do Show, ou Solicitação funcionar, as Equipes precisam estar configuradas. A Equipe é a fundação — sem ela, o motor de cobertura não tem pool de candidatos, o Supervisor não tem escopo e os Avisos não têm destinatários.

**D-GOV-02: Operações são pré-requisito da Agenda.**
Para que eventos da Agenda gerem Livros do Dia, eles precisam estar associados a uma Operação Ativa com Livro do Show e Equipes configuradas. Uma data sem Operação é apenas uma data — não um show a ser coberto.

**D-GOV-03: Administração (S-17) é pré-requisito de S-15 e S-16.**
Para criar Equipes e Operações, o Admin precisa existir. O onboarding do Admin é a primeira ação de qualquer organização que usa o sistema.

**D-GOV-04: Saúde (S-03) é downstream de todo o resto.**
O Painel de Saúde não produz — ele consome e diagnostica. Só é possível ter um Painel de Saúde funcional quando Equipes, Operações, Shows e Livros do Dia estão operando.

**Sequência de setup obrigatória:**
```
1. S-17: Criar Admin(s)
2. S-17: Criar Supervisores
3. S-17: Criar Membros
4. S-15: Criar Equipes e associar Supervisores e Membros
5. S-16: Criar Operação
6. S-13: Criar Livro(s) do Show para a Operação
7. Agenda: Adicionar eventos à Operação
8. S-03: Monitorar saúde quando a operação estiver rodando
```

---

### Riscos identificados

**R-GOV-01: Organização sem Admin ativo**
Se o único Admin da organização for removido, o sistema entra em modo de contingência estrutural — mudanças estruturais bloqueadas até que um novo Admin seja designado. Para MVP: o sistema precisa ter um mecanismo de recuperação de acesso de emergência (fora do escopo de produto — é infraestrutura de plataforma).

**R-GOV-02: Equipe sem Supervisor durante show ativo**
Se um Supervisor é removido de uma Equipe que tem shows nos próximos 7 dias, nenhum Livro do Dia pode ser publicado para aquelas datas. O sistema precisa sinalizar isso como estado de Risco imediato e oferecer ao Admin a ação de designar substituto ou criar delegação de emergência.

**R-GOV-03: Membro em duas Operações com conflito de datas**
Quando um Membro está em Equipes de duas Operações com eventos na mesma data, o motor de cobertura precisa sinalizar o conflito para ambos os Supervisores. A regra de desempate (qual Operação tem prioridade) é do Admin — não do sistema.

**R-GOV-04: Operação arquivada com Membros ainda vinculados**
Quando uma Operação é arquivada, os Membros das Equipes associadas não são automaticamente desvinculados — eles continuam na Equipe, que continua existindo. O arquivamento é da Operação, não da Equipe. Esse comportamento precisa ser explicitado no fluxo de arquivamento.

**R-GOV-05: Delegação expirada sem ação do Admin**
Quando uma delegação expira, o escopo retorna ao delegante — mesmo que o delegante esteja ausente. O sistema não prorroga, mas também não entra em Risco automaticamente — a ação pertencia ao escopo original do delegante. Se o delegante está ausente e a delegação expirou, o Admin precisa criar uma nova delegação. O sistema sinaliza, mas não bloqueia.

---

### Lacunas identificadas para V2

**LG-01: Hierarquia entre Admins**
Para organizações grandes, pode ser necessário um "Super Admin" com autoridade sobre outros Admins. No MVP, todos os Admins têm escopo igual. Essa hierarquia é V2.

**LG-02: Permissões granulares por Operação**
No MVP, o Supervisor tem escopo sobre toda a Equipe em todas as Operações que a Equipe suporta. Em organizações com múltiplas Operações simultâneas, pode ser necessário que um Supervisor tenha escopo em uma Operação específica mas não em outra, mesmo que a Equipe seja a mesma. Isso é V2.

**LG-03: Orçamento e recursos financeiros**
A Operação não tem dimensão financeira no MVP. Custos por show, orçamento de produção, controle de cachê de membros — fora do escopo atual.

**LG-04: Integração com sistemas externos de RH**
Onboarding automático de membros via integração com sistemas de RH da organização. O MVP é manual — criação de usuário pelo Admin. Automação é V2.

**LG-05: Histórico de saúde organizacional ao longo do tempo**
O Painel de Saúde mostra o estado atual e os últimos N shows. Análise histórica comparativa entre temporadas (ano a ano) é V2.

---

## PARTE 8 — VEREDITO

---

### Resumo das definições centrais

| Dimensão | Definição oficial |
|---|---|
| **Admin** | Governa a infraestrutura; não opera shows. A fronteira é: ações que valem para todos os shows futuros (Admin) vs. ações que valem para aquele show específico (Supervisor) |
| **S-03 Saúde** | Diagnóstico interpretado pela IA do Admin — 4 estados (Saudável · Atenção · Risco · Degradação) com limiares configuráveis |
| **S-15 Equipes** | Unidade organizacional fundamental; Membro pode estar em múltiplas Equipes; Equipe sem Supervisor é estado de Risco |
| **S-16 Operações** | Unidade de produção; ciclo de vida: Rascunho → Ativo → Pausado → Arquivado; pré-requisito da Agenda |
| **S-17 Administração** | Permissões na interseção de Perfil × Escopo × Tipo de Ação; delegações temporárias e não-transferíveis; sequência de setup obrigatória |
| **IA do Admin** | Alimenta o Painel de Saúde com diagnóstico narrativo; alerta sobre estrutura, ciclo de vida e governança; nunca reorganiza nem executa administrativamente |

---

### Inventário de decisões produzidas

| # | Decisão |
|---|---|
| GOV-D01 | Admin governa a infraestrutura; Supervisor opera dentro das regras. Fronteira: ações que valem para todos os shows futuros são do Admin; ações que valem para aquele dia são do Supervisor |
| GOV-D02 | Saúde organizacional tem 4 estados com limiares configuráveis pelo Admin. O Painel de Saúde apresenta diagnóstico narrativo, não dashboard de métricas brutas |
| GOV-D03 | A Equipe é a unidade organizacional fundamental — pré-requisito para o motor de cobertura, o escopo do Supervisor e os destinatários de Avisos |
| GOV-D04 | Uma Equipe sem Supervisor ativo é estado de Risco imediato — o sistema bloqueia a publicação de Livros do Dia até que um Supervisor seja designado |
| GOV-D05 | A Operação é a unidade de produção com ciclo de vida Rascunho → Ativo → Pausado → Arquivado. Pré-requisito da geração de Livros do Dia |
| GOV-D06 | Modelo de permissões = Perfil × Escopo × Tipo de Ação. No MVP, todos os Admins têm escopo igual (hierarquia entre Admins é V2) |
| GOV-D07 | Delegações são temporárias, não-transferíveis, com motivo obrigatório e data de encerramento definida. Toda ação em delegação é registrada com contexto de quem delegou |
| GOV-D08 | Sequência de setup obrigatória: S-17 (Admin → Supervisores → Membros) → S-15 (Equipes) → S-16 (Operação) → S-13 (Livro do Show) → Agenda → S-03 (Saúde) |
| GOV-D09 | Membro em Equipes de duas Operações com conflito de datas: o motor sinaliza para ambos os Supervisores; a prioridade é decisão do Admin, não do sistema |
| GOV-D10 | Onboarding de Membro não garante disponibilidade automática para shows — requer: Equipe, qualificações e cruzamento de tags configurado |

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
| **GOV-D01 a GOV-D10** | **10** | **Governança Organizacional** |
| **Total: 91 decisões formais** | | |

---

## 🟢 Pronto para UX

A Governança Organizacional está completamente modelada:

- **Papel do Admin** definido com fronteira precisa em relação ao Supervisor
- **4 estados de saúde** com 6 limiares configuráveis e diagnóstico narrativo via IA
- **Equipes** modeladas com ciclo de vida, restrições organizacionais e relações com múltiplos perfis
- **Operações** modeladas com 4 estados e evolução documentada — pré-requisito formal da Agenda e dos Livros do Dia
- **Permissões** modeladas como interseção de Perfil × Escopo × Tipo de Ação
- **Delegações** com 6 regras formais e distinção de Substituição operacional
- **5 riscos** identificados e mitigados; **5 lacunas de V2** catalogadas
- **Sequência de setup obrigatória** definida — o onboarding da organização tem ordem formal

O produto MyASA 2.0 tem agora **91 decisões formais** e uma fundação completa de comportamento para todas as suas superfícies principais.

---

*Documento elaborado por Product Designer Sênior — MyASA 2.0*
*Governança modelada em 18/06/2026*
*Base: núcleo operacional completo · Ecossistema de IA · pesquisas de campo · 81 decisões anteriores*
