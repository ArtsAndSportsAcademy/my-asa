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

## Próximos itens mapeados (Sprint 02C+)
- Painel de memórias no web-admin (aprovação/rejeição de pendentes)
- Proatividade: morning/evening greeting via cron + push notifications
- Resumo do Dia: infraestrutura preparada no system prompt (bom dia / boa noite)
