<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';

if (isset($_SESSION['user'])) {
    $userData = $_SESSION['user'];
    
    // Verifica eleggibilità sconto benvenuto su primo ordine
    $has_discount = true;
    $userId = $userData['id'] ?? null;
    if ($userId) {
        $stmtOrders = $conn->prepare("SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?");
        if ($stmtOrders) {
            $stmtOrders->bind_param("s", $userId);
            $stmtOrders->execute();
            $result = $stmtOrders->get_result();
            $row = $result->fetch_assoc();
            if ($row && (int)$row['cnt'] > 0) {
                $has_discount = false;
            }
            $stmtOrders->close();
        }
    }
    
    $userData['has_discount'] = $has_discount;
    echo json_encode(["ok" => true, "user" => $userData]);
} else {
    http_response_code(401);
    echo json_encode(["ok" => false, "error" => "Non autenticato"]);
}
