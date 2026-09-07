<?php
require_once __DIR__ . '/session.php';
header('Content-Type: application/json');
require 'db.php';

$conn->set_charset('utf8mb4');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["ok"=>false,"error"=>"JSON non valido"]);
    exit;
}

$items = $data["items"] ?? null;
// compat: frontend locale manda cart
if ($items === null) {
    $cart = $data["cart"] ?? null;
    if (is_array($cart)) {
        $items = array_map(fn($it) => [
            "id" => $it["id"] ?? null,
            "qty" => $it["qty"] ?? null,
            "price_cents" => $it["price_cents"] ?? null,
            "variant_label" => $it["variant_label"] ?? "",
        ], $cart);
    }
}

if (!is_array($items) || count($items) === 0) {
    http_response_code(400);
    echo json_encode(["ok"=>false,"error"=>"Carrello vuoto"]);
    exit;
}

// calcolo totale leggendo dal DB
$total_cents = 0;
$lines = [];

$stmt = $conn->prepare("SELECT id, name, price_cents, price_2, price_1_label, price_2_label, image_url FROM products WHERE id = ?");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Prepare fallita", "message" => $conn->error]);
    exit;
}

foreach ($items as $it) {
    $id = (string)($it["id"] ?? "");
    $qty = (int)($it["qty"] ?? 0);
    if ($id === "" || $qty <= 0) continue;
    
    $stmt->bind_param("s", $id);
    $stmt->execute();
    $res = $stmt->get_result();
    $p = $res->fetch_assoc();
    if (!$p) continue;
    
    // Determina il prezzo in base alla variante selezionata dal client
    $client_price = isset($it["price_cents"]) ? (int)$it["price_cents"] : null;
    $variant_label = isset($it["variant_label"]) ? (string)$it["variant_label"] : "";
    
    $price = (int)$p["price_cents"]; // default: prezzo base
    
    // Se il client ha inviato un prezzo e il prodotto ha doppio prezzo, valida
    if ($client_price !== null && $p["price_2"] !== null && (int)$p["price_2"] > 0) {
        if ($client_price === (int)$p["price_2"]) {
            $price = (int)$p["price_2"];
        } elseif ($client_price === (int)$p["price_cents"]) {
            $price = (int)$p["price_cents"];
        }
    }
    
    $line_total = $price * $qty;
    $total_cents += $line_total;

    // Aggiungi etichetta variante al nome per chiarezza
    $display_name = $p["name"];
    if ($variant_label !== "") {
        $display_name .= " (" . $variant_label . ")";
    }
    
    $lines[] = [
        "id" => $p["id"],
        "name" => $display_name,
        "price_cents" => $price,
        "qty" => $qty,
        "line_total_cents" => $line_total,
        "image_url" => $p["image_url"] ?? null
    ];
}

$payment_method = (string)($data["payment_method"] ?? $data["paymentmethod"] ?? "cod");
$subtotal_cents = $total_cents;

// ✅ SCONTO 5% SOLO PER IL PRIMO ACQUISTO
$discount_cents = 0;
$isLoggedIn = isset($_SESSION['user']) && !empty($_SESSION['user']['id']);
$has_discount = false;
if ($isLoggedIn) {
    $userId = $_SESSION['user']['id'];
    // Controlla se ha già effettuato ordini
    $stmtOrders = $conn->prepare("SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?");
    if ($stmtOrders) {
        $stmtOrders->bind_param("s", $userId);
        $stmtOrders->execute();
        $result = $stmtOrders->get_result();
        $row = $result->fetch_assoc();
        if (!$row || (int)$row['cnt'] === 0) {
            // Primo acquisto: applica sconto
            $discount_cents = (int)round($subtotal_cents * 0.05);
            $has_discount = true;
        }
        $stmtOrders->close();
    }
}

$delivery_cents = 0;
$cod_fee_cents = ($payment_method === "cod") ? 500 : 0; // €5,00
$total_all_cents = $subtotal_cents - $discount_cents + $delivery_cents + $cod_fee_cents;

echo json_encode([
    "ok" => true,
    "totals" => [
        "subtotal_cents" => $subtotal_cents,
        "discount_cents" => $discount_cents,
        "delivery_cents" => $delivery_cents,
        "cod_fee_cents" => $cod_fee_cents,
        "total_cents" => $total_all_cents,
        // compat
        "subtotalcents" => $subtotal_cents,
        "discountcents" => $discount_cents,
        "deliverycents" => $delivery_cents,
        "codfeecents" => $cod_fee_cents,
        "totalcents" => $total_all_cents
    ],
    "lines" => $lines,
    "has_discount" => $has_discount
]);
