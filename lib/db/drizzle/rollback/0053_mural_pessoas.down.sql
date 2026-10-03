-- Desfaz 0053 (aviso para pessoas escolhidas). O valor PEOPLE do tipo announcement_scope fica:
-- o Postgres não remove valor de enum. Antes de desfazer, TODOS os avisos com scope PEOPLE
-- precisam ter o destino convertido mediante decisão autorizada. Cancelar não basta:
-- a regra antiga também valida avisos cancelados. Não remova destinatários antes dessa checagem.
BEGIN;
LOCK TABLE "announcements" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "announcements" WHERE scope::text = 'PEOPLE') THEN
    RAISE EXCEPTION 'Rollback 0053 recusado: ainda existem avisos PEOPLE, inclusive cancelados. Nenhum destinatário foi removido.';
  END IF;
END $$;
DROP INDEX IF EXISTS "announcement_recipients_user_idx";
DROP TABLE IF EXISTS "announcement_recipients";
ALTER TABLE "announcements" DROP CONSTRAINT IF EXISTS "announcements_scope_target_ck";
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_scope_target_ck" CHECK (
  (scope::text = 'HOUSE' AND area_id IS NULL AND location_id IS NULL) OR
  (scope::text = 'AREA' AND area_id IS NOT NULL) OR
  (scope::text = 'LOCATION' AND location_id IS NOT NULL)
);
COMMIT;
