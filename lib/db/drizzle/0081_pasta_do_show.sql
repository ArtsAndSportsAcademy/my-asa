-- Pastas livres para organizar os shows dentro de cada local (24/10/2026). Depois do Natal, o Snowland passou a ter onze shows na mesma
-- lista, e o nome "NATAL" escrito no título era a única separação. Agora cada show pode ter uma pasta com nome livre ("Natal 2026").
-- Aditivo e anulável: show sem pasta continua existindo e aparece em "Sem pasta". Nada que existe é tocado.
ALTER TABLE show_books ADD COLUMN folder text;
