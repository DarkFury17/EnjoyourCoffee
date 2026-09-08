# Rapporto di Security Audit & Vulnerability Assessment
**Progetto:** Enjoy Your Coffee  
**Tipologia applicativa:** Monolito Web (PHP / Vanilla JS / Apache)  
**Data Audit:** 08 Settembre 2026  
**Ruolo:** Senior Application Security Engineer  
**Stato Codebase:** Non modificata (analisi statica read-only)

---

## Executive Summary

È stata condotta una revisione statica della sicurezza (SAST - Static Application Security Testing) e di configurazione architetturale sull'intera codebase del progetto. L'analisi ha riguardato la persistenza dei dati e le query SQL, i meccanismi di autenticazione e gestione delle sessioni, la validazione e sanitizzazione di input/output (XSS e CSRF), la gestione del filesystem e degli upload, nonché le configurazioni server `.htaccess` e la protezione degli asset sensibili.

L'applicazione dimostra l'adozione di buone pratiche di base (come l'uso di query parametrizzate con `mysqli::prepare` per quasi tutti i flussi di input utente e l'hashing delle password con BCRYPT). Tuttavia, sono state individuate **criticità di elevata severità** che mettono a rischio la sicurezza del server, dei dati personali (GDPR) e degli account amministrativi:
1. **Credenziali di produzione hardcoded nella history di Git** (accesso FTP di produzione e database).
2. **Insecure Direct Object Reference (IDOR)** con cancellazione arbitraria di ordini senza autenticazione (`orders_cancel.php`).
3. **Stored Cross-Site Scripting (XSS)** nel pannello amministrativo venditore via dati ordine/variante.
4. **Session Fixation e cookie privi del flag `Secure`** nella gestione delle sessioni PHP.
5. **Esposizione non autorizzata di dati personali (PII)** tramite endpoint pubblici degli ordini.
6. **Host Header Injection / Password Reset Poisoning** nella procedura di recupero password.
7. **Assenza di token Anti-CSRF** su tutte le chiamate API che mutano lo stato.

Di seguito sono dettagliate le schede tecniche di ciascuna vulnerabilità e, in conclusione, la tabella riepilogativa con le priorità di bonifica.

---

## Schede di Dettaglio Vulnerabilità

---

### SEC-01: Credenziali di Produzione Hardcoded in Chiaro nella Cronologia Git
- **Severità:** Critica
- **File e Riga:** `.vscode/sftp.json` (Commit `78db922^:.vscode/sftp.json`, righe 1-16) e `config_private.php` (Commit `aed02fa` e file locale, righe 3-10)
- **Descrizione della vulnerabilità:**  
  Sebbene il file `.vscode/sftp.json` sia stato eliminato nel commit `78db922`, la cronologia completa di Git mantiene in chiaro le credenziali FTP dell'infrastruttura di hosting (`host: ftp.enjoyourcoffee.it`, `username: enjoyourcoffee.it`, `password: pudohC2j`). Chiunque abbia accesso al repository GitHub (o ad una copia clonata) può recuperare le credenziali ed ottenere accesso in scrittura/lettura all'intero filesystem del server web `/htdocs`. Inoltre, le credenziali MySQL di produzione e la chiave Stripe sono presenti nel file `config_private.php` e sono state storicamente tracciate nel commit iniziale `aed02fa`.
- **Codice Attuale Vulnerabile:**  
  *Estratto dal commit storico `78db922^:.vscode/sftp.json`:*
  ```json
  {
      "name": "EnjoyCoffee Tophost",
      "host": "ftp.enjoyourcoffee.it",
      "protocol": "ftp",
      "port": 21,
      "username": "enjoyourcoffee.it",
      "password": "pudohC2j",
      "remotePath": "/htdocs",
      "uploadOnSave": true
  }
  ```
- **Soluzione Proposta:**  
  1. Ruotare **immediatamente** la password dell'account FTP sul pannello dell'hosting provider e la password dell'utente database `enjoyour89469`.  
  2. Ruotare la chiave segreta Stripe.  
  3. Rimuovere permanentemente i file sensibili dalla storia del repository Git utilizzando uno strumento di riscrittura della storia come `git-filter-repo` o `BFG Repo-Cleaner`:
  ```bash
  # Esempio con git-filter-repo
  pip install git-filter-repo
  git filter-repo --invert-paths --path .vscode/sftp.json --path config_private.php --force
  git push origin --force --all
  ```
  4. Mantenere `config_private.php` esclusivamente sul server di produzione e iniettare le credenziali tramite variabili d'ambiente di sistema Apache/PHP (`getenv()`).

---

### SEC-02: Broken Object Level Authorization (IDOR) con Cancellazione Arbitraria degli Ordini
- **Severità:** Critica
- **File e Riga:** `api/orders_cancel.php`, righe 23-52
- **Descrizione della vulnerabilità:**  
  L'endpoint `POST /api/orders/{id}/cancel` non implementa alcun controllo di autenticazione (`require_login()` o `require_seller()`) né verifica la titolarità dell'ordine rispetto all'utente in sessione (`user_id`). Qualsiasi utente non autenticato che conosca o intercetti l'UUID di un ordine in stato `pending_payment` può inviare una richiesta POST e scatenare le query `DELETE FROM order_items` e `DELETE FROM orders`, cancellando definitivamente e irreversibilmente l'ordine e le sue righe dal database.
- **Codice Attuale Vulnerabile:**  
  *`api/orders_cancel.php`:*
  ```php
  $stmt = $conn->prepare("SELECT status FROM orders WHERE id = ?");
  $stmt->bind_param("s", $id);
  $stmt->execute();
  $order = $stmt->get_result()->fetch_assoc();

  if (!$order) {
      http_response_code(404);
      echo json_encode(["error" => "Ordine non trovato"]);
      exit;
  }

  if ($order['status'] !== 'pending_payment') {
      http_response_code(400);
      echo json_encode(["error" => "L'ordine non puo essere annullato perche ha gia superato la fase di pagamento (status: " . $order['status'] . ")."]);
      exit;
  }

  $conn->begin_transaction();

  try {
      $stmtI = $conn->prepare("DELETE FROM order_items WHERE order_id = ?");
      $stmtI->bind_param("s", $id);
      $stmtI->execute();

      $stmtO = $conn->prepare("DELETE FROM orders WHERE id = ?");
      $stmtO->bind_param("s", $id);
      $stmtO->execute();

      $conn->commit();
      echo json_encode(["ok" => true, "message" => "Ordine annullato con successo."]);
  ```
- **Soluzione Proposta:**  
  1. Verificare che l'utente che richiede la cancellazione sia il proprietario dell'ordine (oppure un amministratore con ruolo `seller`).  
  2. Implementare il Soft Delete o l'aggiornamento dello stato in `canceled` anziché la distruzione fisica dei record (`DELETE`).  
  3. Integrare un token di autorizzazione/CSRF.
  ```php
  require_once __DIR__ . '/session.php';
  require_once __DIR__ . '/db.php';

  require_login(); // Obbliga l'autenticazione

  $userId = $_SESSION['user']['id'];
  $userRole = $_SESSION['user']['role'] ?? '';

  $stmt = $conn->prepare("SELECT status, user_id FROM orders WHERE id = ?");
  $stmt->bind_param("s", $id);
  $stmt->execute();
  $order = $stmt->get_result()->fetch_assoc();

  if (!$order) {
      json_error(404, "Ordine non trovato");
  }

  // Verifica autorizzazione: proprietario dell'ordine o venditore
  if ($userRole !== 'seller' && (string)$order['user_id'] !== (string)$userId) {
      json_error(403, "Non sei autorizzato ad annullare questo ordine");
  }

  if ($order['status'] !== 'pending_payment') {
      json_error(400, "Impossibile annullare un ordine già elaborato");
  }

  // Soft delete: aggiornamento stato invece di eliminazione fisica
  $stmtUpd = $conn->prepare("UPDATE orders SET status = 'canceled' WHERE id = ?");
  $stmtUpd->bind_param("s", $id);
  $stmtUpd->execute();

  echo json_encode(["ok" => true, "message" => "Ordine impostato su annullato"]);
  ```

---

### SEC-03: Stored Cross-Site Scripting (XSS) nel Pannello Amministrativo Venditore
- **Severità:** Critica
- **File e Riga:** `js/admin.js`, righe 611-617 e 649-683; `api/orders_create.php`, righe 76-80 e 120-129
- **Descrizione della vulnerabilità:**  
  Nel flusso di checkout pubblico (`api/orders_create.php`), i dati forniti dall'acquirente (`customer_name`, `customer_surname`, `customer_email`, `customer_phone`, `address_street`, `address_city`, `delivery_notes`, `variant_label`) vengono inseriti direttamente nel database senza sanificazione HTML.  
  Nel file `js/admin.js`, all'interno delle funzioni `loadOrders()` e `loadOrderDetail()`, tali campi vengono inseriti nel DOM del pannello di controllo venditore tramite template string e **`innerHTML`** non protetto:
  - `card.innerHTML = ... ${o.customer_name} ${o.customer_surname}...`
  - `orderDetail.innerHTML = ... ${o.customer_name} ... ${it.product_name} ...`
  Un attaccante può effettuare un ordine pubblico inserendo un payload JavaScript (es. `<img src=x onerror="...">`) nel nome, indirizzo o variante. Quando il venditore apre l'area ordini in `admin.html`, lo script malevolo viene eseguito nel contesto della sessione del venditore, consentendo il furto di dati riservati, l'alterazione dei prodotti a catalogo o l'esfiltrazione dell'intero database clienti.
- **Codice Attuale Vulnerabile:**  
  *`js/admin.js` (righe 611-617):*
  ```javascript
  card.innerHTML = `
    <div class="muted small">${new Date(o.created_at).toLocaleString("it-IT")} · ${paymentLabel(o.payment_method)}</div>
    <div style="margin-top:6px;"><b>${o.customer_name} ${o.customer_surname}</b></div>
    <div class="muted small">${o.customer_email} · ${o.customer_phone}</div>
    <div class="muted small">${o.address_city} (${o.address_cap}) · Slot: ${o.delivery_slot}</div>
    <div style="margin-top:8px;"><b>Totale:</b> ${euro(o.total_cents)}</div>
  `;
  ```
  *`js/admin.js` (righe 674-683):*
  ```javascript
  ${items
    .map(
      (it) => `
        <div class="row">
          <span>${it.product_name} × ${it.qty}</span>
          <span>${euro(it.unit_price_cents * it.qty)}</span>
        </div>
      `
    )
    .join("")}
  ```
- **Soluzione Proposta:**  
  1. Creare una funzione universale di escape HTML in JavaScript per sanitizzare qualsiasi stringa prima di interpolarla in `innerHTML`, oppure utilizzare esclusivamente `textContent` e la creazione di nodi DOM sicuri.
  ```javascript
  // Funzione di escaping HTML difensiva
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  ```
  2. Applicare `escapeHtml()` su tutte le variabili interpolate in `js/admin.js`, `js/orders.js`, `js/app.js` e `js/checkout.js`:
  ```javascript
  card.innerHTML = `
    <div class="muted small">${escapeHtml(new Date(o.created_at).toLocaleString("it-IT"))} · ${escapeHtml(paymentLabel(o.payment_method))}</div>
    <div style="margin-top:6px;"><b>${escapeHtml(o.customer_name)} ${escapeHtml(o.customer_surname)}</b></div>
    <div class="muted small">${escapeHtml(o.customer_email)} · ${escapeHtml(o.customer_phone)}</div>
    <div class="muted small">${escapeHtml(o.address_city)} (${escapeHtml(o.address_cap)}) · Slot: ${escapeHtml(o.delivery_slot)}</div>
    <div style="margin-top:8px;"><b>Totale:</b> ${euro(o.total_cents)}</div>
  `;
  ```
  3. Lato server in `api/orders_create.php`, validare e sanitizzare le stringhe testuali prima dell'inserimento:
  ```php
  $customer_name = htmlspecialchars(trim((string)($customer["name"] ?? '')), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
  $variant_label = htmlspecialchars(trim((string)($it["variant_label"] ?? '')), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
  ```

---

### SEC-04: Session Fixation e Cookie Sessione Privo di Flag `Secure`
- **Severità:** Alta
- **File e Riga:** `api/session.php` (riga 17), `api/login.php` (righe 58-62), `api/users_login.php` (righe 75-81), `api/users_verify_email.php` (righe 57-63)
- **Descrizione della vulnerabilità:**  
  1. In `api/session.php`, i parametri del cookie di sessione sono configurati con `'secure' => false`. Questo permette la trasmissione del cookie di sessione `EYCSESSID` su canali HTTP non cifrati (es. attacchi Man-in-the-Middle o richieste a risorse non HTTPS), esponendo il token di autenticazione all'intercettazione.  
  2. Negli endpoint di login e completamento autenticazione (`login.php`, `users_login.php`, `users_verify_email.php`), l'identificatore di sessione non viene rigenerato dopo la verifica delle credenziali. Un attaccante può pre-assegnare un ID di sessione alla vittima (Session Fixation - CWE-384) e, una volta che la vittima si autentica, accedere con lo stesso ID di sessione.
- **Codice Attuale Vulnerabile:**  
  *`api/session.php` (righe 14-20):*
  ```php
  session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => false,   
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
  ```
  *`api/login.php` (righe 58-62) & `api/users_login.php` (righe 75-81):*
  ```php
  // Nessuna chiamata a session_regenerate_id(true) prima di popolare la sessione
  $_SESSION['user'] = [
    "id" => $user["id"],
    "email" => $user["email"],
    "role" => $user["role"],
  ];
  ```
- **Soluzione Proposta:**  
  1. Abilitare dinamicamente o forzare il flag `secure` se la connessione è HTTPS o in produzione:
  ```php
  $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || 
             (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) ||
             (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

  session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $isHttps,   
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
  ```
  2. Invocare sempre `session_regenerate_id(true)` contestualmente alla corretta verifica dell'utente in tutti gli script di login/verifica:
  ```php
  // Rigenerazione ID di sessione con eliminazione del vecchio file di sessione
  session_regenerate_id(true);

  $_SESSION['user'] = [
    "id" => $user["id"],
    "email" => $user["email"],
    "role" => $user["role"],
  ];
  ```

---

### SEC-05: Esposizione di Dati Personali (PII) tramite Endpoint Ordini Pubblici
- **Severità:** Alta
- **File e Riga:** `api/orders_public.php` (righe 16-36) e `api/orders_get.php` (righe 16-53)
- **Descrizione della vulnerabilità:**  
  L'endpoint `api/orders_public.php?id={uuid}` (e similmente `api/orders_get.php?order_id={uuid}`) esegue una query `SELECT * FROM orders WHERE id = ?` e restituisce in output JSON l'intero record della tabella `orders`.  
  Ciò include dati personali e confidenziali dell'acquirente: nome, cognome, indirizzo email, recapito telefonico, indirizzo di spedizione completo (via, civico, CAP, città, note di consegna), slot orario e `user_id`. Chiunque conosca, intercetti o enumeri l'ID dell'ordine può visualizzare i dati sensibili senza alcuna autenticazione o autorizzazione, violando i principi di data minimization del GDPR.
- **Codice Attuale Vulnerabile:**  
  *`api/orders_public.php`:*
  ```php
  $stmtO = $conn->prepare("SELECT * FROM orders WHERE id = ?");
  $stmtO->bind_param("s", $orderId);
  $stmtO->execute();
  $resO = $stmtO->get_result();
  $order = $resO ? $resO->fetch_assoc() : null;
  ...
  echo json_encode(["ok"=>true,"order"=>$order,"items"=>$items]);
  ```
- **Soluzione Proposta:**  
  1. Se l'endpoint serve solo per mostrare la pagina di conferma `success.html`, restituire un payload strettamente ridotto contenente solo ID, stato e importo totale, filtrando completamente i campi PII.  
  2. Per i dettagli completi, richiedere l'autenticazione (`require_login()`) e verificare che l'ordine appartenga all'utente in sessione oppure ad un utente con ruolo `seller`.
  ```php
  // api/orders_public.php (ridotto ai minimi termini non sensibili)
  $stmtO = $conn->prepare("SELECT id, status, total_cents, created_at FROM orders WHERE id = ?");
  $stmtO->bind_param("s", $orderId);
  $stmtO->execute();
  $order = $stmtO->get_result()->fetch_assoc();

  if (!$order) {
      json_error(404, "Ordine non trovato");
  }

  echo json_encode([
      "ok" => true,
      "order" => [
          "id" => $order["id"],
          "status" => $order["status"],
          "total_cents" => (int)$order["total_cents"],
          "created_at" => $order["created_at"]
      ]
  ]);
  ```

---

### SEC-06: Host Header Injection / Password Reset Poisoning & Mail Header Injection
- **Severità:** Alta
- **File e Riga:** `api/users_recover_password.php` (righe 48-59), `api/users_login.php` (righe 52-56), `api/users_register.php` (righe 68-76)
- **Descrizione della vulnerabilità:**  
  Nel file `api/users_recover_password.php`, l'URL del link di ripristino password inviato all'utente viene generato utilizzando direttamente l'header HTTP inviato dal client (`$_SERVER['HTTP_HOST']`).  
  Un attaccante può inviare una richiesta POST verso `/api/users/recover-password` specificando l'email della vittima e modificando l'header `Host` (es. `Host: evil-attacker.com`). Il link di reset generato nell'email sarà `https://evil-attacker.com/reset-password.html?token=...`. Non appena la vittima clicca sul link, il token segreto di ripristino viene inviato al server dell'attaccante, permettendo l'immediato Account Takeover.  
  Inoltre, `$_SERVER['HTTP_HOST']` viene concatenato negli header email `From:` e `Reply-To:` senza sanificazione contro caratteri CRLF (`\r\n`), aprendo a rischi di Mail Header Injection e spoofing del mittente.
- **Codice Attuale Vulnerabile:**  
  *`api/users_recover_password.php` (righe 48-56):*
  ```php
  $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
  $host = $_SERVER['HTTP_HOST'];
  $resetLink = $protocol . $host . "/reset-password.html?token=" . urlencode($token);

  $headers = "From: noreply@" . str_replace("www.", "", $host) . "\r\n";
  $headers .= "Reply-To: noreply@" . str_replace("www.", "", $host) . "\r\n";
  ```
- **Soluzione Proposta:**  
  1. Definire il dominio applicativo in modo statico e centralizzato (es. in `config_private.php`), ignorando completamente il valore dell'header `Host` inviato dall'utente.  
  2. Utilizzare un indirizzo mittente fisso e convalidare l'email del destinatario con `filter_var()`.
  ```php
  // In config_private.php:
  // define('APP_DOMAIN', 'www.enjoyourcoffee.it');
  // define('MAIL_FROM', 'noreply@enjoyourcoffee.it');

  $domain = defined('APP_DOMAIN') ? APP_DOMAIN : 'www.enjoyourcoffee.it';
  $fromMail = defined('MAIL_FROM') ? MAIL_FROM : 'noreply@enjoyourcoffee.it';

  $resetLink = "https://" . $domain . "/reset-password.html?token=" . urlencode($token);

  $headers  = "From: " . $fromMail . "\r\n";
  $headers .= "Reply-To: " . $fromMail . "\r\n";
  $headers .= "MIME-Version: 1.0\r\n";
  $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
  ```

---

### SEC-07: Assenza di Protezione CSRF (Cross-Site Request Forgery) sulle API con Effetti di Stato
- **Severità:** Alta
- **File e Riga:** `api/admin/products.php` (righe 95-194), `api/admin/orders.php` (righe 59-87), `api/stripe_confirm_payment.php` (righe 15-57)
- **Descrizione della vulnerabilità:**  
  Tutti gli endpoint di amministrazione e gestione ordini che modificano lo stato dell'applicazione (creazione/modifica/cancellazione prodotti, aggiornamento stato ordini) si affidano unicamente alla presenza del cookie di sessione. Poiché i cookie hanno `SameSite=Lax`, e non viene richiesto né convalidato alcun token CSRF (Synchronizer Token o Header personalizzato anti-CSRF come `X-Requested-With` o `X-CSRF-Token` validato lato server), l'applicazione è vulnerabile a Cross-Site Request Forgery.  
  Inoltre, `api/stripe_confirm_payment.php` altera lo stato dell'ordine nel database (eseguendo un `UPDATE orders SET status = ?...`) a fronte di una richiesta **HTTP GET**, violando le specifiche HTTP RFC 7231 riguardanti l'idempotenza dei metodi GET e permettendo attacchi via tag `<img src="...">` o prefetching.
- **Codice Attuale Vulnerabile:**  
  *`api/admin/products.php` (nessuna verifica di token):*
  ```php
  if ($method === 'POST') {
      // Modifica/creazione prodotto eseguita senza verifica token CSRF
  }
  if ($method === 'DELETE') {
      // Cancellazione prodotto eseguita senza verifica token CSRF
  }
  ```
  *`api/stripe_confirm_payment.php`:*
  ```php
  // Esecuzione di UPDATE a fronte di richiesta GET:
  $orderId = (string)($_GET['order_id'] ?? '');
  $sessionId = (string)($_GET['session_id'] ?? '');
  ...
  $stmt = $conn->prepare("UPDATE orders SET status = ?, stripe_session_id = ?, stripe_payment_status = ? WHERE id = ?");
  ```
- **Soluzione Proposta:**  
  1. Implementare la generazione e validazione di token CSRF crittografici in sessione per tutte le richieste che alterano lo stato (`POST`, `PATCH`, `DELETE`).  
  2. Spostare la conferma di pagamento da `GET` a `POST` e gestirla preferibilmente tramite il Webhook ufficiale Stripe (`/api/webhooks/stripe`) con verifica crittografica della firma `Stripe-Signature`.
  ```php
  // Helper in session.php
  function get_csrf_token(): string {
      if (empty($_SESSION['csrf_token'])) {
          $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
      }
      return $_SESSION['csrf_token'];
  }

  function verify_csrf_token(): void {
      $headerToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
      $bodyToken = $_POST['csrf_token'] ?? '';
      $validToken = $_SESSION['csrf_token'] ?? '';

      if (!$validToken || (!hash_equals($validToken, $headerToken) && !hash_equals($validToken, $bodyToken))) {
          json_error(403, "Token CSRF non valido o mancante");
      }
  }
  ```

---

### SEC-08: Mancanza di Astrazione PDO e Disabilitazione Eccezioni MySQLi
- **Severità:** Media
- **File e Riga:** `api/db.php` (righe 29-40) e tutti i file in `api/`
- **Descrizione della vulnerabilità:**  
  L'applicazione fa uso esclusivo dell'estensione MySQLi anziché di PDO (PHP Data Objects). Sebbene le query dinamiche utilizzino correttamente `prepare()` e `bind_param()`, in `api/db.php` le eccezioni sono state disabilitate tramite `mysqli_report(MYSQLI_REPORT_OFF)`.  
  Questo comporta che in caso di fallimento di una query o di un vincolo, l'esecuzione prosegue a meno che ogni singolo script non verifichi manualmente i valori di ritorno. In alcuni file (es. `api/get_categories.php`), si ricorre a chiamate arbitrarie come `@$conn->select_db('enjoyour89469')` con nome database hardcoded, e in altri la gestione degli errori è eterogenea, esponendo al rischio di errori silenti o fallimenti parziali di transazioni.
- **Codice Attuale Vulnerabile:**  
  *`api/db.php` (righe 29-31):*
  ```php
  mysqli_report(MYSQLI_REPORT_OFF);

  $conn = @new mysqli($host, $user, $pass, $dbname, $port);
  ```
- **Soluzione Proposta:**  
  Migrare la connessione verso `PDO` con `ERRMODE_EXCEPTION` e `EMULATE_PREPARES => false`, garantendo una gestione uniforme, sicura e nativa dei Prepared Statements:
  ```php
  $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
  $options = [
      PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES   => false,
  ];

  try {
      $pdo = new PDO($dsn, $user, $pass, $options);
  } catch (PDOException $e) {
      error_log("DB Connection error: " . $e->getMessage());
      http_response_code(500);
      header('Content-Type: application/json; charset=utf-8');
      echo json_encode(["error" => "Errore di connessione al database"]);
      exit;
  }
  ```

---

### SEC-09: Information Disclosure: Esposizione di Errori Interni del Database e Versioni Software
- **Severità:** Media
- **File e Riga:** `api/db.php` (righe 35-39), `api/login.php` (righe 2-4, 37, 45), `api/users_register.php` (righe 2-3, 57, 64, 74), `api/admin/products.php` (righe 79, 128, 164, 188), `api/get_products.php` (righe 56-57)
- **Descrizione della vulnerabilità:**  
  In numerosi script PHP attivi sono presenti direttive di debug `ini_set('display_errors', 1)` e blocchi di codice che restituiscono direttamente nel JSON di risposta per il client i messaggi tecnici del motore MySQL (`$conn->error`, `$stmt->error`, `$conn->connect_error`).  
  Questo espone la struttura interna del database (nomi di colonne, tabelle, vincoli di chiave) e percorsi del server ai visitatori. Inoltre, in `api/users_register.php` (riga 74) viene aggiunto l'header email `X-Mailer: PHP/" . phpversion()`, che divulga l'esatta versione di PHP in esecuzione, agevolando attacchi mirati a vulnerabilità note della specifica versione.
- **Codice Attuale Vulnerabile:**  
  *`api/db.php` (righe 35-39):*
  ```php
  if ($conn->connect_error) {
    header('Content-Type: application/json');
    die(json_encode([
      "error" => "Connessione fallita",
      "errno" => $conn->connect_errno,
      "message" => $conn->connect_error
    ]));
  }
  ```
  *`api/login.php` (righe 37 e 45):*
  ```php
  echo json_encode(["error" => "Prepare fallita", "message" => $conn->error]);
  ...
  echo json_encode(["error" => "Execute fallita", "message" => $stmt->error]);
  ```
- **Soluzione Proposta:**  
  1. Disabilitare tassativamente `display_errors` in ambiente di produzione.  
  2. Registrare gli errori dettagliati unicamente nei log server (`error_log()`) e restituire al client messaggi di errore generici.  
  3. Rimuovere l'header `X-Mailer`.
  ```php
  // api/db.php o configurazione globale
  ini_set('display_errors', '0');
  ini_set('display_startup_errors', '0');
  ini_set('log_errors', '1');

  // Nelle risposte di errore:
  error_log("Database Error: " . $conn->error);
  http_response_code(500);
  echo json_encode(["ok" => false, "error" => "Si è verificato un errore interno. Riprova più tardi."]);
  exit;
  ```

---

### SEC-10: Mancanza di Rate Limiting su Endpoint Critici di Autenticazione e OTP
- **Severità:** Media
- **File e Riga:** `api/login.php`, `api/users_login.php`, `api/users_verify_email.php`, `api/users_recover_password.php`
- **Descrizione della vulnerabilità:**  
  Non è presente alcun meccanismo di limitazione della frequenza delle richieste (Rate Limiting) o di blocco temporaneo dell'account/IP dopo tentativi falliti ripetuti.  
  In particolare, il codice di verifica email OTP inviato da `api/users_register.php` e convalidato in `api/users_verify_email.php` è un numero a sole 6 cifre (`100000 - 999999`), generato mediante `mt_rand()` (un generatore pseudocasuale non crittografico). Senza rate limiting o scadenza breve, un attaccante può forzare l'intero spazio di ricerca delle 1.000.000 di combinazioni via script automatizzato in pochi minuti, convalidando qualsiasi account o bypassando la verifica.
- **Codice Attuale Vulnerabile:**  
  *`api/users_register.php` (riga 47):*
  ```php
  $verification_code = sprintf("%06d", mt_rand(1, 999999));
  ```
  *`api/users_verify_email.php` (righe 28-36 - nessun conteggio fallimenti):*
  ```php
  $stmt->bind_param("ss", $email, $code);
  $stmt->execute();
  $res = $stmt->get_result();

  if ($res->num_rows === 0) {
      http_response_code(400);
      echo json_encode(["error" => "Codice di sicurezza non valido o già utilizzato."]);
      exit;
  }
  ```
- **Soluzione Proposta:**  
  1. Utilizzare `random_int()` al posto di `mt_rand()` per garantire casualità crittograficamente sicura (CSPRNG).  
  2. Aggiungere un contatore di tentativi errati (`failed_attempts`) nella tabella utenti, invalidando il codice dopo un massimo di 5 tentativi.  
  3. Implementare il rate limiting a livello di web server (tramite `mod_ratelimit` / `mod_evasive` di Apache) o memorizzando i tentativi su cache/database per IP ed email.
  ```php
  // Generazione crittograficamente sicura
  $verification_code = sprintf("%06d", random_int(100000, 999999));
  ```

---

### SEC-11: Mancanza di Validazione Dimensione File e Mancata Rielaborazione Immagini in Upload
- **Severità:** Media
- **File e Riga:** `api/admin/products.php`, righe 9-70
- **Descrizione della vulnerabilità:**  
  La funzione `save_uploaded_product_image()` implementa un buon livello di sicurezza di base (verifica estensione, MIME type con `finfo_file` e `getimagesize`, hashing casuale del nome file tramite `random_bytes(16)` per prevenire Path Traversal).  
  Tuttavia:
  1. Non viene verificata la dimensione massima del file caricato (`$_FILES['image']['size']`), esponendo a rischi di Denial of Service per saturazione dello spazio disco sul server.  
  2. Il file temporaneo viene spostato direttamente con `move_uploaded_file` senza rielaborazione o ricompressione grafica (es. via libreria `GD` o `Imagick`). Questo permette la conservazione di metadati EXIF malevoli o codice PHP inserito come payload all'interno di file immagine validi (polyglot files).
- **Codice Attuale Vulnerabile:**  
  *`api/admin/products.php` (righe 55-67):*
  ```php
  $uploadDir = __DIR__ . '/../../uploads/';
  if (!is_dir($uploadDir)) {
      mkdir($uploadDir, 0755, true);
  }

  $secureName = bin2hex(random_bytes(16)) . '.' . $ext;
  $targetPath = $uploadDir . $secureName;

  if (!move_uploaded_file($tmpPath, $targetPath)) { ... }
  ```
- **Soluzione Proposta:**  
  1. Convalidare esplicitamente la dimensione del file (es. massimo 3 MB).  
  2. Rielaborare e ricodificare l'immagine sul server (es. convertendo sempre in WebP pulito tramite `imagecreatefromstring()` / `imagewebp()`), distruggendo qualsiasi payload o script nascosto all'interno dei metadati:
  ```php
  // Limite 3MB
  $maxSize = 3 * 1024 * 1024;
  if ($_FILES['image']['size'] > $maxSize) {
      json_error(400, "L'immagine supera la dimensione massima consentita (3MB)");
  }

  // Ricodifica e stripping metadati
  $imgContent = file_get_contents($tmpPath);
  $srcImg = @imagecreatefromstring($imgContent);
  if (!$srcImg) {
      json_error(400, "File immagine non elaborabile o corrotto");
  }

  $secureName = bin2hex(random_bytes(16)) . '.webp';
  $targetPath = $uploadDir . $secureName;

  if (!imagewebp($srcImg, $targetPath, 85)) {
      imagedestroy($srcImg);
      json_error(500, "Errore durante l'elaborazione dell'immagine");
  }
  imagedestroy($srcImg);
  ```

---

### SEC-12: Mancata Validazione del Ruolo Venditore in `login.php` (Separazione dei Privilegi)
- **Severità:** Bassa
- **File e Riga:** `api/login.php`, righe 34-64
- **Descrizione della vulnerabilità:**  
  L'endpoint `/api/auth/login` (utilizzato dal form di login venditore in `admin.html`) autentica qualsiasi utente valido presente nella tabella `users`, indipendentemente dal suo ruolo (`role`).  
  Se un comune cliente (`role = 'customer'`) inserisce le proprie credenziali in `admin.html`, `login.php` risponde con esito positivo `{"ok": true, "user": ...}`. Di conseguenza, lo script frontend `admin.js` mostra le sezioni riservate della dashboard, prima che le successive chiamate API vengano respinte con 403 da `require_seller()`. L'autenticazione venditore deve fallire immediatamente all'origine se l'utente non possiede il ruolo necessario.
- **Codice Attuale Vulnerabile:**  
  *`api/login.php` (righe 52-64):*
  ```php
  if (!$user || !password_verify($password, $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(["error" => "Credenziali errate"]);
    exit;
  }

  $_SESSION['user'] = [
    "id" => $user["id"],
    "email" => $user["email"],
    "role" => $user["role"],
  ];

  echo json_encode(["ok" => true, "user" => $_SESSION['user']]);
  ```
- **Soluzione Proposta:**  
  Verificare immediatamente il ruolo `seller` all'interno di `api/login.php` prima di inizializzare la sessione:
  ```php
  if (!$user || !password_verify($password, $user['password_hash'])) {
      json_error(401, "Credenziali errate");
  }

  if (($user['role'] ?? '') !== 'seller') {
      json_error(403, "Accesso riservato: non disponi dei privilegi di venditore");
  }
  ```

---

### SEC-13: Headers di Sicurezza HTTP Mancanti e File `.htaccess` di Root Non Tracciato
- **Severità:** Bassa
- **File e Riga:** `.htaccess` (root), righe 25-29; git status del repository
- **Descrizione della vulnerabilità:**  
  1. Il file `.htaccess` principale della root risulta attualmente **non tracciato** (`untracked`) nel repository Git. Qualora il progetto venga deployato tramite pipeline CI/CD o `git pull`, il file `.htaccess` potrebbe non essere presente sul server web, lasciando esposti file di configurazione e abilitando il directory listing.  
  2. Negli header di sicurezza di `.htaccess` mancano direttive cruciali:
     - `Strict-Transport-Security` (HSTS): non forza HTTPS a livello di browser.
     - `Content-Security-Policy` (CSP): assente, non limita l'esecuzione di script non autorizzati o il caricamento di risorse cross-origin.
     - `Referrer-Policy`: non configurato (rischio di esporre URL con token/parametri nel campo `Referer`).
     - `Permissions-Policy`: non configurato.  
  3. Nel regex di protezione file sensibili:
     `<FilesMatch "(?i)\.(example|json|lock|sql|log|sh|bak|env)$|^config_private\.php$">`
     Il file `config_private.example.php` ha estensione `.php`, pertanto non termina con `.example` e non viene bloccato dal regex.
- **Codice Attuale Vulnerabile:**  
  *`.htaccess` (root, righe 10-12 e 25-29):*
  ```apache
  <FilesMatch "(?i)\.(example|json|lock|sql|log|sh|bak|env)$|^config_private\.php$">
      Require all denied
  </FilesMatch>

  <IfModule mod_headers.c>
      Header always set X-Content-Type-Options "nosniff"
      Header always set X-Frame-Options "SAMEORIGIN"
  </IfModule>
  ```
- **Soluzione Proposta:**  
  1. Eseguire il commit del file `.htaccess` di root in Git.  
  2. Aggiornare le regole di blocco file e completare gli header di sicurezza:
  ```apache
  # Blocco file sensibili e configurazioni
  <FilesMatch "(?i)(\.(example|json|lock|sql|log|sh|bak|env)|\.example\.php|^config_private\.php)$">
      Require all denied
  </FilesMatch>

  # Blocco accesso diretto a file PHP interni di utilità
  <FilesMatch "^(db|session)\.php$">
      Require all denied
  </FilesMatch>

  # Security Headers completi
  <IfModule mod_headers.c>
      Header always set X-Content-Type-Options "nosniff"
      Header always set X-Frame-Options "SAMEORIGIN"
      Header always set Referrer-Policy "strict-origin-when-cross-origin"
      Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
      Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
      Header always set Content-Security-Policy "default-src 'self'; script-src 'self' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com;"
  </IfModule>
  ```

---

### SEC-14: Esecuzione di Istruzioni DDL (ALTER TABLE) a Runtime su Richieste HTTP Pubbliche
- **Severità:** Bassa
- **File e Riga:** `api/users_register.php` (righe 9-15) e `api/users_recover_password.php` (righe 8-12)
- **Descrizione della vulnerabilità:**  
  Ad ogni singola richiesta di registrazione utente o di recupero password vengono invocate 6 istruzioni DDL `ALTER TABLE users ADD COLUMN...`.  
  In MySQL, l'esecuzione ripetuta di `ALTER TABLE` a runtime provoca lock di metadati sulla tabella `users`, rallentamenti generalizzati e possibili crash o Denial of Service sotto carichi di traffico concorrenti. Le modifiche allo schema devono essere applicate una tantum tramite script di migrazione dedicati e mai inserite nel normale flusso di esecuzione delle API.
- **Codice Attuale Vulnerabile:**  
  *`api/users_register.php` (righe 9-15):*
  ```php
  // Aggiungiamo le colonne se non esistono (ignorerà l'errore se esistono già)
  $conn->query("ALTER TABLE users ADD COLUMN name VARCHAR(255) DEFAULT ''");
  $conn->query("ALTER TABLE users ADD COLUMN surname VARCHAR(255) DEFAULT ''");
  $conn->query("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL");
  $conn->query("ALTER TABLE users ADD COLUMN reset_expires DATETIME DEFAULT NULL");
  $conn->query("ALTER TABLE users ADD COLUMN is_verified TINYINT(1) DEFAULT 1");
  $conn->query("ALTER TABLE users ADD COLUMN verification_code VARCHAR(10) DEFAULT NULL");
  ```
- **Soluzione Proposta:**  
  Rimuovere completamente le chiamate `$conn->query("ALTER TABLE...")` dal codice sorgente delle API. Garantire che la struttura della tabella `users` sia aggiornata tramite un file di migrazione SQL eseguito direttamente sul database in fase di setup:
  ```sql
  -- migrations/2026_users_table_update.sql
  ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS surname VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS reset_expires DATETIME DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS is_verified TINYINT(1) DEFAULT 1,
      ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10) DEFAULT NULL;
  ```

---

## Tabella di Riepilogo Vulnerabilità

| ID | Titolo Vulnerabilità | Severità | File Principale | Azione Correttiva Sintetica |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Credenziali hardcoded in chiaro nella cronologia Git | **Critica** | `.vscode/sftp.json`, `config_private.php` | Ruotare credenziali FTP/DB/Stripe e bonificare la cronologia con `git-filter-repo`. |
| **SEC-02** | Broken Access Control (IDOR) cancellazione ordini | **Critica** | `api/orders_cancel.php` | Richiedere autenticazione, verificare proprietà utente e sostituire `DELETE` con soft delete. |
| **SEC-03** | Stored Cross-Site Scripting (XSS) in Dashboard Venditore | **Critica** | `js/admin.js`, `api/orders_create.php` | Effettuare escaping HTML rigoroso prima di assegnare variabili utente a `innerHTML`. |
| **SEC-04** | Session Fixation e Cookie privo di flag `Secure` | **Alta** | `api/session.php`, `api/login.php` | Impostare `'secure' => true` sui cookie e invocare `session_regenerate_id(true)` al login. |
| **SEC-05** | Esposizione Dati Personali (PII) ordini senza autenticazione | **Alta** | `api/orders_public.php`, `api/orders_get.php` | Filtrare i dati PII dall'output pubblico o richiedere autenticazione e controllo di titolarità. |
| **SEC-06** | Host Header Injection / Password Reset Poisoning | **Alta** | `api/users_recover_password.php` | Usare dominio statico da configurazione per i link email invece di `$_SERVER['HTTP_HOST']`. |
| **SEC-07** | Assenza di protezione CSRF sulle API di mutazione stato | **Alta** | `api/admin/*.php`, `api/stripe_confirm_payment.php` | Introdurre Anti-CSRF Token e convertire conferme di pagamento da GET a POST/Webhook. |
| **SEC-08** | Mancanza di astrazione PDO e gestione errori MySQLi | **Media** | `api/db.php` | Migrare la connessione DB a PDO con Prepared Statements nativi ed eccezioni attive. |
| **SEC-09** | Information Disclosure di errori interni SQL e versioni | **Media** | `api/db.php`, `api/login.php`, `api/users_register.php` | Disabilitare `display_errors`, loggare su file e rimuovere `$conn->error` dalle risposte JSON. |
| **SEC-10** | Assenza di Rate Limiting e debolezza PRNG codice OTP | **Media** | `api/users_register.php`, `api/users_verify_email.php` | Generare OTP con `random_int()`, limitare tentativi errati e applicare rate limit su IP. |
| **SEC-11** | Mancata validazione dimensione e sanitizzazione upload | **Media** | `api/admin/products.php` | Limitare dimensione file (max 3MB) e ricodificare le immagini distruggendo metadati EXIF. |
| **SEC-12** | Mancata validazione ruolo venditore in `login.php` | **Bassa** | `api/login.php` | Rigettare il login venditore con 403 se il ruolo utente non è strettamente `seller`. |
| **SEC-13** | Headers HTTP di sicurezza mancanti e `.htaccess` untracked | **Bassa** | `.htaccess` | Aggiungere HSTS, CSP e Referrer-Policy; tracciare il file `.htaccess` di root nel repo. |
| **SEC-14** | Query DDL (`ALTER TABLE`) eseguite a runtime su API | **Bassa** | `api/users_register.php`, `api/users_recover_password.php` | Eliminare `ALTER TABLE` a runtime e gestire lo schema con migrazioni SQL dedicate. |

---

*Report redatto con standard OWASP Top 10 e CWE/SANS Top 25 da Senior Application Security Engineer.*
