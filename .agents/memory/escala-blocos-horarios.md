---
name: Escala — blocos do show com horários propagam para a Escala
description: Como horas por bloco do Livro do Show chegam à Escala via Livro do Dia (read-time)
---

Objetivo: cada bloco do show pode ter hora de início/fim; quem é escalado (Livro do Dia) vê o bloco com a sua hora na Escala, sem montagem manual.

Modelo (durável):
- Hora vive no BLOCO (show_book_blocks e daily_book_blocks têm start_time/end_time, text nullable). Uma pessoa recebe os blocos onde tem assignment (per-position via position.blockId); cada assignment vira uma linha virtual na Escala com a hora do seu bloco.
- A propagação para a Escala é READ-TIME (mesmo padrão da Fase 1): GET /scales/:id/allocations faz leftJoin a daily_book_blocks e gera linhas virtuais. NÃO grava nada.
- Resiliência: se o bloco não tem hora, cai para a hora do EVENTO da agenda (blockStartTime ?? eventStartTime). Label = blockName ?? showTitle ?? eventTitle.
- generate/regenerate do Livro do Dia COPIAM start_time/end_time do show para o daily book (ambos os caminhos de generate). Sem isso, blocos do daily não teriam hora.

**Why:** manter o formato atual (colunas por pessoa com blocos) e prod-safe — colunas aditivas/nuláveis chegam a prod no Publish sem migração drizzle.

**How to apply:**
- Validar HH:MM no backend (isValidBlockTime em show-book.ts) antes de persistir; "" → null.
- UI do editor de blocos (web-admin show-book.tsx) usa estado LOCAL controlado por bloco (não defaultValue/prop stale) e envia PATCH único com start+end atuais, senão um onBlur sobrescreve o outro com valor antigo.
- Interpretação "todos do cast recebem blocos de preparação" (boas-vindas/maquiagem) NÃO foi implementada: a pessoa só recebe blocos onde tem position. Fica para refinamento se a utilizadora pedir.
