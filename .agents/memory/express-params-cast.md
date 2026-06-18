---
name: Express params cast pattern
description: req.params.id é tipado como string|string[] no Express; Drizzle eq() requer string
---

## Regra
Em todo route handler do Express que usa `req.params.*` com Drizzle ORM, sempre declarar uma constante com cast explícito no início do handler:

```typescript
const id = req.params.id as string;
const userId = req.params.userId as string;
const roleId = req.params.roleId as string;
```

## Por quê
Os tipos do Express (@types/express) definem `req.params` como `ParamsDictionary` onde cada valor é `string | string[]`. O Drizzle `eq()` aceita apenas `string | SQLWrapper`, gerando erro TS2769 em todos os usos diretos de `req.params.id` com Drizzle.

## Como aplicar
- Em qualquer novo route handler com parâmetros de path
- Substituir todas as ocorrências diretas de `req.params.xxx` em chamadas Drizzle pelo cast local
- O cast `as string` é seguro porque Express garante que path params são sempre string simples
