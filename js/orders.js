const euro = (cents) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);

const ordersNotice = document.getElementById("ordersNotice");
const ordersList = document.getElementById("ordersList");
const ordersEmpty = document.getElementById("ordersEmpty");
const orderDetail = document.getElementById("orderDetail");
const orderDetailBox = document.getElementById("orderDetailBox");

function setNotice(msg) {
  if (!ordersNotice) return;
  ordersNotice.hidden = !msg;
  ordersNotice.textContent = msg || "";
}

async function getJson(url) {
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Errore nel caricamento");
  return data;
}

function renderOrders(orders) {
  ordersList.innerHTML = "";
  ordersEmpty.hidden = true;
  orderDetail.hidden = true;
  orderDetailBox.innerHTML = "";

  if (!orders.length) {
    ordersEmpty.hidden = false;
    return;
  }

  for (const o of orders) {
    const card = document.createElement("article");
    card.className = "card";
    card.style.padding = "14px";
    card.style.cursor = "pointer";

    const created = new Date(o.created_at).toLocaleString("it-IT");

    card.innerHTML = `
      <div class="muted small">${created}</div>
      <div style="margin-top:6px;"><b>ID:</b> ${o.id}</div>
      <div style="margin-top:6px;"><b>Stato:</b> ${o.status}</div>
      <div style="margin-top:6px;"><b>Totale:</b> ${euro(o.total_cents)}</div>
    `;

    card.addEventListener("click", async () => {
      try {
        setNotice("");
        const d = await getJson(`/api/orders_get.php?order_id=${o.id}`);
        renderOrderDetail(d.order, d.items);
      } catch (e) {
        setNotice(String(e.message || e));
      }
    });

    ordersList.appendChild(card);
  }
}

function renderOrderDetail(order, items) {
  orderDetail.hidden = false;

  const rows = (items || [])
    .map(it => `<li>${it.product_name} · ${it.qty} × ${euro(it.unit_price_cents)}</li>`)
    .join("");

  orderDetailBox.innerHTML = `
    <div><b>Totale:</b> ${euro(order.total_cents)}</div>
    <div style="margin-top:8px;"><b>Prodotti:</b></div>
    <ul style="margin-top:6px;">${rows || "<li>Nessuna riga ordine.</li>"}</ul>
  `;

  orderDetail.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function main() {
  try {
    setNotice("Caricamento ordini...");
    const data = await getJson('/api/orders_user.php');
    setNotice("");
    renderOrders(data.orders || []);
  } catch (e) {
    setNotice("Devi effettuare l'accesso per vedere i tuoi ordini.");
  }
}

main();
