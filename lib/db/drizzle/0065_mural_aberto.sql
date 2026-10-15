-- Mural aberto (14/10): o Elenco também publica no Mural, e o que foi publicado pode ser editado,
-- derrubado e trazido de volta. Quatro mudanças pequenas e uma tabela:
--   * tipo POST: publicação do Elenco (e de quem quiser). Diferente de NOTICE, que é o aviso oficial
--     da gestão — pede ciente, fica no topo e toca o sino. POST não pede ciente e só avisa quem foi
--     marcado ou o público de destino (a casa inteira não recebe push de publicação).
--   * edited_at: aparece "editado" no cartão quando o texto muda depois de publicado.
--   * removed_by: quem derrubou. O autor pode desfazer a própria remoção; a Administração e a
--     Direção, qualquer uma. A remoção em si já era lógica (cancelled_at + cancellation_reason).
--   * destination_label: quando o destino é uma mistura (áreas + locais + pessoas), as pessoas são
--     gravadas em announcement_recipients no momento da publicação e este texto diz, no cartão,
--     para quem foi ("Patinadores e Bailarinos"). Destino simples (casa, uma área, um local) continua
--     dinâmico e não usa este campo.
--   * mural_datas_especiais: datas que se repetem todo ano (Dia do Teatro, Dia da Dança…), cadastradas
--     pela Administração/Direção. O Mural mostra a data na semana e no dia, sem criar publicação.
-- O valor novo do enum só é usado depois desta migração (o Postgres não deixa usar na mesma transação).
ALTER TYPE announcement_type ADD VALUE IF NOT EXISTS 'POST';
--> statement-breakpoint
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES users(id);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS destination_label text;
--> statement-breakpoint
CREATE TABLE mural_datas_especiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 80),
  mensagem text CHECK (mensagem IS NULL OR length(mensagem) <= 280),
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  dia integer NOT NULL CHECK (dia BETWEEN 1 AND 31),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE mural_datas_especiais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mural_datas_especiais FROM anon, authenticated, PUBLIC;
CREATE INDEX mural_datas_especiais_org_idx ON mural_datas_especiais(org_id) WHERE active;
