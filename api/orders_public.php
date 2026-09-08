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

$stmtO = $conn->prepare("SELECT id, status, total_cents, created_at FROM orders WHERE id = ?");
if (!$stmtO) {
  error_log("orders_public prepare error: " . $conn->error);
  http_response_code(500);
  echo json_encode(["ok" => false, "error" => "Errore interno del server. Riprova più tardi."]);
  exit;
}
$stmtO->bind_param("s", $orderId);
$stmtO->execute();
$resO = $stmtO->get_result();
$order = $resO ? $resO->fetch_assoc() : null;

if (!$order) {
  http_response_code(404);
  echo json_encode(["ok" => false, "error" => "Ordine non trovato"]);
  exit;
}

// Estrazione sicura degli articoli (senza dati personali)
$stmtI = $conn->prepare("SELECT product_name, variant_label, qty, unit_price_cents FROM order_items WHERE order_id = ?");
if (!$stmtI) {
  // Fallback se la colonna variant_label non è presente a schema
  $stmtI = $conn->prepare("SELECT product_name, qty, unit_price_cents FROM order_items WHERE order_id = ?");
}

$items = [];
if ($stmtI) {
  $stmtI->bind_param("s", $orderId);
  $stmtI->execute();
  $resI = $stmtI->get_result();
  if ($resI) {
    while ($r = $resI->fetch_assoc()) {
      $items[] = [
        "product_name"     => $r["product_name"] ?? "",
        "variant_label"    => $r["variant_label"] ?? "",
        "qty"              => (int)($r["qty"] ?? 1),
        "unit_price_cents" => (int)($r["unit_price_cents"] ?? 0)
      ];
    }
  }
}

echo json_encode([
  "ok" => true,
  "order" => $order,
  "items" => $items
]);
