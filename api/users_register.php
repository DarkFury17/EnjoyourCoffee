<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session.php';

// Aggiungiamo le colonne se non esistono (ignorerà l'errore se esistono già)
$conn->query("ALTER TABLE users ADD COLUMN name VARCHAR(255) DEFAULT ''");
$conn->query("ALTER TABLE users ADD COLUMN surname VARCHAR(255) DEFAULT ''");
$conn->query("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL");
$conn->query("ALTER TABLE users ADD COLUMN reset_expires DATETIME DEFAULT NULL");
$conn->query("ALTER TABLE users ADD COLUMN is_verified TINYINT(1) DEFAULT 1");
$conn->query("ALTER TABLE users ADD COLUMN verification_code VARCHAR(10) DEFAULT NULL");

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
    http_response_code(500);
    echo json_encode(["error" => "Errore interno DB prepare: " . $conn->error]);
    exit;
}

$stmt->bind_param("ssssssis", $user_id, $email, $hashed, $role, $name, $surname, $is_verified, $verification_code);
if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(["error" => "Errore salvataggio utente: " . $stmt->error]);
    exit;
}

$host = $_SERVER['HTTP_HOST'];
$subject = "Enjoy Your Coffee - Conferma la tua email";
$message = "Ciao " . ($name ?: 'nuovo utente') . ",\n\nBenvenuto in Enjoy Your Coffee!\nPer completare la tua iscrizione e accedere al tuo account, copia il codice temporaneo qui sotto e inseriscilo nel popup del sito:\n\nTuoc codice di verifica: " . $verification_code . "\n\nA presto,\nIl Team di Enjoy Your Coffee";

$headers = "From: noreply@" . str_replace("www.", "", $host) . "\r\n";
$headers .= "Reply-To: noreply@" . str_replace("www.", "", $host) . "\r\n";
$headers .= "X-Mailer: PHP/" . phpversion();

@mail($email, $subject, $message, $headers);

echo json_encode(["ok" => true, "require_verification" => true, "email" => $email]);
