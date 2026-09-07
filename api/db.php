<?php
define('DEBUG', false);

error_reporting(E_ALL);
ini_set('display_errors', DEBUG ? '1' : '0');
ini_set('display_startup_errors', DEBUG ? '1' : '0');
ini_set('log_errors', '1');

$configFile = __DIR__ . '/../config_private.php';
if (file_exists($configFile)) {
    require_once $configFile;
}

$host   = defined('DB_HOST') ? DB_HOST : (getenv('DB_HOST') ?: '');
$user   = defined('DB_USER') ? DB_USER : (getenv('DB_USER') ?: '');
$pass   = defined('DB_PASS') ? DB_PASS : (getenv('DB_PASS') ?: '');
$dbname = defined('DB_NAME') ? DB_NAME : (getenv('DB_NAME') ?: '');
$port   = defined('DB_PORT') ? (int)DB_PORT : (int)(getenv('DB_PORT') ?: 3306);

if (empty($host) || empty($user) || empty($dbname)) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    die(json_encode([
        "ok" => false,
        "error" => "Configurazione database mancante. Crea il file config_private.php partendo da config_private.example.php."
    ]));
}

mysqli_report(MYSQLI_REPORT_OFF);

$conn = @new mysqli($host, $user, $pass, $dbname, $port);

if ($conn->connect_error) {
  header('Content-Type: application/json');
  die(json_encode([
    "error" => "Connessione fallita",
    "errno" => $conn->connect_errno,
    "message" => $conn->connect_error
  ]));
}

$conn->set_charset("utf8mb4");
