# MyASA 2.0 — Documento de Arquitetura

> Versão: Gate 1 — Decisões incorporadas em 17/06/2026
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
- Pode publicar Escalas dentro de seu escopo.
- Aprova solicitações dos Membros de seu grupo.

### Membro
- Visualiza sua própria participação.
- Não visualiza a operação inteira.
- Pode criar solicitações.
- Pode criar entregas para si mesmo.

---

## Estrutura Organizacional

### Operação

Uma Operação é a unidade principal do sistema. Ela representa a empresa, a companhia ou o projeto que utiliza o MyASA.

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
Livro do Dia
↓
Escala
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

- Gerado a partir do Livro do Show.
- Considera folgas aprovadas.
- Considera restrições ativas.
- Considera disponibilidade dos membros.
- Mudanças no Livro do Show **não alteram automaticamente** Livros do Dia já gerados.
- Qualquer atualização que afete um Livro do Dia já gerado exige confirmação explícita.

---

## Escala

A Escala é o centro operacional do sistema.

Ela responde:
- Quem eu tenho hoje?
- O que cada pessoa faz?
- Existem conflitos?
- Quem está disponível?
- A operação está pronta?

A Escala é o local oficial de publicação do dia.

A Escala nasce das atividades. A operação é construída nesta ordem:
1. Shows
2. Ensaios e aulas
3. Eventos
4. Produção e administrativo
5. Disponibilidades restantes

**Jornada:**
- Entrada = primeira atividade do dia
- Saída = última atividade do dia

**Publicação:**
- Pode ser publicada por Supervisor ou Admin.
- Após publicação, os Membros afetados recebem atualização automática do Meu Dia.
- Alterações posteriores à publicação são permitidas.
- Membros afetados por qualquer alteração pós-publicação recebem notificação automática.

---

## Agenda

Calendário central da operação.

Contém:
- Ensaios
- Aulas
- Reuniões
- Eventos
- Avaliações
- Prazos
- Entregas

**Regra Agenda → Escala:**

Um item da Agenda aparece na Escala quando possuir simultaneamente:
- Data
- Horário
- Participantes definidos
- Impacto operacional

Itens sem impacto operacional permanecem apenas na Agenda.

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

Meu Dia é atualizado automaticamente quando a Escala é publicada ou alterada.

---

## Folgas

Criadas por: Admin ou Supervisor.

O Membro pode solicitar:
- Troca de folga
- Dia específico
- Solicitações excepcionais

O Supervisor aprova solicitações dentro de seu Grupo Operacional.

---

## Restrições

Criadas por: Admin ou Supervisor. **Nunca diretamente pelo Membro.**

**Fluxo para restrições médicas:**

O Membro cria uma **Solicitação** informando a necessidade.
O Supervisor ou Admin analisa e registra a **Restrição oficial**.

Restrições podem possuir:
- Data de início
- Data de término
- Data de revisão

Exemplos de restrições:
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
Comunicados de broadcast operacional.

### Mensagens
Funcionam como comunicação direta interna.

### Inbox Unificado
Todas as conversas contextuais são consolidadas em um Inbox Unificado.

O usuário não precisa procurar mensagens dentro de objetos separados.

O Inbox consolida:
- Mensagens diretas
- Conversas vinculadas a Entregas
- Conversas vinculadas a Solicitações
- Conversas vinculadas a Eventos
- Conversas vinculadas a Avaliações

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
```

A IA nunca executa ações complexas sem confirmação explícita.

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

Cada registro deve indicar:
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
