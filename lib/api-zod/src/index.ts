export * from "./generated/types";
export * from "./generated/api";

// Disambiguate names that orval emits both as a zod schema (value, in `api.ts`)
// and as a TypeScript type (in `generated/types`). Explicit re-exports take
// precedence over the wildcard `export *` above, resolving TS2308. This lives in
// the hand-maintained entry file, so it survives codegen (orval only cleans `generated/`).
export {
  AddTaskCommentBody,
  CancelTaskBody,
  RequestTaskChangesBody,
  UpdateOperationSetupReviewBody,
} from "./generated/api";
