-- Supervisão que também atua nos shows (23/10/2026). Hoje só quem tem o papel de Elenco aparece nos seletores de personagem e de
-- formação; supervisor que também se apresenta ficava de fora e não dava para escalá-lo. A Administração passa a ligar, no cadastro da
-- pessoa, "Participa dos shows". Aditivo: uma coluna nova, desligada para todo mundo; ninguém muda de comportamento até alguém ligar.
ALTER TABLE users ADD COLUMN participa_dos_shows boolean NOT NULL DEFAULT false;
