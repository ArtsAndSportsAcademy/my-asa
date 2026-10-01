-- Tabelas da 15 Escalas privadas como as demais: RLS ligado e nenhum grant para o Data API.
ALTER TABLE public.programacoes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.programacao_blocos ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.escala_areas_prontas ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.programacoes, public.programacao_blocos, public.escala_areas_prontas FROM PUBLIC, anon, authenticated;