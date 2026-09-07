<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../session.php';
require_once __DIR__ . '/../db.php';

// Solo i seller possono vedere i clienti
require_seller();

$conn->set_charset('utf8mb4');

// Mostra tutti i clienti, non solo quelli con ordini pagati
$stmt = $conn->prepare("
    SELECT
        customer_email,
        MAX(customer_name) AS customer_name,
        MAX(customer_surname) AS customer_surname,
        MAX(customer_phone) AS customer_phone,
        COUNT(*) AS orders_count,
        SUM(total_cents) AS total_spent_cents,
        MAX(created_at) AS last_order_at
    FROM orders
    GROUP BY customer_email
    ORDER BY last_order_at DESC
");

if (!$stmt) {
    http_response_code(500);
    echo json_encode([
        "ok" => false,
        "error" => "Prepare fallita",
        "message" => $conn->error
    ]);
    exit;
}

$stmt->execute();
$res = $stmt->get_result();

$rows = [];
while ($r = $res->fetch_assoc()) {
    $rows[] = $r;
}

echo json_encode($rows);
