const { test, expect } = require("@playwright/test");

const guestCart = (id = "cart_guest_checkout") => ({
  id,
  email: "",
  currency_code: "eur",
  items: [{
    id: "line_guest_checkout",
    product_title: "Guest checkout product",
    variant_title: "M",
    thumbnail: "/img/no image.png",
    quantity: 1,
    unit_price: 25,
    total: 25,
  }],
  item_subtotal: 25,
  shipping_total: 0,
  discount_total: 0,
  tax_total: 0,
  total: 25,
  shipping_methods: [],
});

const guestCheckoutResponse = (cart, shippingOptions) => ({
  cart,
  shippingOptions,
  checkoutMode: "guest",
  checkoutContact: { email: cart.email, phone: cart.shipping_address?.phone || "" },
  checkoutPaymentAvailable: false,
  stripeAvailable: false,
  stripeCheckoutAvailable: false,
  stripePublishableKey: null,
});

const installGuestCheckoutRoutes = async (page, cart, {
  onShipping = () => {},
  resetResponse,
} = {}) => {
  const shippingOptions = [
    { id: "so_guest_standard", name: "Standard Shipping", amount: 0 },
    { id: "so_guest_express", name: "Express Shipping", amount: 8 },
  ];

  await page.route("**/medusa-customer/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ authenticated: false }),
  }));
  await page.route("**/medusa-cart/current", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ cart }),
  }));
  await page.route(`**/medusa-checkout/${cart.id}/reset`, (route) => resetResponse
    ? resetResponse(route)
    : route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(guestCheckoutResponse(cart, shippingOptions)),
    }));
  await page.route(`**/medusa-checkout/${cart.id}/shipping`, (route) => {
    const body = route.request().postDataJSON();
    onShipping(body);
    cart.email = body.email;
    cart.shipping_address = {
      ...body.address,
      address_1: body.address.address,
      address_2: [body.address.street, body.address.landmark].filter(Boolean).join(", "),
    };
    cart.shipping_methods = [{ shipping_option_id: body.shippingOptionId }];
    cart.shipping_total = body.shippingOptionId === "so_guest_express" ? 8 : 0;
    cart.total = cart.item_subtotal + cart.shipping_total;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cart }),
    });
  });
  return shippingOptions;
};

const fillGuestAddress = async (page) => {
  await page.locator("#last_name").fill("Guest");
  await page.locator("#first_name").fill("Camille");
  await page.locator("#address").fill("10 rue du Test");
  await page.locator("#street").fill("Rue du Test");
  await page.locator("#city").fill("La Rochelle");
  await page.locator("#state").fill("Charente-Maritime");
  await page.locator("#pincode").fill("17000");
};

// This is a mocked storefront/BFF contract test. It does not demonstrate the
// native Medusa HMAC middleware; that is covered by the opt-in integration test.
test("Phase A mock - un invité sans e-mail de Cart ni session héritée atteint Checkout sans paiement Stripe", async ({ page }) => {
  const cart = guestCart();
  await page.addInitScript(() => {
    sessionStorage.setItem("user", JSON.stringify({ email: "former-customer@example.test" }));
  });
  await installGuestCheckoutRoutes(page, cart);
  let stripeRequests = 0;
  await page.route(`**/medusa-checkout/${cart.id}/stripe-checkout`, (route) => {
    stripeRequests += 1;
    return route.abort();
  });

  await page.goto("/checkout");

  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.locator("#email")).toHaveValue("");
  await expect(page.locator("#email")).toHaveAttribute("autocomplete", "off");
  await expect(page.locator("#email")).not.toHaveJSProperty("readOnly", true);
  expect(await page.evaluate(() => sessionStorage.getItem("user"))).toBeNull();
  await expect(page.locator(".shipping-option input")).toHaveCount(2);
  await expect(page.locator(".place-order-btn")).toBeDisabled();
  await expect(page.locator(".place-order-btn")).toHaveText("Passez commande");
  await expect(page.locator(".checkout-status")).toHaveText("Le paiement pour les invités est temporairement indisponible.");
  expect(stripeRequests).toBe(0);
});

test("Phase A mock - l'e-mail invité est obligatoire et le téléphone reste facultatif", async ({ page }) => {
  const cart = guestCart("cart_guest_email");
  const submittedBodies = [];
  const shippingOptions = await installGuestCheckoutRoutes(page, cart, {
    onShipping: (body) => submittedBodies.push(body),
  });

  await page.goto("/checkout");
  await fillGuestAddress(page);
  await page.locator(`.shipping-option input[value="${shippingOptions[0].id}"]`).click();
  await expect(page.locator("#email-error")).toHaveText("This field is required.");
  expect(submittedBodies).toHaveLength(0);

  await page.locator("#email").fill("not-an-email");
  await page.locator(`.shipping-option input[value="${shippingOptions[1].id}"]`).click();
  await expect(page.locator("#email-error")).toHaveText("Enter a valid email address.");
  expect(submittedBodies).toHaveLength(0);

  await page.locator("#email").fill("guest@example.test");
  const shippingRequest = page.waitForRequest((request) => (
    request.url().endsWith(`/medusa-checkout/${cart.id}/shipping`) && request.method() === "POST"
  ));
  await page.locator(`.shipping-option input[value="${shippingOptions[1].id}"]`).click();
  await shippingRequest;

  expect(submittedBodies).toEqual([expect.objectContaining({
    email: "guest@example.test",
    address: expect.objectContaining({ phone: "" }),
  })]);
  await expect(page.locator("#phone-error")).toHaveText("");
  await expect(page.locator(`.shipping-option input[value="${shippingOptions[1].id}"]`)).toBeChecked();
  await expect(page.locator('[data-summary="total"]')).toContainText("33");
  await expect(page.locator(".checkout-status")).not.toHaveText("checkout_unavailable");
});

test("Phase A mock - un e-mail invité vient uniquement du Cart courant et reste modifiable", async ({ page }) => {
  const cart = guestCart("cart_guest_contact");
  cart.email = "guest-cart@example.test";
  await page.addInitScript(() => {
    sessionStorage.setItem("user", JSON.stringify({ email: "former-customer@example.test" }));
  });
  await installGuestCheckoutRoutes(page, cart);

  await page.goto("/checkout");

  await expect(page.locator("#email")).toHaveValue("guest-cart@example.test");
  await expect(page.locator("#email")).not.toHaveJSProperty("readOnly", true);
  await page.locator("#email").fill("changed-guest@example.test");
  await expect(page.locator("#email")).toHaveValue("changed-guest@example.test");
});

test("Phase A mock - un échec de chargement restaure le bouton et explique l'indisponibilité", async ({ page }) => {
  const cart = guestCart("cart_guest_reset_failure");
  await installGuestCheckoutRoutes(page, cart, {
    resetResponse: (route) => route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "checkout_unavailable" }),
    }),
  });

  await page.goto("/checkout");

  await expect(page.locator(".shipping-option input")).toHaveCount(0);
  await expect(page.locator(".checkout-status")).toHaveText(
    "Le chargement du Checkout est temporairement indisponible. Réessayez."
  );
  await expect(page.locator(".checkout-status")).toHaveClass(/error/);
  await expect(page.locator(".place-order-btn")).toBeDisabled();
  await expect(page.locator(".place-order-btn")).toHaveText("Passez commande");
});
