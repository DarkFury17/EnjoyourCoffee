<?php
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/db.php';

$orderId = $_GET["id"] ?? null;

if (!$orderId) {
  http_response_code(400);
  echo json_encode(["ok"=>false,"error"=>"orderid mancante"]);
  exit;
}

$stmtO = $conn->prepare("SELECT * FROM orders WHERE id = ?");
$stmtO->bind_param("s", $orderId);
$stmtO->execute();
$resO = $stmtO->get_result();
$order = $resO ? $resO->fetch_assoc() : null;

if (!$order) {
  http_response_code(404);
  echo json_encode(["ok"=>false,"error"=>"Ordine non trovato"]);
  exit;
}

$stmtI = $conn->prepare("SELECT * FROM order_items WHERE order_id = ?");
$stmtI->bind_param("s", $orderId);
$stmtI->execute();
$resI = $stmtI->get_result();

$items = [];
if ($resI) { while ($r = $resI->fetch_assoc()) $items[] = $r; }

echo json_encode(["ok"=>true,"order"=>$order,"items"=>$items]);
