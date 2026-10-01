-- Bloco 5: encerramento lógico dos registros operacionais.
-- Nenhuma linha de trabalho é apagada por uma ação da operação. Os defaults
-- preservam os dados já existentes como ativos; regenerações de escala/Livro
-- do Dia continuam sendo a exceção transacional definida no Bloco 1.

ALTER TABLE "show_book_scenes"
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;
ALTER TABLE "show_book_blocks"
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;
ALTER TABLE "show_book_roles"
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;
ALTER TABLE "show_book_lines"
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;

ALTER TABLE "scale_allocations"
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;
ALTER TABLE "allocation_candidates"
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;
ALTER TABLE "allocation_exceptions"
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;

ALTER TABLE "library_categories"
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;
ALTER TABLE "task_evidences"
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "show_book_scenes_active_idx"
  ON "show_book_scenes" ("show_book_id", "active", "order");
CREATE INDEX IF NOT EXISTS "show_book_blocks_active_idx"
  ON "show_book_blocks" ("show_book_id", "active", "order");
CREATE INDEX IF NOT EXISTS "show_book_roles_active_idx"
  ON "show_book_roles" ("show_book_id", "active", "order");
CREATE INDEX IF NOT EXISTS "show_book_lines_active_idx"
  ON "show_book_lines" ("position_id", "active", "order");
CREATE INDEX IF NOT EXISTS "scale_allocations_active_idx"
  ON "scale_allocations" ("scale_id", "active");
CREATE INDEX IF NOT EXISTS "allocation_exceptions_active_idx"
  ON "allocation_exceptions" ("scale_id", "active");
