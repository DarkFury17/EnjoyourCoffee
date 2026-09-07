<?php
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';

function uuidv4() {
  $data = random_bytes(16);
  $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
  $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
  http_response_code(400);
  echo json_encode(["ok" => false, "error" => "JSON non valido"]);
  exit;
}

$customer = $data["customer"] ?? [];
$address  = $data["address"] ?? [];
$cart     = $data["cart"] ?? [];
$payment_method = (string)($data["payment_method"] ?? $data["paymentmethod"] ?? "cod");
$delivery_slot  = (string)($data["delivery_slot"]  ?? $data["deliveryslot"]  ?? "");
$delivery_notes = (string)($data["notes"]["delivery"] ?? "");

if (!is_array($cart) || count($cart) === 0) {
  http_response_code(400);
  echo json_encode(["ok" => false, "error" => "Carrello vuoto"]);
  exit;
}

// Calcolo totale DAL DB
$subtotal_cents = 0;
$items = [];

$stmtP = $conn->prepare("SELECT id, name, price_cents, price_2, price_1_label, price_2_label FROM products WHERE id = ?");
if (!$stmtP) {
  http_response_code(500);
  echo json_encode(["ok" => false, "error" => "Prepare prodotti fallita", "message" => $conn->error]);
  exit;
}

foreach ($cart as $it) {
  $id  = (string)($it["id"] ?? "");
  $qty = (int)($it["qty"] ?? 0);
  if ($id === "" || $qty <= 0) continue;

  $stmtP->bind_param("s", $id);
  $stmtP->execute();
  $res = $stmtP->get_result();
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
    // Se non corrisponde a nessuno dei due, usa il prezzo base (protezione da manomissioni)
  }
  
  $line_total = $price * $qty;
  $subtotal_cents += $line_total;

  // Aggiungi etichetta variante al nome prodotto per chiarezza nell'ordine
  $display_name = (string)$p["name"];
  if ($variant_label !== "") {
    $display_name .= " (" . $variant_label . ")";
  }

  $items[] = [
    "product_id" => (string)$p["id"],
    "product_name" => $display_name,
    "unit_price_cents" => $price,
    "qty" => $qty
  ];
}

if (count($items) === 0) {
  http_response_code(400);
  echo json_encode(["ok" => false, "error" => "Nessun prodotto valido nel carrello"]);
  exit;
}

// Campi extra presenti in orders (li mettiamo per coerenza col tuo schema)
// ✅ SCONTO 5% SOLO PER IL PRIMO ACQUISTO
$discount_cents = 0;
$user_id = null;
$isLoggedIn = isset($_SESSION['user']) && !empty($_SESSION['user']['id']);
if ($isLoggedIn) {
    $user_id = $_SESSION['user']['id'];
    // Controlla se ha già effettuato ordini
    $stmtOrders = $conn->prepare("SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?");
    if ($stmtOrders) {
        $stmtOrders->bind_param("s", $user_id);
        $stmtOrders->execute();
        $result = $stmtOrders->get_result();
        $row = $result->fetch_assoc();
        if (!$row || (int)$row['cnt'] === 0) {
            // Primo acquisto: applica sconto
            $discount_cents = (int)round($subtotal_cents * 0.05);
        }
        $stmtOrders->close();
    }
}

$delivery_cents = 0;
$cod_fee_cents  = ($payment_method === "cod") ? 500 : 0; // cambia se vuoi fee per contrassegno
$total_cents    = $subtotal_cents - $discount_cents + $delivery_cents + $cod_fee_cents;

$status = ($payment_method === "card") ? "pending_payment" : "pending";

// Dati cliente/indirizzo (nel tuo schema sono NOT NULL quasi tutti)
$customer_name    = (string)($customer["name"] ?? "");
$customer_surname = (string)($customer["surname"] ?? "");
$customer_email   = (string)($customer["email"] ?? "");
$customer_phone   = (string)($customer["phone"] ?? "");
$addr_street  = (string)($address["street"] ?? "");
$addr_number  = (string)($address["number"] ?? "");
$addr_cap     = (string)($address["cap"] ?? "");
$addr_city    = (string)($address["city"] ?? "");
$addr_details = (string)($address["details"] ?? "");

// ✅ CONTROLLO CAP: solo BA (70xxx), BAT (76xxx) e CAP extra ammessi
$cap_validi = ['72015']; // CAP extra ammessi
$cap_prefissi_validi = ['70', '76']; // Prefissi Bari e BAT

$cap_ok = false;

// Controlla se è nei CAP extra ammessi
if (in_array($addr_cap, $cap_validi)) {
    $cap_ok = true;
}

// Controlla se inizia con 70 o 76
if (!$cap_ok) {
    foreach ($cap_prefissi_validi as $prefix) {
        if (substr($addr_cap, 0, 2) === $prefix) {
            $cap_ok = true;
            break;
        }
    }
}

if (!$cap_ok) {
    http_response_code(400);
    echo json_encode([
        "ok" => false, 
        "error" => "Consegna non disponibile per il CAP inserito. Consegniamo solo in provincia di Bari (70xxx), BAT (76xxx) e zone limitrofe."
    ]);
    exit;
}

// ID ordine (varchar 36)
$orderId = uuidv4();

$conn->begin_transaction();

try {
  // INSERT orders con id esplicito
  $stmtO = $conn->prepare("
    INSERT INTO orders
      (id, status,
       customer_name, customer_surname, customer_email, customer_phone,
       address_street, address_number, address_cap, address_city, address_details,
       delivery_notes, delivery_slot, payment_method,
       subtotal_cents, discount_cents, delivery_cents, cod_fee_cents, total_cents,
       user_id)
    VALUES
      (?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?)
  ");
  if (!$stmtO) throw new Exception("Prepare orders fallita: " . $conn->error);

  $stmtO->bind_param(
    "ssssssssssssssiiiiis",
    $orderId, $status,
    $customer_name, $customer_surname, $customer_email, $customer_phone,
    $addr_street, $addr_number, $addr_cap, $addr_city, $addr_details,
    $delivery_notes, $delivery_slot, $payment_method,
    $subtotal_cents, $discount_cents, $delivery_cents, $cod_fee_cents, $total_cents,
    $user_id  // può essere NULL o string
);
  $stmtO->execute();

  // INSERT order_items (order_id è varchar(36)!)
  $stmtI = $conn->prepare("
    INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, qty)
    VALUES (?, ?, ?, ?, ?)
  ");
  if (!$stmtI) throw new Exception("Prepare order_items fallita: " . $conn->error);

  foreach ($items as $it) {
    $pid  = (string)$it["product_id"];
    $pnam = (string)$it["product_name"];
    $pr   = (int)$it["unit_price_cents"];
    $qt   = (int)$it["qty"];

    $stmtI->bind_param("sssii", $orderId, $pid, $pnam, $pr, $qt);
    $stmtI->execute();
  }

  $conn->commit();

  echo json_encode([
    "ok" => true,
    "order" => [
      "id" => $orderId,
      "total_cents" => $total_cents,
      "status" => $status,
      "payment_method" => $payment_method
    ]
  ]);
} catch (Throwable $e) {
  $conn->rollback();
  http_response_code(500);
  echo json_encode(["ok" => false, "error" => "Errore creazione ordine", "message" => $e->getMessage()]);
}
