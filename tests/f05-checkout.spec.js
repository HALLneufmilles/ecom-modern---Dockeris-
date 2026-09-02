const { test, expect } = require("@playwright/test");

test("F-05 - saisir une adresse et lancer le checkout depuis le Cart Medusa", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.setItem("user", JSON.stringify({
      name: "Playwright",
      email: "playwright@example.com",
      seller: false,
    }));
  });

  const cartSetup = await page.evaluate(async () => {
    const catalogue = await fetch("/medusa-home-products").then((response) => response.json());
    const product = await fetch(`/medusa-products/${catalogue[0].id}`).then((response) => response.json());
    const variant = product.variants.find((item) => item.available && item.price);
    const response = await fetch("/medusa-cart/items", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ variantId: variant.id, quantity: 1 }),
    });
    const { cart } = await response.json();
    localStorage.setItem("medusa_cart_id", cart.id);
    return { cartId: cart.id, productName: product.name };
  });

  await page.route("**/stripe-checkout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify("/"),
    });
  });

  await page.goto("/checkout");
  await expect(page.locator(".heading")).toHaveText("checkout");
  await expect(page.locator(".sm-product-name")).toHaveText(cartSetup.productName);
  await expect(page.locator(".bill")).toContainText("€");

  await page.locator(".place-order-btn").click();
  await expect(page.locator(".alert-msg")).toHaveText("fill all the inputs first");

  await page.locator("#address").fill("10 rue du Test");
  await page.locator("#street").fill("Rue du Test");
  await page.locator("#city").fill("La Rochelle");
  await page.locator("#state").fill("Charente-Maritime");
  await page.locator("#pincode").fill("17000");
  await page.locator("#landmark").fill("Près du port");

  const checkoutRequestPromise = page.waitForRequest(
    (request) => request.url().endsWith("/stripe-checkout") && request.method() === "POST"
  );
  await page.locator(".place-order-btn").click();

  const body = (await checkoutRequestPromise).postDataJSON();
  expect(body.email).toBe("playwright@example.com");
  expect(body.cartId).toBe(cartSetup.cartId);
  expect(body.items).toBeUndefined();
  expect(body.address).toEqual({
    address: "10 rue du Test",
    street: "Rue du Test",
    city: "La Rochelle",
    state: "Charente-Maritime",
    pincode: "17000",
    landmark: "Près du port",
  });
});
