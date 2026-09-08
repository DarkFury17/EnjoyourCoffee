<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session.php';

if (!defined('APP_DOMAIN')) {
    define('APP_DOMAIN', 'enjoyourcoffee.it');
}
if (!defined('MAIL_FROM')) {
    define('MAIL_FROM', 'noreply@' . APP_DOMAIN);
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

$email = trim((string)($data['email'] ?? ''));
$password = (string)($data['password'] ?? '');
$name = trim((string)($data['name'] ?? ''));
$surname = trim((string)($data['surname'] ?? ''));

if ($email === '' || $password === '') {
  http_response_code(400);
  echo json_encode(["error" => "Email e password richieste"]);
  exit;
}

$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
if (!$stmt) {
  error_log("Users register check prepare error: " . $conn->error);
  http_response_code(500);
  echo json_encode(["error" => "Errore interno del server. Riprova più tardi."]);
  exit;
}

$stmt->bind_param("s", $email);
$stmt->execute();
if ($stmt->get_result()->num_rows > 0) {
  http_response_code(400);
  echo json_encode(["error" => "Email già registrata"]);
  exit;
}

function uuidv4() {
  $data = random_bytes(16);
  $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
  $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

$verification_code = sprintf("%06d", mt_rand(1, 999999));
$is_verified = 0;

$hashed = password_hash($password, PASSWORD_BCRYPT);
$role = 'customer';
$user_id = uuidv4();

$stmt = $conn->prepare("INSERT INTO users (id, email, password_hash, role, name, surname, is_verified, verification_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
if (!$stmt) {
    error_log("Users register insert prepare error: " . $conn->error);
    http_response_code(500);
    echo json_encode(["error" => "Errore durante la registrazione. Riprova più tardi."]);
    exit;
}

$stmt->bind_param("ssssssis", $user_id, $email, $hashed, $role, $name, $surname, $is_verified, $verification_code);
if (!$stmt->execute()) {
    error_log("Users register insert execute error: " . $stmt->error);
    http_response_code(500);
    echo json_encode(["error" => "Errore durante il salvataggio dei dati. Riprova più tardi."]);
    exit;
}

$subject = "Enjoy Your Coffee - Conferma la tua email";
$message = "Ciao " . ($name ?: 'nuovo utente') . ",\n\nBenvenuto in Enjoy Your Coffee!\nPer completare la tua iscrizione e accedere al tuo account, copia il codice temporaneo qui sotto e inseriscilo nel popup del sito:\n\nTuoc codice di verifica: " . $verification_code . "\n\nA presto,\nIl Team di Enjoy Your Coffee";

$headers  = "From: " . MAIL_FROM . "\r\n";
$headers .= "Reply-To: " . MAIL_FROM . "\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

@mail($email, $subject, $message, $headers);

echo json_encode(["ok" => true, "require_verification" => true, "email" => $email]);
