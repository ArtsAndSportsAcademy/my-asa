DROP TRIGGER IF EXISTS myasa_fill_user_names_before_write ON public.users;
DROP FUNCTION IF EXISTS public.myasa_fill_user_names();
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_names_not_blank;
ALTER TABLE public.users ALTER COLUMN nome_completo DROP DEFAULT;
ALTER TABLE public.users DROP COLUMN IF EXISTS nome_de_exibicao;
ALTER TABLE public.users RENAME COLUMN nome_completo TO name;
