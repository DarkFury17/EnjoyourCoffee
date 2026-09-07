const API_BASE = "";

const qs = (id) => document.getElementById(id);
const euro = (cents) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);

// ---- Login ----
const loginForm = qs("loginForm");
const loginEmail = qs("loginEmail");
const loginPassword = qs("loginPassword");
const loginError = qs("loginError");
const logoutBtn = qs("logoutBtn");
const productsSection = qs("productsSection");
const editDialog = qs("editDialog");
const editForm = qs("editForm");
const editId = qs("editId");
const editName = qs("editName");
const editDescription = qs("editDescription");
const editPrice = qs("editPrice");
const editStock = qs("editStock");
const editDisplayOrder = qs("editDisplayOrder");
const editActive = qs("editActive");
const editImage = qs("editImage");
const editError = qs("editError");
const productCategory = qs("productCategory");
const editCategory = qs("editCategory");
const loginSection = qs("loginSection");
const salesSection = qs("salesSection");

// Imposta stato iniziale
if (productsSection) productsSection.hidden = true;
if (salesSection) salesSection.hidden = true;

let CATEGORIES = [];

// ============================
// DEBUG HELPER
// ============================
function debugLog(msg, data) {
  console.log(`[ADMIN DEBUG] ${msg}`, data || '');
}

async function openEdit(p) {
  editError.hidden = true;
  editError.textContent = "";

  editId.value = p.id;
  editName.value = p.name || "";
  editDescription.value = p.description || "";
  editPrice.value = p.price_cents ?? 0;
  editStock.value = p.stock_qty ?? 0;
  editDisplayOrder.value = p.display_order ?? 0;
  editActive.checked = Boolean(p.is_active);
  editImage.value = "";

  // Campi variante formato
  const editPrice1Label = qs("editPrice1Label");
  const editPrice2 = qs("editPrice2");
  const editPrice2Label = qs("editPrice2Label");
  if (editPrice1Label) editPrice1Label.value = p.price_1_label || "";
  if (editPrice2) editPrice2.value = p.price_2 || "";
  if (editPrice2Label) editPrice2Label.value = p.price_2_label || "";

  // Auto-apri la sezione variante se ha valori
  const editVariantDetails = editDialog?.querySelector('.variant-details');
  if (editVariantDetails) {
    editVariantDetails.open = Boolean(p.price_2);
  }

  await loadCategoriesForSelect(productCategory?.value || null, p.category_id || null);

  editDialog.showModal();
}

editForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  e.stopPropagation();

  try {
    editError.hidden = true;
    editError.textContent = "";

    const fd = new FormData();
    fd.append("name", editName.value.trim());
    fd.append("description", editDescription.value.trim());
    fd.append("price_cents", editPrice.value);
    fd.append("stock_qty", editStock.value);
    fd.append("display_order", editDisplayOrder.value);
    fd.append("is_active", String(editActive.checked));
    fd.set("category_id", editCategory.value);

    // Campi variante formato
    fd.append("price_1_label", qs("editPrice1Label")?.value?.trim() || "");
    fd.append("price_2", qs("editPrice2")?.value || "");
    fd.append("price_2_label", qs("editPrice2Label")?.value?.trim() || "");

    if (editImage.files && editImage.files[0]) {
      const file = editImage.files[0];
      const allowedExts = ["jpg", "jpeg", "png", "webp"];
      const ext = file.name.split('.').pop().toLowerCase();
      if (!allowedExts.includes(ext)) {
        throw new Error("Formato file non supportato. Sono consentiti solo JPG, PNG e WEBP.");
      }
      fd.append("image", file);
    }

    debugLog('Aggiornamento prodotto', editId.value);

    const res = await fetch(`${API_BASE}/api/admin/products/${editId.value}`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });

    debugLog('Risposta aggiornamento', { status: res.status });

    if (res.status === 401) throw new Error("Non hai eseguito il login.");

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || data?.error || `HTTP ${res.status}`);

    editDialog.close();
    await loadProducts();
  } catch (err) {
    editError.hidden = false;
    editError.textContent = err.message || "Errore modifica prodotto.";
    console.error(err);
  }
});

// Email modificabile

function showLoginError(msg) {
  if (loginError) {
    loginError.hidden = false;
    loginError.textContent = msg;
  }
}

function clearLoginError() {
  if (loginError) {
    loginError.hidden = true;
    loginError.textContent = "";
  }
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearLoginError();

  try {
    debugLog('Tentativo login', loginEmail.value);

    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: loginEmail.value.trim(),
        password: loginPassword.value,
      }),
    });

    debugLog('Risposta login', { status: res.status });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

    debugLog('Login riuscito, caricamento dati...');

    // Carica dati
    await loadCategoriesForSelect();
    await loadProducts();
    await loadOrders();
    await loadCustomers();

    // Mostra sezioni
    if (productsSection) productsSection.hidden = false;
    if (salesSection) salesSection.hidden = false;
    if (loginSection) loginSection.hidden = true;

    debugLog('Tutto caricato con successo');

  } catch (err) {
    showLoginError("Login fallito: email o password errate.");
    console.error('[ADMIN ERROR]', err);
  }
});

logoutBtn?.addEventListener("click", async () => {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    
    const ordersGrid = qs("ordersGrid");
    const orderDetail = qs("orderDetail");
    const adminNotice = qs("adminNotice");
    
    if (ordersGrid) ordersGrid.innerHTML = "";
    if (orderDetail) orderDetail.hidden = true;
    if (adminNotice) {
      adminNotice.hidden = false;
      adminNotice.textContent = "Logout effettuato.";
    }
    
    if (loginSection) loginSection.hidden = false;
    if (productsSection) productsSection.hidden = true;
    if (salesSection) salesSection.hidden = true;
    
    alert("Logout effettuato.");
  } catch (err) {
    console.error('[ADMIN ERROR] Logout', err);
  }
});

// ---- Create product ----
const createForm = qs("createProductForm");
const createError = qs("createError");
const createOk = qs("createOk");
const pName = qs("pName");
const pDescription = qs("pDescription");
const pPrice = qs("pPrice");
const pStock = qs("pStock");
const pImage = qs("pImage");
const pActive = qs("pActive");
const pDisplayOrder = qs("pDisplayOrder");

function showCreateError(msg) {
  if (createOk) createOk.hidden = true;
  if (createError) {
    createError.hidden = false;
    createError.textContent = msg;
  }
}

function showCreateOk(msg) {
  if (createError) createError.hidden = true;
  if (createOk) {
    createOk.hidden = false;
    createOk.textContent = msg;
  }
}

function clearCreateMsgs() {
  if (createError) {
    createError.hidden = true;
    createError.textContent = "";
  }
  if (createOk) {
    createOk.hidden = true;
    createOk.textContent = "";
  }
}

createForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearCreateMsgs();

  try {
    const fd = new FormData();
    fd.append("name", pName.value.trim());
    fd.append("description", pDescription.value.trim());
    fd.append("price_cents", pPrice.value);
    fd.append("stock_qty", pStock.value);
    fd.append("display_order", pDisplayOrder?.value || "0");
    fd.append("is_active", String(pActive.checked));
    fd.append("category_id", productCategory.value);

    // Campi variante formato
    fd.append("price_1_label", qs("pPrice1Label")?.value?.trim() || "");
    fd.append("price_2", qs("pPrice2")?.value || "");
    fd.append("price_2_label", qs("pPrice2Label")?.value?.trim() || "");

    if (pImage.files && pImage.files[0]) {
      const file = pImage.files[0];
      const allowedExts = ["jpg", "jpeg", "png", "webp"];
      const ext = file.name.split('.').pop().toLowerCase();
      if (!allowedExts.includes(ext)) {
        throw new Error("Formato file non supportato. Sono consentiti solo JPG, PNG e WEBP.");
      }
      fd.append("image", file);
    }

    debugLog('Creazione prodotto', pName.value);

    const res = await fetch(`${API_BASE}/api/admin/products`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });

    debugLog('Risposta creazione', { status: res.status });

    if (res.status === 401) {
      throw new Error("Non hai eseguito il login.");
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || data?.error || `HTTP ${res.status}`);

    showCreateOk("Prodotto creato con successo.");
    createForm.reset();
    if (pActive) pActive.checked = true;

    await loadProducts();
  } catch (err) {
    showCreateError(err.message || "Errore creazione prodotto.");
    console.error('[ADMIN ERROR] Creazione prodotto', err);
  }
});

// ---- Products list ----
const reloadBtn = qs("reloadBtn");
const listInfo = qs("listInfo");
const tbody = qs("productsTbody");
const filterCategory = qs("filterCategory");
const filterSearch = qs("filterSearch");

let allProducts = []; // Store all products for filtering

reloadBtn?.addEventListener("click", loadProducts);

// Filter handlers
filterCategory?.addEventListener("change", applyProductFilters);
filterSearch?.addEventListener("input", applyProductFilters);

function applyProductFilters() {
  const catId = filterCategory?.value || "";
  const search = (filterSearch?.value || "").toLowerCase().trim();

  let filtered = allProducts;

  if (catId) {
    filtered = filtered.filter(p => String(p.category_id) === catId);
  }

  if (search) {
    filtered = filtered.filter(p => (p.name || "").toLowerCase().includes(search));
  }

  renderProductRows(filtered);
}

function renderProductRows(data) {
  if (!tbody) return;
  tbody.innerHTML = "";

  if (listInfo) listInfo.textContent = `Prodotti mostrati: ${data.length} di ${allProducts.length}`;

  data.forEach((p) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.style.padding = "10px";
    tdName.textContent = p.name;

    // Mostra anche la categoria
    const catName = CATEGORIES.find(c => String(c.id) === String(p.category_id))?.name;
    if (catName) {
      const catSpan = document.createElement("span");
      catSpan.style.cssText = "display:block; font-size:11px; color:var(--muted); margin-top:2px;";
      catSpan.textContent = catName;
      tdName.appendChild(catSpan);
    }

    const tdPrice = document.createElement("td");
    tdPrice.style.padding = "10px";
    let priceText = euro(p.price_cents);
    if (p.price_1_label) priceText += ` (${p.price_1_label})`;
    if (p.price_2) {
      priceText += `\n${euro(Math.round(p.price_2 * 100))}`;
      if (p.price_2_label) priceText += ` (${p.price_2_label})`;
    }
    tdPrice.style.whiteSpace = "pre-line";
    tdPrice.textContent = priceText;

    const tdStock = document.createElement("td");
    tdStock.style.padding = "10px";
    tdStock.textContent = String(p.stock_qty);

    const tdActive = document.createElement("td");
    tdActive.style.padding = "10px";
    tdActive.textContent = p.is_active ? "Sì" : "No";

    const tdImg = document.createElement("td");
    tdImg.style.padding = "10px";
    if (p.image_url) {
      const a = document.createElement("a");
      a.href = `${API_BASE}${p.image_url}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Apri";
      tdImg.appendChild(a);
    } else {
      tdImg.textContent = "-";
    }

    const tdActions = document.createElement("td");
    tdActions.style.padding = "10px";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-ghost";
    editBtn.type = "button";
    editBtn.textContent = "Modifica";
    editBtn.addEventListener("click", () => openEdit(p));

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger";
    delBtn.type = "button";
    delBtn.textContent = "Elimina";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Eliminare "${p.name}"?`)) return;

      const r = await fetch(`${API_BASE}/api/admin/products/${p.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const j = await r.json().catch(() => ({}));
      if (r.status === 401) {
        alert("Non hai eseguito il login.");
        if (productsSection) productsSection.hidden = true;
        return;
      }
      if (!r.ok) {
        alert(j?.error || j?.detail || "Errore eliminazione.");
        return;
      }
      await loadProducts();
    });

    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdPrice);
    tr.appendChild(tdStock);
    tr.appendChild(tdActive);
    tr.appendChild(tdImg);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

async function loadProducts() {
  if (!listInfo || !tbody) {
    debugLog('loadProducts: elementi DOM mancanti');
    return;
  }

  listInfo.textContent = "Caricamento...";
  tbody.innerHTML = "";

  try {
    debugLog('Caricamento prodotti...');

    const res = await fetch(`${API_BASE}/api/admin/products`, {
      method: "GET",
      credentials: "include",
    });

    debugLog('Risposta prodotti', { status: res.status });

    if (res.status === 401) {
      if (productsSection) productsSection.hidden = true;
      listInfo.textContent = "Devi fare login per gestire i prodotti.";
      return;
    }

    const data = await res.json().catch(() => []);
    
    debugLog('Prodotti ricevuti', { count: data.length });

    if (!res.ok) {
      if (productsSection) productsSection.hidden = true;
      listInfo.textContent = "Errore caricamento prodotti.";
      return;
    }

    if (productsSection) productsSection.hidden = false;
    
    // Salva tutti i prodotti per il filtraggio
    allProducts = data;

    // Popola il dropdown del filtro per categoria
    populateFilterCategories();

    // Applica i filtri correnti (o mostra tutti)
    applyProductFilters();

  } catch (err) {
    console.error('[ADMIN ERROR] Caricamento prodotti', err);
    listInfo.textContent = "Errore: " + (err.message || "Sconosciuto");
  }
}

function populateFilterCategories() {
  if (!filterCategory) return;
  
  const currentVal = filterCategory.value;
  filterCategory.innerHTML = "";
  
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "Tutte le categorie";
  filterCategory.appendChild(allOpt);

  // Helper: trova i figli diretti di una categoria
  function getChildren(parentId) {
    return CATEGORIES.filter(c => Number(c.parent_id) === Number(parentId));
  }

  // Helper: verifica se una categoria ha figli
  function hasChildren(catId) {
    return CATEGORIES.some(c => Number(c.parent_id) === Number(catId));
  }

  // Helper: conta prodotti ricorsivamente (categoria + tutti i discendenti)
  function countProductsRecursive(catId) {
    let count = allProducts.filter(p => String(p.category_id) === String(catId)).length;
    getChildren(catId).forEach(child => {
      count += countProductsRecursive(child.id);
    });
    return count;
  }

  const insertedIds = new Set();

  // Funzione ricorsiva per aggiungere le opzioni con indentazione ad albero
  function addFilterTreeOptions(parentId, indentPrefix) {
    const children = getChildren(parentId);
    children.forEach((child, index) => {
      const isLast = index === children.length - 1;
      const opt = document.createElement("option");
      opt.value = child.id;

      const count = countProductsRecursive(child.id);
      let label;
      if (!parentId || parentId === 0) {
        label = child.name;
      } else {
        const connector = isLast ? "└── " : "├── ";
        label = indentPrefix + connector + child.name;
      }
      opt.textContent = `${label} (${count})`;

      filterCategory.appendChild(opt);
      insertedIds.add(Number(child.id));

      if (hasChildren(child.id)) {
        let nextPrefix;
        if (!parentId || parentId === 0) {
          nextPrefix = "\u00A0\u00A0\u00A0\u00A0";
        } else {
          nextPrefix = indentPrefix + (isLast ? "\u00A0\u00A0\u00A0\u00A0\u00A0" : "│\u00A0\u00A0\u00A0");
        }
        addFilterTreeOptions(child.id, nextPrefix);
      }
    });
  }

  // Categorie root
  const roots = CATEGORIES.filter(c => !c.parent_id);

  roots.forEach(root => {
    const opt = document.createElement("option");
    opt.value = root.id;
    const count = countProductsRecursive(root.id);
    opt.textContent = `${root.name} (${count})`;
    filterCategory.appendChild(opt);
    insertedIds.add(Number(root.id));

    addFilterTreeOptions(root.id, "", false);
  });

  // Orfani
  const orphans = CATEGORIES.filter(c => !insertedIds.has(Number(c.id)));
  orphans.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.id;
    const count = allProducts.filter(p => String(p.category_id) === String(o.id)).length;
    opt.textContent = `${o.name} (${count})`;
    filterCategory.appendChild(opt);
  });

  if (currentVal) filterCategory.value = currentVal;
}

// ---- ORDERS ----
const adminNotice = qs("adminNotice");
const ordersGrid = qs("ordersGrid");
const orderDetail = qs("orderDetail");

function noticeOrders(msg) {
  if (!adminNotice) return;
  adminNotice.hidden = !msg;
  adminNotice.textContent = msg || "";
}

function paymentLabel(pm) {
  if (pm === "cod") return "Pagamento alla consegna (+5€)";
  if (pm === "card") return "Carta di credito";
  return pm || "-";
}

async function loadOrders() {
  if (!ordersGrid) {
    debugLog('loadOrders: ordersGrid mancante');
    return;
  }

  noticeOrders("");
  ordersGrid.innerHTML = "";

  try {
    debugLog('Caricamento ordini...');

    const res = await fetch(`${API_BASE}/api/admin/orders`, {
      method: "GET",
      credentials: "include",
    });

    debugLog('Risposta ordini', { status: res.status });

    if (res.status === 401) {
      noticeOrders("Devi fare login per vedere gli ordini.");
      return;
    }

    const data = await res.json().catch(() => []);
    
    debugLog('Ordini ricevuti', { count: data.length });

    if (!res.ok) {
      noticeOrders("Errore caricamento ordini.");
      return;
    }

    data.forEach((o) => {
      const card = document.createElement("article");
      card.className = "card";
      card.style.padding = "16px";
      card.style.cursor = "pointer";

      card.innerHTML = `
        <div class="muted small">${new Date(o.created_at).toLocaleString("it-IT")} · ${paymentLabel(o.payment_method)}</div>
        <div style="margin-top:6px;"><b>${o.customer_name} ${o.customer_surname}</b></div>
        <div class="muted small">${o.customer_email} · ${o.customer_phone}</div>
        <div class="muted small">${o.address_city} (${o.address_cap}) · Slot: ${o.delivery_slot}</div>
        <div style="margin-top:8px;"><b>Totale:</b> ${euro(o.total_cents)}</div>
      `;

      card.addEventListener("click", () => loadOrderDetail(o.id));
      ordersGrid.appendChild(card);
    });
  } catch (err) {
    console.error('[ADMIN ERROR] Caricamento ordini', err);
    noticeOrders("Errore: " + (err.message || "Sconosciuto"));
  }
}

async function loadOrderDetail(id) {
  if (!orderDetail) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/orders/${id}`, {
      method: "GET",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      noticeOrders(data.detail || data.error || "Errore dettaglio ordine.");
      return;
    }

    const o = data.order;
    const items = data.items || [];

    orderDetail.hidden = false;
    orderDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    orderDetail.innerHTML = `
      <div class="contacts-head">
        <div>
          <h2 class="h2">Dettaglio ordine</h2>
          <div class="muted small">ID: ${o.id}</div>
        </div>
      </div>
      <div class="muted small">${o.customer_name} ${o.customer_surname} · ${o.customer_email} · ${o.customer_phone}</div>
      <div class="muted small">${o.address_street} ${o.address_number}, ${o.address_cap} ${o.address_city}</div>
      <div class="muted small">Slot: ${o.delivery_slot} · Pagamento: ${paymentLabel(o.payment_method)}</div>

      <div style="margin-top:10px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <label class="muted small">Stato:</label>
        <select class="select" id="statusSelect">
          <option value="pending">Pending</option>
          <option value="in_preparazione">In preparazione</option>
          <option value="in_consegna">In consegna</option>
          <option value="consegnato">Consegnato</option>
          <option value="annullato">Annullato</option>
        </select>
        <button class="btn btn-ghost" type="button" id="saveStatusBtn">Salva stato</button>
      </div>

      <hr style="border:0; border-top:1px solid rgba(251,246,240,0.10); margin:12px 0;" />

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

      <hr style="border:0; border-top:1px solid rgba(251,246,240,0.10); margin:12px 0;" />

      <div class="row"><span>Subtotale</span><span>${euro(o.subtotal_cents)}</span></div>
      <div class="row"><span>Sconto</span><span>- ${euro(o.discount_cents)}</span></div>
      <div class="row"><span>Consegna</span><span>${euro(o.delivery_cents)}</span></div>
      <div class="row"><span>Supplemento</span><span>${euro(o.cod_fee_cents)}</span></div>
      <div class="row total"><span>Totale</span><span>${euro(o.total_cents)}</span></div>
    `;

    const statusSelect = document.getElementById("statusSelect");
    const saveStatusBtn = document.getElementById("saveStatusBtn");

    if (statusSelect) statusSelect.value = o.status || "pending";

    saveStatusBtn?.addEventListener("click", async () => {
      try {
        const res2 = await fetch(`${API_BASE}/api/admin/orders/${o.id}/status`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: statusSelect.value }),
        });
        const j2 = await res2.json().catch(() => ({}));
        if (!res2.ok) throw new Error(j2.detail || j2.error || `HTTP ${res2.status}`);

        noticeOrders("Stato aggiornato.");
        await loadOrders();
      } catch (e) {
        noticeOrders(String(e.message || e));
      }
    });
  } catch (err) {
    console.error('[ADMIN ERROR] Dettaglio ordine', err);
    noticeOrders("Errore: " + (err.message || "Sconosciuto"));
  }
}

// ---- CUSTOMERS ----
const customersNotice = qs("customersNotice");
const customersTbody = qs("customersTbody");

function noticeCustomers(msg) {
  if (!customersNotice) return;
  customersNotice.hidden = !msg;
  customersNotice.textContent = msg || "";
}

async function loadCustomers() {
  if (!customersTbody) {
    debugLog('loadCustomers: customersTbody mancante');
    return;
  }

  noticeCustomers("");
  customersTbody.innerHTML = "";

  try {
    debugLog('Caricamento clienti...');

    const res = await fetch(`${API_BASE}/api/admin/customers`, {
      method: "GET",
      credentials: "include",
    });

    debugLog('Risposta clienti', { status: res.status });

    if (res.status === 401) {
      noticeCustomers("Devi fare login per vedere i clienti.");
      return;
    }

    const data = await res.json().catch(() => []);
    
    debugLog('Clienti ricevuti', { count: data.length });

    if (!res.ok) {
      noticeCustomers("Errore caricamento clienti.");
      return;
    }

    data.forEach((c) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.style.padding = "10px";
      tdName.textContent = `${c.customer_name || ""} ${c.customer_surname || ""}`.trim() || "-";

      const tdEmail = document.createElement("td");
      tdEmail.style.padding = "10px";
      tdEmail.textContent = c.customer_email || "-";

      const tdPhone = document.createElement("td");
      tdPhone.style.padding = "10px";
      tdPhone.textContent = c.customer_phone || "-";

      const tdCount = document.createElement("td");
      tdCount.style.padding = "10px";
      tdCount.textContent = String(c.orders_count || 0);

      const tdSpent = document.createElement("td");
      tdSpent.style.padding = "10px";
      tdSpent.textContent = euro(c.total_spent_cents);

      const tdLast = document.createElement("td");
      tdLast.style.padding = "10px";
      tdLast.textContent = c.last_order_at ? new Date(c.last_order_at).toLocaleString("it-IT") : "-";

      tr.appendChild(tdName);
      tr.appendChild(tdEmail);
      tr.appendChild(tdPhone);
      tr.appendChild(tdCount);
      tr.appendChild(tdSpent);
      tr.appendChild(tdLast);

      customersTbody.appendChild(tr);
    });
  } catch (err) {
    console.error('[ADMIN ERROR] Caricamento clienti', err);
    noticeCustomers("Errore: " + (err.message || "Sconosciuto"));
  }
}

// ---- CATEGORIES ----
async function loadCategoriesForSelect(selectedCreateId = null, selectedEditId = null) {
  try {
    debugLog('Caricamento categorie...');

    const res = await fetch("/api/categories", { credentials: "include" });
    const cats = await res.json();

    debugLog('Categorie ricevute', { count: cats.length });

    CATEGORIES = Array.isArray(cats) ? cats : [];

    function fillSelect(sel, selectedId) {
      if (!sel) return;
      sel.innerHTML = "";

      const ph = document.createElement("option");
      ph.value = "";
      ph.textContent = "Seleziona categoria…";
      ph.disabled = true;
      ph.selected = !selectedId;
      sel.appendChild(ph);

      // Helper: trova i figli diretti di una categoria
      function getChildren(parentId) {
        return CATEGORIES.filter(c => Number(c.parent_id) === Number(parentId));
      }

      // Helper: verifica se una categoria ha figli
      function hasChildren(catId) {
        return CATEGORIES.some(c => Number(c.parent_id) === Number(catId));
      }

      // Raccoglie tutti gli ID inseriti nell'albero per trovare gli orfani
      const insertedIds = new Set();

      // Funzione ricorsiva che aggiunge le opzioni con indentazione ad albero
      function addTreeOptions(parentId, indentPrefix, isParentLast) {
        const children = getChildren(parentId);
        children.forEach((child, index) => {
          const isLast = index === children.length - 1;
          const opt = document.createElement("option");
          opt.value = child.id;

          // Costruisci il prefisso visivo
          let label;
          if (!parentId || parentId === 0) {
            // Categorie root: nessun prefisso
            label = child.name;
          } else {
            // Sotto-categorie: usa caratteri ad albero
            const connector = isLast ? "└── " : "├── ";
            label = indentPrefix + connector + child.name;
          }
          opt.textContent = label;

          // Disabilita i nodi intermedi che hanno sotto-categorie
          if (hasChildren(child.id)) {
            opt.disabled = true;
            opt.style.fontWeight = "bold";
            opt.style.color = "#d2a06f";
          }

          sel.appendChild(opt);
          insertedIds.add(Number(child.id));

          // Ricorsione sui figli
          if (hasChildren(child.id)) {
            // Calcola il prefisso per i livelli successivi
            let nextPrefix;
            if (!parentId || parentId === 0) {
              // I figli delle root iniziano con spazi semplici
              nextPrefix = "\u00A0\u00A0\u00A0\u00A0";
            } else {
              // Sotto-livelli: continua la linea verticale o aggiungi spazi vuoti
              nextPrefix = indentPrefix + (isLast ? "\u00A0\u00A0\u00A0\u00A0\u00A0" : "│\u00A0\u00A0\u00A0");
            }
            addTreeOptions(child.id, nextPrefix, isLast);
          }
        });
      }

      // Trova le categorie radice (parent_id è null, undefined, 0 o vuoto)
      const roots = CATEGORIES.filter(c => !c.parent_id);

      // Inserisci ogni radice e il suo sotto-albero
      roots.forEach(root => {
        const opt = document.createElement("option");
        opt.value = root.id;
        opt.textContent = root.name;
        insertedIds.add(Number(root.id));

        // Disabilita se ha figli
        if (hasChildren(root.id)) {
          opt.disabled = true;
          opt.style.fontWeight = "bold";
          opt.style.color = "#d2a06f";
        }

        sel.appendChild(opt);

        // Aggiungi i figli ricorsivamente
        addTreeOptions(root.id, "", false);
      });

      // Gestione orfani (categorie con parent_id che non esiste nell'albero)
      const orphans = CATEGORIES.filter(c => !insertedIds.has(Number(c.id)));
      if (orphans.length > 0) {
        // Separatore visivo
        const sep = document.createElement("option");
        sep.disabled = true;
        sep.textContent = "────────────";
        sel.appendChild(sep);

        orphans.forEach(o => {
          const opt = document.createElement("option");
          opt.value = o.id;
          opt.textContent = o.name;
          sel.appendChild(opt);
          insertedIds.add(Number(o.id));
        });
      }

      if (selectedId) sel.value = selectedId;
    }

    fillSelect(productCategory, selectedCreateId);
    fillSelect(editCategory, selectedEditId);
  } catch (err) {
    console.error('[ADMIN ERROR] Caricamento categorie', err);
  }
}

// ---- Bootstrap ----
async function bootstrapAdmin() {
  debugLog('=== Avvio admin panel ===');

  // Stato iniziale
  if (loginSection) loginSection.hidden = false;
  if (productsSection) productsSection.hidden = true;
  if (salesSection) salesSection.hidden = true;

  try {
    // Verifica se già loggato
    const res = await fetch("/api/admin/products", { credentials: "include" });
    
    if (!res.ok) {
      debugLog('Non loggato, mostra form login');
      return;
    }

    debugLog('Già loggato, caricamento dati...');

    // Già loggato
    if (loginSection) loginSection.hidden = true;
    if (productsSection) productsSection.hidden = false;
    if (salesSection) salesSection.hidden = false;

    await loadCategoriesForSelect();
    await loadProducts();
    await loadOrders();
    await loadCustomers();

    debugLog('=== Admin panel pronto ===');
  } catch (e) {
    debugLog('Errore bootstrap', e);
  }
}

bootstrapAdmin();
