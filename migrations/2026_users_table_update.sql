-- =====================================================================
-- Migration: 2026_users_table_update.sql
-- Progetto: Enjoy Your Coffee
-- Descrizione: Aggiunta colonne per anagrafica utente, verifica email e reset password
-- Esecuzione: Da eseguire una tantum direttamente sul database MySQL
-- =====================================================================

ALTER TABLE `users`
    ADD COLUMN IF NOT EXISTS `name` VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS `surname` VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS `reset_token` VARCHAR(255) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `reset_expires` DATETIME DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `is_verified` TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS `verification_code` VARCHAR(10) DEFAULT NULL;
