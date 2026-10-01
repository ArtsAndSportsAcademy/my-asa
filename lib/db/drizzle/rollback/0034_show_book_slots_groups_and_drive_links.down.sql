DROP TABLE IF EXISTS public.show_book_drive_links;
ALTER TABLE public.show_book_blocks DROP COLUMN IF EXISTS zone;
ALTER TABLE public.show_book_blocks DROP COLUMN IF EXISTS prefix;
