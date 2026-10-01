-- Pessoa tem um nome formal e um nome de exibição. A coluna `name` anterior
-- era formal; depois desta migração, toda leitura comum usa nome_de_exibicao.
ALTER TABLE public.users RENAME COLUMN name TO nome_completo;
--> statement-breakpoint
ALTER TABLE public.users ADD COLUMN nome_de_exibicao text;
--> statement-breakpoint
UPDATE public.users
SET nome_de_exibicao = split_part(btrim(nome_completo), ' ', 1)
WHERE nome_de_exibicao IS NULL OR btrim(nome_de_exibicao) = '';
--> statement-breakpoint
ALTER TABLE public.users ALTER COLUMN nome_de_exibicao SET NOT NULL;
--> statement-breakpoint
-- O default e o trigger só preservam a compatibilidade de inserções legadas
-- feitas diretamente por fixtures. As rotas exigem nome_completo explicitamente.
ALTER TABLE public.users ALTER COLUMN nome_completo SET DEFAULT '';
--> statement-breakpoint
ALTER TABLE public.users
  ADD CONSTRAINT users_names_not_blank
  CHECK (btrim(nome_completo) <> '' AND btrim(nome_de_exibicao) <> '');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.myasa_fill_user_names()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF btrim(COALESCE(NEW.nome_de_exibicao, '')) = '' THEN
    NEW.nome_de_exibicao := split_part(btrim(COALESCE(NEW.nome_completo, '')), ' ', 1);
  END IF;
  IF btrim(COALESCE(NEW.nome_completo, '')) = '' THEN
    NEW.nome_completo := NEW.nome_de_exibicao;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER myasa_fill_user_names_before_write
BEFORE INSERT OR UPDATE OF nome_completo, nome_de_exibicao ON public.users
FOR EACH ROW EXECUTE FUNCTION public.myasa_fill_user_names();
