---
name: Folga type enum (web-admin/API)
description: Valores canônicos do enum de tipo de folga — não usar os nomes intuitivos em português
---

Ao criar/registrar uma folga (`useCreateFolga`, `CreateFolgaRequest.type`), os valores válidos do enum são:
`DAY_OFF` (Folga), `NO_SHOW` (No-show), `RECESSO`, `AFASTAMENTO`, `RESTRICAO`, `OUTRO`.

**Why:** os nomes intuitivos em PT (`FOLGA`, `FERIAS`) NÃO existem no contrato; enviá-los causa erro de enum no backend/DB (500). Padrão idêntico ao de `tasks-status-enum.md` e `notice-type-enum.md`.

**How to apply:** copiar os valores/labels de `artifacts/web-admin/src/pages/admin/folgas.tsx` (TYPE_LABELS) ou de `CreateFolgaRequestType` em `lib/api-client-react/src/generated/api.schemas.ts`. Default razoável: `DAY_OFF`.
