const { test, expect } = require("@playwright/test");

const cartId = "cart_payment_test";
const order = {
  id: "order_medusa_test",
  display_id: 42,
  customer_id: "cus_test",
  currency_code: "eur",
  total: 60,
  status: "pending",
  payment_status: "captured",
  fulfillment_status: "not_fulfilled",
  items: [{
    id: "line_test",
    product_title: "Medusa Test Product",
    variant_title: "M / Blue",
    thumbnail: "/img/no image.png",
    quantity: 1,
    unit_price: 50,
  }],
};

const prepareReturnPage = async (page) => {
  await page.addInitScript(({ cartId }) => {
    if (sessionStorage.getItem("checkout_return_test_initialized")) return;
    sessionStorage.setItem("user", JSON.stringify({
      name: "Username Playwright",
      email: "playwright@example.com",
      seller: false,
    }));
    sessionStorage.setItem("checkout_return_test_initialized", "true");
    sessionStorage.setItem("medusa_cart_id", cartId);
  }, { cartId });
};

for (const paymentMethod of ["card", "link"]) {
  test(`F-06 - le retour Stripe Checkout ${paymentMethod} retrouve l'Order Medusa`, async ({ page }) => {
    await prepareReturnPage(page);
    const sessionId = `cs_test_${paymentMethod}`;
    let statusRequestUrl = "";

    await page.route("**/stripe-checkout/status?**", (route) => {
      statusRequestUrl = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "complete", order }),
      });
    });
    await page.route("**/medusa-orders/order_medusa_test", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ order }),
    }));

    await page.goto(`/stripe-checkout/return?session_id=${sessionId}&cart_id=${cartId}`);

    await expect(page).toHaveURL(/\/order\/order_medusa_test$/);
    await expect(page.locator(".order-reference")).toHaveText("Order #42");
    await expect(page.locator(".order-total")).toContainText("60,00");
    const statusUrl = new URL(statusRequestUrl);
    expect(statusUrl.searchParams.get("session_id")).toBe(sessionId);
    expect(statusUrl.searchParams.get("cart_id")).toBe(cartId);
    expect(await page.evaluate(() => sessionStorage.getItem("medusa_cart_id"))).toBeNull();

    await page.reload();
    await expect(page.locator(".order-reference")).toHaveText("Order #42");
  });
}

test("F-06 - un retour Stripe non confirmé conserve le Cart", async ({ page }) => {
  await prepareReturnPage(page);
  await page.route("**/stripe-checkout/status?**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "checkout_status_unavailable" }),
  }));

  await page.goto(`/stripe-checkout/return?session_id=cs_test_pending&cart_id=${cartId}`);

  await expect(page.locator("#checkout-return-status")).toHaveText(
    "Unable to confirm the order yet. Your cart is unchanged."
  );
  expect(await page.evaluate(() => sessionStorage.getItem("medusa_cart_id"))).toBe(cartId);
  await expect(page).toHaveURL(/\/stripe-checkout\/return/);
});

test("F-06 - le retour Stripe attend une Order déjà finalisée par le webhook", async ({ page }) => {
  await prepareReturnPage(page);
  let statusRequests = 0;

  await page.route("**/stripe-checkout/status?**", (route) => {
    statusRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(statusRequests === 1
        ? { status: "pending" }
        : { status: "complete", order }),
    });
  });
  await page.route("**/medusa-orders/order_medusa_test", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ order }),
  }));

  await page.goto(`/stripe-checkout/return?session_id=cs_test_delayed&cart_id=${cartId}`);

  await expect(page).toHaveURL(/\/order\/order_medusa_test$/);
  expect(statusRequests).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => sessionStorage.getItem("medusa_cart_id"))).toBeNull();
});
