-- Desfaz a opção "Participa dos shows" do cadastro.
-- O que se perde: quem estava marcado como supervisor que atua nos shows deixa de aparecer nos seletores de personagem e formação
-- (os personagens, filas e formações já gravados com essas pessoas continuam como estão). Rode ANTES de voltar o código para uma versão
-- sem a opção, ou a lista de pessoas falha ao ler a coluna.
ALTER TABLE users DROP COLUMN IF EXISTS participa_dos_shows;
