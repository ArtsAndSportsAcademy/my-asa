---
name: tasksTable.status enum values
description: Valid status values for tasksTable — "DONE" does not exist
---

## Rule
`tasksTable.status` does NOT include `"DONE"`. The completed state is `"COMPLETED"`.

Valid enum values: `"EXPIRED" | "CANCELLED" | "COMPLETED" | "APPROVED" | "CREATED" | "IN_PROGRESS" | "READY_FOR_APPROVAL" | "CHANGES_REQUESTED"`

**Why:** Drizzle `eq(tasksTable.status, "DONE")` throws TS2769 "No overload matches" because "DONE" is not in the enum union. The error message from TypeScript reveals the full enum.

**How to apply:** Whenever querying completed tasks, use `eq(tasksTable.status, "COMPLETED")` not `"DONE"`. Same for `inArray(tasksTable.status, [...])` — use "COMPLETED".
