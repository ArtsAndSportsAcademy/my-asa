-- Reversão do Grupo B. Use apenas em ambiente sem dados operacionais novos.
DROP TABLE IF EXISTS daily_book_checkin_vacancies;
--> statement-breakpoint
DROP TABLE IF EXISTS day_check_ins;
--> statement-breakpoint
DROP TYPE IF EXISTS day_checkin_status;
--> statement-breakpoint
DROP TABLE IF EXISTS leave_requests;
--> statement-breakpoint
DROP TYPE IF EXISTS leave_request_status;
--> statement-breakpoint
DROP TABLE IF EXISTS leave_regimes;
