(async function () {
    const msgEl = document.getElementById("successMsg");
    const boxEl = document.getElementById("successBox");

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("orderid") || params.get("order_id");

    if (!orderId) {
        msgEl.textContent = "Manca l'ID ordine nell'URL.";
        return;
    }

    const sessionId = params.get("session_id") || params.get("sessionId");

    if (sessionId) {
        await fetch(
            `/api/stripe_confirm_payment.php?order_id=${encodeURIComponent(orderId)}&session_id=${encodeURIComponent(sessionId)}`,
            { method: "GET", headers: { "Accept": "application/json" } }
        );
    }

    try {
        const res = await fetch(`/api/orders/public/${encodeURIComponent(orderId)}`, {
            method: "GET",
            headers: { "Accept": "application/json" }
        });


        const data = await res.json();

        if (!res.ok) {
            msgEl.textContent = data?.error || "Errore nel recupero dell'ordine.";
            return;
        }

        const o = data.order;

        if (!o) {
            msgEl.textContent = "Risposta server inattesa (manca order).";
            return;
        }

        // Reset carrello locale dopo conferma transazione
        localStorage.setItem("coffee_cart_v1", "[]");
        window.dispatchEvent(new Event('cartUpdated'));

        const statusMap = {
            pending: "In attesa",
            pending_payment: "In attesa pagamento",
            paid: "Pagato",
            in_preparazione: "In preparazione",
            in_consegna: "In consegna",
            consegnato: "Consegnato"
        };

        const statusLabel = statusMap[o.status] || o.status || "-";
        const total = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" })
            .format((o.total_cents || 0) / 100);
        const createdAt = o.created_at ? new Date(o.created_at).toLocaleString("it-IT") : "-";

        boxEl.innerHTML = `
            <div style="display:grid; gap:8px;">
            <div><strong>Ordine #:</strong> ${o.id}</div>
            <div><strong>Stato:</strong> ${statusLabel}</div>
            <div><strong>Totale:</strong> ${total}</div>
            <div><strong>Data:</strong> ${createdAt}</div>
            </div>
        `;


    } catch (err) {
        msgEl.textContent = "Errore di rete o server non raggiungibile.";
    }
})();
