const { test, expect } = require("@playwright/test");

test("F-18 - modifier puis supprimer une ligne du Cart Medusa", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();

  const firstProduct = page.locator("#men-tshirt-products .product-card").first();
  await expect(firstProduct).toBeVisible();
  const productResponsePromise = page.waitForResponse((response) => (
    response.url().includes("/medusa-products/") && response.status() === 200
  ));
  await firstProduct.click();
  await expect(page).toHaveURL(/\/products\/prod_.+/);

  const productResponse = await productResponsePromise;
  const product = await productResponse.json();
  const variant = product.variants.find((item) => item.available && item.price);

  for (const option of variant.options) {
    await page.locator(`.product-option-group[data-option-id="${option.optionId}"] .option-radio-btn`, {
      hasText: option.value,
    }).click();
  }

  await page.locator(".cart-btn").click();
  await expect(page.locator(".cart-btn")).toHaveText("added");
  await page.goto("/cart");

  const cartProduct = page.locator(".cart .sm-product").first();
  await expect(cartProduct).toBeVisible();
  const lineId = await cartProduct.getAttribute("data-line-id");
  const cartId = await page.evaluate(() => localStorage.getItem("medusa_cart_id"));
  expect(lineId).toMatch(/^cali_/);
  expect(cartId).toMatch(/^cart_/);

  const incrementResponsePromise = page.waitForResponse((response) => (
    response.url().includes(`/medusa-cart/${cartId}/items/${lineId}`)
    && response.request().method() === "PATCH"
  ));
  await cartProduct.locator(".increment").click();
  const incrementResponse = await incrementResponsePromise;
  expect(incrementResponse.status()).toBe(200);
  expect((await incrementResponse.json()).cart.items[0].quantity).toBe(2);
  await expect(page.locator(`[data-line-id="${lineId}"] .item-count`)).toHaveText("2");

  const decrementResponsePromise = page.waitForResponse((response) => (
    response.url().includes(`/medusa-cart/${cartId}/items/${lineId}`)
    && response.request().method() === "PATCH"
  ));
  await page.locator(`[data-line-id="${lineId}"] .decrement`).click();
  const decrementResponse = await decrementResponsePromise;
  expect((await decrementResponse.json()).cart.items[0].quantity).toBe(1);
  await expect(page.locator(`[data-line-id="${lineId}"] .item-count`)).toHaveText("1");

  const deleteResponsePromise = page.waitForResponse((response) => (
    response.url().includes(`/medusa-cart/${cartId}/items/${lineId}`)
    && response.request().method() === "DELETE"
  ));
  await page.locator(`[data-line-id="${lineId}"] .sm-delete-btn`).click();
  const deleteResponse = await deleteResponsePromise;
  expect(deleteResponse.status()).toBe(200);
  expect((await deleteResponse.json()).cart.items).toHaveLength(0);
  await expect(page.locator(".cart .sm-product")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("cart"))).toBeNull();

  await page.evaluate(() => localStorage.setItem("medusa_cart_id", "cart_missing"));
  await page.reload();
  await expect(page.locator(".cart .sm-product")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("medusa_cart_id"))).toBeNull();
});
