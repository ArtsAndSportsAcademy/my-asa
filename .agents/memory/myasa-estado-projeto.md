---
name: MyASA 2.0 — Estado do Projeto
description: Resumo do que foi construído por sprint no projeto MyASA 2.0
---

## Sprint concluídas

### PILOT-NAV-FOLGAS-FIX-01
- Módulo Folgas completo: DB (folgas + delegations), API CRUD, web-admin (grid + modal), mobile (Meu Dia), ASA tools (consultar_folgas, consultar_ausencias_do_dia, consultar_disponibilidade)

### ESCALAS-MANUAL-ENTRY-D01
- DB migration: agenda_event_id nullable + manual_date/manual_label/start_time/end_time/notes/overridden_by/override_reason
- API: POST /scales/:id/entries, DELETE /scales/:id/entries/:entryId
- Web-admin: OperationalDayView + AddEntryModal
- Hooks manuais: useCreateScaleEntry, useDeleteScaleEntry

### ASA-SPRINT-02A — Operação por Linguagem Natural
- Tool consultar_membros: fuzzy matching em todos os membros da org, resolução de apelidos via memories APPROVED, desambiguação
- Tool criar_entrada_escala: encontra escala ativa cobrindo a data, verifica folga, insere em scaleAllocationsTable com MANUAL_OVERRIDE
- Tool criar_tarefa: cria em tasksTable com origin="AI", requiresApproval=true
- System prompt: fluxo obrigatório (consultar_membros → confirmar → criar), exemplos de linguagem natural
- Mobile TOOL_LABELS: adicionados labels para todas as tools (consultar_folgas, ausencias, disponibilidade, consultar_membros, criar_entrada_escala, criar_tarefa)
- Mobile SUGGESTIONS: "Quem está de folga hoje?", "Adicionar [nome] na escala amanhã.", "Criar tarefa para [nome] até sexta."

## Próximos itens mapeados (Sprint 02B+)
- Memórias aprovadas injetadas no system prompt automaticamente
- Painel de memórias no web-admin (aprovação/rejeição)
- Personalidade aprimorada (emojis, mais humanidade)
- consultar_biblioteca tool
- Proatividade (morning/evening greeting via cron + push)
