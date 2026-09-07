<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/session.php';  // ✅ Usa session.php invece di session_start()
require_once __DIR__ . '/db.php';

if (isset($_SESSION['user'])) {
    $userData = $_SESSION['user'];
    
    // Controlla se l'utente ha già effettuato ordini (per sconto primo acquisto)
    $has_discount = true; // default: sconto attivo
    $userId = $userData['id'] ?? null;
    if ($userId) {
        $stmtOrders = $conn->prepare("SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?");
        if ($stmtOrders) {
            $stmtOrders->bind_param("s", $userId);
            $stmtOrders->execute();
            $result = $stmtOrders->get_result();
            $row = $result->fetch_assoc();
            if ($row && (int)$row['cnt'] > 0) {
                $has_discount = false; // Ha già ordinato, niente sconto
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
