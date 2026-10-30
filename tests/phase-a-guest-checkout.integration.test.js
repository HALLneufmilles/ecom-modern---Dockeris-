const { test } = require("node:test");
const assert = require("node:assert/strict");
require("dotenv").config();

const base = "http://127.0.0.1:5000";
const guestFixtureVariables = [
  "MVDW_PHASE_A_GUEST_CART_ID",
  "MVDW_PHASE_A_GUEST_CART_PROOF",
  "MVDW_PHASE_A_GUEST_OTHER_CART_ID",
];

const validAddress = {
  last_name: "Guest",
  first_name: "Probe",
  address: "10 rue du Test",
  street: "Rue du Test",
  city: "La Rochelle",
  state: "Charente-Maritime",
  pincode: "17000",
  landmark: "",
  country: "fr",
  phone: "",
};

const request = (path, { token, guestProof, method = "GET", body } = {}) => fetch(`${base}${path}`, {
  method,
  headers: {
    ...(token ? { Cookie: `medusa_customer_token=${token}` } : {}),
    ...(guestProof ? { Cookie: `mvdw_guest_cart_proof=${guestProof}` } : {}),
    ...(body ? { "Content-Type": "application/json" } : {}),
  },
  body: body ? JSON.stringify(body) : undefined,
  signal: AbortSignal.timeout(15000),
});

const requireFixture = (t, variables) => {
  const missing = variables.filter((name) => !process.env[name]);
  if (missing.length) {
    t.skip(`Requires isolated fixtures: ${missing.join(", ")}`);
    return false;
  }
  return true;
};

// This is a real local BFF/Medusa integration test. It deliberately relies on
// supplied disposable fixtures rather than creating products, changing stock,
// or generating a live Stripe session.
test("Phase A - la preuve invité protège l'accès Checkout et bloque le paiement invité", async (t) => {
  if (!requireFixture(t, guestFixtureVariables)) return;

  const cartId = process.env.MVDW_PHASE_A_GUEST_CART_ID;
  const guestProof = process.env.MVDW_PHASE_A_GUEST_CART_PROOF;
  const otherCartId = process.env.MVDW_PHASE_A_GUEST_OTHER_CART_ID;
  const encodedCartId = encodeURIComponent(cartId);

  const validCheckout = await request(`/medusa-checkout/${encodedCartId}`, { guestProof });
  assert.equal(validCheckout.status, 200);
  const checkout = await validCheckout.json();
  assert.equal(checkout.checkoutMode, "guest");
  assert.equal(checkout.checkoutPaymentAvailable, false);
  assert.ok(Array.isArray(checkout.shippingOptions));

  assert.equal((await request(`/medusa-checkout/${encodedCartId}`)).status, 404);
  assert.equal((await request(`/medusa-checkout/${encodedCartId}`, { guestProof: "forged-proof" })).status, 404);
  assert.equal((await request(`/medusa-checkout/${encodeURIComponent(otherCartId)}`, { guestProof })).status, 404);

  const shippingOptionId = checkout.shippingOptions.find((option) => Number(option.amount) > 0)?.id
    || checkout.shippingOptions[0]?.id;
  assert.ok(shippingOptionId, "The isolated guest Cart needs an available shipping option.");

  for (const email of ["", "not-an-email"]) {
    const invalidEmail = await request(`/medusa-checkout/${encodedCartId}/shipping`, {
      method: "POST",
      guestProof,
      body: { email, address: validAddress, shippingOptionId },
    });
    assert.equal(invalidEmail.status, 400);
    assert.equal((await invalidEmail.json()).error, "invalid_checkout_email");
  }

  const payment = await request(`/medusa-checkout/${encodedCartId}/stripe-checkout`, {
    method: "POST",
    guestProof,
    body: { email: "guest@example.test", address: validAddress, shippingOptionId },
  });
  assert.equal(payment.status, 403);
  assert.equal((await payment.json()).error, "guest_checkout_payment_not_available");
  assert.equal((await request(`/medusa-checkout/${encodedCartId}/complete`, {
    method: "POST",
    guestProof,
  })).status, 403);
});

test("Phase A - la livraison invité enregistre l'e-mail et accepte un téléphone vide", async (t) => {
  if (!requireFixture(t, guestFixtureVariables)) return;
  if (process.env.MVDW_PHASE_A_GUEST_CHECKOUT_MUTATION_APPROVED !== "true") {
    t.skip("Set MVDW_PHASE_A_GUEST_CHECKOUT_MUTATION_APPROVED=true only for a disposable guest Cart.");
    return;
  }

  const cartId = process.env.MVDW_PHASE_A_GUEST_CART_ID;
  const guestProof = process.env.MVDW_PHASE_A_GUEST_CART_PROOF;
  // When supplied, this can deliberately be an e-mail that already belongs
  // to a Customer: the request has no Customer cookie and must remain guest.
  const guestEmail = process.env.MVDW_PHASE_A_GUEST_EXISTING_CUSTOMER_EMAIL
    || "guest-checkout@example.test";
  const reset = await request(`/medusa-checkout/${encodeURIComponent(cartId)}/reset`, {
    method: "POST",
    guestProof,
  });
  assert.equal(reset.status, 200);
  const checkout = await reset.json();
  assert.equal(checkout.checkoutMode, "guest");
  assert.ok(Array.isArray(checkout.shippingOptions));
  const shippingOptionId = checkout.shippingOptions.find((option) => Number(option.amount) > 0)?.id
    || checkout.shippingOptions[0]?.id;
  assert.ok(shippingOptionId, "The isolated guest Cart needs an available shipping option.");

  const response = await request(`/medusa-checkout/${encodeURIComponent(cartId)}/shipping`, {
    method: "POST",
    guestProof,
    body: { email: guestEmail, address: validAddress, shippingOptionId },
  });
  assert.equal(response.status, 200);
  const { cart } = await response.json();
  assert.equal(cart.email, guestEmail);
  assert.equal(cart.customer_id, null, "Guest checkout must not attach the Cart to a Customer account.");
  assert.ok(cart.shipping_methods?.some((method) => method.shipping_option_id === shippingOptionId));
  assert.equal(cart.shipping_address?.phone || "", "");
  const afterShipping = await request(`/medusa-checkout/${encodeURIComponent(cartId)}`, { guestProof });
  assert.equal(afterShipping.status, 200);
  assert.equal((await afterShipping.json()).checkoutMode, "guest");
});

test("Phase A - l'e-mail Customer ne peut pas être remplacé par le navigateur", async (t) => {
  const customerVariables = [
    "MVDW_PHASE_A_CHECKOUT_CUSTOMER_TOKEN",
    "MVDW_PHASE_A_CHECKOUT_CUSTOMER_CART_ID",
    "MVDW_PHASE_A_CHECKOUT_CUSTOMER_EMAIL",
  ];
  if (!requireFixture(t, customerVariables)) return;
  if (process.env.MVDW_PHASE_A_GUEST_CHECKOUT_MUTATION_APPROVED !== "true") {
    t.skip("Use a disposable Customer Cart and explicitly approve the checkout mutation test.");
    return;
  }

  const token = process.env.MVDW_PHASE_A_CHECKOUT_CUSTOMER_TOKEN;
  const cartId = process.env.MVDW_PHASE_A_CHECKOUT_CUSTOMER_CART_ID;
  const customerEmail = process.env.MVDW_PHASE_A_CHECKOUT_CUSTOMER_EMAIL;
  const checkoutResponse = await request(`/medusa-checkout/${encodeURIComponent(cartId)}`, { token });
  assert.equal(checkoutResponse.status, 200);
  const checkout = await checkoutResponse.json();
  const shippingOptionId = checkout.shippingOptions[0]?.id;
  assert.ok(shippingOptionId, "The isolated Customer Cart needs an available shipping option.");

  const response = await request(`/medusa-checkout/${encodeURIComponent(cartId)}/shipping`, {
    method: "POST",
    token,
    body: { email: "attacker@example.test", address: validAddress, shippingOptionId },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).cart.email, customerEmail);
});
