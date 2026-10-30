const { test, expect } = require("@playwright/test");

// These are storefront contract tests. Routes are mocked deliberately: they
// protect the user-facing failure path but do not prove Medusa's inventory
// reservation or Stripe's webhook completion in a live environment.
const cartId = "cart_phase_a_stock";
const cart = {
  id: cartId,
  currency_code: "eur",
  items: [{
    id: "line_phase_a_stock",
    product_title: "Phase A stock product",
    variant_title: "M / Blue",
    thumbnail: "/img/no image.png",
    quantity: 2,
    unit_price: 25,
    total: 50,
  }],
  item_subtotal: 50,
  shipping_total: 0,
  discount_total: 0,
  tax_total: 0,
  total: 50,
  shipping_methods: [],
};

const checkoutAddress = {
  last_name: "Stock",
  first_name: "Phase A",
  address: "10 rue du Test",
  street: "Rue du Test",
  city: "La Rochelle",
  state: "Charente-Maritime",
  pincode: "17000",
  landmark: "",
  country: "fr",
};

const prepareCheckout = async (page, handlers = {}) => {
  await page.addInitScript(({ id }) => {
    sessionStorage.setItem("user", JSON.stringify({ name: "Phase A", email: "phase-a@example.test" }));
    sessionStorage.setItem("medusa_cart_id", id);
  }, { id: cartId });
  // checkout.js now trusts the server-restored Customer session, not only the
  // legacy sessionStorage cache. This mock keeps the test in its intended
  // simulated-auth scope; it does not validate Medusa authentication.
  await page.route("**/medusa-customer/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      authenticated: true,
      user: { name: "Phase A", email: "phase-a@example.test" },
    }),
  }));
  await page.route("**/medusa-cart/current", (route) => route.fulfill({ json: { cart } }));
  await page.route(`**/medusa-checkout/${cartId}/reset`, handlers.reset || ((route) => route.fulfill({
    json: {
      cart,
      shippingOptions: [{ id: "so_phase_a", name: "Standard Shipping", amount: 0 }],
      stripeCheckoutAvailable: true,
    },
  })));
  await page.route(`**/medusa-checkout/${cartId}/shipping`, handlers.shipping || ((route) => route.fulfill({
    json: { cart: { ...cart, shipping_methods: [{ shipping_option_id: "so_phase_a" }] } },
  })));
  await page.route(`**/medusa-checkout/${cartId}/stripe-checkout`, handlers.stripeCheckout || ((route) => route.fulfill({
    json: { cart, checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_phase_a" },
  })));
};

const fillAddress = async (page) => {
  for (const [field, value] of Object.entries(checkoutAddress)) {
    const locator = page.locator(`#${field}`);
    if (field === "country") {
      await locator.selectOption(value);
    } else {
      await locator.fill(value);
    }
  }
};

test("Phase A mock - un refus de stock à l’entrée du checkout conserve le Cart et propose le retour au panier", async ({ page }) => {
  await prepareCheckout(page, {
    reset: (route) => route.fulfill({ status: 409, json: { error: "insufficient_inventory" } }),
  });

  await page.goto("/checkout");

  await expect(page.locator(".checkout-status")).toContainText("ne sont plus disponibles");
  await expect(page.locator(".checkout-cart-return")).toBeVisible();
  await expect(page.locator(".place-order-btn")).toBeDisabled();
  await expect(page.locator(".place-order-btn")).toHaveText("Passez commande");
  expect(await page.evaluate(() => sessionStorage.getItem("medusa_cart_id"))).toBe(cartId);
});

test("Phase A mock - le retour au panier est masqué après une nouvelle vérification valide", async ({ page }) => {
  let insufficient = true;
  await prepareCheckout(page, {
    reset: (route) => route.fulfill(insufficient
      ? { status: 409, json: { error: "insufficient_inventory" } }
      : {
        json: {
          cart,
          shippingOptions: [{ id: "so_phase_a", name: "Standard Shipping", amount: 0 }],
          stripeCheckoutAvailable: true,
        },
      }),
  });

  await page.goto("/checkout");
  await expect(page.locator(".checkout-cart-return")).toBeVisible();

  insufficient = false;
  await page.reload();

  await expect(page.locator(".checkout-cart-return")).toBeHidden();
});

test("Phase A mock - un refus de stock pendant la livraison conserve le Cart et affiche une erreur", async ({ page }) => {
  await prepareCheckout(page, {
    shipping: (route) => route.fulfill({ status: 409, json: { error: "insufficient_inventory" } }),
  });

  await page.goto("/checkout");
  await expect(page.locator(".checkout-cart-return")).toBeHidden();
  await fillAddress(page);
  await page.locator('.shipping-option input[value="so_phase_a"]').click();

  await expect(page.locator(".checkout-status")).toContainText("ne sont plus disponibles");
  await expect(page.locator(".checkout-cart-return")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("medusa_cart_id"))).toBe(cartId);
  await expect(page.locator(".cart .sm-product")).toHaveCount(1);
});

test("Phase A mock - un refus de stock avant Stripe ne redirige pas et conserve le Cart", async ({ page }) => {
  await prepareCheckout(page, {
    stripeCheckout: (route) => route.fulfill({ status: 409, json: { error: "insufficient_inventory" } }),
  });

  await page.goto("/checkout");
  await fillAddress(page);
  await page.locator('.shipping-option input[value="so_phase_a"]').click();
  await page.locator(".place-order-btn").click();

  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.locator(".checkout-status")).toContainText("ne sont plus disponibles");
  await expect(page.locator(".checkout-cart-return")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("medusa_cart_id"))).toBe(cartId);
});

test("Phase A mock - un webhook sans Order confirmée ne retire pas le Cart", async ({ page }) => {
  await page.addInitScript(({ id }) => sessionStorage.setItem("medusa_cart_id", id), { id: cartId });
  await page.route("**/stripe-checkout/status?**", (route) => route.fulfill({
    status: 409,
    json: { error: "order_not_created" },
  }));

  await page.goto(`/stripe-checkout/return?session_id=cs_test_phase_a&cart_id=${cartId}`);

  await expect(page.locator("#checkout-return-status")).toHaveText(
    "Unable to confirm the order yet. Your cart is unchanged."
  );
  expect(await page.evaluate(() => sessionStorage.getItem("medusa_cart_id"))).toBe(cartId);
});

test("Phase A mock - le panier conserve une ligne sans stock et affiche le stock disponible", async ({ page }) => {
  await page.route("**/medusa-customer/session", (route) => route.fulfill({
    json: { authenticated: false },
  }));
  await page.route("**/medusa-cart/current", (route) => route.fulfill({
    json: {
      cart,
      inventory: {
        sufficient: false,
        lines: [{
          line_id: "line_phase_a_stock",
          variant_id: "variant_phase_a_stock",
          requested_quantity: 2,
          requested_variant_quantity: 2,
          available_quantity: 0,
          manage_inventory: true,
          allow_backorder: false,
          sufficient: false,
          reason: "insufficient_inventory",
        }],
      },
    },
  }));

  await page.goto("/cart");

  await expect(page.locator(".cart .sm-product")).toHaveCount(1);
  await expect(page.locator(".cart-stock-status")).toContainText("ne sont plus disponibles");
  await expect(page.locator(".cart-inventory-message")).toHaveText("Cet article n’est plus disponible.");
  await expect(page.locator(".checkout-btn")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator(".decrement")).toBeEnabled();
  await expect(page.locator(".increment")).toBeDisabled();
});

test("Phase A mock - le bouton Checkout est réactivé après un contrôle de stock valide", async ({ page }) => {
  await page.route("**/medusa-customer/session", (route) => route.fulfill({
    json: { authenticated: false },
  }));
  await page.route("**/medusa-cart/current", (route) => route.fulfill({
    json: {
      cart,
      inventory: {
        sufficient: true,
        lines: [{
          line_id: "line_phase_a_stock",
          variant_id: "variant_phase_a_stock",
          requested_quantity: 2,
          requested_variant_quantity: 2,
          available_quantity: 2,
          manage_inventory: true,
          allow_backorder: false,
          sufficient: true,
        }],
      },
    },
  }));

  await page.goto("/cart");

  await expect(page.locator(".checkout-btn")).toHaveAttribute("aria-disabled", "false");
});
