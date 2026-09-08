<?php
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(["error" => "Accesso diretto non consentito"]);
    exit;
}

ini_set('session.cookie_httponly', 1);
ini_set('session.use_strict_mode', 1);

session_name('EYCSESSID');

$isHttps = (!empty($_SERVER['HTTPS']) && strtolower($_SERVER['HTTPS']) !== 'off')
    || (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443)
    || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https')
    || (isset($_SERVER['HTTP_X_FORWARDED_SSL']) && strtolower($_SERVER['HTTP_X_FORWARDED_SSL']) === 'on');

session_set_cookie_params([
  'lifetime' => 0,
  'path' => '/',
  'secure' => $isHttps,   
  'httponly' => true,
  'samesite' => 'Lax',
]);

session_start();

function json_error($code, $msg) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(["error" => $msg]);
  exit;
}

function require_login() {
  if (empty($_SESSION['user'])) {
    json_error(401, "Non autenticato");
  }
}

// Verifica sessione e autorizzazione RBAC (ruolo seller)
function require_seller() {
  require_login();
  if (($_SESSION['user']['role'] ?? '') !== 'seller') {
    json_error(403, "Accesso negato");
  }
}