<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';

$conn->set_charset('utf8mb4');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

$email = trim((string)($data['email'] ?? ''));
$password = (string)($data['password'] ?? '');

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(["error" => "Email e password richieste"]);
    exit;
}

$stmt = $conn->prepare("SELECT id, email, password_hash, role, name, surname, is_verified FROM users WHERE email = ? LIMIT 1");
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

$is_verif = isset($user['is_verified']) ? (int)$user['is_verified'] : 1;

if ($is_verif === 0) {
    $newCode = sprintf("%06d", mt_rand(1, 999999));
    $upd = $conn->prepare("UPDATE users SET verification_code = ? WHERE id = ?");
    if ($upd) {
        $upd->bind_param("ss", $newCode, $user['id']);
        $upd->execute();
        
        $host = $_SERVER['HTTP_HOST'];
        $subject = "Enjoy Your Coffee - Nuovo codice di attivazione";
        $message = "Ciao,\n\nHai cercato di accedere ma il tuo account non è ancora verificato.\nEcco un nuovo codice temporaneo:\n\nCodice: " . $newCode . "\n\nInseriscilo sul sito per attivare l'account.\n\nIl Team di Enjoy Your Coffee";
        $headers = "From: noreply@" . str_replace("www.", "", $host) . "\r\n";
        @mail($user['email'], $subject, $message, $headers);
    }

    http_response_code(401);
    echo json_encode([
        "error" => "Account non verificato. Abbiamo appena inviato un nuovo codice OTP alla tua casella email.", 
        "require_verification" => true,
        "email" => $user['email']
    ]);
    exit;
}

$stmtAssoc = $conn->prepare("UPDATE orders SET user_id = ? WHERE customer_email = ? AND user_id IS NULL");
if ($stmtAssoc) {
    $stmtAssoc->bind_param("ss", $user['id'], $user['email']);
    $stmtAssoc->execute();
    $stmtAssoc->close();
}

session_regenerate_id(true);

$_SESSION['user'] = [
    "id" => $user["id"],
    "email" => $user["email"],
    "role" => $user["role"],
    "name" => $user["name"] ?? '',
    "surname" => $user["surname"] ?? ''
];

echo json_encode(["ok" => true, "user" => $_SESSION['user']]);
