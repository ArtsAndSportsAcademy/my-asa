-- Renovação de sessão com tolerância: o app pode fechar no instante em que o servidor troca o token
-- (o servidor trocou, o aparelho não guardou o novo). Por 30 segundos, o token recém-trocado ainda
-- renova. rotated_at marca troca por renovação; revogação por Sair, encerrar sessões, senha
-- redefinida ou desligamento continua com rotated_at nulo e nunca tem tolerância.
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS rotated_at timestamptz;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS replaced_by uuid;
