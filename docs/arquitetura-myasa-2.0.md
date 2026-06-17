# MyASA 2.0 — Documento de Arquitetura

> Versão: Gate 1 — Fase Final — 17/06/2026
> Status: Em auditoria — pré-UX

---

## Visão Geral

O MyASA é uma plataforma operacional para operações artísticas, espetáculos e equipes.

Seu objetivo é transformar comunicação operacional em operação organizada.

- O sistema deve se adaptar à operação. A operação não deve se adaptar ao sistema.
- A IA deve reduzir trabalho manual.
- O Supervisor deve revisar e aprovar.
- O sistema deve fazer o trabalho pesado.

---

## Princípios

1. Mobile e Web possuem a mesma importância.
2. Nenhuma funcionalidade é considerada pronta sem experiência mobile.
3. Características não viram módulos.
4. Apenas pilares viram módulos.
5. O sistema deve parecer um produto premium.
6. O sistema deve ser simples mesmo em dias caóticos.
7. A IA ajuda a operar.
8. A IA não substitui pessoas.

---

## Públicos

### Administrador
- Acesso total ao sistema.
- Gerencia todas as Operações e todos os Grupos Operacionais.
- Pode criar e editar qualquer entidade.

### Supervisor
- Gerencia um ou mais Grupos Operacionais.
- Seu escopo de atuação é definido pelos Grupos Operacionais aos quais está vinculado.
- Trabalha sobre a Escala única da Operação, alocando membros de seu(s) Grupo(s).
- Pode publicar a Escala da Operação.
- Aprova solicitações dos Membros de seu grupo.
- Visualiza indisponibilidade de membros de outros grupos sem acessar dados confidenciais desses grupos.

### Membro
- Visualiza sua própria participação.
- Não visualiza a operação inteira.
- Pode criar solicitações.
- Pode criar entregas para si mesmo.

---

## Estrutura Organizacional

### Operação

Uma Operação é a unidade principal do sistema. Ela representa a empresa, a companhia ou o projeto que utiliza o MyASA.

Exemplos: Snowland, Acquamotion.

### Grupo Operacional

Um Grupo Operacional é um conjunto configurável de membros dentro de uma Operação.

Pode representar:
- Elenco de espetáculo
- Grupo de aula
- Equipe técnica
- Equipe artística
- Supervisão
- Evento específico
- Qualquer agrupamento operacional

Regras:
- Uma Operação possui vários Grupos Operacionais.
- Um Membro pode pertencer a vários Grupos Operacionais.
- Um Supervisor pode gerenciar um ou mais Grupos Operacionais.
- Um Admin possui acesso a todos os Grupos Operacionais.
- O Grupo Operacional define o escopo de atuação do Supervisor.
- O Grupo Operacional existe dentro da Operação.

---

## Pilares

### Rotina Operacional
- Escala
- Agenda
- Livros

### Pessoas
- Equipe
- Folgas
- Restrições
- Solicitações
- Entregas

### Comunicação
- Avisos
- Mensagens
- Inbox Unificado

### Conhecimento
- Biblioteca
- Manuais
- Diretrizes
- Procedimentos

### Assistência
- IA

### Unidades Operacionais *(anteriormente "Administração")*
- Operações
- Configurações

---

## Fluxo Principal

```
Livro do Show
↓
Folgas e Restrições
↓
Livro do Dia  ← gerado automaticamente pelo sistema
↓
Escala  ← única por Operação
↓
Publicação
↓
Meu Dia
```

---

## Livros

Todo espetáculo utiliza Livros.

Existem dois tipos:

### Livro do Show

- Criado e editado pelo Supervisor ou Admin.
- Pode possuir versões.
- É o modelo operacional permanente do espetáculo.

**Modelos internos (configurações, não módulos):**

- **Modelo Simples:** Papel → Pessoa
- **Modelo Estruturado:** Cena → Bloco → Posição → Pessoa

### Livro do Dia

O Livro do Dia é gerado automaticamente pelo sistema.

**Fluxo de geração:**

```
Supervisor escolhe a data
↓
Sistema gera proposta considerando:
  - Livro do Show
  - Folgas aprovadas
  - Restrições ativas
  - Disponibilidade dos membros
  - Regras do espetáculo
↓
Supervisor revisa a proposta
↓
Supervisor aprova
↓
Livro do Dia pronto
```

O Supervisor não reconstrói o Livro do Dia manualmente do zero.

**Regras de versionamento:**

- Mudanças no Livro do Show **não alteram automaticamente** Livros do Dia já gerados (datas passadas ou presentes).
- Livros do Dia de **datas futuras ainda não gerados** utilizarão sempre a versão mais recente do Livro do Show no momento da geração.
- Qualquer atualização que afete um Livro do Dia já aprovado exige confirmação explícita do Supervisor.

---

## Escala

A Escala é o centro operacional do sistema e pertence à **Operação**, não a grupos individuais.

Existe **uma única Escala por Operação** (ex: Escala Snowland, Escala Acquamotion).

Ela responde:
- Quem eu tenho hoje?
- O que cada pessoa faz?
- Existem conflitos?
- Quem está disponível?
- A operação está pronta?

A Escala é o local oficial de publicação do dia.

**Construção da Escala — ordem de prioridade:**
1. Shows
2. Ensaios e aulas
3. Eventos
4. Produção e administrativo
5. Disponibilidades restantes

**Jornada:**
- Entrada = primeira atividade do dia
- Saída = última atividade do dia

**Gestão de conflitos:**
- Ao tentar alocar uma pessoa, o sistema consulta toda a Escala da Operação.
- Se existir conflito, o sistema alerta imediatamente.
- Conflitos devem ser resolvidos antes da publicação.
- Supervisores visualizam indisponibilidade de membros de outros grupos, sem acesso a informações confidenciais desses grupos.

**Publicação:**
- Pode ser publicada por Supervisor ou Admin.
- Após publicação, os Membros afetados recebem atualização automática no Meu Dia.
- Alterações posteriores à publicação são permitidas.
- Membros afetados por qualquer alteração pós-publicação recebem notificação automática via Central de Notificações.

**Cancelamento de show:**

Cancelamentos são eventos críticos. Ao cancelar um show, o sistema pergunta: *"Impactar Escala?"*

- **Se sim:** remove a atividade da Escala, recalcula disponibilidade, atualiza o Meu Dia de todos os membros afetados, envia notificação crítica via Central de Notificações.
- **Se não:** registra apenas o cancelamento operacional no histórico.

Toda alteração gera registro obrigatório no histórico.

---

## Agenda

Calendário central da operação. É a fonte primária de eventos.

Contém:
- Ensaios
- Aulas
- Reuniões
- Eventos
- Avaliações
- Prazos
- Entregas

**Regra Agenda → Escala (baseada no tipo do evento):**

Eventos que **aparecem na Escala** (impacto operacional definido pelo tipo):
- Shows
- Ensaios
- Aulas
- Avaliações presenciais
- Reuniões operacionais
- Eventos operacionais

Eventos que **permanecem apenas na Agenda** (sem impacto operacional):
- Lembretes
- Prazos
- Aniversários
- Datas comemorativas
- Entregas sem horário operacional

O impacto operacional não é uma escolha manual do criador. É determinado automaticamente pelo tipo do evento.

---

## Meu Dia

Meu Dia é a tela principal do Membro.

Conteúdo:
- Programação do dia
- Participações em espetáculos
- Papéis atribuídos
- Atividades do dia
- Entregas pendentes
- Avisos importantes
- Próximos compromissos

O Membro vê sua participação. Não vê a operação inteira.

Meu Dia é atualizado automaticamente quando:
- A Escala é publicada
- A Escala é alterada após publicação
- Um show é cancelado com impacto na Escala

---

## Folgas

Criadas por: Admin ou Supervisor.

O Membro pode solicitar via Solicitação:
- Troca de folga
- Dia específico
- Solicitações excepcionais

O Supervisor aprova solicitações dentro de seu Grupo Operacional.

---

## Restrições

Criadas por: Admin ou Supervisor. **Nunca diretamente pelo Membro.**

**Fluxo para restrições de origem do membro (ex: médicas):**

```
Membro cria Solicitação informando a necessidade
↓
Supervisor ou Admin analisa
↓
Supervisor ou Admin registra a Restrição oficial
```

Restrições possuem:
- Data de início
- Data de término (opcional)
- Data de revisão (opcional)

Ao expirar ou atingir a data de revisão, o Supervisor responsável recebe notificação automática.

Exemplos:
- Sem acrobacia
- Não pode entrar no gelo
- Restrição médica
- Restrição operacional

---

## Entregas

Tipos:
- Tarefa simples
- Projeto
- Entrega digital
- Avaliação presencial

Permissões de criação:
- Admin: cria para todos
- Supervisor: cria para seu Grupo Operacional
- Membro: cria para si mesmo

---

## Comunicação

### Avisos
Comunicados de broadcast operacional. Aparecem no Inbox Unificado.

### Mensagens
Comunicação direta interna entre usuários.

### Inbox Unificado

Todas as conversas e comunicados são consolidados em um Inbox Unificado.

O usuário não precisa procurar mensagens dentro de objetos separados.

O Inbox consolida:
- Avisos
- Mensagens diretas
- Conversas vinculadas a Entregas
- Conversas vinculadas a Solicitações
- Conversas vinculadas a Eventos
- Conversas vinculadas a Avaliações

---

## Central de Notificações

A Central de Notificações é uma infraestrutura compartilhada, não um módulo.

**Tipos de notificação:**

| Tipo | Exemplos |
|---|---|
| **Informativo** | Avisos gerais |
| **Importante** | Alteração de programação, mudança de atividade |
| **Crítico** | Cancelamento de show, alteração urgente |

Notificações críticas podem exigir **confirmação de leitura** pelo destinatário.

**Canais suportados:**
- Push mobile
- In-app

---

## Biblioteca

Contém:
- Manual do Elenco
- Diretriz do Gelo
- Procedimentos
- Regulamentos
- Treinamentos

A IA pode responder perguntas usando os documentos da Biblioteca.

---

## IA

A IA transforma comunicação operacional em ações.

**Escopo de ações permitidas:**
- Criar eventos
- Criar ensaios
- Criar aulas
- Criar avisos
- Criar entregas
- Propor folgas
- Atualizar Livros
- Atualizar Escala

**Fluxo obrigatório para qualquer ação:**

```
Mensagem / Solicitação
↓
Interpretação
↓
Proposta (exibida ao usuário)
↓
Confirmação (obrigatória)
↓
Execução
↓
Opção de desfazer disponível imediatamente após execução
```

A IA nunca executa ações sem confirmação explícita.

**Reversibilidade:**

Toda ação executada pela IA possui:
- Registro no histórico
- Autor identificado
- Data e hora
- Opção de reversão disponível após execução

---

## Histórico e Auditoria

O histórico é obrigatório em todo o sistema.

Entidades com registro obrigatório:
- Folgas
- Restrições
- Escala
- Livros
- Agenda
- Solicitações
- Entregas
- Publicações
- Ações da IA
- Cancelamentos

Cada registro indica:
- Quem fez
- Quando fez
- O que mudou

---

## Identidade Visual

Inspiração:
- iOS
- Apple Calendar
- Apple Reminders
- Apple Health

Não parecer:
- ERP
- RH
- Sistema corporativo

Visual:
- Modo claro como padrão
- Muito espaço em branco
- Bordas arredondadas
- Glassmorphism leve
- Transparências suaves
- Poucas cores

**Asa do MyASA:**

A asa é o principal elemento visual. Utilizar apenas a asa — não utilizar o fundo escuro do ícone dentro da interface.

Versões:
- Asa Glass
- Asa Outline
- Asa Marca-d'água

A asa deve funcionar como elemento visual elegante e não competir com o conteúdo.
