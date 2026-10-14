const { test } = require("node:test");
const assert = require("node:assert/strict");
require("dotenv").config();
const { signGuestCart } = require("../guest-cart-proof");

const storeKey = process.env.MEDUSA_PUBLISHABLE_API_KEY;
const bff = "http://127.0.0.1:5000";
const medusa = "http://127.0.0.1:9000";

const request = (base, pathname, { method = "GET", body, cookie, store = false } = {}) => fetch(`${base}${pathname}`, {
  method,
  headers: {
    ...(store ? { "x-publishable-api-key": storeKey } : {}),
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
  },
  body: body ? JSON.stringify(body) : undefined,
  signal: AbortSignal.timeout(15000),
});

test("guest Cart proof protects BFF and native Store Cart entry points", { timeout: 90000 }, async () => {
  assert.ok(storeKey, "MEDUSA_PUBLISHABLE_API_KEY is required");
  const productsResponse = await request(bff, "/medusa-home-products");
  assert.equal(productsResponse.status, 200);
  const products = await productsResponse.json();
  let variantId;
  let secondVariantId;
  for (const product of products) {
    const detailsResponse = await request(bff, `/medusa-products/${encodeURIComponent(product.id)}`);
    if (detailsResponse.status !== 200) continue;
    const details = await detailsResponse.json();
    for (const variant of details.variants || []) {
      if (!variant.available) continue;
      if (!variantId) variantId = variant.id;
      else if (variant.id !== variantId) secondVariantId = variant.id;
    }
    if (secondVariantId) break;
  }
  assert.ok(variantId, "a purchasable product variant is required");
  assert.ok(secondVariantId, "a second purchasable product variant is required");

  const create = async () => {
    const response = await request(bff, "/medusa-cart/items", {
      method: "POST", body: { variantId, quantity: 1 },
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    assert.match(cookie || "", /^mvdw_guest_cart_proof=/);
    const cookieHeader = response.headers.get("set-cookie") || "";
    assert.match(cookieHeader, /HttpOnly/i);
    assert.match(cookieHeader, /SameSite=Lax/i);
    assert.match(cookieHeader, /Path=\//i);
    assert.doesNotMatch(cookieHeader, /(?:Max-Age|Expires)=/i);
    const { cart } = await response.json();
    assert.ok(cart.id);
    return { cart, cookie };
  };

  const first = await create();
  const second = await create();
  const firstPath = `/store/carts/${encodeURIComponent(first.cart.id)}`;
  const firstBffPath = `/medusa-cart/${encodeURIComponent(first.cart.id)}`;
  const validBff = await request(bff, firstBffPath, { cookie: first.cookie });
  assert.equal(validBff.status, 200);
  assert.equal((await validBff.json()).cart.id, first.cart.id);
  const noProofCurrent = await request(bff, "/medusa-cart/current");
  assert.equal(noProofCurrent.status, 200);
  assert.equal((await noProofCurrent.json()).cart, null);
  const current = await request(bff, "/medusa-cart/current", { cookie: first.cookie });
  assert.equal((await current.json()).cart.id, first.cart.id);
  for (const cookie of [second.cookie, `${first.cookie}x`, `mvdw_guest_cart_proof=${signGuestCart(first.cart.id, Date.now() - 8 * 24 * 60 * 60 * 1000)}`]) {
    const response = await request(bff, "/medusa-cart/current", { cookie });
    const { cart } = await response.json();
    assert.notEqual(cart?.id, first.cart.id);
  }

  for (const cookie of [undefined, second.cookie, `${first.cookie}x`]) {
    assert.equal((await request(bff, firstBffPath, { cookie })).status, 404);
    assert.equal((await request(medusa, firstPath, { cookie, store: true })).status, 404);
  }

  const validNative = await request(medusa, firstPath, { cookie: first.cookie, store: true });
  assert.equal(validNative.status, 200);
  assert.equal((await validNative.json()).cart.id, first.cart.id);

  const lineId = first.cart.items[0]?.id;
  assert.ok(lineId);
  const mutationPath = `${firstPath}/line-items/${encodeURIComponent(lineId)}`;
  assert.equal((await request(medusa, mutationPath, {
    method: "POST", body: { quantity: 2 }, store: true,
  })).status, 404);
  assert.equal((await request(medusa, mutationPath, {
    method: "POST", body: { quantity: 1 }, cookie: first.cookie, store: true,
  })).status, 200);
  const update = await request(bff, `/medusa-cart/${encodeURIComponent(first.cart.id)}/items/${encodeURIComponent(lineId)}`, {
    method: "PATCH", body: { quantity: 1 }, cookie: first.cookie,
  });
  assert.equal(update.status, 200);
  assert.equal((await request(bff, "/medusa-cart/items", {
    method: "POST", body: { cartId: first.cart.id, variantId, quantity: 1 },
  })).status, 404);

  // Deux onglets indépendants : le second ne dispose que du cookie partagé.
  const addFromSecondTab = await request(bff, "/medusa-cart/items", {
    method: "POST", cookie: first.cookie,
    body: { cartId: second.cart.id, variantId: secondVariantId, quantity: 1 },
  });
  assert.equal(addFromSecondTab.status, 200);
  const sharedCart = (await addFromSecondTab.json()).cart;
  assert.equal(sharedCart.id, first.cart.id);
  assert.ok(sharedCart.items.some((item) => item.variant_id === variantId));
  assert.ok(sharedCart.items.some((item) => item.variant_id === secondVariantId));
  const refreshedFirstTab = await request(bff, "/medusa-cart/current", { cookie: first.cookie });
  assert.equal((await refreshedFirstTab.json()).cart.items.length, sharedCart.items.length);

  assert.equal((await request(medusa, "/store/payment-collections", {
    method: "POST", body: { cart_id: first.cart.id }, store: true,
  })).status, 404);
  const collectionResponse = await request(medusa, "/store/payment-collections", {
    method: "POST", body: { cart_id: first.cart.id }, cookie: first.cookie, store: true,
  });
  assert.equal(collectionResponse.status, 200);
  const collectionId = (await collectionResponse.json()).payment_collection?.id;
  assert.ok(collectionId);
  assert.equal((await request(medusa, `/store/payment-collections/${encodeURIComponent(collectionId)}/payment-sessions`, {
    method: "POST", body: { provider_id: "not-used-in-this-test" }, store: true,
  })).status, 404);
  const permittedSessionAttempt = await request(medusa, `/store/payment-collections/${encodeURIComponent(collectionId)}/payment-sessions`, {
    method: "POST", body: { provider_id: "not-used-in-this-test" }, cookie: first.cookie, store: true,
  });
  assert.notEqual(permittedSessionAttempt.status, 404);
  assert.equal((await request(medusa, `/store/shipping-options?cart_id=${encodeURIComponent(first.cart.id)}`, {
    store: true,
  })).status, 404);
  assert.equal((await request(medusa, `/store/shipping-options?cart_id=${encodeURIComponent(first.cart.id)}`, {
    cookie: first.cookie, store: true,
  })).status, 200);
  assert.equal((await request(medusa, `${firstPath}/customer`, {
    method: "POST", cookie: first.cookie, store: true,
  })).status, 401);
});
