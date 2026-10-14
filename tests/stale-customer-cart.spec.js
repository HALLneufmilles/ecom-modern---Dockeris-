const { test, expect } = require("@playwright/test");

test("un cookie Customer refusé conserve le panier invité lors d'un ajout depuis la fiche produit", async ({
  page,
  context,
  request
}) => {
  const catalogueResponse = await request.get("/medusa-home-products");
  expect(catalogueResponse.status()).toBe(200);
  const selections = [];
  for (const summary of await catalogueResponse.json()) {
    const response = await request.get(`/medusa-products/${encodeURIComponent(summary.id)}`);
    if (!response.ok()) continue;
    const product = await response.json();
    const variant = product.variants?.find((entry) => entry.available && entry.price);
    if (variant) selections.push({ product, variant });
    if (selections.length === 2) break;
  }
  expect(selections).toHaveLength(2);
  const [initial, addition] = selections;

  const created = await request.post("/medusa-cart/items", {
    data: { variantId: initial.variant.id, quantity: 1 }
  });
  expect(created.status()).toBe(200);
  const guestCart = (await created.json()).cart;
  const originalLine = guestCart.items.find((item) => item.variant_id === initial.variant.id);
  expect(originalLine.quantity).toBe(1);
  const proofCookie = (await request.storageState()).cookies.find((cookie) => cookie.name === "mvdw_guest_cart_proof");
  expect(Boolean(proofCookie?.httpOnly)).toBe(true);
  await context.addCookies([
    proofCookie,
    {
      name: "medusa_customer_token",
      value: "invalid-browser-regression-token",
      url: "http://127.0.0.1:5000",
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);

  // Le jeton invalide ne donne aucun accès aux données réservées au Customer.
  const customerOnly = await context.request.get("/medusa-wishlist");
  expect(customerOnly.status()).toBe(401);
  expect(await customerOnly.json()).toEqual({ error: "authentication_required" });

  await page.goto(`/products/${addition.product.id}`);
  expect(await page.evaluate(() => sessionStorage.getItem("medusa_cart_id"))).toBeNull();
  for (const option of addition.variant.options) {
    await page
      .locator(
        `.product-option-group[data-option-id="${option.optionId}"] .option-radio-btn[data-option-value="${option.value}"]`
      )
      .click();
  }

  const statuses = [];
  page.on("response", (response) => {
    if (response.url().endsWith("/medusa-cart/items") && response.request().method() === "POST")
      statuses.push(response.status());
  });
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/medusa-cart/items") && response.request().method() === "POST"
  );
  await page.locator(".cart-btn").click();
  const response = await responsePromise;
  expect(response.request().postDataJSON().cartId).toBeNull();
  expect(response.request().postDataJSON().variantId).toBe(addition.variant.id);
  expect(response.status()).toBe(200);
  const cart = (await response.json()).cart;
  expect(cart.id).toBe(guestCart.id);
  expect(cart.customer_id).toBeFalsy();
  expect(cart.items).toHaveLength(2);
  expect(cart.items.find((item) => item.id === originalLine.id)?.quantity).toBe(originalLine.quantity);
  expect(cart.items.find((item) => item.variant_id === addition.variant.id)?.quantity).toBe(1);
  // await expect(page.locator(".cart-btn")).toHaveText("added");
  await expect(page.locator(".cart-btn")).toHaveText("Ajouté");
  expect(statuses).toEqual([200]);
  expect((await context.cookies()).some((cookie) => cookie.name === "medusa_customer_token")).toBe(false);

  const current = await context.request.get("/medusa-cart/current");
  expect(current.status()).toBe(200);
  expect((await current.json()).cart.id).toBe(guestCart.id);
  await page.goto("/cart");
  await expect(page.locator(`.cart .sm-product[data-line-id="${originalLine.id}"] .item-count`)).toHaveText("1");
  await expect(page.locator(".cart .sm-product-name").filter({ hasText: addition.product.name })).toHaveCount(1);
  await expect(page.locator(".cart .sm-product")).toHaveCount(2);
});
