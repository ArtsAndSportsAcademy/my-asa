-- Cor padrão do grupo de slots. Ajustes individuais permanecem em
-- show_book_roles.position_json.markerColor, junto da posição do slot.
ALTER TABLE public.show_book_blocks
  ADD COLUMN IF NOT EXISTS color text;
