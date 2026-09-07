<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/../vendor/autoload.php';
$configFile = __DIR__ . '/../config_private.php';
if (file_exists($configFile)) {
    require_once $configFile;
}

$conn->set_charset('utf8mb4');

// Verifica e riconciliazione transazionale stato di pagamento Stripe
$orderId = (string)($_GET['order_id'] ?? '');
$sessionId = (string)($_GET['session_id'] ?? '');

if (!$orderId || !$sessionId) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Parametri mancanti"]);
    exit;
}

if (!defined('STRIPE_SECRET_KEY') || !STRIPE_SECRET_KEY) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "STRIPE_SECRET_KEY non configurata"]);
    exit;
}

\Stripe\Stripe::setApiKey(STRIPE_SECRET_KEY);

try {
    $session = \Stripe\Checkout\Session::retrieve($sessionId);

    if ((string)$session->client_reference_id !== $orderId) {
        http_response_code(400);
        echo json_encode(["ok" => false, "error" => "Sessione non corrisponde all'ordine"]);
        exit;
    }

    $paymentStatus = (string)$session->payment_status;
    
    $newStatus = ($paymentStatus === 'paid') ? 'paid' : 'pending';
    
    $stmt = $conn->prepare("
        UPDATE orders
        SET status = ?, stripe_session_id = ?, stripe_payment_status = ?
        WHERE id = ?
    ");
    
    if (!$stmt) {
        throw new Exception($conn->error);
    }
    
    $stmt->bind_param("ssss", $newStatus, $sessionId, $paymentStatus, $orderId);
    $stmt->execute();

    echo json_encode([
        "ok" => true,
        "order_id" => $orderId,
        "stripe" => [
            "session_id" => $sessionId,
            "payment_status" => $paymentStatus
        ],
        "order_status" => $newStatus
    ]);
    
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "ok" => false,
        "error" => "Stripe confirm error",
        "message" => $e->getMessage()
    ]);
}
