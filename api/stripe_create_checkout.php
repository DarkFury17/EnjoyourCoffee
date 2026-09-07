<?php
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';

$conn->set_charset('utf8mb4');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "JSON non valido"]);
    exit;
}

$orderId = (string)($data["orderId"] ?? '');

if ($orderId === '') {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "orderId mancante"]);
    exit;
}

$stmtO = $conn->prepare("SELECT id, total_cents, discount_cents FROM orders WHERE id = ?");
if (!$stmtO) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Prepare fallita", "message" => $conn->error]);
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

$stmtI = $conn->prepare("SELECT product_name, unit_price_cents, qty FROM order_items WHERE order_id = ?");
if (!$stmtI) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Prepare items fallita", "message" => $conn->error]);
    exit;
}

$stmtI->bind_param("s", $orderId);
$stmtI->execute();
$resItems = $stmtI->get_result();

$line_items = [];
while ($row = $resItems->fetch_assoc()) {
    $line_items[] = [
        "price_data" => [
            "currency" => "eur",
            "product_data" => [
                "name" => $row["product_name"]
            ],
            "unit_amount" => (int)$row["unit_price_cents"]
        ],
        "quantity" => (int)$row["qty"]
    ];
}

if (count($line_items) === 0) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Ordine senza righe"]);
    exit;
}

// Inizializzazione Stripe Checkout Session transazionale
require_once __DIR__ . '/../vendor/autoload.php';
$configFile = __DIR__ . '/../config_private.php';
if (file_exists($configFile)) {
    require_once $configFile;
}

if (!defined('STRIPE_SECRET_KEY') || !STRIPE_SECRET_KEY) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "STRIPE_SECRET_KEY non configurata"]);
    exit;
}

\Stripe\Stripe::setApiKey(STRIPE_SECRET_KEY);

$origin = "https://www.enjoyourcoffee.it";
$successUrl = $origin . "/success.html?order_id=" . urlencode($orderId) . "&session_id={CHECKOUT_SESSION_ID}";
$cancelUrl = $origin . "/checkout.html?canceled=1&order_id=" . urlencode($orderId);

try {
    $session_data = [
        "mode" => "payment",
        "success_url" => $successUrl,
        "cancel_url" => $cancelUrl,
        "line_items" => $line_items,
        "client_reference_id" => $orderId,
    ];

    if (isset($order['discount_cents']) && (int)$order['discount_cents'] > 0) {
        $coupon = \Stripe\Coupon::create([
            'amount_off' => (int)$order['discount_cents'],
            'currency' => 'eur',
            'duration' => 'once',
            'name' => 'Sconto 5% Primo Acquisto'
        ]);
        $session_data['discounts'] = [['coupon' => $coupon->id]];
    }

    $session = \Stripe\Checkout\Session::create($session_data);

    echo json_encode(["ok" => true, "url" => $session->url]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "ok" => false,
        "error" => "Stripe error",
        "message" => $e->getMessage()
    ]);
}
