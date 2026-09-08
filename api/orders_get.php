<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';

require_login();

$conn->set_charset('utf8mb4');

$orderId = (string)($_GET['order_id'] ?? '');

if ($orderId === '') {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "order_id mancante"]);
    exit;
}

$stmtO = $conn->prepare("SELECT * FROM orders WHERE id = ?");
if (!$stmtO) {
    error_log("orders_get prepare orders error: " . $conn->error);
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Errore interno del server. Riprova più tardi."]);
    exit;
}

$stmtO->bind_param("s", $orderId);
$stmtO->execute();
$order = $stmtO->get_result()->fetch_assoc();

if (!$order) {
    http_response_code(404);
    echo json_encode(["ok" => false, "error" => "Ordine non trovato"]);
    exit;
}

$sessionUserId = $_SESSION['user']['id'] ?? null;
$sessionRole = $_SESSION['user']['role'] ?? null;

$isSeller = ($sessionRole === 'seller');
$isOwner = ($sessionUserId !== null && !empty($order['user_id']) && (string)$order['user_id'] === (string)$sessionUserId);

if (!$isSeller && !$isOwner) {
    http_response_code(403);
    echo json_encode(["ok" => false, "error" => "Accesso negato: non sei autorizzato a visualizzare questo ordine"]);
    exit;
}

$stmtI = $conn->prepare("SELECT * FROM order_items WHERE order_id = ?");
if (!$stmtI) {
    error_log("orders_get prepare items error: " . $conn->error);
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Errore interno del server. Riprova più tardi."]);
    exit;
}

$stmtI->bind_param("s", $orderId);
$stmtI->execute();
$resItems = $stmtI->get_result();

$items = [];
while ($row = $resItems->fetch_assoc()) {
    $items[] = $row;
}

echo json_encode([
    "ok" => true,
    "order" => $order,
    "items" => $items
]);
