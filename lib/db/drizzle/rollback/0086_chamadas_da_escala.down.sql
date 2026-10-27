-- Desfaz as chamadas da Escala.
-- O que se perde: todas as chamadas cadastradas (nome, horário, duração, "ocupa tempo", "avisar"), inclusive as que nasceram da cópia dos
-- horários de chamada antigos. O horário de chamada de cada sessão continua em sessions.call_time, que esta migração nunca mexeu.
-- Os eventos do Registro continuam onde estão.
-- Rode ANTES de voltar o código para uma versão que não conhece a tabela.
DROP TABLE IF EXISTS escala_chamadas;
