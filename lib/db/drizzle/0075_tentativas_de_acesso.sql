-- Limite de tentativas de senha (20/10/2026). Até hoje nada impedia alguém de tentar senhas sem parar no login e na troca de senha.
-- Aditivo: uma tabela nova, sem mexer em nada que existe. Cada chave (login:<usuário> ou troca:<id>) conta os erros; no 8º erro
-- dentro de 15 minutos a chave fica pausada por 15 minutos (bloqueado_ate). Acertar a senha, ou a Administração redefinir, zera.
CREATE TABLE tentativas_de_acesso (
  chave text PRIMARY KEY,
  falhas integer NOT NULL DEFAULT 0 CHECK (falhas >= 0),
  janela_inicio timestamptz NOT NULL DEFAULT now(),
  bloqueado_ate timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE tentativas_de_acesso ENABLE ROW LEVEL SECURITY;
