<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../session.php';

require_seller();

$method = $_SERVER['REQUEST_METHOD'];

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
preg_match('/\/api\/admin\/orders\/([0-9a-fA-F-]+)/', $path, $matches);
$id = $matches[1] ?? null;

if ($method === 'GET') {
    if ($id) {
        $stmt = $conn->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
        $stmt->bind_param("s", $id);
        $stmt->execute();
        $res = $stmt->get_result();
        $order = $res->fetch_assoc();
        
        if (!$order) {
            http_response_code(404);
            echo json_encode(["error" => "Ordine non trovato"]);
            exit;
        }
        
        $stmt2 = $conn->prepare("SELECT * FROM order_items WHERE order_id = ?");
        $stmt2->bind_param("s", $id);
        $stmt2->execute();
        $res2 = $stmt2->get_result();
        
        $items = [];
        while ($item = $res2->fetch_assoc()) {
            $items[] = $item;
        }
        
        echo json_encode(["order" => $order, "items" => $items]);
        exit;
    }
    
    $stmt = $conn->prepare("
        SELECT id, status, customer_name, customer_surname, customer_email, customer_phone,
               address_city, address_cap, delivery_slot, payment_method, total_cents, created_at
        FROM orders
        WHERE status != 'pending_payment' AND status != 'canceled'
        ORDER BY created_at DESC
    ");
    $stmt->execute();
    $res = $stmt->get_result();
    
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    
    echo json_encode($rows);
    exit;
}

if ($method === 'PATCH') {
    if (!$id) {
        http_response_code(400);
        echo json_encode(["error" => "ID ordine richiesto"]);
        exit;
    }
    
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $status = $data['status'] ?? '';
    
    if (empty($status)) {
        http_response_code(400);
        echo json_encode(["error" => "Status richiesto"]);
        exit;
    }
    
    $stmt = $conn->prepare("UPDATE orders SET status = ? WHERE id = ?");
    $stmt->bind_param("ss", $status, $id);
    
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(["error" => "Aggiornamento fallito", "message" => $stmt->error]);
        exit;
    }
    
    echo json_encode(["ok" => true, "message" => "Stato aggiornato"]);
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Metodo non supportato"]);
