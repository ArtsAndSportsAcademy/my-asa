---
name: MyASA 2.0 — Estado do Projeto
description: Contexto acumulado, decisões e fase atual do produto MyASA 2.0
---

## Produto
MyASA 2.0 — plataforma operacional para operações artísticas, shows e equipes.
Comunicação e documentação em Português Brasileiro.

## Fase atual
**Sprint 0 CONCLUÍDO** — ambiente técnico pronto. Próxima fase: Sprint 1 (autenticação + estrutura base).

## Documentos base
- docs/arquitetura-myasa-2.0.md
- docs/ux-diretrizes-obrigatorias.md
- docs/ux-pesquisa-supervisor.md
- docs/ux-pesquisa-membro.md
- docs/ux-pesquisa-admin.md
- docs/jornadas-myasa-2.0.md
- docs/ux-superficies-myasa-2.0.md
- docs/auditoria-consistencia-final.md
- docs/arquitetura-navegacao-myasa-2.0.md

## Decisões críticas tomadas
- 3 produtos distintos com dados compartilhados (Membro / Supervisor / Admin)
- Cada produto tem nav separada — nunca a mesma estrutura
- Folgas e Restrições NÃO são superfícies — embutidas em Solicitações e Perfil
- Inbox Unificado NÃO é superfície no MVP
- S-16 + S-17 fundidas em "Administração" na nav do Admin
- S-13 (Livro do Show) é sub-seção de Administração no MVP
- IA embarcada nas superfícies centrais — não aba isolada
- Alteração Operacional Persistente: 4º comportamento de notificação (estado, não evento)

## Nav permanente por perfil
- Membro: [ Meu Dia ] [ Solicitações ] [ Entregas ] [ Mensagens ]
- Supervisor: [ Painel ] [ Escala ] [ Solicitações ] [ Mensagens ]
- Admin: [ Painel de Saúde ] [ Histórico ] [ Avisos ] [ Administração ]

## Ordem de design de interface (16 superfícies, 5 blocos)
- Bloco 1: S-01 Meu Dia, S-02 Painel Operacional, S-04 Escala
- Bloco 2: S-05 Livro do Dia, S-08+S-09 Avisos+Mensagens, S-06 Solicitações
- Bloco 3: S-10 IA embarcada (junto com Bloco 1 e 2)
- Bloco 4: S-03 Painel de Saúde, S-07 Entregas, S-11 Histórico, S-12 Agenda
- Bloco 5: S-15 Equipes/Grupos, S-16+S-17 Administração, S-13 Livro do Show, S-14 Biblioteca, S-10 IA chat

## Identidade visual
- iOS-inspired, modo claro, glassmorphism leve, bordas arredondadas, espaço branco
- Logo: asa gradiente roxo→azul em docs/myasa-asa-logo.png
- PROIBIDO: fundo escuro dentro da interface, estética ERP/RH

## Why
Decisões acima são baseadas em pesquisa com os 3 perfis + 20 jornadas + auditoria de consistência. Não alterar sem evidência equivalente.
