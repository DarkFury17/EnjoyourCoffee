<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Metodo non valido"]);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
preg_match('/\/api\/orders\/([0-9a-fA-F-]+)\/cancel/', $path, $matches);
$id = $matches[1] ?? null;

if (!$id) {
    http_response_code(400);
    echo json_encode(["error" => "ID ordine mancante"]);
    exit;
}

$stmt = $conn->prepare("SELECT status, user_id FROM orders WHERE id = ?");
if (!$stmt) {
    error_log("orders_cancel prepare select error: " . $conn->error);
    http_response_code(500);
    echo json_encode(["error" => "Errore interno del server. Riprova più tardi."]);
    exit;
}

$stmt->bind_param("s", $id);
$stmt->execute();
$order = $stmt->get_result()->fetch_assoc();

if (!$order) {
    http_response_code(404);
    echo json_encode(["error" => "Ordine non trovato"]);
    exit;
}

$sessionUserId = $_SESSION['user']['id'] ?? null;
$sessionRole = $_SESSION['user']['role'] ?? null;

$isSeller = ($sessionRole === 'seller');
$isOwner = ($sessionUserId !== null && !empty($order['user_id']) && (string)$order['user_id'] === (string)$sessionUserId);

if (!$isSeller && !$isOwner) {
    http_response_code(403);
    echo json_encode(["error" => "Non autorizzato ad annullare questo ordine"]);
    exit;
}

if ($order['status'] !== 'pending_payment') {
    http_response_code(400);
    echo json_encode(["error" => "L'ordine non puo essere annullato perche ha gia superato la fase di pagamento (status: " . $order['status'] . ")."]);
    exit;
}

$stmtUpd = $conn->prepare("UPDATE orders SET status = 'canceled' WHERE id = ?");
if (!$stmtUpd) {
    error_log("orders_cancel prepare update error: " . $conn->error);
    http_response_code(500);
    echo json_encode(["error" => "Errore interno del server. Riprova più tardi."]);
    exit;
}

$stmtUpd->bind_param("s", $id);
if (!$stmtUpd->execute()) {
    error_log("orders_cancel execute update error: " . $stmtUpd->error);
    http_response_code(500);
    echo json_encode(["error" => "Errore durante l'annullamento dell'ordine."]);
    exit;
}

echo json_encode(["ok" => true, "message" => "Ordine annullato con successo."]);
