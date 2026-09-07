<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';

$conn->set_charset('utf8mb4');

$orderId = (string)($_GET['order_id'] ?? '');

if ($orderId === '') {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "order_id mancante"]);
    exit;
}

$stmtO = $conn->prepare("SELECT * FROM orders WHERE id = ?");
if (!$stmtO) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Prepare orders fallita", "message" => $conn->error]);
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

$stmtI = $conn->prepare("SELECT * FROM order_items WHERE order_id = ?");
if (!$stmtI) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Prepare items fallita", "message" => $conn->error]);
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
