---
name: MyASA 2.0 — Estado do Projeto
description: Resumo do que foi construído por sprint no projeto MyASA 2.0
---

## Sprints concluídas

### PILOT-NAV-FOLGAS-FIX-01
- Módulo Folgas completo: DB, API CRUD, web-admin (grid + modal), mobile (Meu Dia), ASA tools

### ESCALAS-MANUAL-ENTRY-D01
- DB migration: colunas manual_date/manual_label/start_time/end_time/notes + override fields
- API: POST/DELETE /scales/:id/entries
- Web-admin: OperationalDayView + AddEntryModal
- Hooks manuais: useCreateScaleEntry, useDeleteScaleEntry

### ASA-SPRINT-02A — Operação por Linguagem Natural
- Tool consultar_membros: fuzzy matching + resolução de apelidos via memories APPROVED + desambiguação
- Tool criar_entrada_escala: localiza escala ativa por data, verifica folga, insere com MANUAL_OVERRIDE
- Tool criar_tarefa: cria em tasksTable com origin="AI", requiresApproval=true
- System prompt: fluxo obrigatório (consultar_membros → confirmar → criar)
- Mobile: TOOL_LABELS + SUGGESTIONS atualizados

### ASA-SPRINT-02B — Memória, Biblioteca e Personalidade
- Memórias aprovadas injetadas no system prompt antes de cada conversa (até 40 registros)
- Tool consultar_biblioteca: busca em libraryDocumentsTable (status=PUBLISHED) com keyword filter JS
- System prompt reescrito: primeira pessoa, emojis, tom acolhedor, exemplos de conversa, regras preservadas
- Mobile: AsaAvatar substituiu 🐦 no header, no estado vazio e nas bolhas de mensagem (Image 30x30)
- Mobile: TOOL_LABELS + consultar_biblioteca adicionado

### ASA-SPRINT-04 — Vida, Reconhecimento e Conversas Inteligentes
- DB: recognitions table criada; asaUserPreferencesTable estendido (goodMorningTime, goodNightTime, messageFrequency, proactivityLevel)
- assembleResumoDodia() recebe 4º param userRole (default "MEMBER"); retorna avatarState + milestones
- Milestone detection via users.createdAt: marcos de 3m, 6m, 1a, 2a...
- Operational suggestions (gestores): membros de folga com tarefas pendentes → emoji 💡
- avatarState: comemoracao > atencao > sugestao > bomdia/boanoite/feliz
- 3 novas tools: consultar_reconhecimentos, criar_reconhecimento, detectar_marcos
- REST endpoints: GET/POST /api/asa/recognitions
- AsaAvatar.tsx: prop state com badge emoji overlay (7 estados)
- historico-asa.tsx: nova tela com tabs Reconhecimentos/Memórias
- mais.tsx: Histórico ASA na seção Inteligência

### EQUIPE-HUB-PROFILE-AWARE
- Especialização `CHOREOGRAPHER` (Coreógrafo) adicionada em todo o stack (openapi 3 enums, api-server VALID_SPECIALIZATIONS, lib/db identity.ts type+labels)
- Hub de perfil (supervisor/equipe.tsx) é profile-aware: Performer/Elenco ("o que faço": message/task/folga/recognition/history) vs Especializado ("quem acompanha": message/task/recognition/delegation/history). `isSpecialist()` define o split; troca de view ao vivo via estado local `spec`
- Especialização editável inline no hub (SpecializationEditor), persiste via useUpdateUser e invalida getListUsersQueryKey

### WEB-ADMIN MEMBER-PARITY
- MEMBER agora tem paridade no web-admin com o mobile: páginas próprias em `src/pages/membro/*` (escala, tarefas, entregas, mensagens, biblioteca, livro-do-dia, avisos, solicitacoes), montadas em rotas `/membro/*` (ProtectedRoute, auth-only).
- `admin-layout.tsx`: MEMBER_NAV define a navegação do membro; capitães herdam MEMBER_NAV + seção Capitão.
- Páginas de membro DEVEM usar hooks my-scoped (useGetMyTasks, useGetMyDeliveries, useGetMyNotices, useListMyAllocations, etc.), nunca os hooks globais de gestão.

## Notas importantes

### Controle de acesso: páginas de gestão vs membro (decisão)
Páginas de gestão (ex.: `/admin/avisos`) devem usar **RoleRoute** (ADMIN/SUPERVISOR_A/SUPERVISOR_B), nunca `ProtectedRoute` (auth-only).
**Why:** com ProtectedRoute, um MEMBER podia navegar manualmente para `/admin/avisos` e ver dados de gestão (lista/detalhe de avisos com contagem de destinatários) — esconder só os botões de criar/gerir com `isManager` não basta, os dados ainda renderizavam.
**How to apply:** ao criar página de gestão, gate por RoleRoute; o equivalente de leitura do membro vive em `/membro/*` com hook my-scoped. Home do membro usa `useGetMyNotices` (não `useListNotices`).

### PATCH /users/:id — permissão por papel (decisão)
Rota agora aceita ADMIN + SUPERVISOR_A + SUPERVISOR_B, mas **supervisores só podem editar `specialization`** (name/email/birthDate continuam ADMIN-only, bloqueados com 403 dentro do handler).
**Why:** o hub de perfil em supervisor/equipe.tsx precisa editar a função do membro; antes a rota era ADMIN-only e dava 403.
**How to apply:** ao adicionar campos editáveis por supervisor, estender a checagem de campos do handler; não relaxar para outros campos sem intenção.

### GET /api/asa/memories
Retorna array direto (NÃO `{ memories: [] }`). Filtrar por status via query param `?status=APPROVED`.

### assembleResumoDodia signature
```typescript
assembleResumoDodia(userId, organizationId, operationId, userRole?)
```
Chamado em 2 lugares: tool handler (ctx.userRole) + REST endpoint (user.role).

## Próximos itens mapeados
- Web-admin: UI de reconhecimentos (listar/criar)
- Web-admin: UI de preferências avançadas (goodMorningTime, goodNightTime, messageFrequency, proactivityLevel)
- Proatividade: morning/evening greeting via cron + push notifications
