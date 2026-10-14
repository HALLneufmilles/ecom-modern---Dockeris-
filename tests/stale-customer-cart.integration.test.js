const { test } = require("node:test");
const assert = require("node:assert/strict");
require("dotenv").config();
const { signGuestCart } = require("../guest-cart-proof");

const base = "http://127.0.0.1:5000";

const request = (path, { method = "GET", cookie, body } = {}) => fetch(`${base}${path}`, {
  method,
  headers: {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(body ? { "Content-Type": "application/json" } : {}),
  },
  body: body ? JSON.stringify(body) : undefined,
  signal: AbortSignal.timeout(15000),
});

const availableVariant = async () => {
  const productsResponse = await request("/medusa-home-products");
  assert.equal(productsResponse.status, 200);
  for (const product of await productsResponse.json()) {
    const response = await request(`/medusa-products/${encodeURIComponent(product.id)}`);
    if (!response.ok) continue;
    const details = await response.json();
    const variant = details.variants?.find((entry) => entry.available);
    if (variant) return variant.id;
  }
  assert.fail("No available Medusa variant for the Cart integration test");
};

test("refused Customer token falls back only to a proven guest Cart", { timeout: 60000 }, async () => {
  const variantId = await availableVariant();
  const first = await request("/medusa-cart/items", {
    method: "POST", body: { variantId, quantity: 1 },
  });
  assert.equal(first.status, 200);
  const guestCookie = first.headers.get("set-cookie")?.split(";")[0];
  assert.match(guestCookie || "", /^mvdw_guest_cart_proof=/);
  const guestCart = (await first.json()).cart;

  const mixed = await request("/medusa-cart/items", {
    method: "POST",
    cookie: `${guestCookie}; medusa_customer_token=invalid-integration-token`,
    body: { variantId, quantity: 1 },
  });
  assert.equal(mixed.status, 200);
  assert.match(mixed.headers.get("set-cookie") || "", /medusa_customer_token=;/);
  assert.equal((await mixed.json()).cart.id, guestCart.id);

  const recovered = await request("/medusa-cart/current", { cookie: guestCookie });
  assert.equal(recovered.status, 200);
  const recoveredCart = (await recovered.json()).cart;
  assert.equal(recoveredCart.id, guestCart.id);
  assert.equal(recoveredCart.items.find((item) => item.variant_id === variantId).quantity, 2);

  const withoutProof = await request("/medusa-cart/items", {
    method: "POST",
    cookie: "medusa_customer_token=invalid-integration-token",
    body: { variantId, quantity: 1 },
  });
  assert.equal(withoutProof.status, 200);
  assert.match(withoutProof.headers.get("set-cookie") || "", /medusa_customer_token=;/);
  assert.notEqual((await withoutProof.json()).cart.id, guestCart.id);

  const unauthorized = await request(`/medusa-cart/${encodeURIComponent(guestCart.id)}`, {
    cookie: "medusa_customer_token=invalid-integration-token",
  });
  assert.equal(unauthorized.status, 404);
  assert.match(unauthorized.headers.get("set-cookie") || "", /medusa_customer_token=;/);

  const forged = await request("/medusa-cart/items", {
    method: "POST",
    cookie: "medusa_customer_token=invalid-integration-token; mvdw_guest_cart_proof=forged",
    body: { cartId: guestCart.id, variantId, quantity: 1 },
  });
  assert.equal(forged.status, 404);
});

test("a refused Customer token never authorizes a missing guest Cart", async () => {
  const missingId = "cart_missing_stale_customer_regression";
  const proof = `mvdw_guest_cart_proof=${signGuestCart(missingId)}`;
  const current = await request("/medusa-cart/current", {
    cookie: `${proof}; medusa_customer_token=invalid-integration-token`,
  });
  assert.equal(current.status, 200);
  assert.equal((await current.json()).cart, null);
  assert.match(current.headers.get("set-cookie") || "", /medusa_customer_token=;/);
  const direct = await request(`/medusa-cart/${missingId}`, { cookie: proof });
  assert.equal(direct.status, 404);
});
