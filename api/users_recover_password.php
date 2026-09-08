<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

if (!defined('APP_DOMAIN')) {
    define('APP_DOMAIN', 'enjoyourcoffee.it');
}
if (!defined('MAIL_FROM')) {
    define('MAIL_FROM', 'noreply@' . APP_DOMAIN);
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
$email = trim((string)($data['email'] ?? ''));

if ($email === '') {
    http_response_code(400);
    echo json_encode(["error" => "Email richiesta"]);
    exit;
}

$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
if (!$stmt) {
    error_log("Recover password select prepare error: " . $conn->error);
    http_response_code(500);
    echo json_encode(["error" => "Errore interno del server. Riprova più tardi."]);
    exit;
}

$stmt->bind_param("s", $email);
$stmt->execute();
$res = $stmt->get_result();

if ($res && $res->num_rows > 0) {
    $user = $res->fetch_assoc();
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', time() + 3600);

    $stmtUpd = $conn->prepare("UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?");
    if (!$stmtUpd) {
        error_log("Recover password update prepare error: " . $conn->error);
        http_response_code(500);
        echo json_encode(["error" => "Errore interno del server. Riprova più tardi."]);
        exit;
    }
    
    $stmtUpd->bind_param("sss", $token, $expires, $user['id']);
    if (!$stmtUpd->execute()) {
        error_log("Recover password update execute error: " . $stmtUpd->error);
        http_response_code(500);
        echo json_encode(["error" => "Errore interno del server. Riprova più tardi."]);
        exit;
    }

    $resetLink = "https://" . APP_DOMAIN . "/reset-password.html?token=" . urlencode($token);

    $subject = "Enjoy Your Coffee - Recupero Password";
    $message = "Ciao,\n\nHai richiesto il recupero della tua password per il sito Enjoy Your Coffee.\nClicca sul link sottostante o copialo nel browser per impostare una nuova password (il link scadrà tra 1 ora):\n\n" . $resetLink . "\n\nSe non sei stato tu a richiedere il ripristino, ignora pure questa mail.\n\nA presto,\nIl Team di Enjoy Your Coffee";
    
    $headers  = "From: " . MAIL_FROM . "\r\n";
    $headers .= "Reply-To: " . MAIL_FROM . "\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

    @mail($email, $subject, $message, $headers);
}

echo json_encode(["ok" => true, "message" => "Processed"]);
