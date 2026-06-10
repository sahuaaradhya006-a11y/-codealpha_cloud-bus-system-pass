const statusEl = document.querySelector("#service-status");
const form = document.querySelector("#booking-form");
const routeSelect = document.querySelector("#route-select");
const passSelect = document.querySelector("#pass-select");
const riderSelect = document.querySelector("#rider-select");
const quoteButton = document.querySelector("#quote-button");
const resultEl = document.querySelector("#result");

const formatMoney = (cents, currency) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

function option(value, label) {
  const el = document.createElement("option");
  el.value = value;
  el.textContent = label;
  return el;
}

async function loadCatalog() {
  const catalog = await api("/api/routes");
  routeSelect.replaceChildren(
    ...catalog.routes.map((route) => option(route.id, `${route.name} (${route.distanceKm} km)`))
  );
  passSelect.replaceChildren(...catalog.passTypes.map((pass) => option(pass.id, pass.label)));
  riderSelect.replaceChildren(...catalog.riderTypes.map((rider) => option(rider.id, rider.label)));
  statusEl.textContent = "Ready";
  statusEl.classList.add("ready");
}

function formPayload() {
  const data = new FormData(form);
  return {
    routeId: data.get("routeId"),
    passType: data.get("passType"),
    riderType: data.get("riderType"),
    user: {
      name: data.get("name"),
      email: data.get("email"),
      phone: data.get("phone")
    }
  };
}

function showQuote(quote) {
  resultEl.className = "result-card";
  resultEl.innerHTML = `
    <div class="small">Server calculated fare</div>
    <div class="price">${formatMoney(quote.priceCents, quote.currency)}</div>
    <div>${quote.breakdown.routeName}</div>
    <div class="small">${quote.breakdown.passLabel} for ${quote.breakdown.riderLabel}</div>
    <div class="small">Pricing rule ${quote.ruleVersion}; valid for ${quote.expiresInDays} day(s).</div>
  `;
}

function showPass(response) {
  const { pass, pricing } = response;
  resultEl.className = "result-card";
  resultEl.innerHTML = `
    <div class="small">Confirmed pass</div>
    <div class="price">${formatMoney(pass.fareCents, pass.currency)}</div>
    <div><strong>Pass ID:</strong> ${pass.passId}</div>
    <div><strong>Status:</strong> ${pass.status}</div>
    <div><strong>Owner:</strong> ${pass.owner.email}</div>
    <div class="small">Valid until ${new Date(pass.expiresAt).toLocaleString()}</div>
    <div class="small">QR token for validator apps</div>
    <div class="token">${pass.qrToken}</div>
    <div class="small">Fare checked against rule ${pricing.ruleVersion}; no browser-entered price was accepted.</div>
  `;
}

quoteButton.addEventListener("click", async () => {
  try {
    showQuote(await api("/api/quote", { method: "POST", body: JSON.stringify(formPayload()) }));
  } catch (error) {
    resultEl.className = "empty-state warning";
    resultEl.textContent = error.message;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = {
      ...formPayload(),
      idempotencyKey: crypto.randomUUID()
    };
    showPass(await api("/api/bookings", { method: "POST", body: JSON.stringify(payload) }));
  } catch (error) {
    resultEl.className = "empty-state warning";
    resultEl.textContent = error.message;
  }
});

loadCatalog().catch((error) => {
  statusEl.textContent = "Offline";
  resultEl.className = "empty-state warning";
  resultEl.textContent = error.message;
});
