<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/session.php';

// ✅ Cancella solo i dati dell'utente, NON distruggere la sessione
unset($_SESSION['user']);

echo json_encode(["ok" => true, "message" => "Logout effettuato"]);
