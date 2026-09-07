// ============================
// Category Page - Caricamento dinamico prodotti
// ============================

const categoryName = document.getElementById("categoryName");
const categoryTitle = document.getElementById("categoryTitle");
const categoryDescription = document.getElementById("categoryDescription");
const searchInput = document.getElementById("searchInput");
const productGrid = document.getElementById("productGrid");

let categoryProducts = [];

// ============================
// Lightbox (zoom immagine)
// ============================

function initLightbox() {
  if (document.getElementById('productLightbox')) return;

  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.id = 'productLightbox';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'lightbox-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Chiudi');

  const img = document.createElement('img');
  img.id = 'lightboxImg';
  img.alt = 'Immagine ingrandita';

  overlay.appendChild(closeBtn);
  overlay.appendChild(img);
  document.body.appendChild(overlay);

  function closeLightbox() {
    overlay.classList.remove('is-open');
  }

  overlay.addEventListener('click', closeLightbox);
  img.addEventListener('click', function(e) { e.stopPropagation(); });
  closeBtn.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeLightbox();
  });

  function handleImageTap(e) {
    var imgEl = e.target.closest('.product-img');
    if (!imgEl) {
      var media = e.target.closest('.card-media');
      if (media) {
        imgEl = media.querySelector('.product-img');
      }
    }
    if (!imgEl || !imgEl.src) return;
    e.preventDefault();
    e.stopPropagation();
    openLightbox(imgEl.src, imgEl.alt || 'Prodotto');
  }

  var grid = document.getElementById('productGrid');
  if (grid) {
    grid.addEventListener('click', handleImageTap);

    var touchMoved = false;
    grid.addEventListener('touchstart', function() { touchMoved = false; }, { passive: true });
    grid.addEventListener('touchmove', function() { touchMoved = true; }, { passive: true });
    grid.addEventListener('touchend', function(e) {
      if (touchMoved) return;
      handleImageTap(e);
    });
  }
}

function openLightbox(src, alt) {
  const overlay = document.getElementById('productLightbox');
  const img = document.getElementById('lightboxImg');
  if (!overlay || !img) return;
  img.src = src;
  img.alt = alt || 'Immagine prodotto';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
}

initLightbox();

// ============================
// Funzioni di utility
// ============================

function showNotice(msg) {
  const notice = document.getElementById("productsNotice");
  if (!notice) return;
  notice.hidden = false;
  notice.textContent = msg;
}

function clearNotice() {
  const notice = document.getElementById("productsNotice");
  if (!notice) return;
  notice.hidden = true;
  notice.textContent = "";
}

// ============================
// Crea card prodotto
// ============================

function createProductCard(p) {
  const article = document.createElement("article");
  article.className = "card product";
  article.dataset.id = p.id;
  article.dataset.name = p.name;
  article.dataset.priceCents = p.price_cents;

  // Determina se il prodotto ha doppio prezzo
  const hasVariant = p.price_2 && Number(p.price_2) > 0;

  const media = document.createElement("div");
  media.className = "card-media";

  if (p.image_url) {
    const img = document.createElement("img");
    img.src = `${window.API_BASE || ''}${p.image_url}`;
    img.alt = p.name;
    img.loading = "lazy";
    img.className = "product-img";
    media.appendChild(img);
  } else {
    media.textContent = "Immagine";
  }

  const body = document.createElement("div");
  body.className = "card-body";

  const meta = document.createElement("div");
  meta.className = "meta-row";

  const pill = document.createElement("span");
  pill.className = "pill";
  pill.textContent = "Prodotto";

  const price = document.createElement("span");
  price.className = "price";
  price.textContent = window.euro ? window.euro(p.price_cents) : `€ ${(p.price_cents / 100).toFixed(2)}`;

  meta.appendChild(pill);
  meta.appendChild(price);

  const title = document.createElement("h3");
  title.className = "title";
  title.textContent = p.name;

  // Description with "Leggi di più" truncation
  const descWrap = document.createElement("div");
  descWrap.className = "desc-wrap";

  const desc = document.createElement("p");
  desc.className = "muted desc-text";
  desc.textContent = p.description || "";

  descWrap.appendChild(desc);

  if (p.description && p.description.length > 0) {
    const toggle = document.createElement("button");
    toggle.className = "desc-toggle";
    toggle.type = "button";
    toggle.textContent = "Leggi di più";
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isExpanded = descWrap.classList.toggle("is-expanded");
      toggle.textContent = isExpanded ? "Mostra meno" : "Leggi di più";
    });
    descWrap.appendChild(toggle);
  }

  // ============================
  // Selettore variante formato (solo se doppio prezzo)
  // ============================
  let variantSelect = null;
  if (hasVariant) {
    const variantWrap = document.createElement("div");
    variantWrap.className = "variant-selector";

    const variantLabel = document.createElement("span");
    variantLabel.className = "muted small";
    variantLabel.textContent = "Formato:";

    variantSelect = document.createElement("select");
    variantSelect.className = "input variant-select";

    const opt1 = document.createElement("option");
    opt1.value = "1";
    opt1.textContent = (p.price_1_label || "Opzione 1") + " — " + (window.euro ? window.euro(p.price_cents) : `€ ${(p.price_cents / 100).toFixed(2)}`);
    variantSelect.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = "2";
    opt2.textContent = (p.price_2_label || "Opzione 2") + " — " + (window.euro ? window.euro(Math.round(p.price_2 * 100)) : `€ ${Number(p.price_2).toFixed(2)}`);
    variantSelect.appendChild(opt2);

    // Aggiornamento dinamico del prezzo mostrato
    variantSelect.addEventListener("change", () => {
      const selectedCents = variantSelect.value === "2" ? Math.round(Number(p.price_2) * 100) : Number(p.price_cents);
      price.textContent = window.euro ? window.euro(selectedCents) : `€ ${(selectedCents / 100).toFixed(2)}`;
    });

    variantWrap.appendChild(variantLabel);
    variantWrap.appendChild(variantSelect);
    body.appendChild(meta);
    body.appendChild(title);
    body.appendChild(descWrap);
    body.appendChild(variantWrap);
  } else {
    body.appendChild(meta);
    body.appendChild(title);
    body.appendChild(descWrap);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const qtyLabel = document.createElement("label");
  qtyLabel.className = "qty";

  const qtySpan = document.createElement("span");
  qtySpan.className = "muted small";
  qtySpan.textContent = "Q.tà";

  const qtyInput = document.createElement("input");
  qtyInput.className = "input qty-input";
  qtyInput.type = "number";
  qtyInput.min = "1";
  qtyInput.value = "1";

  qtyLabel.appendChild(qtySpan);
  qtyLabel.appendChild(qtyInput);

  const btn = document.createElement("button");
  if (p.stock_qty !== undefined && Number(p.stock_qty) <= 0) {
    btn.className = "icon-btn icon-btn--primary add-to-cart";
    btn.type = "button";
    btn.disabled = true;
    btn.style.backgroundColor = "#e53935";
    btn.style.color = "white";
    btn.style.cursor = "not-allowed";
    btn.setAttribute("aria-label", "Prodotto esaurito");
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
      </svg>
    `;
    qtyLabel.style.display = "none";
  } else {
    btn.className = "icon-btn icon-btn--primary add-to-cart";
    btn.type = "button";
    btn.setAttribute("aria-label", "Aggiungi al carrello");
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2Zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2ZM6.2 6l.94 2h10.9c.75 0 1.32.7 1.17 1.43l-1.2 6.4c-.13.67-.72 1.17-1.4 1.17H8.1c-.63 0-1.19-.37-1.38-.97L4.1 3H2V1h3.6c.38 0 .72.22.88.56L6.2 6Zm2.2 9h7.7l1-5.4H7.2l1.2 5.4Z"/>
      </svg>
    `;

    // Evento click
    btn.addEventListener("click", () => {
      const qty = Math.max(1, Number(qtyInput.value || 1));

      // Determina prezzo e etichetta della variante selezionata
      let selectedPriceCents = Number(p.price_cents);
      let variantLabel = "";
      if (hasVariant && variantSelect) {
        if (variantSelect.value === "2") {
          selectedPriceCents = Math.round(Number(p.price_2) * 100);
          variantLabel = p.price_2_label || "Opzione 2";
        } else {
          variantLabel = p.price_1_label || "Opzione 1";
        }
      }

      // Recupera il carrello da localStorage
      const STORAGE_CART = "coffee_cart_v1";
      let cart = [];
      try {
        cart = JSON.parse(localStorage.getItem(STORAGE_CART)) ?? [];
      } catch {
        cart = [];
      }

      // ID univoco nel carrello: product_id + variant_label (per distinguere le due opzioni)
      const cartKey = hasVariant ? `${p.id}__${variantLabel}` : p.id;
      const existing = cart.find(x => x.cartKey === cartKey || (!hasVariant && x.id === p.id && !x.cartKey));
      const totalWanted = (existing ? existing.qty : 0) + qty;

      if (p.stock_qty !== undefined && totalWanted > Number(p.stock_qty)) {
        if (window.showToast) {
          window.showToast(`Spiacenti, la quantità richiesta supera lo stock disponibile (${p.stock_qty} pezzi disponibili).`);
        } else {
          alert(`Spiacenti, la quantità richiesta supera lo stock disponibile (${p.stock_qty} pezzi disponibili).`);
        }
        return;
      }

      if (existing) {
        existing.qty += qty;
      } else {
        const item = {
          id: p.id,
          name: p.name,
          price_cents: selectedPriceCents,
          qty,
          stock_qty: p.stock_qty
        };
        if (hasVariant) {
          item.cartKey = cartKey;
          item.variant_label = variantLabel;
        }
        cart.push(item);
      }

      localStorage.setItem(STORAGE_CART, JSON.stringify(cart));
      
      // Triggera evento custom per notificare app.js
      window.dispatchEvent(new CustomEvent('cartUpdated'));
      
      // Apri il drawer
      const drawer = document.getElementById("cartDrawer");
      const backdrop = document.getElementById("drawerBackdrop");
      if (drawer && backdrop) {
        drawer.classList.add("is-open");
        drawer.setAttribute("aria-hidden", "false");
        backdrop.hidden = false;
      }
    });
  }

  actions.appendChild(qtyLabel);
  actions.appendChild(btn);

  body.appendChild(actions);

  article.appendChild(media);
  article.appendChild(body);

  return article;
}

// ============================
// Carica prodotti dall'API
// ============================

let allCategories = [];

async function loadProducts() {

  if (!productGrid) {
    console.log('[category.js] productGrid non trovato, probabilmente index.html');
    return;
  }

  try {
    clearNotice();
    productGrid.innerHTML = "";
    showNotice("Caricamento prodotti...");

    // Prendi la configurazione della categoria dalla pagina
    const config = window.CATEGORY_CONFIG || {};
    
    // USA LO SLUG, NON L'ID
    const categorySlug = config.slug;

    if (!categorySlug) {
      throw new Error("Configurazione categoria mancante (slug richiesto)");
    }

    console.log('[category.js] Caricamento categoria:', categorySlug);

    // Carica anche la lista delle categorie per l'albero
    const catsRes = await fetch(`${window.API_BASE || ''}/api/get_categories.php`);
    if (!catsRes.ok) throw new Error("Errore caricamento categorie");
    allCategories = await catsRes.json();

    // Costruisci URL con parametro category (SLUG)
    const url = new URL(`${window.API_BASE || ''}/api/get_products.php`, window.location.origin);
    url.searchParams.set("category", categorySlug);

    console.log('[category.js] URL completo:', url.toString());

    const res = await fetch(url.toString());
    
    console.log('[category.js] Risposta API:', res.status);
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    categoryProducts = await res.json();
    
    console.log('[category.js] Prodotti ricevuti:', categoryProducts.length);
    
    if (!Array.isArray(categoryProducts)) throw new Error("API non restituisce un array");

    clearNotice();
    
    if (!categoryProducts.length) {
      showNotice("Nessun prodotto disponibile in questa categoria.");
      return;
    }

    // Aggiorna il titolo della pagina se presente nella config
    if (config.name && categoryName) {
      categoryName.textContent = config.name;
    }
    if (config.title && categoryTitle) {
      categoryTitle.textContent = config.title;
    }
    if (config.description && categoryDescription) {
      categoryDescription.textContent = config.description;
    }

    // Renderizza i prodotti ad albero
    renderTreeProducts(categoryProducts);

  } catch (e) {
    showNotice(
      "Errore nel caricamento prodotti. Controlla che il database e il backend siano pronti."
    );
    console.error('[category.js] Errore:', e);
  }
}

function renderTreeProducts(productsList) {
  if (!productGrid) return;
  productGrid.innerHTML = "";

  const config = window.CATEGORY_CONFIG || {};
  
  // Ricerca robusta della root category
  const rootCat = allCategories.find(c => {
    const slugMatch = c.slug && config.slug && c.slug.toLowerCase().trim() === config.slug.toLowerCase().trim();
    const nameMatch = c.name && config.name && c.name.toLowerCase().trim() === config.name.toLowerCase().trim();
    return slugMatch || nameMatch;
  });
  
  if (!rootCat) {
    // Fallback se la categoria root non è trovata: griglia piatta
    productGrid.classList.add("grid");
    productsList.forEach(p => productGrid.appendChild(createProductCard(p)));
    return;
  }

  // Livello 1 (Macro-sezioni): Categorie figlie dirette della root
  const macroCategories = allCategories.filter(c => Number(c.parent_id) === Number(rootCat.id));

  if (macroCategories.length === 0) {
    // Se non ci sono sotto-categorie, mostra i prodotti in una griglia piatta
    productGrid.classList.add("grid");
    productsList.forEach(p => productGrid.appendChild(createProductCard(p)));
    return;
  }

  // Stiamo renderizzando l'albero gerarchico: rimuoviamo la classe "grid" dal contenitore principale
  // affinché le macro-sezioni si comportino come blocchi full-width
  productGrid.classList.remove("grid");

  // Renderizza ciascuna macro-sezione
  macroCategories.forEach(macro => {
    // Livello 2 (Sotto-sezioni): Categorie figlie di questa macro-sezione (es. Borbone, Toraldo, Del RE)
    const subCategories = allCategories.filter(c => Number(c.parent_id) === Number(macro.id));
    
    const macroContainer = document.createElement("div");
    macroContainer.className = "macro-section";
    macroContainer.style.marginBottom = "40px";

    const macroHeader = document.createElement("h2");
    macroHeader.className = "h2 category-section-title";
    macroHeader.textContent = macro.name;
    macroHeader.style.cssText = "font-size: 22px; border-bottom: 2px solid var(--accent); padding-bottom: 8px; margin-bottom: 20px; color: var(--accent); text-transform: uppercase; letter-spacing: 1px;";
    macroContainer.appendChild(macroHeader);

    let hasProducts = false;

    if (subCategories.length > 0) {
      subCategories.forEach(sub => {
        // Livello 3: Sotto-sotto-categorie di questo brand (es. Sistemi Nespresso, A Modo Mio, Dolce Gusto)
        const subSubCategories = allCategories.filter(c => Number(c.parent_id) === Number(sub.id));
        
        // Verifica se ci sono prodotti per questa sotto-sezione (direttamente o nei suoi figli di 3° livello)
        const directSubProducts = productsList.filter(p => Number(p.category_id) === Number(sub.id));
        
        let hasSubProducts = directSubProducts.length > 0;
        const subSubData = [];
        
        subSubCategories.forEach(subSub => {
          const subSubProducts = productsList.filter(p => Number(p.category_id) === Number(subSub.id));
          if (subSubProducts.length > 0) {
            hasSubProducts = true;
            subSubData.push({ category: subSub, products: subSubProducts });
          }
        });

        if (hasSubProducts) {
          hasProducts = true;
          
          const subContainer = document.createElement("div");
          subContainer.className = "sub-section";
          subContainer.style.marginBottom = "28px";

          const subHeader = document.createElement("h3");
          subHeader.className = "h3 subcategory-title";
          subHeader.textContent = sub.name;
          subHeader.style.cssText = "font-size: 20px; margin-top: 24px; margin-bottom: 16px; color: var(--accent); font-weight: 600; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%; border-bottom: 1px dashed rgba(210, 160, 111, 0.3); padding-bottom: 8px;";
          subContainer.appendChild(subHeader);

          // 1. Renderizza i prodotti DIRETTI della sotto-categoria (se ce ne sono)
          if (directSubProducts.length > 0) {
            const subSubContainer = document.createElement("div");
            subSubContainer.className = "sub-sub-section";
            subSubContainer.style.cssText = "margin-left: 12px; margin-bottom: 20px;";

            const subSubHeader = document.createElement("h4");
            subSubHeader.className = "h4 sub-subcategory-title";
            subSubHeader.textContent = `Capsule ${sub.name}`;
            subSubHeader.style.cssText = "font-size: 14px; margin-top: 14px; margin-bottom: 8px; color: var(--accent); padding-left: 10px; border-left: 2px solid var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;";
            subSubContainer.appendChild(subSubHeader);

            const grid = document.createElement("div");
            grid.className = "products-grid grid";
            directSubProducts.forEach(p => grid.appendChild(createProductCard(p)));
            subSubContainer.appendChild(grid);

            subContainer.appendChild(subSubContainer);
          }

          // 2. Renderizza i sistemi di 3° livello (Sotto-sotto-categorie)
          if (subSubData.length > 0) {
            subSubData.forEach(item => {
              const subSubContainer = document.createElement("div");
              subSubContainer.className = "sub-sub-section";
              subSubContainer.style.cssText = "margin-left: 12px; margin-bottom: 20px;";

              const subSubHeader = document.createElement("h4");
              subSubHeader.className = "h4 sub-subcategory-title";
              subSubHeader.textContent = item.category.name;
              subSubHeader.style.cssText = "font-size: 14px; margin-top: 14px; margin-bottom: 8px; color: var(--accent); padding-left: 10px; border-left: 2px solid var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;";
              subSubContainer.appendChild(subSubHeader);

              const grid = document.createElement("div");
              grid.className = "products-grid grid";
              item.products.forEach(p => grid.appendChild(createProductCard(p)));
              subSubContainer.appendChild(grid);

              subContainer.appendChild(subSubContainer);
            });
          }
          
          macroContainer.appendChild(subContainer);
        }
      });
    }

    // Prodotti associati DIRETTAMENTE alla macro-sezione
    const directProducts = productsList.filter(p => Number(p.category_id) === Number(macro.id));
    if (directProducts.length > 0) {
      hasProducts = true;
      const grid = document.createElement("div");
      grid.className = "products-grid grid";
      directProducts.forEach(p => grid.appendChild(createProductCard(p)));
      macroContainer.appendChild(grid);
    }

    // Aggiungi al DOM solo se ci sono prodotti
    if (hasProducts) {
      productGrid.appendChild(macroContainer);
    }
  });

  // Prodotti orfani (associati direttamente alla root o a categorie non tracciate nell'albero corrente)
  const allTreeCatIds = new Set();
  macroCategories.forEach(macro => {
    allTreeCatIds.add(Number(macro.id));
    
    const subCategories = allCategories.filter(c => Number(c.parent_id) === Number(macro.id));
    subCategories.forEach(sub => {
      allTreeCatIds.add(Number(sub.id));
      
      const subSubCategories = allCategories.filter(c => Number(c.parent_id) === Number(sub.id));
      subSubCategories.forEach(subSub => {
        allTreeCatIds.add(Number(subSub.id));
      });
    });
  });

  const orphanProducts = productsList.filter(p => !allTreeCatIds.has(Number(p.category_id)));
  if (orphanProducts.length > 0) {
    const orphanContainer = document.createElement("div");
    orphanContainer.className = "macro-section orphan-section";
    orphanContainer.style.marginBottom = "40px";

    const orphanHeader = document.createElement("h2");
    orphanHeader.className = "h2 category-section-title";
    orphanHeader.textContent = "Altri Prodotti";
    orphanHeader.style.cssText = "font-size: 22px; border-bottom: 2px solid var(--accent); padding-bottom: 8px; margin-bottom: 20px; color: var(--accent); text-transform: uppercase; letter-spacing: 1px;";
    orphanContainer.appendChild(orphanHeader);

    const grid = document.createElement("div");
    grid.className = "products-grid grid";
    orphanProducts.forEach(p => grid.appendChild(createProductCard(p)));
    orphanContainer.appendChild(grid);

    productGrid.appendChild(orphanContainer);
  }
}

// ============================
// Ricerca prodotti
// ============================

searchInput?.addEventListener("input", () => {
  const q = (searchInput.value || "").toLowerCase().trim();
  if (!q) return renderTreeProducts(categoryProducts);
  renderTreeProducts(categoryProducts.filter(p => (p.name || "").toLowerCase().includes(q)));
});

// ============================
// Inizializza al caricamento pagina
// ============================

// Aspetta che app.js sia completamente caricato
function initCategoryPage() {
  if (typeof window.appReady === 'undefined') {
    setTimeout(initCategoryPage, 100);
    return;
  }
  console.log('[category.js] App pronto, caricamento prodotti...');
  loadProducts();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCategoryPage);
} else {
  initCategoryPage();
}