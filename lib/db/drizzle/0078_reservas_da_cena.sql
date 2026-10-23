-- Reservas da cena (23/10/2026). Antes, o substituto era cadastrado bolinha por bolinha: num show de formação (todos "guardiões"),
-- a mesma lista tinha de ser digitada em cada posição. Agora a cena tem UMA lista de reservas, que cobre qualquer posição dela quando
-- o titular não pode (folga, atestado, restrição). Aditivo: uma coluna nova, vazia para todas as cenas; nada muda até alguém montar a lista.
-- Os substitutos que já estão cadastrados nas bolinhas continuam valendo e vêm antes das reservas.
ALTER TABLE show_book_scenes ADD COLUMN reserve_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
