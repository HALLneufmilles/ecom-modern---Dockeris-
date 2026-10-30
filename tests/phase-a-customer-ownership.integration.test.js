const { test } = require("node:test");
const assert = require("node:assert/strict");
require("dotenv").config();

const base = "http://127.0.0.1:5000";
const medusaStoreBase = process.env.MVDW_PHASE_A_MEDUSA_STORE_URL || "http://127.0.0.1:9000";
const requiredEnvironment = [
  "MVDW_PHASE_A_CUSTOMER_A_TOKEN",
  "MVDW_PHASE_A_CUSTOMER_B_TOKEN",
  "MVDW_PHASE_A_CUSTOMER_A_CART_ID",
  "MVDW_PHASE_A_CUSTOMER_A_ORDER_ID",
];

const request = (path, token, { method = "GET", body } = {}) => fetch(`${base}${path}`, {
  method,
  headers: {
    Cookie: `medusa_customer_token=${token}`,
    ...(body ? { "Content-Type": "application/json" } : {}),
  },
  body: body ? JSON.stringify(body) : undefined,
  signal: AbortSignal.timeout(15000),
});

const medusaStoreRequest = (path, publishableApiKey, token) => fetch(`${medusaStoreBase}${path}`, {
  headers: {
    "x-publishable-api-key": publishableApiKey,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  signal: AbortSignal.timeout(15000),
});

const validAddress = {
  last_name: "Ownership",
  first_name: "Probe",
  address: "10 rue du Test",
  street: "Rue du Test",
  city: "La Rochelle",
  state: "Charente-Maritime",
  pincode: "17000",
  landmark: "",
  country: "fr",
};

test("Phase A - Customer B cannot access Customer A checkout, Stripe status, or Order", async (t) => {
  const missing = requiredEnvironment.filter((name) => !process.env[name]);
  if (missing.length) {
    t.skip(`Requires isolated existing fixtures: ${missing.join(", ")}`);
    return;
  }

  const customerA = process.env.MVDW_PHASE_A_CUSTOMER_A_TOKEN;
  const customerB = process.env.MVDW_PHASE_A_CUSTOMER_B_TOKEN;
  const cartId = process.env.MVDW_PHASE_A_CUSTOMER_A_CART_ID;
  const orderId = process.env.MVDW_PHASE_A_CUSTOMER_A_ORDER_ID;

  // Customer A proves that the supplied fixture is usable. All following
  // probes use Customer B and must fail before any Cart mutation is reached.
  assert.equal((await request(`/medusa-checkout/${encodeURIComponent(cartId)}`, customerA)).status, 200);

  assert.equal((await request(`/medusa-checkout/${encodeURIComponent(cartId)}`, customerB)).status, 404);
  assert.equal((await request(`/medusa-checkout/${encodeURIComponent(cartId)}/shipping`, customerB, {
    method: "POST",
    body: { address: validAddress, shippingOptionId: "so_ownership_probe" },
  })).status, 404);
  assert.equal((await request(`/medusa-checkout/${encodeURIComponent(cartId)}/stripe-checkout`, customerB, {
    method: "POST",
    body: { address: validAddress, shippingOptionId: "so_ownership_probe" },
  })).status, 404);
  assert.equal((await request(`/medusa-checkout/${encodeURIComponent(cartId)}/complete`, customerB, {
    method: "POST",
  })).status, 404);
  assert.equal((await request(
    `/stripe-checkout/status?cart_id=${encodeURIComponent(cartId)}&session_id=cs_ownership_probe`,
    customerB
  )).status, 404);
  assert.equal((await request(`/medusa-orders/${encodeURIComponent(orderId)}`, customerB)).status, 404);
});

test("Phase A - Medusa Store refuses direct Order access without the owning Customer", async (t) => {
  const required = [...requiredEnvironment, "MEDUSA_PUBLISHABLE_API_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    t.skip(`Requires isolated fixtures and a Store key: ${missing.join(", ")}`);
    return;
  }

  const customerA = process.env.MVDW_PHASE_A_CUSTOMER_A_TOKEN;
  const customerB = process.env.MVDW_PHASE_A_CUSTOMER_B_TOKEN;
  const orderId = process.env.MVDW_PHASE_A_CUSTOMER_A_ORDER_ID;
  const publishableApiKey = process.env.MEDUSA_PUBLISHABLE_API_KEY;
  const path = `/store/orders/${encodeURIComponent(orderId)}`;

  assert.equal((await medusaStoreRequest(path, publishableApiKey, customerA)).status, 200);
  assert.equal((await medusaStoreRequest(path, publishableApiKey, customerB)).status, 404);
  assert.equal((await medusaStoreRequest(path, publishableApiKey)).status, 404);
});
