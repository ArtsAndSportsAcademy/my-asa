---
name: Drizzle and() + ctx property TypeScript narrowing
description: ctx.operationId/organizationId not narrowed by TS; and() returns SQL|undefined — fix patterns
---

## Rule 1: ctx property narrowing
TypeScript does NOT narrow object property types through control flow. After `if (!ctx.operationId) return`, TypeScript still sees `ctx.operationId` as `string | undefined`.

**Fix:** Use `ctx.operationId!` and `ctx.organizationId!` inside `eq()` calls when a guard already verified the value exists.

```ts
// WRONG — TS2769 because eq() for notNull column rejects string|undefined
eq(tasksTable.organizationId, ctx.organizationId)

// CORRECT
eq(tasksTable.organizationId, ctx.organizationId!)
```

## Rule 2: and() returns SQL|undefined
Drizzle's `and(...args)` returns `SQL<unknown> | undefined`. The `.where()` method has strict overloads that don't always accept `undefined`.

**Fix:** Use `!` assertion on `and()` result INSIDE `.where()`:
```ts
// CORRECT: ! on and() result, inside .where()
.where(and(eq(...), eq(...))!)

// WRONG: ! on .where() result (doesn't fix the argument type)
.where(and(eq(...), eq(...)))!

// ALSO CORRECT: assign to variable then assert
const myFilter = and(...)
.where(myFilter!)
```

**Why:** TS2769 "No overload matches this call" on `.where()` when `and()` returns `SQL | undefined`.
