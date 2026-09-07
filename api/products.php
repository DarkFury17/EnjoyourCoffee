<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$category_id = isset($_GET['category']) ? (int)$_GET['category'] : null;

if ($category_id) {
    // Filtra per categoria specifica
    $stmt = $conn->prepare("SELECT * FROM products WHERE category_id = ? AND is_active = 1 ORDER BY created_at DESC");
    $stmt->bind_param("i", $category_id);
    $stmt->execute();
    $result = $stmt->get_result();
} else {
    // Tutti i prodotti attivi
    $result = $conn->query("SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC");
}

$products = [];
while ($row = $result->fetch_assoc()) {
    $products[] = $row;
}

echo json_encode($products);
