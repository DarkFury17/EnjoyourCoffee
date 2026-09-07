<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

// Aggiungiamo le colonne in fallback. Ignorerà l'errore se esistono già.
$conn->query("ALTER TABLE users ADD COLUMN name VARCHAR(255) DEFAULT ''");
$conn->query("ALTER TABLE users ADD COLUMN surname VARCHAR(255) DEFAULT ''");
$conn->query("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL");
$conn->query("ALTER TABLE users ADD COLUMN reset_expires DATETIME DEFAULT NULL");

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
$email = trim((string)($data['email'] ?? ''));

if ($email === '') {
    http_response_code(400);
    echo json_encode(["error" => "Email richiesta"]);
    exit;
}

$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$res = $stmt->get_result();

if ($res->num_rows > 0) {
    $user = $res->fetch_assoc();
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', time() + 3600);

    $stmtUpd = $conn->prepare("UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?");
    if (!$stmtUpd) {
        http_response_code(500);
        echo json_encode(["error" => "Errore DB prepare token: " . $conn->error]);
        exit;
    }
    
    $stmtUpd->bind_param("sss", $token, $expires, $user['id']);
    if (!$stmtUpd->execute()) {
        http_response_code(500);
        echo json_encode(["error" => "Errore salvataggio token: " . $stmtUpd->error]);
        exit;
    }

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'];
    $resetLink = $protocol . $host . "/reset-password.html?token=" . urlencode($token);

    $subject = "Enjoy Your Coffee - Recupero Password";
    $message = "Ciao,\n\nHai richiesto il recupero della tua password per il sito Enjoy Your Coffee.\nClicca sul link sottostante o copialo nel browser per impostare una nuova password (il link scadrà tra 1 ora):\n\n" . $resetLink . "\n\nSe non sei stato tu a richiedere il ripristino, ignora pure questa mail.\n\nA presto,\nIl Team di Enjoy Your Coffee";
    
    $headers = "From: noreply@" . str_replace("www.", "", $host) . "\r\n";
    $headers .= "Reply-To: noreply@" . str_replace("www.", "", $host) . "\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    @mail($email, $subject, $message, $headers);
}

echo json_encode(["ok" => true, "message" => "Processed"]);
