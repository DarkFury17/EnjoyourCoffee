<?php
define('DEBUG', false);

error_reporting(E_ALL);
ini_set('display_errors', DEBUG ? '1' : '0');
ini_set('display_startup_errors', DEBUG ? '1' : '0');
ini_set('log_errors', '1');

$host   = 'sql.enjoyourcoffee.it';
$user   = 'enjoyour89469';
$pass   = 'enjo50149';
$dbname = 'enjoyour89469';
$port   = 3306;

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
