<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db.php';       
require_once __DIR__ . '/session.php';   

if (!isset($conn)) {
  http_response_code(500);
  echo json_encode(["error" => "DB: variabile \$conn non definita"]);
  exit;
}
if (!($conn instanceof mysqli)) {
  http_response_code(500);
  echo json_encode(["error" => "DB: conn non è mysqli", "type" => gettype($conn)]);
  exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

$email = trim((string)($data['email'] ?? ''));
$password = (string)($data['password'] ?? '');

if ($email === '' || $password === '') {
  http_response_code(400);
  echo json_encode(["error" => "Email e password richieste"]);
  exit;
}

$stmt = $conn->prepare("SELECT id, email, password_hash, role FROM users WHERE email = ? LIMIT 1");
if (!$stmt) {
  http_response_code(500);
  echo json_encode(["error" => "Prepare fallita", "message" => $conn->error]);
  exit;
}

$stmt->bind_param("s", $email);

if (!$stmt->execute()) {
  http_response_code(500);
  echo json_encode(["error" => "Execute fallita", "message" => $stmt->error]);
  exit;
}

$res = $stmt->get_result();
$user = $res ? $res->fetch_assoc() : null;

if (!$user || !password_verify($password, $user['password_hash'])) {
  http_response_code(401);
  echo json_encode(["error" => "Credenziali errate"]);
  exit;
}

$_SESSION['user'] = [
  "id" => $user["id"],
  "email" => $user["email"],
  "role" => $user["role"],
];

echo json_encode(["ok" => true, "user" => $_SESSION['user']]);
