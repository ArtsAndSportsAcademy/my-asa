# Manual do MyASA 2.0

Guia completo e detalhado de todas as funcionalidades do aplicativo.

---

## 1. O que é o MyASA

O **MyASA** é a plataforma de gestão operacional da ASA. Ele organiza tudo o que
acontece em uma operação (espetáculo/show): quem trabalha, quando, em qual
posição, quais tarefas precisam ser feitas, avisos, folgas, mensagens e muito
mais.

O sistema tem **duas formas de uso**, conectadas ao mesmo banco de dados:

- **Painel Web (administração)** — usado por administradores, supervisores e
  capitães para planejar e gerenciar tudo. Também tem áreas para o membro.
- **Aplicativo Mobile (Expo/celular)** — usado pelos membros (e capitães) no dia
  a dia: ver a escala, fazer check-in, ler avisos, cumprir tarefas, etc.

Há ainda a **ASA**, uma assistente virtual inteligente que responde perguntas em
linguagem natural sobre escala, equipe, riscos do dia e mais.

---

## 2. Perfis de acesso (papéis)

Cada pessoa tem um papel que define o que pode ver e fazer:

| Papel | O que pode fazer (resumo) |
|---|---|
| **ADMIN** | Acesso total à organização. Cria/apaga usuários, operações e grupos; vê auditoria; gerencia tudo. |
| **SUPERVISOR (A/B)** | Gerencia as operações sob sua responsabilidade: escalas, tarefas, avisos, folgas, biblioteca, solicitações, delegações. |
| **CAPITÃO** | Não é um papel fixo: é um membro que recebeu uma **delegação** temporária de uma responsabilidade específica (ex.: aprovar tarefas, publicar avisos). Age como supervisor **apenas** naquela área delegada. |
| **MEMBRO** | Vê o seu dia, sua escala, suas tarefas; faz check-in; confirma leitura de avisos; envia mensagens; pede folga/troca; usa a biblioteca e a ASA. |

> **Acesso por delegação:** quando um supervisor delega uma responsabilidade
> (ex.: "Avisos" ou "Check-ins") a um membro, esse membro passa a enxergar a
> tela correspondente mesmo sem ser supervisor. Se tentar entrar numa área sem
> permissão nem delegação, vê a mensagem **"Acesso restrito"** com a lista das
> suas responsabilidades ativas.

---

## 3. Entrar no sistema (Login)

1. Informe seu **usuário** no formato `nome.sobrenome` e a **senha**.
2. Use o ícone de olho para mostrar/ocultar a senha.
3. **Primeiro acesso ou senha resetada:** o sistema obriga a **trocar a senha**
   antes de continuar (tela "Trocar senha"), pedindo a senha atual e a nova
   (digitada duas vezes para confirmação).
4. Erros de login (usuário/senha incorretos ou sem permissão) aparecem com
   mensagem explicativa.

A sessão fica salva com segurança e é renovada automaticamente enquanto você usa
o app.

---

## 4. Funcionalidades do Painel Web

### 4.1. Meu Dia / Home
A tela inicial ("Sua central de operações"). Mostra:
- **"O que precisa da sua atenção agora"** — pendências e itens urgentes.
- **Visão organizacional** — saúde da operação.
- Resumo do dia: atividade atual, próximos eventos, avisos e delegações ativas.

### 4.2. Agenda
Calendário de eventos da operação (espetáculos, ensaios, reuniões, chamadas).
- **Criar evento:** define tipo, data, horário, local e visibilidade
  (operação ou só gestão).
- **Escolher participantes (uma vez):** ao criar/editar um evento você seleciona
  os membros participantes. Esses membros aparecem **automaticamente** como
  células na **Escala Semanal**, com o selo **"Agenda"** — sem precisar escolher
  de novo na escala. Apenas gestores veem essa lista de participantes.
- **Gerenciar status:** confirmar, suspender/cancelar ou marcar como concluído.

### 4.3. Escalas (Escala Semanal/Mensal)
O coração do planejamento de equipe.
- **Geração automática** da escala e **publicação** para os membros.
- **Lançamentos manuais:** adicionar pessoas em dias/posições específicas.
- **"Adicionar da agenda":** trazer participantes de eventos da agenda para a
  escala (coexiste com a seleção feita direto na agenda).
- **Prazo de publicação** (publish deadline) e tratamento de exceções.
- Cada célula mostra horário, local e posição (ex.: "Elenco A", "Pista de Gelo").
- **Folgas** aparecem destacadas com o selo **🌴 Folga**.

### 4.4. Livro do Show (Show Book)
Modelo estrutural de uma produção: define as cenas, blocos, posições e funções
técnicas necessárias. É o "esqueleto" do espetáculo usado para montar o dia.

### 4.5. Livro do Dia (Daily Book)
O plano de execução de um dia específico — o "roteiro final". É derivado da
escala + livro do show e mostra a alocação final de cada pessoa. Permite
confirmar/cancelar escalados.

### 4.6. Painel Operacional
Acompanhamento ao vivo da operação. Permite marcar membros como **Presente**,
**Atrasado** ou **Ausente**, dando visão da saúde da operação em tempo real.

### 4.7. Tarefas
Gestão de tarefas operacionais.
- **Criar e atribuir** tarefas a membros.
- **Acompanhar status:** criada → em andamento → enviada para aprovação →
  aprovada (ou alterações solicitadas/cancelada).
- **Checklists, evidências** (links/arquivos) e **comentários**.
- Gestores (ou capitães com a delegação) **aprovam** após revisar as evidências.

### 4.8. Avisos
Comunicados oficiais da operação.
- **Criar aviso** com urgência: **Informativo**, **Importante**, **Persistente**
  ou **Escalonado**.
- Avisos podem **exigir confirmação de leitura** dos membros.
- Recursos de **escalonamento** para garantir que mensagens críticas sejam vistas.

### 4.9. Mural
Espaço de **reconhecimentos** (elogios e marcos). Permite registrar um
reconhecimento para um membro, escolhendo o tipo e a mensagem
(ex.: "Excelente atuação no espetáculo de sexta").

### 4.10. Mensagens
Sistema de comunicação interna por **conversas (threads)**.
- Conversas agrupadas por contexto (escala, livro do dia, etc.).
- Enviar mensagens de texto, ver participantes e status (aberta/fechada).
- **Nova conversa:** escolher vários destinatários e definir o contexto.

### 4.11. Biblioteca
Repositório central de documentos: procedimentos (SOPs), políticas, referências
de personagem/figurino, segurança, etc.
- **Categorias** e **documentos** com **versionamento** (histórico de versões).
- Busca e filtros; cada documento mostra responsável e histórico.

### 4.12. Entregas (Deliveries)
Itens de leitura/entrega obrigatórios (ex.: "Leitura obrigatória — Manual de
Segurança"), com acompanhamento de quem cumpriu.

### 4.13. Folgas
Gestão de ausências em uma **grade mensal**.
- Marcar/alternar dias de folga, recesso, afastamento, restrição, falta, etc.
- **Preenchimento em lote** e reset mensal (admin).

### 4.14. Solicitações (Requests)
Pedidos dos membros: **folga**, **troca** ou **mudança de escala**.
- Gestores **aprovam, negam ou propõem alternativa**.
- O membro pode **aceitar/recusar** a alternativa proposta.

### 4.15. Restrições
Cadastro de restrições de membros (limitações de horário, função, etc.) que o
planejamento da escala deve respeitar.

### 4.16. Check-ins
Verificação de presença operacional: confirma quando os membros chegam e iniciam
suas atividades no dia.

### 4.17. Solicitações entre Supervisores (Empréstimo de membros)
Permite que um supervisor **peça membros de outra operação/equipe** para eventos
específicos ("emprestar" pessoal entre operações).

### 4.18. Delegações
Transferência temporária de autoridade. Um supervisor **delega responsabilidades
específicas** (ex.: "Avisos", "Tarefas", "Check-ins") a um membro, que vira
**capitão** naquela área pelo período definido.

### 4.19. Responsabilidades
Atribuições permanentes além da função padrão (ex.: "Responsável por Segurança",
"Líder de Figurino").

### 4.20. Equipe
Visão da equipe sob responsabilidade do supervisor, com dados dos membros.

### 4.21. Insights
Relatórios e análises de desempenho. Usa dados históricos (e IA) para identificar
tendências, riscos e padrões operacionais.

### 4.22. Histórico
Registro de eventos operacionais (ex.: "Republicação de escala — 20/06").

### 4.23. Auditoria (apenas ADMIN)
Histórico de **alterações estruturais** do sistema — quem mudou o quê — para
rastreabilidade e governança.

### 4.24. Usuários (apenas ADMIN)
Cadastro e gestão de contas: criar/editar/remover membros, redefinir senha,
atribuir especializações e papéis.

### 4.25. Operações e Grupos (apenas ADMIN)
- **Operações:** as unidades/espetáculos ("shows"), com status e saúde.
- **Grupos Operacionais:** organizam equipes dentro de uma operação
  (ex.: "Equipe de Palco").

### 4.26. ASA (assistente)
Assistente virtual no painel. Responde perguntas, gera resumos e sugestões
operacionais (mais detalhes na seção 6).

### 4.27. Áreas do Membro no Painel Web
Mesmo no painel, o membro tem suas telas: **Minha Escala**, **Minhas Tarefas**,
**Minhas Entregas**, **Mensagens**, **Biblioteca**, **Livro do Dia**, **Avisos**
e **Solicitações**.

---

## 5. Funcionalidades do Aplicativo Mobile

O app mobile é voltado ao dia a dia do membro (e do capitão). Navegação por abas,
com a assistente ASA sempre acessível.

### 5.1. Login e Troca de Senha
Igual ao painel: usuário `nome.sobrenome` + senha; troca obrigatória de senha no
primeiro acesso ou após reset.

### 5.2. Meu Dia
Tela principal do membro:
- Saudação personalizada, clima, aniversariantes e a avatar da ASA (que muda de
  pose conforme o contexto).
- **Check-in:** botão "Realizar Check-in" para confirmar presença no turno; mostra
  status (Presente, Atrasado, Ausente).
- **Agora:** atividade atual + próximos eventos (show, ensaio) com horário, local
  e posição.
- Avisos críticos e delegações ativas (se você estiver atuando como capitão).

### 5.3. Avisos
- Ler avisos informativos, importantes ou críticos.
- **Confirmar leitura** quando exigido.
- **Capitão (delegação "Avisos"):** botão "Novo Aviso" para publicar à operação.

### 5.4. Central / Notificações
Lista de notificações do sistema (ex.: "Escala atualizada"). Tocar para marcar
como lida ou ir direto à tela relacionada.

### 5.5. Mensagens
- Ver conversas agrupadas por contexto.
- Enviar mensagens, ver participantes e status (aberta/fechada).
- **Nova:** iniciar conversa escolhendo destinatários e contexto.

### 5.6. Escala
- Linha do tempo semanal (quinta a quarta).
- Cada dia mostra horários, locais e posições.
- Folgas com selo "🌴 Folga"; filtros "Próximos" ou "Todos".

### 5.7. Agenda
Filtrar eventos da operação (show, reunião, ensaio) por status (confirmado,
cancelado, concluído) e ver as datas/horários de toda a operação.

### 5.8. Solicitações
- **Nova:** pedir folga, troca ou mudança de escala (operação, datas e motivo).
- **Negociação:** aceitar/recusar alternativas propostas pelo supervisor.
- **Capitão (delegação):** decidir (aprovar/negar) pedidos da equipe.

### 5.9. Tarefas
- **Iniciar** tarefa, marcar itens do checklist, anexar **evidências** e
  **Enviar para Aprovação**.
- **Capitão (delegação):** **Aprovar** tarefas da equipe após revisar evidências.

### 5.10. Biblioteca
Buscar/filtrar documentos (SOPs, referências, segurança), ver conteúdo, histórico
de versões e responsáveis.

### 5.11. Telas Operacionais (menu "Mais")
- **Painel Operacional:** visão de saúde da operação (supervisores/capitães).
- **Livro do Show / Livro do Dia:** composição do show e alocação do dia.
- **Insights:** indicadores e KPIs operacionais.
- **Responsabilidades:** responsabilidades permanentes atribuídas a você.

### 5.12. ASA (no app)
Assistente por linguagem natural — ver seção 6.

---

## 6. ASA — Assistente Virtual

A ASA é a coordenadora virtual inteligente, disponível no painel e no app.
- **Perguntas em linguagem natural:** "Minha escala hoje", "Quem faz
  aniversário?", "Quais os riscos de hoje?".
- **Dados em tempo real:** usa ferramentas internas para buscar escala, equipe e
  informações operacionais — inclusive consultas em lote (vários membros de uma
  vez).
- **Proatividade:** resumos de "Bom dia", alertas de clima, marcos culturais e
  sugestões operacionais.
- **Expressiva:** a avatar muda de pose (analisando, feliz, festiva) conforme a
  tarefa.

---

## 7. Conceitos importantes

- **Operação:** uma unidade/espetáculo ("show"). Quase tudo é organizado por
  operação.
- **Grupo Operacional:** subdivisão de equipe dentro de uma operação.
- **Escala vs. Agenda:** a *agenda* lista eventos (shows, ensaios); a *escala*
  define quem trabalha em cada dia/posição. Participantes escolhidos na agenda
  aparecem automaticamente na escala.
- **Delegação vs. Responsabilidade:** *delegação* é temporária (vira capitão por
  um período); *responsabilidade* é permanente (ex.: Segurança).
- **Folga vs. Restrição:** *folga* é ausência em um dia; *restrição* é uma
  limitação contínua que o planejamento deve respeitar.

---

*Documento gerado a partir do estado atual do aplicativo MyASA 2.0.*
