<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';

$conn->set_charset('utf8mb4');

if (!isset($_SESSION['user']) || empty($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode(["ok" => false, "error" => "Devi effettuare l'accesso per vedere i tuoi ordini."]);
    exit;
}

$user_id = $_SESSION['user']['id'];

$stmt = $conn->prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Prepare fallita", "message" => $conn->error]);
    exit;
}

$stmt->bind_param("s", $user_id);
$stmt->execute();
$result = $stmt->get_result();

$orders = [];
while ($row = $result->fetch_assoc()) {
    $orders[] = $row;
}

echo json_encode(["ok" => true, "orders" => $orders]);
