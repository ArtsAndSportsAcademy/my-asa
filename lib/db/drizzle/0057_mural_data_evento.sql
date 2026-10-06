-- Mural (desenho 22): aviso pode dizer a data do evento ("qui, 9 out") além da data em que foi publicado.
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "event_date" date;
