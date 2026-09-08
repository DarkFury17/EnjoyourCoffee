<?php
/**
 * Enjoy Your Coffee - Template di Configurazione Privata
 *
 * Istruzioni per l'ambiente locale/produzione:
 * 1. Copia o rinomina questo file in 'config_private.php' nella root del progetto.
 * 2. Inserisci i parametri reali di connessione al database MySQL e la chiave segreta di Stripe.
 * 3. Il file 'config_private.php' è escluso dal tracciamento Git tramite .gitignore per proteggere le credenziali.
 */

// Configurazione Database MySQL
define('DB_HOST', 'localhost');
define('DB_USER', 'DB_USER_HERE');
define('DB_PASS', 'DB_PASSWORD_HERE');
define('DB_NAME', 'DB_NAME_HERE');
define('DB_PORT', 3306);

// Configurazione Stripe (usa sk_test_... per test e sk_live_... in produzione)
define('STRIPE_SECRET_KEY', 'sk_test_placeholder_key_here');

// Configurazione Dominio e Mittente Email
define('APP_DOMAIN', 'enjoyourcoffee.it');
define('MAIL_FROM', 'noreply@enjoyourcoffee.it');
