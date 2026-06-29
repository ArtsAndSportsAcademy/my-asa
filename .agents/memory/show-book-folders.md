---
name: Livro do Show — vista agregada por operação
description: GET /show-books sem operationId devolve todos os livros visíveis; usar para vistas que agrupam por operação sem N chamadas
---

# Livro do Show — listagem agregada por operação

`GET /show-books` aceita `operationId` opcional. **Sem** `operationId` devolve
TODOS os livros visíveis da organização, já filtrados por `canViewShowBook` por
ator no servidor (escopo multi-tenant garantido no backend).

**Why:** para vistas que precisam de mostrar livros de várias operações ao mesmo
tempo (ex.: pastas por operação na web-admin), evita-se fazer N chamadas (uma por
operação). O `operationId` já vem em cada `ShowBook` (tabela + schema OpenAPI), e
os nomes das operações vêm de `useGetOperations` (admin recebe todas as ops da org).

**How to apply:** no cliente, `useListShowBooks(undefined, ...)` + agrupar por
`book.operationId`. Para o seletor de responsável, usar `selectedBook.operationId`
(NÃO uma operação global do dropdown) senão filtra os supervisores pela operação
errada. Criar livro exige escolher a operação explicitamente (admin=todas;
não-admin=operações geridas).
