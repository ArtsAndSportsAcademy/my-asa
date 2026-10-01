-- Bloco 2: backfill de dados e constraints dependentes.
-- Se houver nome ou vínculo ambíguo, a transação falha com a lista para revisão.

INSERT INTO "locations" ("organization_id", "name")
SELECT DISTINCT
	o."organization_id",
	btrim(location_name.value)
FROM "operations" o
CROSS JOIN LATERAL jsonb_array_elements_text(
	CASE WHEN jsonb_typeof(o."locations") = 'array' THEN o."locations" ELSE '[]'::jsonb END
) AS location_name(value)
WHERE btrim(location_name.value) <> ''
ON CONFLICT ("organization_id", "name") DO NOTHING;

DO $$
DECLARE
	bad_rows text;
BEGIN
	SELECT string_agg(
		sb."id"::text || ' (' || sb."title" || '): ' || coalesce(sb."start_time", '<vazio>') || ' - ' || coalesce(sb."end_time", '<vazio>'),
		'; ' ORDER BY sb."id"::text
	)
	INTO bad_rows
	FROM "show_books" sb
	WHERE (sb."start_time" IS NOT NULL OR sb."end_time" IS NOT NULL)
	AND NOT (
		sb."start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
		AND sb."end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
	);
	IF bad_rows IS NOT NULL THEN
		RAISE EXCEPTION 'Bloco 2 interrompido: horários de show inválidos para Sessao: %', bad_rows;
	END IF;
END $$;

INSERT INTO "sessions" ("show_id", "start_time", "end_time")
SELECT sb."id", sb."start_time"::time, sb."end_time"::time
FROM "show_books" sb
WHERE sb."start_time" IS NOT NULL AND sb."end_time" IS NOT NULL
ON CONFLICT ("show_id", "start_time", "end_time") DO NOTHING;

CREATE TEMP TABLE "block2_character_candidates" ON COMMIT DROP AS
WITH raw_refs AS (
	SELECT
		l."id" AS line_id,
		sb."operation_id" AS operation_id,
		l."type" AS line_type,
		coalesce(nullif(btrim(l."config" ->> 'characterName'), ''), nullif(btrim(l."config" ->> 'characterId'), '')) AS raw_name
	FROM "show_book_lines" l
	JOIN "show_book_roles" r ON r."id" = l."position_id"
	JOIN "show_books" sb ON sb."id" = r."show_book_id"
	WHERE (l."config" ? 'characterName' OR l."config" ? 'characterId')
	  AND coalesce(nullif(btrim(l."config" ->> 'characterName'), ''), nullif(btrim(l."config" ->> 'characterId'), '')) IS NOT NULL
), normalized AS (
	SELECT *, regexp_replace(lower(raw_name), '[^a-z0-9]+', '', 'g') AS normalized_name
	FROM raw_refs
)
SELECT *, CASE normalized_name
	WHEN 'astrid' THEN 'Astrid'
	WHEN 'guardiao' THEN 'Guardião'
	WHEN 'guardio' THEN 'Guardião'
	WHEN 'chocolato' THEN 'Chocolato'
	WHEN 'igno' THEN 'Igno'
	WHEN 'mensageiro' THEN 'Mensageiro'
	WHEN 'mensageira' THEN 'Mensageira'
	WHEN 'rainha' THEN 'Rainha'
	WHEN 'yeti' THEN 'Yeti'
	WHEN 'nanook' THEN 'Nanook'
	ELSE NULL
END AS canonical_name
FROM normalized;

DO $$
DECLARE
	unknown_names text;
BEGIN
	SELECT string_agg(DISTINCT raw_name, ', ' ORDER BY raw_name)
	INTO unknown_names
	FROM "block2_character_candidates"
	WHERE canonical_name IS NULL;
	IF unknown_names IS NOT NULL THEN
		RAISE EXCEPTION 'Bloco 2 interrompido: personagens sem mapeamento: %', unknown_names;
	END IF;
END $$;

DO $$
DECLARE
	ambiguous_locations text;
BEGIN
	WITH location_counts AS (
		SELECT c.canonical_name, c.operation_id, count(DISTINCT loc."id") AS location_count
		FROM "block2_character_candidates" c
		JOIN "operations" o ON o."id" = c.operation_id
		LEFT JOIN LATERAL jsonb_array_elements_text(
			CASE WHEN jsonb_typeof(o."locations") = 'array' THEN o."locations" ELSE '[]'::jsonb END
		) AS location_name(value) ON true
		LEFT JOIN "locations" loc ON loc."organization_id" = o."organization_id" AND loc."name" = btrim(location_name.value)
		GROUP BY c.canonical_name, c.operation_id
	)
	SELECT string_agg(canonical_name || ' na operação ' || operation_id::text || ' (' || location_count::text || ' locais)', '; ' ORDER BY canonical_name)
	INTO ambiguous_locations
	FROM location_counts
	WHERE location_count <> 1;
	IF ambiguous_locations IS NOT NULL THEN
		RAISE EXCEPTION 'Bloco 2 interrompido: local ausente ou ambíguo para personagem: %', ambiguous_locations;
	END IF;
END $$;

INSERT INTO "characters" ("name", "location_id", "mode")
SELECT
	c.canonical_name,
	loc."id",
	CASE WHEN bool_or(c.line_type = 'ROTATION') THEN 'rodizio'::"character_mode" ELSE 'titular'::"character_mode" END
FROM "block2_character_candidates" c
JOIN "operations" o ON o."id" = c.operation_id
CROSS JOIN LATERAL jsonb_array_elements_text(
	CASE WHEN jsonb_typeof(o."locations") = 'array' THEN o."locations" ELSE '[]'::jsonb END
) AS location_name(value)
JOIN "locations" loc ON loc."organization_id" = o."organization_id" AND loc."name" = btrim(location_name.value)
GROUP BY c.canonical_name, loc."id"
ON CONFLICT DO NOTHING;

UPDATE "show_book_lines" l
SET "character_id" = ch."id"
FROM "block2_character_candidates" c
JOIN "show_book_lines" source_line ON source_line."id" = c.line_id
JOIN "show_book_roles" r ON r."id" = source_line."position_id"
JOIN "show_books" sb ON sb."id" = r."show_book_id"
JOIN "operations" o ON o."id" = c.operation_id
CROSS JOIN LATERAL jsonb_array_elements_text(
	CASE WHEN jsonb_typeof(o."locations") = 'array' THEN o."locations" ELSE '[]'::jsonb END
) AS location_name(value)
JOIN "locations" loc ON loc."organization_id" = o."organization_id" AND loc."name" = btrim(location_name.value)
JOIN "characters" ch ON ch."name" = c.canonical_name AND ch."location_id" = loc."id"
WHERE l."id" = source_line."id";

DO $$
DECLARE
	unmapped_lines text;
BEGIN
	SELECT string_agg(line_id::text || ' (' || raw_name || ')', '; ' ORDER BY line_id::text)
	INTO unmapped_lines
	FROM "block2_character_candidates"
	WHERE canonical_name IS NOT NULL
	  AND NOT EXISTS (SELECT 1 FROM "show_book_lines" l WHERE l."id" = line_id AND l."character_id" IS NOT NULL);
	IF unmapped_lines IS NOT NULL THEN
		RAISE EXCEPTION 'Bloco 2 interrompido: linhas sem personagem_id após mapeamento: %', unmapped_lines;
	END IF;
END $$;

-- Migra o elenco dos rodízios e das relações titular/substituto para a entidade própria.
INSERT INTO "character_cast" ("character_id", "person_id", "order", "times_done")
SELECT
	l."character_id",
	member.value::uuid,
	(member.ordinality - 1)::integer,
	coalesce(nullif(l."config" -> 'executionCounts' ->> member.value, '')::integer, 0)
FROM "show_book_lines" l
CROSS JOIN LATERAL jsonb_array_elements_text(
	CASE WHEN jsonb_typeof(l."config" -> 'memberIds') = 'array' THEN l."config" -> 'memberIds' ELSE '[]'::jsonb END
) WITH ORDINALITY AS member(value, ordinality)
WHERE l."character_id" IS NOT NULL
  AND l."type" = 'ROTATION'
ON CONFLICT ("character_id", "person_id") DO UPDATE
SET "order" = LEAST("character_cast"."order", EXCLUDED."order"),
	"times_done" = GREATEST("character_cast"."times_done", EXCLUDED."times_done");

INSERT INTO "character_cast" ("character_id", "person_id", "order", "times_done")
SELECT
	l."character_id",
	people.person_id::uuid,
	people.order_index,
	coalesce(nullif(l."config" -> 'executionCounts' ->> people.person_id, '')::integer, 0)
FROM "show_book_lines" l
CROSS JOIN LATERAL (
	SELECT l."config" ->> 'titularId' AS person_id, 0 AS order_index
	WHERE nullif(l."config" ->> 'titularId', '') IS NOT NULL
	UNION ALL
	SELECT substitute.value AS person_id, substitute.ordinality::integer AS order_index
	FROM jsonb_array_elements_text(
		CASE WHEN jsonb_typeof(l."config" -> 'substituteIds') = 'array' THEN l."config" -> 'substituteIds' ELSE '[]'::jsonb END
	) WITH ORDINALITY AS substitute(value, ordinality)
) people
WHERE l."character_id" IS NOT NULL
  AND l."type" = 'TITULAR_SUBSTITUTE'
ON CONFLICT ("character_id", "person_id") DO UPDATE
SET "order" = LEAST("character_cast"."order", EXCLUDED."order"),
	"times_done" = GREATEST("character_cast"."times_done", EXCLUDED."times_done");

CREATE TEMP TABLE "block2_ledger_candidates" ON COMMIT DROP AS
SELECT
	a."id" AS ledger_id,
	a."source_line_id" AS source_line_id,
	a."legacy_character_key" AS legacy_key,
	CASE
		WHEN a."legacy_character_key" LIKE 'character-name:%' THEN substring(a."legacy_character_key" FROM 16)
		WHEN a."legacy_character_key" LIKE 'character:%' THEN substring(a."legacy_character_key" FROM 11)
		ELSE NULL
	END AS raw_name,
	CASE
		WHEN a."legacy_character_key" LIKE 'character-name:%' THEN regexp_replace(lower(substring(a."legacy_character_key" FROM 16)), '[^a-z0-9]+', '', 'g')
		WHEN a."legacy_character_key" LIKE 'character:%' THEN regexp_replace(lower(substring(a."legacy_character_key" FROM 11)), '[^a-z0-9]+', '', 'g')
		ELSE NULL
	END AS normalized_name
FROM "rotation_daily_advances" a
WHERE a."character_id" IS NULL;

UPDATE "rotation_daily_advances" a
SET "character_id" = l."character_id"
FROM "show_book_lines" l
WHERE a."character_id" IS NULL
  AND a."source_line_id" = l."id"
  AND l."character_id" IS NOT NULL;

UPDATE "rotation_daily_advances" a
SET "character_id" = ch."id"
FROM "block2_ledger_candidates" c
JOIN "characters" ch ON ch."id"::text = c.raw_name
WHERE a."id" = c.ledger_id AND a."character_id" IS NULL;

UPDATE "rotation_daily_advances" a
SET "character_id" = ch."id"
FROM "block2_ledger_candidates" c
JOIN "characters" ch ON ch."name" = CASE c.normalized_name
	WHEN 'astrid' THEN 'Astrid'
	WHEN 'guardiao' THEN 'Guardião'
	WHEN 'guardio' THEN 'Guardião'
	WHEN 'chocolato' THEN 'Chocolato'
	WHEN 'igno' THEN 'Igno'
	WHEN 'mensageiro' THEN 'Mensageiro'
	WHEN 'mensageira' THEN 'Mensageira'
	WHEN 'rainha' THEN 'Rainha'
	WHEN 'yeti' THEN 'Yeti'
	WHEN 'nanook' THEN 'Nanook'
	ELSE NULL
END
WHERE a."id" = c.ledger_id AND a."character_id" IS NULL
	AND (SELECT count(*) FROM "characters" same_name WHERE same_name."name" = ch."name") = 1;

DO $$
DECLARE
	unresolved_ledger text;
BEGIN
	SELECT string_agg(c.ledger_id::text || ' (' || coalesce(c.legacy_key, '<vazio>') || ')', '; ' ORDER BY c.ledger_id::text)
	INTO unresolved_ledger
	FROM "block2_ledger_candidates" c
	JOIN "rotation_daily_advances" a ON a."id" = c.ledger_id
	WHERE a."character_id" IS NULL;
	IF unresolved_ledger IS NOT NULL THEN
		RAISE EXCEPTION 'Bloco 2 interrompido: ledger sem personagem_id após mapeamento: %', unresolved_ledger;
	END IF;
END $$;

ALTER TABLE "show_book_lines"
	ADD CONSTRAINT "show_book_lines_character_id_characters_fk"
	FOREIGN KEY ("character_id") REFERENCES "characters"("id");

ALTER TABLE "show_book_scenes"
	ADD CONSTRAINT "show_book_scenes_formation_id_formations_fk"
	FOREIGN KEY ("formation_id") REFERENCES "formations"("id");

UPDATE "daily_book_assignments" a
SET "scene_id" = s."id"
FROM "daily_book_positions" p
JOIN "daily_book_blocks" b ON b."id" = p."block_id"
JOIN "daily_book_scenes" s ON s."id" = b."scene_id"
WHERE a."position_id" = p."id" AND a."scene_id" IS NULL;

DO $$
DECLARE
	duplicate_people text;
BEGIN
	SELECT string_agg(d."daily_book_id"::text || '/' || d."scene_id"::text || '/' || d."user_id"::text || ' (' || d."total"::text || ')', '; ')
	INTO duplicate_people
	FROM (
		SELECT "daily_book_id", "scene_id", "user_id", count(*) AS total
		FROM "daily_book_assignments"
		WHERE "scene_id" IS NOT NULL AND "user_id" IS NOT NULL AND "status" <> 'REMOVED'
		GROUP BY "daily_book_id", "scene_id", "user_id"
		HAVING count(*) > 1
	) d;
	IF duplicate_people IS NOT NULL THEN
		RAISE EXCEPTION 'Bloco 2 interrompido: pessoa repetida na mesma cena: %', duplicate_people;
	END IF;
END $$;

ALTER TABLE "daily_book_assignments"
	ADD CONSTRAINT "daily_book_assignments_scene_id_daily_book_scenes_fk"
	FOREIGN KEY ("scene_id") REFERENCES "daily_book_scenes"("id");

CREATE UNIQUE INDEX "daily_book_assignments_daily_book_scene_user_uq"
	ON "daily_book_assignments" ("daily_book_id", "scene_id", "user_id")
	WHERE "scene_id" IS NOT NULL AND "user_id" IS NOT NULL AND "status" <> 'REMOVED';

ALTER TABLE "rotation_daily_advances"
	ALTER COLUMN "character_id" SET NOT NULL;

ALTER TABLE "rotation_daily_advances"
	ADD CONSTRAINT "rotation_daily_advances_character_id_characters_fk"
	FOREIGN KEY ("character_id") REFERENCES "characters"("id");

CREATE UNIQUE INDEX "rotation_daily_advances_character_user_date_uq"
	ON "rotation_daily_advances" ("character_id", "user_id", "date");
