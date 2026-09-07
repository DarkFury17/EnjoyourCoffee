# ☕ EnjoyYourCoffee - Custom E-Commerce Platform

Piattaforma e-commerce full-stack snella e reattiva sviluppata per la vendita e distribuzione di caffè, macchine espresso e accessori. Il progetto è stato concepito senza l'ausilio di framework monolitici (come WordPress/WooCommerce o Laravel), privilegiando un'architettura **Vanilla JavaScript + PHP Modulare + MySQL** per azzerare l'overhead di caricamento e garantire il controllo granulare su sicurezza, routing e ciclo di vita delle richieste.

---

## 🏗️ Architettura & Stack Tecnologico

### Frontend
- **HTML5 Semantico & CSS3 Custom**: Layout responsive sviluppato da zero (senza Bootstrap o Tailwind) con supporto a CSS Grid, Flexbox e variabili native CSS per un rendering sub-secondo.
- **Vanilla JavaScript (ES6+)**:
  - State management del carrello client-side sincronizzato tramite `LocalStorage API`.
  - Logica dinamica per sconti prima registrazione e calcolo imposte in tempo reale.
  - Modale di autenticazione asincrona con supporto al flusso di registrazione, login e recupero password via Fetch API.
  - Formati multimediali ottimizzati (`WebP` prioritario per Core Web Vitals elevati).

### Backend & API
- **PHP Modulare (REST-like Architecture)**: Endpoint dedicati e disaccoppiati per la gestione del catalogo, autenticazione e transazioni.
- **MySQL Relazionale**: Progettazione schema dati per supporto a categorie multi-livello, varianti di prezzo dinamiche e tracking ordini.
- **Stripe Checkout API**: Integrazione sicura per l'elaborazione dei pagamenti digitali conforme a standard PCI-DSS.
- **Apache Web Server**: Routing e riscrittura URL tramite `.htaccess` con disaccoppiamento tra asset pubblici ed endpoint applicativi.

---

## 🔒 Sicurezza & Infrastructure Hardening

Il backend adotta policy di sicurezza avanzate a protezione dell'infrastruttura di hosting condiviso:

- **RBAC (Role-Based Access Control)**: Protezione nativa degli endpoint amministrativi tramite routine di validazione sessione server-side (`require_seller()`), disabilitando l'accesso non autorizzato a rotte di mutazione DB.
- **Protezione Sessioni**: Cookie di sessione configurati rigorosamente con flag `HttpOnly`, `SameSite=Lax` e crittografia lato server contro attacchi XSS e CSRF.
- **Upload Hardening (No-Exec uploads)**: 
  - Whitelist restrittiva dei MIME-type reali (`image/webp`, `image/jpeg`, `image/png`) validati a livello di byte stream (non tramite estensione file client).
  - Ridenominazione univoca e crittografica dei file salvati su disco.
  - Direttive Apache restrittive nella cartella `/uploads` (`Options -ExecCGI`, blocco assoluto di interpreti `.php`, `.phtml`, `.js`, `.sh`) per scongiurare caricamento di webshell o Remote Code Execution (RCE).
- **Decoupling delle Credenziali**: Separazione rigorosa tra codice versionabile e configurazioni di produzione (`config_private.php` vs `config_private.example.php`).

---

## 📂 Struttura del Progetto

```
├── api/                     # Backend API & Business Logic
│   ├── admin/               # Endpoint protetti riservati ai seller
│   ├── db.php               # Connessione PDO/MySQLi con fallback d'ambiente
│   ├── session.php          # Configurazione blindata sessioni e RBAC
│   ├── get_products.php     # Query catalogo e filtri categoria
│   └── stripe_*.php         # Flusso di creazione e notifica pagamenti
├── js/                      # Script client-side modulari
│   ├── app.js               # Core logic: Carrello, UI drawers, Auth clienti
│   └── admin.js             # Pannello gestionale prodotti, scorte e categorie
├── uploads/                 # Directory statica protetta per immagini catalogo
│   └── .htaccess            # Hardening esecuzione script
├── config_private.example.php # Template di configurazione per setup locale
├── admin.html               # Dashboard di amministrazione
├── index.html               # Storefront principale
└── .htaccess                # Configurazione rewrite e security headers
```

## 👨‍💻 Autore

**Marco Di Palma**

[![Portfolio](https://img.shields.io/badge/Portfolio-000000?style=for-the-badge&logo=Netlify&logoColor=white)](https://portfolio-dipalma.netlify.app)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/DarkFury17)

- **Website**: [Portfolio](https://portfolio-dipalma.netlify.app)
- **GitHub**: [@DarkFury17](https://github.com/DarkFury17)
- **Email**: [mdipalma62@gmail.com](mailto:mdipalma62@gmail.com)
