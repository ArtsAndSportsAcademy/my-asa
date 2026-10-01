-- Bloco 2: entidades próprias e colunas de referência.
-- A migração de dados e as FKs dependentes ficam em 0019, depois do backfill.

CREATE TABLE IF NOT EXISTS "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
	"name" text NOT NULL,
	"type" text NOT NULL DEFAULT 'parque',
	"closed" boolean NOT NULL DEFAULT false,
	"closed_reason" text,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "locations_organization_name_uq" UNIQUE ("organization_id", "name")
);

DO $$ BEGIN
	CREATE TYPE "character_mode" AS ENUM ('titular', 'rodizio');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	CREATE TYPE "occurrence_state" AS ENUM ('aberta', 'em_analise', 'resolvida');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"location_id" uuid NOT NULL REFERENCES "locations"("id"),
	"mode" "character_mode" NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "characters_name_location_uq" UNIQUE ("name", "location_id")
);

CREATE TABLE IF NOT EXISTS "character_cast" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"character_id" uuid NOT NULL REFERENCES "characters"("id"),
	"person_id" uuid NOT NULL REFERENCES "users"("id"),
	"order" integer NOT NULL,
	"times_done" integer NOT NULL DEFAULT 0,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "character_cast_character_person_uq" UNIQUE ("character_id", "person_id"),
	CONSTRAINT "character_cast_character_order_uq" UNIQUE ("character_id", "order"),
	CONSTRAINT "character_cast_order_nonnegative_ck" CHECK ("order" >= 0),
	CONSTRAINT "character_cast_times_done_nonnegative_ck" CHECK ("times_done" >= 0)
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"show_id" uuid NOT NULL REFERENCES "show_books"("id"),
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"call_time" time,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "sessions_show_start_end_uq" UNIQUE ("show_id", "start_time", "end_time"),
	CONSTRAINT "sessions_end_after_start_ck" CHECK ("end_time" > "start_time")
);

CREATE TABLE IF NOT EXISTS "formations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"people_count" integer NOT NULL,
	"positions" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"show_id" uuid REFERENCES "show_books"("id"),
	"times_used" integer NOT NULL DEFAULT 0,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "formations_people_count_positive_ck" CHECK ("people_count" > 0),
	CONSTRAINT "formations_times_used_nonnegative_ck" CHECK ("times_used" >= 0)
);

CREATE INDEX IF NOT EXISTS "formations_people_count_idx" ON "formations" ("people_count");

CREATE TABLE IF NOT EXISTS "occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"person_id" uuid NOT NULL REFERENCES "users"("id"),
	"date" date NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"state" "occurrence_state" NOT NULL DEFAULT 'aberta',
	"registered_by" uuid NOT NULL REFERENCES "users"("id"),
	"reason" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "occurrences_reason_nonblank_ck" CHECK (btrim("reason") <> ''),
	CONSTRAINT "occurrences_type_nonblank_ck" CHECK (btrim("type") <> ''),
	CONSTRAINT "occurrences_description_nonblank_ck" CHECK (btrim("description") <> '')
);

-- Referências novas, ainda sem FK para permitir o backfill de 0019.
ALTER TABLE "show_book_lines"
	ADD COLUMN IF NOT EXISTS "character_id" uuid;

ALTER TABLE "show_book_scenes"
	ADD COLUMN IF NOT EXISTS "formation_id" uuid;

ALTER TABLE "daily_book_assignments"
	ADD COLUMN IF NOT EXISTS "scene_id" uuid;

-- O Bloco 1 já tem dados aqui. Preservamos a chave antiga como proveniência e
-- preenchemos a nova coluna UUID em 0019 antes de torná-la NOT NULL/FK.
ALTER TABLE "rotation_daily_advances"
	RENAME COLUMN "character_id" TO "legacy_character_key";

ALTER TABLE "rotation_daily_advances"
	ADD COLUMN "character_id" uuid;

DROP INDEX IF EXISTS "rotation_daily_advances_character_user_date_uq";

-- Regra do ciclo de vida: cada transição de estado exige um novo motivo e
-- somente avança aberta -> em_analise -> resolvida.
CREATE OR REPLACE FUNCTION "validate_occurrence_transition"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'UPDATE' AND NEW."state" IS DISTINCT FROM OLD."state" THEN
		IF NEW."reason" IS NULL OR btrim(NEW."reason") = '' OR NEW."reason" IS NOT DISTINCT FROM OLD."reason" THEN
			RAISE EXCEPTION 'Motivo obrigatório para mudar o estado da ocorrência';
		END IF;
		IF NOT (
			(OLD."state" = 'aberta' AND NEW."state" = 'em_analise') OR
			(OLD."state" = 'em_analise' AND NEW."state" = 'resolvida')
		) THEN
			RAISE EXCEPTION 'Transição de ocorrência inválida: % -> %', OLD."state", NEW."state";
		END IF;
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "occurrences_state_transition_trg" ON "occurrences";
CREATE TRIGGER "occurrences_state_transition_trg"
BEFORE UPDATE ON "occurrences"
FOR EACH ROW EXECUTE FUNCTION "validate_occurrence_transition"();
