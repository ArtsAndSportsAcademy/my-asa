-- Desfaz o Mural aberto. Some a tabela de datas especiais e as três colunas novas (a marca "editado",
-- quem derrubou e o texto do destino misto). O valor POST do enum NÃO sai: o Postgres não remove
-- valor de enum. As publicações POST já feitas continuam na tabela, visíveis e legíveis; o app
-- anterior só não conhece o rótulo e as mostra como "POST". Se for preciso escondê-las, é melhor
-- derrubá-las pelo próprio Mural (remoção lógica, com motivo) do que apagar aqui.
DROP TABLE IF EXISTS mural_datas_especiais;
ALTER TABLE announcements DROP COLUMN IF EXISTS destination_label;
ALTER TABLE announcements DROP COLUMN IF EXISTS removed_by;
ALTER TABLE announcements DROP COLUMN IF EXISTS edited_at;
