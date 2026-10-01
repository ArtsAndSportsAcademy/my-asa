-- Nada é apagado fisicamente.
-- Livro do Dia: ao regenerar o rascunho, as linhas da geração anterior ficam
-- preservadas e marcadas como substituídas (além de is_removed / REMOVED).
-- `superseded_at` distingue "substituída pela regeneração" (não restaurável)
-- de "removida pela Supervisão" (restaurável pelas rotas de restore).
ALTER TABLE public.daily_book_scenes ADD COLUMN IF NOT EXISTS superseded_at timestamptz;
ALTER TABLE public.daily_book_blocks ADD COLUMN IF NOT EXISTS superseded_at timestamptz;
ALTER TABLE public.daily_book_positions ADD COLUMN IF NOT EXISTS superseded_at timestamptz;
ALTER TABLE public.daily_book_assignments ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

-- Tags e referências da Biblioteca passam a ser desativadas em vez de apagadas.
ALTER TABLE public.show_book_tags
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.user_tags
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.show_book_position_library_refs
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
