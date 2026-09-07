<?php
header('Content-Type: application/json');
require 'db.php';

$conn->set_charset('utf8mb4');

$category = isset($_GET['category']) ? trim($_GET['category']) : null;

if ($category) {
    if (is_numeric($category)) {
        $stmt = $conn->prepare("
            SELECT p.*, c.parent_id as category_parent_id, p1.parent_id as category_grandparent_id
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN categories p1 ON c.parent_id = p1.id
            LEFT JOIN categories p2 ON p1.parent_id = p2.id
            LEFT JOIN categories p3 ON p2.parent_id = p3.id
            WHERE (p.category_id = ? OR c.parent_id = ? OR p1.parent_id = ? OR p2.parent_id = ?) AND p.is_active = 1
            ORDER BY p.display_order ASC, p.created_at DESC
        ");
        $category_id = (int)$category;
        $stmt->bind_param("iiii", $category_id, $category_id, $category_id, $category_id);
    } else {
        $stmt = $conn->prepare("
            SELECT p.*, c.parent_id as category_parent_id, p1.parent_id as category_grandparent_id
            FROM products p
            INNER JOIN categories c ON p.category_id = c.id
            LEFT JOIN categories p1 ON c.parent_id = p1.id
            LEFT JOIN categories p2 ON p1.parent_id = p2.id
            LEFT JOIN categories p3 ON p2.parent_id = p3.id
            WHERE (c.slug = ? OR p1.slug = ? OR p2.slug = ? OR p3.slug = ?) AND p.is_active = 1
            ORDER BY p.display_order ASC, p.created_at DESC
        ");
        $stmt->bind_param("ssss", $category, $category, $category, $category);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
} else {
    $result = $conn->query("
        SELECT p.*, c.parent_id as category_parent_id, p1.parent_id as category_grandparent_id
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN categories p1 ON c.parent_id = p1.id
        WHERE p.is_active = 1 
        ORDER BY p.display_order ASC, p.created_at DESC
    ");
}

if ($result === false) {
    http_response_code(500);
    echo json_encode([
        "ok" => false,
        "error" => "Query fallita",
        "errno" => $conn->errno,
        "message" => $conn->error
    ]);
    exit;
}

$products = [];
while ($row = $result->fetch_assoc()) {
    if (isset($row['price_2']) && $row['price_2'] !== null) {
        $row['price_2'] = (float)$row['price_2'] / 100;
    }
    $products[] = $row;
}

echo json_encode($products);
?>
