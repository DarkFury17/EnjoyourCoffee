<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

$email = trim((string)($data['email'] ?? ''));
$code = trim((string)($data['code'] ?? ''));

if ($email === '' || $code === '') {
    http_response_code(400);
    echo json_encode(["error" => "Email o codice mancanti"]);
    exit;
}

$stmt = $conn->prepare("SELECT id, email, role, name, surname, is_verified FROM users WHERE email = ? AND verification_code = ?");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(["error" => "Errore interno DB prepare: " . $conn->error]);
    exit;
}

$stmt->bind_param("ss", $email, $code);
$stmt->execute();
$res = $stmt->get_result();

if ($res->num_rows === 0) {
    http_response_code(400);
    echo json_encode(["error" => "Codice di sicurezza non valido o già utilizzato."]);
    exit;
}

$user = $res->fetch_assoc();

if ($user['is_verified'] == 1) {
    http_response_code(400);
    echo json_encode(["error" => "Account già verificato."]);
    exit;
}

$stmtUpd = $conn->prepare("UPDATE users SET is_verified = 1, verification_code = NULL WHERE id = ?");
$stmtUpd->bind_param("s", $user['id']);
$stmtUpd->execute();

$stmtAssoc = $conn->prepare("UPDATE orders SET user_id = ? WHERE customer_email = ? AND user_id IS NULL");
if ($stmtAssoc) {
    $stmtAssoc->bind_param("ss", $user['id'], $user['email']);
    $stmtAssoc->execute();
    $stmtAssoc->close();
}

$_SESSION['user'] = [
    "id" => $user["id"],
    "email" => $user["email"],
    "role" => $user["role"],
    "name" => $user["name"],
    "surname" => $user["surname"]
];

echo json_encode(["ok" => true, "user" => $_SESSION['user']]);
