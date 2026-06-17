# MyASA 2.0 — Documento de Arquitetura

> Versão Candidata à Aprovação — 17/06/2026
> Status: Gate 1 concluído — pronto para UX

---

## Visão

O MyASA é uma plataforma operacional para operações artísticas, espetáculos e equipes.

Seu objetivo é transformar comunicação operacional em operação organizada.

- O sistema deve se adaptar à operação. A operação não deve se adaptar ao sistema.
- A IA deve reduzir trabalho manual.
- O Supervisor continua sendo o responsável pelas decisões operacionais.

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

**Administrador** — Possui visão completa da operação.

**Supervisor** — Gerencia grupos operacionais dentro da operação.

**Membro** — Visualiza sua programação, tarefas, entregas e comunicação.

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

### Conhecimento
- Biblioteca
- Manuais
- Diretrizes
- Procedimentos

### Assistência
- IA

### Unidades Operacionais
- Operações
- Configurações

---

## Operações

Uma Operação é a unidade principal do sistema. Representa a empresa, a companhia ou o projeto que utiliza o MyASA.

Exemplos: Snowland, Acquamotion, Hotelaria, Eventos futuros.

Cada Operação possui:
- Membros
- Grupos Operacionais
- Escala
- Agenda
- Livros

---

## Grupos Operacionais

Grupo Operacional é um agrupamento configurável dentro de uma Operação.

Exemplos: Elenco Musical, Equipe Patinação, Grupo A, Grupo B, Supervisores, Evento Especial.

Regras:
- Uma Operação possui vários Grupos Operacionais.
- Um Membro pode pertencer a vários Grupos Operacionais.
- Um Supervisor pode gerenciar vários Grupos Operacionais.
- Admin possui acesso a todos os grupos.

---

## Fluxo Principal

```
Livro do Show
↓
Folgas
↓
Restrições
↓
Livro do Dia  ← gerado automaticamente
↓
Escala  ← única por Operação
↓
Publicação
↓
Meu Dia
```

---

## Livros

### Livro do Show

Define a estrutura permanente do espetáculo.

**Modelos internos (configurações, não módulos):**

- **Simples:** Papel → Pessoa
- **Estruturado:** Cena → Bloco → Posição → Pessoa

### Livro do Dia

Gerado automaticamente pelo sistema.

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
Supervisor revisa
↓
Supervisor aprova
```

Mudanças no Livro do Show **não alteram automaticamente** Livros do Dia já gerados.

---

## Agenda

A Agenda é a fonte oficial dos eventos.

**Permissões:**

| Público | Ação |
|---|---|
| Admin | Criar, editar, excluir |
| Supervisor | Criar, editar, excluir dentro do seu escopo |
| Membro | Visualizar agenda operacional; criar lembretes e compromissos pessoais |

Compromissos pessoais do Membro:
- Não entram na Escala
- Não possuem impacto operacional
- São privados

---

## Impacto Operacional

O impacto operacional é determinado pelo **tipo do evento**, não por escolha manual.

**Eventos com impacto operacional** — aparecem na Escala:
- Show
- Ensaio
- Aula
- Avaliação presencial
- Reunião operacional
- Evento operacional

**Eventos sem impacto operacional** — permanecem apenas na Agenda:
- Lembretes
- Prazos
- Aniversários
- Datas comemorativas
- Entregas sem horário operacional
- Compromissos pessoais do Membro

---

## Escala

Existe **uma única Escala por Operação**.

Exemplos: Escala Snowland, Escala Acquamotion.

A Escala responde:
- Quem eu tenho hoje?
- O que cada pessoa faz?
- Existem conflitos?
- Quem está disponível?
- A operação está pronta?

Os Supervisores trabalham em seus Grupos Operacionais, mas toda alocação ocorre sobre a Escala única da Operação.

O sistema detecta conflitos de horário antes da publicação.

**Jornada:**
- Entrada = primeira atividade do dia
- Saída = última atividade do dia

---

## Publicação

A publicação pertence à Operação.

**Podem publicar:** Admin e Supervisor.

**Antes da publicação**, o sistema executa validações:
- Conflitos de horário
- Pendências abertas
- Membros não alocados

O responsável decide se publica mesmo com alertas pendentes.

**Após publicação:**
- Meu Dia é atualizado automaticamente
- Membros afetados recebem notificações
- Alterações futuras geram novas notificações

---

## Cancelamento de Show

Cancelamentos são eventos críticos.

Ao cancelar um show, o sistema pergunta: *"Impactar Escala?"*

- **Se sim:** remove atividade, recalcula disponibilidade, atualiza Meu Dia, envia notificação crítica.
- **Se não:** registra apenas o cancelamento operacional no histórico.

Toda alteração gera registro no histórico.

---

## Folgas

**Criadas por:** Admin ou Supervisor.

**Membro pode solicitar:**
- Folga
- Troca de folga
- Solicitação excepcional

A aprovação pertence ao Supervisor ou Admin.

---

## Restrições

**Criadas por:** Admin ou Supervisor. Nunca diretamente pelo Membro.

**Fluxo para restrições de origem do membro:**

```
Membro cria Solicitação
↓
Admin ou Supervisor analisa
↓
Admin ou Supervisor registra a Restrição oficial
```

Restrições possuem:
- Data de início
- Data de término (opcional)
- Data de revisão (opcional)

Exemplos: Médica, Operacional, Física, Técnica.

---

## Solicitações

**Tipos oficiais:**
- Solicitação de folga
- Troca de folga
- Solicitação excepcional
- Solicitação de restrição
- Solicitação de ajuste de escala
- Solicitação de saída antecipada
- Solicitação de chegada tardia
- Solicitação administrativa

---

## Entregas

**Tipos:**
- Tarefa simples
- Projeto
- Entrega digital
- Avaliação presencial

**Permissões de criação:**
- Admin: cria para todos
- Supervisor: cria dentro do seu escopo
- Membro: cria para si mesmo

---

## Meu Dia

Tela principal do Membro.

Apresenta:
- Programação do dia
- Participações em espetáculos
- Papéis atribuídos
- Atividades do dia
- Entregas pendentes
- Avisos importantes
- Próximos compromissos

O Membro vê apenas sua realidade operacional.

---

## Comunicação

**Avisos** — Comunicação oficial de broadcast operacional.

**Mensagens** — Comunicação conversacional direta.

Conversas contextuais podem existir em:
- Entregas
- Solicitações
- Eventos
- Avaliações

### Inbox Unificado

Consolida em um único lugar:
- Mensagens
- Avisos
- Entregas
- Solicitações
- Eventos
- Avaliações

---

## Biblioteca

Contém:
- Manual do Elenco
- Diretrizes operacionais
- Procedimentos
- Regulamentos
- Treinamentos

A IA pode consultar a Biblioteca para responder perguntas.

---

## IA

A IA transforma comunicação operacional em ações.

**Fluxo obrigatório:**

```
Mensagem
↓
Interpretação
↓
Proposta (exibida ao usuário)
↓
Confirmação (obrigatória)
↓
Execução
↓
Opção de desfazer disponível
```

A IA atua **dentro das permissões do usuário que a acionou**.

Toda ação executada pela IA possui:
- Registro no histórico
- Autor identificado
- Data e hora
- Possibilidade de reversão

---

## Histórico e Auditoria

O histórico é obrigatório para todas as entidades principais.

**Entidades com registro obrigatório:**
- Escala
- Agenda
- Livros
- Folgas
- Restrições
- Solicitações
- Entregas
- Publicações
- Ações da IA

Cada registro indica:
- Quem fez
- Quando fez
- O que mudou

---

## Central de Notificações

Infraestrutura compartilhada — não é um módulo.

**Tipos:**

| Tipo | Exemplos |
|---|---|
| **Informativo** | Avisos gerais |
| **Importante** | Alteração de programação, mudança de atividade |
| **Crítico** | Cancelamento de show, alteração urgente |

**Canais:** Push Mobile e In-App.

Notificações críticas podem exigir confirmação de leitura.

---

## Identidade Visual

**Inspiração:** iOS, Apple Calendar, Apple Reminders, Apple Health.

**Não parecer:** ERP, RH, sistema corporativo.

**Visual:**
- Modo claro como padrão
- Muito espaço em branco
- Bordas arredondadas
- Transparências suaves
- Glassmorphism leve
- Poucas cores

---

## Marca

A asa do MyASA é o principal elemento visual.

Utilizar apenas a asa. Não utilizar o fundo escuro do ícone dentro da interface.

**Versões:**
- Asa Glass
- Asa Outline
- Asa Marca-d'água
