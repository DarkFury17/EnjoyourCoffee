const STORAGE_CART = "coffee_cart_v1";

const euro = (cents) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);

function loadCart() {
    try { return JSON.parse(localStorage.getItem(STORAGE_CART)) ?? []; }
    catch { return []; }
}
function saveCart(cart) {
    localStorage.setItem(STORAGE_CART, JSON.stringify(cart));
}

let cart = loadCart();

const checkoutForm = document.getElementById("checkoutForm");
const checkoutNotice = document.getElementById("checkoutNotice");
const cartSummary = document.getElementById("cartSummary");
const checkoutTotals = document.getElementById("checkoutTotals");
const btnQuote = document.getElementById("btnQuote");
const btnRecalc = document.getElementById("btnRecalc");

function setCheckoutNotice(msg) {
    if (!checkoutNotice) return;
    checkoutNotice.hidden = !msg;
    checkoutNotice.textContent = msg || "";
}

function renderCartSummary() {
    if (!cartSummary) return;

    if (!Array.isArray(cart) || cart.length === 0) {
        cartSummary.innerHTML = `<div class="muted">Il carrello è vuoto. Torna allo shop.</div>`;
        return;
    }

    const rows = cart.map(it => {
        const variantInfo = it.variant_label ? ` <span class="variant-badge">${it.variant_label}</span>` : '';
        return `
    <div style="display:flex; justify-content:space-between; gap:12px;">
      <div>${it.name}${variantInfo} <span class="muted small">× ${it.qty}</span></div>
      <div>${euro(it.price_cents * it.qty)}</div>
    </div>
  `;
    }).join("");

    cartSummary.innerHTML = rows;
}

(function () {
    const p = new URLSearchParams(window.location.search);
    const canceled = p.get("canceled");
    const orderId = p.get("order_id");

    if (canceled === "1" && orderId) {
        setCheckoutNotice("Pagamento annullato: sto annullando l'ordine...");
        fetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST" })
            .then(async (r) => {
                const d = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(d?.error || "Errore annullamento");
                setCheckoutNotice("Pagamento annullato. Nessun addebito effettuato.");
                window.history.replaceState({}, "", "/checkout.html");
            })
            .catch((e) => setCheckoutNotice(String(e.message || e)));
    }

})();

function showTotals(totals) {
    if (!checkoutTotals) return;
    checkoutTotals.hidden = false;

    const discountRow = totals.discount_cents > 0
        ? `<div><b>Sconto primo acquisto (-5%):</b> -${euro(totals.discount_cents)}</div>`
        : "";

    checkoutTotals.innerHTML = `
    <div><b>Subtotale:</b> ${euro(totals.subtotal_cents)}</div>
    ${discountRow}
    <div><b>Consegna:</b> ${euro(totals.delivery_cents)}</div>
    <div><b>Contrassegno:</b> ${euro(totals.cod_fee_cents)}</div>
    <div><b>Totale:</b> ${euro(totals.total_cents)}</div>
  `;
}

function buildCheckoutPayload() {
    return {
        customer: {
            name: document.getElementById("cName")?.value?.trim(),
            surname: document.getElementById("cSurname")?.value?.trim(),
            email: document.getElementById("cEmail")?.value?.trim(),
            phone: document.getElementById("cPhone")?.value?.trim(),
        },
        address: {
            street: document.getElementById("aStreet")?.value?.trim(),
            number: document.getElementById("aNumber")?.value?.trim(),
            cap: document.getElementById("aCap")?.value?.trim(),
            city: document.getElementById("aCity")?.value?.trim(),
            details: document.getElementById("aDetails")?.value?.trim(),
        },
        delivery_slot: document.getElementById("deliverySlot")?.value,
        payment_method: document.getElementById("paymentMethod")?.value,
        notes: { delivery: document.getElementById("deliveryNotes")?.value?.trim() },
        cart,
    };
}

async function postJson(url, payload) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // per cookie sessione e sconto [web:1874]
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || data.detail || `HTTP ${res.status}`);
    return data;
}

async function doQuote() {
    setCheckoutNotice("");
    if (!cart.length) throw new Error("Il carrello è vuoto.");
    const payload = buildCheckoutPayload();
    const q = await postJson("/api/orders/quote", payload);
    showTotals(q.totals);
}

btnQuote?.addEventListener("click", async () => {
    try { await doQuote(); } catch (e) { setCheckoutNotice(String(e.message || e)); }
});

btnRecalc?.addEventListener("click", async () => {
    try { await doQuote(); } catch (e) { setCheckoutNotice(String(e.message || e)); }
});

checkoutForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        setCheckoutNotice("");

        // Privacy Policy checkbox validation
        const privacyCheck = document.getElementById("privacyAccept");
        const privacyLabel = document.getElementById("privacyCheckLabel");
        if (privacyCheck && !privacyCheck.checked) {
            setCheckoutNotice("Devi accettare la Privacy Policy per procedere con l'ordine.");
            if (privacyLabel) {
                privacyLabel.classList.remove("is-error");
                void privacyLabel.offsetWidth; // force reflow for re-trigger animation
                privacyLabel.classList.add("is-error");
                privacyLabel.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(() => privacyLabel.classList.remove("is-error"), 1200);
            }
            return;
        }

        if (!cart.length) throw new Error("Il carrello è vuoto.");

        // 1) quote
        await doQuote();

        // 2) create order
        const payload = buildCheckoutPayload();
        const created = await postJson("/api/orders", payload);
        console.log("created order response:", created);
        console.log("payment_method:", payload.payment_method);

        const orderId = created.order.id;

        setCheckoutNotice(`Ordine creato! ID: ${orderId}`);

        // Se pagamento carta -> apri Stripe
        if (payload.payment_method === "card") {
            const r = await fetch(`/api/stripe_create_checkout.php`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ orderId }),
            });
            const d = await r.json().catch(() => null);
            if (!r.ok || !d?.ok || !d?.url) {
                setCheckoutNotice(d?.error || d?.message || "Errore apertura pagamento con carta.");
                return;
            }
            window.location.href = d.url;
            return;
        }

        // Se contrassegno -> vai alla success
        window.location.href = `/success.html?order_id=${encodeURIComponent(orderId)}`;

        // svuota carrello locale
        cart = [];
        saveCart(cart);

    } catch (e2) {
        setCheckoutNotice(String(e2.message || e2));
    }
});

// init
renderCartSummary();
if (cart && cart.length > 0) {
    doQuote().catch(console.error);
}
