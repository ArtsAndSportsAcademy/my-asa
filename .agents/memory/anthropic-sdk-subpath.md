---
name: Anthropic SDK subpath import in pnpm
description: @anthropic-ai/sdk subpath imports don't resolve via pnpm symlinks — use local types
---

## Rule
Do NOT import from `@anthropic-ai/sdk/resources/messages` or `@anthropic-ai/sdk/resources/messages/messages` — these paths fail with TS2307 "Cannot find module" even though the files exist in the pnpm store.

**Why:** pnpm installs packages in a virtual store (`.pnpm/`) and creates symlinks at `node_modules/@anthropic-ai/sdk`. The symlink exposes the package root but NOT subdirectories for subpath imports. The package.json `exports` map has `./resources/*` but without a `"types"` key in the export entry, TypeScript can't resolve the `.d.ts`.

**How to apply:** Declare types locally with `content: any` (compatible via structural typing):
```ts
type MessageParam = { role: "user" | "assistant"; content: any };
type Tool = { name: string; description?: string; input_schema: any };
```
This is structurally assignable to the SDK's actual types in `anthropic.messages.create()`.
