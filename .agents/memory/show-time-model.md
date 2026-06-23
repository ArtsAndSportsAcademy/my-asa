---
name: Horário único por show (não por bloco)
description: Onde vive a hora do show e como propaga para a escala
---

O horário do Livro do Show é ÚNICO para o show inteiro (não por bloco).

- A hora vive em `showBooksTable.startTime/endTime` (text nullable, aditivo prod-safe).
- A UI do construtor (admin/show-book.tsx) tem UM editor de hora no cabeçalho do show; NÃO há mais inputs de hora por bloco.
- Na escala, o cast do Livro do Dia mostra o NOME DO SHOW (não o nome do bloco) e a hora do show, com prioridade `showStartTime ?? blockStartTime ?? eventStartTime` (o fallback ao bloco mantém compat com Livros do Dia gerados antes da mudança).

**Why:** a utilizadora (diretora) achava repetitivo definir a mesma hora em cada bloco; pediu uma só hora para o show e que a escala mostrasse só o nome do show.

**How to apply:** ao mexer em horário de show/escala, ler a hora do show (showBooksTable), não a do bloco. As colunas de hora de `show_book_blocks`/`daily_book_blocks` ainda existem (legado) mas só são fallback. my-day/painel/check-ins usam a hora do EVENTO (agenda), não do bloco — não dependem disto.
