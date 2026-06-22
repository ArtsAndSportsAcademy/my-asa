---
name: ASA — data atual deve ser injetada no system prompt
description: sem a data de hoje, o modelo assume um ano padrão e grava folgas/tarefas/avisos no ano errado, somindo das tabelas
---

O system prompt da ASA (buildSystemPrompt em artifacts/api-server/src/routes/asa.ts) DEVE conter a data de hoje. Sem isso, o modelo escolhe um ano padrão (observado: 2025) ao interpretar "dia 3 de junho" e grava as datas nesse ano errado. As entradas existem no banco mas não aparecem na tabela do ano corrente (ex.: folgas de um membro gravadas em 2025-06-* enquanto a UI mostrava Junho/2026).

**Correção:** injetar `Hoje é <data BR> (<YYYY-MM-DD>)` no prompt (fuso America/Sao_Paulo) e instruir: datas sem ano → usar o ANO ATUAL; nunca gravar anos passados; formato YYYY-MM-DD.

**Why:** é sistêmico — afeta TODA ação datada (folgas, tarefas, avisos, escalas, trocas), não só folgas.

**How to apply:** qualquer recurso de IA que grave datas a partir de linguagem natural precisa receber a data atual no contexto; nunca confiar no "ano padrão" do modelo. Calcular no fuso do cliente (Brasil) para não errar perto da meia-noite.
