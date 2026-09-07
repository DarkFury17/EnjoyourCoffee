<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db.php'; // oppure ../db.php (vedi sopra)

$conn->set_charset('utf8mb4');
@$conn->select_db('enjoyour89469');

$res = $conn->query("SELECT id, name, slug, parent_id FROM categories ORDER BY name ASC");
if ($res === false) {
  http_response_code(500);
  echo json_encode([
    "ok" => false,
    "error" => "Query categories fallita",
    "errno" => $conn->errno,
    "message" => $conn->error
  ]);
  exit;
}

$rows = [];
while ($r = $res->fetch_assoc()) $rows[] = $r;

echo json_encode($rows);
