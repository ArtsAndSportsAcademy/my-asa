-- 28 Perfil: o que a própria pessoa decide sobre si, e as regras da casa que a Administração define.
-- privacidade: telefone e e-mail em três níveis (gestao | grupo | asa); aniversário (off | lista | mural).
-- silencio: janela noturna da pessoa; NULL = segue o silêncio da casa (organizations.regras.silencio).
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacidade jsonb NOT NULL
  DEFAULT '{"tel":"grupo","mail":"gestao","bday":"mural"}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS silencio jsonb;

-- Quem já tinha escolhido "só a gestão" no contato continua assim; quem deixava os colegas verem vira "meu grupo".
UPDATE users SET privacidade = jsonb_build_object(
  'tel', CASE WHEN (contact_visibility->>'phone') = 'false' THEN 'gestao' ELSE 'grupo' END,
  'mail', CASE WHEN (contact_visibility->>'email') = 'false' THEN 'gestao' ELSE 'grupo' END,
  'bday', 'mural'
);

-- Regras da casa: silêncio noturno padrão e antecedência do lembrete de check-in.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS regras jsonb NOT NULL
  DEFAULT '{"silencio":{"on":true,"de":"22:00","ate":"06:00"},"lembreteCheckinMin":30}'::jsonb;

-- Foto de perfil: fica no Postgres, servida só pela API autenticada. Trocar desativa a anterior.
CREATE TABLE IF NOT EXISTS user_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  org_id uuid NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 1048576),
  content bytea NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_photos_user_active_idx ON user_photos(user_id, active);

ALTER TABLE user_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE user_photos FROM anon, authenticated, PUBLIC;
