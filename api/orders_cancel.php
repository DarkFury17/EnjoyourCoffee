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

$stmt = $conn->prepare("SELECT status FROM orders WHERE id = ?");
$stmt->bind_param("s", $id);
$stmt->execute();
$order = $stmt->get_result()->fetch_assoc();

if (!$order) {
    http_response_code(404);
    echo json_encode(["error" => "Ordine non trovato"]);
    exit;
}

if ($order['status'] !== 'pending_payment') {
    http_response_code(400);
    echo json_encode(["error" => "L'ordine non puo essere annullato perche ha gia superato la fase di pagamento (status: " . $order['status'] . ")."]);
    exit;
}

$conn->begin_transaction();

try {
    $stmtI = $conn->prepare("DELETE FROM order_items WHERE order_id = ?");
    $stmtI->bind_param("s", $id);
    $stmtI->execute();

    $stmtO = $conn->prepare("DELETE FROM orders WHERE id = ?");
    $stmtO->bind_param("s", $id);
    $stmtO->execute();

    $conn->commit();
    echo json_encode(["ok" => true, "message" => "Ordine annullato con successo."]);
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => "Errore cancellazione ordine: " . $e->getMessage()]);
}
