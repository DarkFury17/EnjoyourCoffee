// ============================
// Config
// ============================
const API_BASE = "";
const STORAGE_CART = "coffee_cart_v1";
const STORAGE_SELLER = "coffee_seller_auth_v1";
const SELLER_PASSWORD = "1234";

let currentUser = null;

// ============================
// Utils
// ============================
const euro = (cents) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);

function showToast(message) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
    </svg>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast--hide");
    toast.addEventListener("animationend", () => toast.remove());
  }, 3000);
}

function loadCart() {
  try { return JSON.parse(localStorage.getItem(STORAGE_CART)) ?? []; }
  catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem(STORAGE_CART, JSON.stringify(cart));
}
function cartCount(cart) {
  return cart.reduce((sum, it) => sum + it.qty, 0);
}
function cartTotal(cart) {
  let total = cart.reduce((sum, it) => sum + it.qty * it.price_cents, 0);
  if (currentUser && currentUser.has_discount) {
    total = Math.round(total * 0.95);
  }
  return total;
}

// ============================
// Drawer (carrello)
// ============================
let cart = loadCart();

const drawer = document.getElementById("cartDrawer");
const backdrop = document.getElementById("drawerBackdrop");
const openCartTop = document.getElementById("openCartTop");
const openCartFab = document.getElementById("openCartFab");
const closeCart = document.getElementById("closeCart");
const myOrdersLink = document.getElementById("myOrdersLink");

function openDrawer() {
  drawer?.classList.add("is-open");
  drawer?.setAttribute("aria-hidden", "false");
  if (backdrop) backdrop.hidden = false;
}
function closeDrawer() {
  drawer?.classList.remove("is-open");
  drawer?.setAttribute("aria-hidden", "true");
  if (backdrop) backdrop.hidden = true;
}

openCartTop?.addEventListener("click", openDrawer);
openCartFab?.addEventListener("click", openDrawer);
closeCart?.addEventListener("click", closeDrawer);
backdrop?.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

// Render cart
const cartList = document.getElementById("cartList");
const cartTotalEl = document.getElementById("cartTotal");
const cartCountTop = document.getElementById("cartCountTop");
const cartCountFab = document.getElementById("cartCountFab");
const clearCartBtn = document.getElementById("clearCart");

function renderCart() {
  const count = cartCount(cart);

  if (cartCountTop) cartCountTop.textContent = String(count);
  if (cartCountFab) cartCountFab.textContent = String(count);
  if (cartTotalEl) {
    cartTotalEl.textContent = euro(cartTotal(cart));
    if (currentUser && currentUser.has_discount) {
      cartTotalEl.innerHTML += '<br><small style="color:var(--accent); font-size:12px; font-weight:normal; display:block; text-align:right;">(Sconto 5% primo acquisto applicato)</small>';
    }
  }
  if (!cartList) return;

  cartList.innerHTML = "";
  if (cart.length === 0) {
    const li = document.createElement("li");
    li.className = "cart-item";
    li.innerHTML = `<div class="muted">Il carrello è vuoto.</div>`;
    cartList.appendChild(li);
    return;
  }

  cart.forEach((it) => {
    const li = document.createElement("li");
    li.className = "cart-item";
    const variantInfo = it.variant_label ? ` <span class="variant-badge">${it.variant_label}</span>` : '';
    const itemKey = it.cartKey || it.id;
    li.innerHTML = `
      <div class="cart-item-row">
        <div>
          <div class="cart-item-name">${it.name}${variantInfo}</div>
          <div class="cart-item-meta">${euro(it.price_cents)} · Q.tà ${it.qty}</div>
        </div>
        <div class="cart-item-name">${euro(it.price_cents * it.qty)}</div>
      </div>
      <div class="cart-item-actions">
        <button class="btn btn-small btn-ghost" data-action="dec" data-cart-key="${itemKey}">-</button>
        <button class="btn btn-small btn-ghost" data-action="inc" data-cart-key="${itemKey}">+</button>
        <button class="btn btn-small btn-danger" data-action="rm" data-cart-key="${itemKey}">Rimuovi</button>
      </div>
    `;
    cartList.appendChild(li);
  });
}

cartList?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const cartKey = btn.getAttribute("data-cart-key");
  const action = btn.getAttribute("data-action");

  // Confronto flessibile: usa cartKey se presente, altrimenti ID
  const idx = cart.findIndex(x => {
    const key = x.cartKey || String(x.id);
    return key === cartKey || String(key) === String(cartKey);
  });
  if (idx === -1) return;

  if (action === "inc") {
    const item = cart[idx];
    if (item.stock_qty !== undefined && item.qty + 1 > Number(item.stock_qty)) {
      showToast(`Spiacenti, la quantità richiesta supera lo stock disponibile (${item.stock_qty} pezzi disponibili).`);
      return;
    }
    cart[idx].qty += 1;
  }
  if (action === "dec") cart[idx].qty = Math.max(1, cart[idx].qty - 1);
  if (action === "rm") cart.splice(idx, 1);

  saveCart(cart);
  renderCart();
});

clearCartBtn?.addEventListener("click", () => {
  cart = [];
  saveCart(cart);
  renderCart();
});

renderCart();

window.addEventListener('cartUpdated', () => {
  cart = loadCart();
  renderCart();
});

// ============================
// User auth (customer)
// ============================
const openAuthBtn = document.getElementById("openAuthBtn");
const userBadge = document.getElementById("userBadge");
const userAuthDialog = document.getElementById("userAuthDialog");
const userAuthError = document.getElementById("userAuthError");
const closeAuthDialog = document.getElementById("closeAuthDialog");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginPane = document.getElementById("loginPane");
const registerPane = document.getElementById("registerPane");
const userLoginEmail = document.getElementById("userLoginEmail");
const userLoginPassword = document.getElementById("userLoginPassword");
const btnUserLogin = document.getElementById("btnUserLogin");
const userRegEmail = document.getElementById("userRegEmail");
const userRegPassword = document.getElementById("userRegPassword");
const userRegPasswordConfirm = document.getElementById("userRegPasswordConfirm");
const userRegName = document.getElementById("userRegName");
const userRegSurname = document.getElementById("userRegSurname");
const btnUserRegister = document.getElementById("btnUserRegister");
const btnUserLogout = document.getElementById("btnUserLogout");

const recoverPane = document.getElementById("recoverPane");
const linkRecoverPassword = document.getElementById("linkRecoverPassword");
const linkBackToLogin = document.getElementById("linkBackToLogin");
const userRecoverEmail = document.getElementById("userRecoverEmail");
const btnRecoverPassword = document.getElementById("btnRecoverPassword");

const verifyPane = document.getElementById("verifyPane");
const userVerifyEmail = document.getElementById("userVerifyEmail");
const userVerifyCode = document.getElementById("userVerifyCode");
const btnVerifyCode = document.getElementById("btnVerifyCode");
const linkResendotp = document.getElementById("linkResendotp");

function showUserError(msg) {
  if (!userAuthError) return;
  userAuthError.hidden = !msg;
  userAuthError.textContent = msg || "";
}

function renderUserUi() {
  const isLogged = Boolean(currentUser?.id);
  
  console.log('[app.js] renderUserUi - isLogged:', isLogged, 'currentUser:', currentUser);

  // Bottone header
  if (openAuthBtn) openAuthBtn.textContent = isLogged ? "Account" : "Accedi";
  if (userBadge) userBadge.hidden = true;
  if (myOrdersLink) myOrdersLink.hidden = !isLogged;

  // Gestisci visibilità elementi modal
  const tabsWrap = document.getElementById("authTabsWrap");
  const panesWrap = document.getElementById("authPanesWrap");
  const loggedUserView = document.getElementById("loggedUserView");
  const loggedUserEmail = document.getElementById("loggedUserEmail");

  // Se loggato: nascondi tabs e form, mostra messaggio
  if (tabsWrap) tabsWrap.hidden = isLogged;
  if (panesWrap) panesWrap.hidden = isLogged;
  if (loginPane) loginPane.hidden = isLogged;
  if (registerPane) registerPane.hidden = true;
  if (recoverPane) recoverPane.hidden = true;
  if (verifyPane) verifyPane.hidden = true;

  // Mostra messaggio quando loggato
  if (loggedUserView) {
    loggedUserView.hidden = !isLogged;
    if (isLogged && loggedUserEmail && currentUser?.email) {
      loggedUserEmail.textContent = currentUser.email;
    }
    const modalDiscountMessage = document.getElementById("modalDiscountMessage");
    if (modalDiscountMessage && isLogged) {
      if (currentUser?.has_discount) {
        modalDiscountMessage.innerHTML = `<strong>Complimenti!</strong> Ti sei registrato con successo.<br>Hai il <strong style="color: var(--accent);">5% di sconto</strong> sul tuo primo acquisto per ringraziarti!`;
      } else {
        modalDiscountMessage.innerHTML = `Hai già riscattato il <strong style="color: var(--accent);">5% di sconto</strong> sul primo acquisto.`;
      }
    }
  }

  // Logout visibile solo se loggato
  if (btnUserLogout) btnUserLogout.hidden = !isLogged;

  // Quando NON loggato, default su login
  if (!isLogged) {
    if (tabLogin) {
      tabLogin.classList.add("active");
      tabLogin.hidden = false;
    }
    if (tabRegister) {
      tabRegister.classList.remove("active");
      tabRegister.hidden = false;
    }
    if (loginPane) loginPane.hidden = false;
    if (registerPane) registerPane.hidden = true;
    if (recoverPane) recoverPane.hidden = true;
    // verifyPane remains hidden initially unless redirect happens
  }
  
  showUserError("");
  renderDiscountBanner();
  renderCart();
}

async function apiPost(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.detail || `HTTP ${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}

async function refreshMe() {
  try {
    const res = await fetch("/api/users_me.php", { credentials: "include" });
    
    if (!res.ok) {
      currentUser = null;
      renderUserUi();
      return;
    }
    
    const data = await res.json();
    currentUser = data.user || null;
    
    console.log('[app.js] refreshMe completato - currentUser:', currentUser);
    
    renderUserUi();
  } catch (e) {
    console.error('[app.js] Errore refreshMe:', e);
    currentUser = null;
    renderUserUi();
  }
}

// Open dialog
openAuthBtn?.addEventListener("click", async () => {
  if (!userAuthDialog) return;
  await refreshMe();
  showUserError("");
  userAuthDialog.showModal();
});

// Chiudi dialog
closeAuthDialog?.addEventListener("click", () => {
  if (userAuthDialog) userAuthDialog.close();
});

// Chiudi cliccando fuori
userAuthDialog?.addEventListener("click", (e) => {
  const dialogDimensions = userAuthDialog.getBoundingClientRect();
  if (
    e.clientX < dialogDimensions.left ||
    e.clientX > dialogDimensions.right ||
    e.clientY < dialogDimensions.top ||
    e.clientY > dialogDimensions.bottom
  ) {
    userAuthDialog.close();
  }
});

// Tabs
tabLogin?.addEventListener("click", () => {
  if (currentUser?.id) return;
  if (loginPane) loginPane.hidden = false;
  if (registerPane) registerPane.hidden = true;
  if (recoverPane) recoverPane.hidden = true;
  tabLogin.classList.add("active");
  tabRegister?.classList.remove("active");
  showUserError("");
});

tabRegister?.addEventListener("click", () => {
  if (currentUser?.id) return;
  if (registerPane) registerPane.hidden = false;
  if (loginPane) loginPane.hidden = true;
  if (recoverPane) recoverPane.hidden = true;
  tabRegister.classList.add("active");
  tabLogin?.classList.remove("active");
  showUserError("");
});

// Login
btnUserLogin?.addEventListener("click", async () => {
  try {
    showUserError("");
    await apiPost("/api/users_login.php", {
      email: userLoginEmail.value.trim(),
      password: userLoginPassword.value,
    });
    // Se loggato ri-renderizza UI
    await refreshMe();
    userAuthDialog.close();
  } catch (e) {
    if (e.data && e.data.require_verification) {
      // mostriamo verifyPane
      if (userVerifyEmail) userVerifyEmail.value = e.data.email || userLoginEmail.value.trim();
      if (loginPane) loginPane.hidden = true;
      if (registerPane) registerPane.hidden = true;
      if (verifyPane) verifyPane.hidden = false;
      showUserError("");
    } else {
      showUserError(String(e.message || e));
    }
  }
});

// Register
btnUserRegister?.addEventListener("click", async () => {
  try {
    showUserError("");
    if (userRegPassword.value !== userRegPasswordConfirm.value) {
      throw new Error("Le password non coincidono. Riprova: confermala correttamente.");
    }
    
    const res = await apiPost("/api/users_register.php", {
      email: userRegEmail.value.trim(),
      password: userRegPassword.value,
      name: userRegName?.value?.trim() || "",
      surname: userRegSurname?.value?.trim() || "",
    });
    
    if (res.require_verification) {
      if (userVerifyEmail) userVerifyEmail.value = userRegEmail.value.trim();
      if (loginPane) loginPane.hidden = true;
      if (registerPane) registerPane.hidden = true;
      if (verifyPane) verifyPane.hidden = false;
      showUserError("");
    } else {
      await refreshMe();
    }
  } catch (e) {
    showUserError(String(e.message || e));
  }
});

// Verifica OTP
btnVerifyCode?.addEventListener("click", async () => {
  try {
    showUserError("");
    const email = userVerifyEmail?.value?.trim();
    const code = userVerifyCode?.value?.trim();
    if (!code || code.length !== 6) throw new Error("Inserisci il codice di 6 cifre.");
    
    await apiPost("/api/users_verify_email.php", { email, code });
    await refreshMe();
    // Ora è loggato, la UI mostrerà automaticamente loggedUserView con il banner speciale
  } catch (e) {
    showUserError(String(e.message || e));
  }
});

linkResendotp?.addEventListener("click", () => {
  // Torniamo a login o resettiamo
  if (loginPane) loginPane.hidden = false;
  if (verifyPane) verifyPane.hidden = true;
  showUserError("Re-inserisci le tue credenziali nell'accesso per richiedere un altro codice.");
});

// Logout
btnUserLogout?.addEventListener("click", async () => {
  try {
    showUserError("");
    await fetch("/api/users_logout.php", { method: "POST", credentials: "include" });
    await refreshMe();
    userAuthDialog.close();
  } catch (e) {
    showUserError(String(e.message || e));
  }
});

// Recover Password UI
linkRecoverPassword?.addEventListener("click", () => {
  if (loginPane) loginPane.hidden = true;
  if (registerPane) registerPane.hidden = true;
  if (recoverPane) recoverPane.hidden = false;
  showUserError("");
  
  // reset state in case it was used before
  const recoverSuccess = document.getElementById("recoverSuccess");
  const recoverDescription = document.getElementById("recoverDescription");
  if (recoverSuccess) recoverSuccess.hidden = true;
  if (recoverDescription) recoverDescription.hidden = false;
  if (userRecoverEmail) userRecoverEmail.closest('.field').hidden = false;
  if (btnRecoverPassword) btnRecoverPassword.hidden = false;
});

linkBackToLogin?.addEventListener("click", () => {
  if (recoverPane) recoverPane.hidden = true;
  if (loginPane) loginPane.hidden = false;
  showUserError("");
});

btnRecoverPassword?.addEventListener("click", async () => {
  try {
    const email = userRecoverEmail?.value?.trim();
    if (!email) throw new Error("Inserisci la tua email.");
    showUserError("");
    
    await apiPost("/api/users_recover_password.php", { email });
    
    const recoverSuccess = document.getElementById("recoverSuccess");
    const recoverDescription = document.getElementById("recoverDescription");
    const recoverForm = document.getElementById("recoverForm");
    
    if (recoverSuccess) recoverSuccess.hidden = false;
    if (recoverDescription) recoverDescription.hidden = true;
    
    // Mostriamo solo il pulsante di ritorno nascondendo il form input
    if (userRecoverEmail) userRecoverEmail.closest('.field').hidden = true;
    if (btnRecoverPassword) btnRecoverPassword.hidden = true;
    
  } catch (e) {
    showUserError(String(e.message || e));
  }
});

const discountBanner = document.getElementById("discountBanner");
const heroPromoBanner = document.getElementById("heroPromoBanner");

function renderDiscountBanner() {
  const isLogged = Boolean(currentUser?.id);

  // Hero promo banner (homepage)
  if (heroPromoBanner) {
    if (isLogged) {
      const userName = currentUser?.name || '';
      const greeting = userName ? `Benvenuto, <strong style="color: var(--accent);">${userName}</strong>!` : 'Benvenuto!';
      heroPromoBanner.innerHTML = `👋 ${greeting}`;
    } else {
      heroPromoBanner.innerHTML = `🎁 <strong>Novità:</strong> Registrati ora per ottenere il <strong style="color: var(--accent);">5% di sconto</strong> sul tuo primo acquisto!`;
    }
  }

  // Discount banner (cart area)
  if (!discountBanner) return;
  const hasDiscount = Boolean(currentUser?.has_discount);
  if (!hasDiscount) {
    discountBanner.hidden = true;
    discountBanner.textContent = "";
    return;
  }
  discountBanner.hidden = false;
  discountBanner.textContent = "Benvenuto! Hai uno sconto del 5% sul tuo primo acquisto, applicato automaticamente al carrello.";
}

// On page load
refreshMe();

// Segnala che app.js è pronto
window.appReady = true;
window.euro = euro;
