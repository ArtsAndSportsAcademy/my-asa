-- Pedidos às responsabilidades e lista fixa com repetição (16/10/2026). Tudo aditivo.
--   * responsibility_requests: alguém pede algo escolhendo a responsabilidade ("Perucas"), sem saber quem cuida dela.
--     O pedido vai para quem cuida; quem aceita primeiro fica com ele e o pedido vira uma tarefa (task_id).
--   * responsibility_request_recipients: quem recebeu o pedido, e quem recusou (com o motivo).
--   * responsibility_routines: a lista fixa de uma responsabilidade (o que se faz sempre). Cada item repete, ou não,
--     do jeito que quem cuida dele escolher: nunca, todo dia, toda semana, todo mês, ou a cada N dias.
CREATE TABLE responsibility_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  responsibility_id uuid NOT NULL REFERENCES responsibilities(id),
  requester_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL CHECK (btrim(title) <> ''),
  details text,
  due_date date,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
  accepted_by_id uuid REFERENCES users(id),
  accepted_at timestamptz,
  task_id uuid REFERENCES tasks(id),
  sem_dono boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX responsibility_requests_resp_open_idx ON responsibility_requests (responsibility_id) WHERE status = 'OPEN';
--> statement-breakpoint
ALTER TABLE responsibility_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE responsibility_requests FROM anon, authenticated, PUBLIC;
--> statement-breakpoint
CREATE TABLE responsibility_request_recipients (
  request_id uuid NOT NULL REFERENCES responsibility_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  declined_at timestamptz,
  decline_reason text,
  PRIMARY KEY (request_id, user_id)
);
--> statement-breakpoint
CREATE INDEX responsibility_request_recipients_user_idx ON responsibility_request_recipients (user_id);
--> statement-breakpoint
ALTER TABLE responsibility_request_recipients ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE responsibility_request_recipients FROM anon, authenticated, PUBLIC;
--> statement-breakpoint
CREATE TABLE responsibility_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  responsibility_id uuid NOT NULL REFERENCES responsibilities(id),
  title text NOT NULL CHECK (btrim(title) <> ''),
  owner_id uuid NOT NULL REFERENCES users(id),
  repeat_kind text NOT NULL DEFAULT 'NONE' CHECK (repeat_kind IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'EVERY_N_DAYS')),
  repeat_n integer CHECK (repeat_n IS NULL OR repeat_n BETWEEN 1 AND 365),
  weekday integer CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  done boolean NOT NULL DEFAULT false,
  last_done_at timestamptz,
  next_due_on date,
  active boolean NOT NULL DEFAULT true,
  removed_reason text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT responsibility_routines_n_ck CHECK (repeat_kind <> 'EVERY_N_DAYS' OR repeat_n IS NOT NULL),
  CONSTRAINT responsibility_routines_semana_ck CHECK (repeat_kind <> 'WEEKLY' OR weekday IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX responsibility_routines_resp_idx ON responsibility_routines (responsibility_id) WHERE active;
--> statement-breakpoint
CREATE INDEX responsibility_routines_volta_idx ON responsibility_routines (next_due_on) WHERE active AND done AND next_due_on IS NOT NULL;
--> statement-breakpoint
ALTER TABLE responsibility_routines ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE responsibility_routines FROM anon, authenticated, PUBLIC;
