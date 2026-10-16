-- Regras do pedido de folga que a Administração ajusta (Etapa 3, 16/10/2026). Tudo aditivo.
--   * prazo_supervisao_dias: a Administração passa a poder decidir um pedido que a Supervisão não
--     respondeu quando faltam esta quantidade de dias corridos (ou menos) para a data pedida. Padrão 3.
--   * limite_folga_por_area: {"<areaId>": N}. Quantas pessoas da área podem estar de folga no mesmo dia
--     antes de a análise do pedido AVISAR (nunca trava). Depende dos shows, por isso é configurável.
-- Uma linha por organização; sem linha, valem os padrões (prazo 3, nenhum limite).
CREATE TABLE folga_config (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id),
  prazo_supervisao_dias integer NOT NULL DEFAULT 3 CHECK (prazo_supervisao_dias BETWEEN 0 AND 30),
  limite_folga_por_area jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE folga_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE folga_config FROM anon, authenticated, PUBLIC;
