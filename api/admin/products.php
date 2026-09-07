<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../session.php';

require_seller();

function save_uploaded_product_image(): ?string {
    if (!isset($_FILES['image']) || $_FILES['image']['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    if ($_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(["error" => "Errore durante l'upload del file"]);
        exit;
    }

    $tmpPath = $_FILES['image']['tmp_name'];
    $origName = $_FILES['image']['name'];

    // Whitelist rigida estensioni
    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    $allowedExts = ['webp', 'jpg', 'jpeg', 'png'];
    if (!in_array($ext, $allowedExts, true)) {
        http_response_code(400);
        echo json_encode(["error" => "Estensione non consentita. Sono ammessi solo file .webp, .jpg, .jpeg, .png."]);
        exit;
    }

    // Verifica integrità immagine e MIME reale con getimagesize
    $imgInfo = @getimagesize($tmpPath);
    if ($imgInfo === false || empty($imgInfo['mime'])) {
        http_response_code(400);
        echo json_encode(["error" => "Il file caricato non è un'immagine valida"]);
        exit;
    }

    $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!in_array($imgInfo['mime'], $allowedMimes, true)) {
        http_response_code(400);
        echo json_encode(["error" => "Tipo MIME non valido per l'immagine"]);
        exit;
    }

    // Se l'estensione fileinfo è presente nel server, esegui ulteriore controllo
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $realMime = finfo_file($finfo, $tmpPath);
        finfo_close($finfo);
        if (!in_array($realMime, $allowedMimes, true)) {
            http_response_code(400);
            echo json_encode(["error" => "Tipo MIME non consentito"]);
            exit;
        }
    }

    $uploadDir = __DIR__ . '/../../uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Ridenominazione sicura con token casuale univoco
    $secureName = bin2hex(random_bytes(16)) . '.' . $ext;
    $targetPath = $uploadDir . $secureName;

    if (!move_uploaded_file($tmpPath, $targetPath)) {
        http_response_code(500);
        echo json_encode(["error" => "Impossibile salvare l'immagine sul server"]);
        exit;
    }

    return '/uploads/' . $secureName;
}

$method = $_SERVER['REQUEST_METHOD'];

// GET - Lista prodotti
if ($method === 'GET') {
    $res = $conn->query("SELECT * FROM products ORDER BY display_order ASC, created_at DESC");
    
    if ($res === false) {
        http_response_code(500);
        echo json_encode(["error" => "Query fallita", "message" => $conn->error]);
        exit;
    }
    
    $rows = [];
    while ($r = $res->fetch_assoc()) {
        if (isset($r['price_2']) && $r['price_2'] !== null) {
            $r['price_2'] = (float)$r['price_2'] / 100;
        }
        $rows[] = $r;
    }
    
    echo json_encode($rows);
    exit;
}

// POST - Crea o aggiorna prodotto
if ($method === 'POST') {
    // Estrai ID dall'URL se presente (es: /api/admin/products/123)
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    preg_match('/\/api\/admin\/products\/([0-9]+)/', $path, $matches);
    $id = $matches[1] ?? null;
    
    // Aggiorna esistente
    if ($id) {
        $name = trim($_POST['name'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $price_cents = (int)($_POST['price_cents'] ?? 0);
        $stock_qty = (int)($_POST['stock_qty'] ?? 0);
        $is_active = ($_POST['is_active'] === 'true') ? 1 : 0;
        $category_id = (int)($_POST['category_id'] ?? 0);
        $display_order = (int)($_POST['display_order'] ?? 0);
        
        // Campi doppio prezzo / variante formato
        $price_1_label = trim($_POST['price_1_label'] ?? '');
        $price_1_label = $price_1_label === '' ? null : $price_1_label;
        $price_2_raw = trim($_POST['price_2'] ?? '');
        $price_2 = ($price_2_raw === '' || $price_2_raw === '0') ? null : (int)round((float)$price_2_raw * 100);
        $price_2_label = trim($_POST['price_2_label'] ?? '');
        $price_2_label = $price_2_label === '' ? null : $price_2_label;
        
        // Gestione sicura upload immagine
        $image_url = save_uploaded_product_image();
        
        // Update query
        if ($image_url) {
            $stmt = $conn->prepare("UPDATE products SET name=?, description=?, price_cents=?, stock_qty=?, is_active=?, category_id=?, image_url=?, display_order=?, price_1_label=?, price_2=?, price_2_label=? WHERE id=?");
            $stmt->bind_param("ssiiiisiisii", $name, $description, $price_cents, $stock_qty, $is_active, $category_id, $image_url, $display_order, $price_1_label, $price_2, $price_2_label, $id);
        } else {
            $stmt = $conn->prepare("UPDATE products SET name=?, description=?, price_cents=?, stock_qty=?, is_active=?, category_id=?, display_order=?, price_1_label=?, price_2=?, price_2_label=? WHERE id=?");
            $stmt->bind_param("ssiiiiisisi", $name, $description, $price_cents, $stock_qty, $is_active, $category_id, $display_order, $price_1_label, $price_2, $price_2_label, $id);
        }
        
        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(["error" => "Aggiornamento fallito", "message" => $stmt->error]);
            exit;
        }
        
        echo json_encode(["ok" => true, "message" => "Prodotto aggiornato"]);
        exit;
    }
    
    // Crea nuovo
    $name = trim($_POST['name'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $price_cents = (int)($_POST['price_cents'] ?? 0);
    $stock_qty = (int)($_POST['stock_qty'] ?? 0);
    $is_active = ($_POST['is_active'] === 'true') ? 1 : 0;
    $category_id = (int)($_POST['category_id'] ?? 0);
    $display_order = (int)($_POST['display_order'] ?? 0);
    
    // Campi doppio prezzo / variante formato
    $price_1_label = trim($_POST['price_1_label'] ?? '');
    $price_1_label = $price_1_label === '' ? null : $price_1_label;
    $price_2_raw = trim($_POST['price_2'] ?? '');
    $price_2 = ($price_2_raw === '' || $price_2_raw === '0') ? null : (int)round((float)$price_2_raw * 100);
    $price_2_label = trim($_POST['price_2_label'] ?? '');
    $price_2_label = $price_2_label === '' ? null : $price_2_label;
    
    if (empty($name)) {
        http_response_code(400);
        echo json_encode(["error" => "Nome prodotto richiesto"]);
        exit;
    }
    
    // Gestione sicura upload immagine
    $image_url = save_uploaded_product_image();
    
    $stmt = $conn->prepare("INSERT INTO products (name, description, price_cents, stock_qty, is_active, category_id, image_url, display_order, price_1_label, price_2, price_2_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssiiiisisis", $name, $description, $price_cents, $stock_qty, $is_active, $category_id, $image_url, $display_order, $price_1_label, $price_2, $price_2_label);
    
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(["error" => "Creazione fallita", "message" => $stmt->error]);
        exit;
    }
    
    echo json_encode(["ok" => true, "id" => $conn->insert_id]);
    exit;
}

// DELETE - Elimina prodotto
if ($method === 'DELETE') {
    // Estrai ID dall'URL
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    preg_match('/\/api\/admin\/products\/([0-9]+)/', $path, $matches);
    $id = $matches[1] ?? null;
    
    if (!$id) {
        http_response_code(400);
        echo json_encode(["error" => "ID richiesto"]);
        exit;
    }
    
    $stmt = $conn->prepare("DELETE FROM products WHERE id = ?");
    $stmt->bind_param("i", $id);
    
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(["error" => "Eliminazione fallita", "message" => $stmt->error]);
        exit;
    }
    
    echo json_encode(["ok" => true, "message" => "Prodotto eliminato"]);
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Metodo non supportato"]);
