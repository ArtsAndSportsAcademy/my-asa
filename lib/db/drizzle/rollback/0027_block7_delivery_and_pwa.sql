-- Executar somente em janela de manutenção, após exportar os dados deste bloco.
BEGIN;
DROP TABLE pwa_installations;
DROP TABLE web_push_subscriptions;
DROP TABLE notification_outbox;
DROP TABLE undo_actions;
ALTER TABLE request_decisions DROP COLUMN reverted_at;
COMMIT;
