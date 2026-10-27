-- Chamadas da Escala (27/10/2026). Um show (ou uma atividade) pode ter várias chamadas: "Aquecimento 13:00", "Call do show 13:45", depois o
-- show às 14:00. Até aqui cada sessão do show guardava UM horário de chamada, só para exibir na tela do show. Agora a chamada tem nome, horário
-- (fixo ou "X minutos antes" do início), duração, se ocupa tempo (gera choque) ou só informa, e se entra no aviso de convocação. Quem vai são as
-- pessoas da atividade a que ela pertence (o Livro do Dia, no caso do show): não se guarda aqui.
--   A chamada pertence a UMA dona: uma sessão do show, um bloco da Programação, ou uma atividade só de um dia (Escala do dia + chave do bloco).
--   Nunca se apaga: active = false tira a chamada, e dá para voltar.
-- Os horários de chamada que já existem (sessions.call_time) viram a primeira chamada de cada sessão, chamada "Chamada", FIXA e SÓ INFORMA
-- (não ocupa tempo): assim nada que já existe passa a gerar choque de repente. A coluna antiga continua onde está, sem uso novo.
-- Aditivo: uma tabela nova e as cópias. Nada que existe é tocado.
CREATE TABLE escala_chamadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  session_id uuid REFERENCES sessions(id),
  programacao_bloco_id uuid REFERENCES programacao_blocos(id),
  scale_id uuid REFERENCES scales(id) ON DELETE CASCADE,
  bloco_key text,
  nome text NOT NULL,
  modo text NOT NULL,
  hora_fixa time,
  minutos_antes integer,
  duracao_min integer NOT NULL DEFAULT 15,
  ocupa_tempo boolean NOT NULL DEFAULT true,
  avisar boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT escala_chamadas_modo_ck CHECK (modo IN ('fixo','antes')),
  CONSTRAINT escala_chamadas_horario_ck CHECK ((modo = 'fixo' AND hora_fixa IS NOT NULL) OR (modo = 'antes' AND minutos_antes BETWEEN 1 AND 600)),
  CONSTRAINT escala_chamadas_duracao_ck CHECK (duracao_min BETWEEN 5 AND 240),
  CONSTRAINT escala_chamadas_dona_ck CHECK ((CASE WHEN session_id IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN programacao_bloco_id IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN scale_id IS NOT NULL AND bloco_key IS NOT NULL THEN 1 ELSE 0 END) = 1)
);
--> statement-breakpoint
CREATE INDEX escala_chamadas_sessao_idx ON escala_chamadas (session_id) WHERE session_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX escala_chamadas_bloco_idx ON escala_chamadas (programacao_bloco_id) WHERE programacao_bloco_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX escala_chamadas_escala_idx ON escala_chamadas (scale_id) WHERE scale_id IS NOT NULL;
--> statement-breakpoint
ALTER TABLE escala_chamadas ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
INSERT INTO escala_chamadas (organization_id, session_id, nome, modo, hora_fixa, duracao_min, ocupa_tempo, avisar, ordem, active)
SELECT o.organization_id, s.id, 'Chamada', 'fixo', s.call_time,
  CASE WHEN s.call_time < s.start_time THEN GREATEST(5, LEAST(240, (EXTRACT(EPOCH FROM (s.start_time - s.call_time)) / 60)::integer)) ELSE 15 END,
  false, true, 1, s.active
FROM sessions s
JOIN show_books b ON b.id = s.show_id
JOIN operations o ON o.id = b.operation_id
WHERE s.call_time IS NOT NULL;
