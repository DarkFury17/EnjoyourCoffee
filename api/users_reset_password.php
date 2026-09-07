<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

$token = trim((string)($data['token'] ?? ''));
$password = (string)($data['password'] ?? '');

if ($token === '' || $password === '') {
    http_response_code(400);
    echo json_encode(["error" => "Token e nuova password richiesti."]);
    exit;
}

$stmt = $conn->prepare("SELECT id, reset_expires FROM users WHERE reset_token = ?");
$stmt->bind_param("s", $token);
$stmt->execute();
$res = $stmt->get_result();

if ($res->num_rows === 0) {
    http_response_code(400);
    echo json_encode(["error" => "Il link di ripristino non è valido o è già stato utilizzato."]);
    exit;
}

$user = $res->fetch_assoc();

if (strtotime($user['reset_expires']) < time()) {
    http_response_code(400);
    echo json_encode(["error" => "Il link di ripristino è scaduto. Richiedine uno nuovo."]);
    exit;
}

$hashed = password_hash($password, PASSWORD_BCRYPT);
$stmtUpd = $conn->prepare("UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?");

if (!$stmtUpd) {
    http_response_code(500);
    echo json_encode(["error" => "Errore DB prepare reset: " . $conn->error]);
    exit;
}

$stmtUpd->bind_param("ss", $hashed, $user['id']);
if (!$stmtUpd->execute()) {
    http_response_code(500);
    echo json_encode(["error" => "Errore salvataggio nuova password: " . $stmtUpd->error]);
    exit;
}

echo json_encode(["ok" => true, "message" => "Password aggiornata con successo!"]);
