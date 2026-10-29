-- Chamada de bloco de show passa a ser da sessão do show (29/10/2026). Até aqui uma chamada digitada na Programação, no bloco de um show
-- ("Livro manda"), ficava presa ao bloco, e a tela do show só lê as chamadas das sessões: eram dois cadastros, e quem digitava de um lado não via do outro.
-- Agora a dona é a sessão do show que começa na mesma hora do bloco. Esta migração traz para a sessão o que já foi digitado nos blocos de show.
--   Só entra em sessão que ainda não tem chamada ativa (nunca duplica nem sobrescreve o que já está na sessão).
--   Se o mesmo horário se repete em vários dias da semana (mesmas chamadas em cinco blocos), vira UMA chamada só na sessão.
--   As chamadas antigas do bloco ficam onde estão, sem exclusão; o código passa a ignorá-las nos blocos de show.
-- Aditivo: só insere linhas novas.
INSERT INTO escala_chamadas (organization_id, created_by, session_id, nome, modo, hora_fixa, minutos_antes, duracao_min, ocupa_tempo, avisar, ordem)
SELECT DISTINCT ON (s.id, c.nome, c.modo, c.hora_fixa, c.minutos_antes)
  c.organization_id, c.created_by, s.id, c.nome, c.modo, c.hora_fixa, c.minutos_antes, c.duracao_min, c.ocupa_tempo, c.avisar, c.ordem
FROM escala_chamadas c
JOIN programacao_blocos b ON b.id = c.programacao_bloco_id AND b.regra = 'livro' AND b.show_book_id IS NOT NULL AND b.active
JOIN sessions s ON s.show_id = b.show_book_id AND s.active AND s.start_time = b.inicio
WHERE c.active
  AND NOT EXISTS (SELECT 1 FROM escala_chamadas x WHERE x.session_id = s.id AND x.active)
ORDER BY s.id, c.nome, c.modo, c.hora_fixa, c.minutos_antes, c.created_at;
