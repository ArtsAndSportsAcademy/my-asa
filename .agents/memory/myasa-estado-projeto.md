---
name: MyASA 2.0 — Estado do Projeto
description: Estado atual do produto, fases concluídas e próximas etapas
---

# Fases concluídas
- RESPONSIBILITIES-D01: schema, API, web admin, mobile, meu-dia integration ✅
- AI-D01 audit document: `docs/specs/AI-D01-audit.md` ✅
- ASA-FOUNDATION-D01: Fundação da ASA inteligente ✅

# ASA-FOUNDATION-D01 — Entregáveis
- DB: conversations, ai_messages, asa_memories, asa_user_preferences, asa_audit_log
- API routes: /api/anthropic/conversations (CRUD) + /api/asa/chat/:id/messages (SSE) + memories + preferences + audit
- Web Admin: /admin/asa — página de chat SSE com streaming
- Mobile: /(tabs)/asa — tela de chat com SSE
- Model: claude-sonnet-4-6 via Replit AI Integrations (Anthropic)
- Tools: consultar_agenda, escalas, responsabilidades, notificacoes, avisos, tarefas, memorias, criar_aviso_rascunho, criar_ensaio_rascunho, sugerir_memoria

# Fixes críticos documentados
- requireAuth/requireOrganization vem de `../middlewares/auth.js` (NÃO de auth.service.ts)
- noticesTable usa operationId (não organizationId) e authorId (não createdBy)
- noticeUrgencyEnum: INFORMATIVE | IMPORTANT | CRITICAL
- agendaVisibilityEnum: OPERATION | MANAGEMENT
- Drizzle where condicional: usar array de conditions + and(...conditions)

# Demo users
- admin@myasa.demo (ADMIN bb7a31b8) / Teste@123
- supervisor@myasa.demo (SUPERVISOR_A b1aa11f9) / Teste@123
- membro01@myasa.demo (MEMBER b2193dd3) / Teste@123

# DB connection
psql "postgresql://postgres:password@helium/heliumdb?sslmode=disable"
drizzle-kit push SEMPRE falha sem TTY — usar psql

# Próxima fase sugerida
- Design da interface (UX refinement da tela ASA)
- Sistema de memórias com aprovação via web admin
- Testes de ponta a ponta do chat com ferramentas reais
