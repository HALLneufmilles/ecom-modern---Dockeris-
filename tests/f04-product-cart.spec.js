const { test, expect } = require("@playwright/test");

test("F-04 - ouvrir un produit Medusa, choisir sa variante et l'ajouter au panier Medusa", async ({ page }) => {
  const legacyDetailRequests = [];

  page.on("request", (request) => {
    if (
      request.url().endsWith("/get-products")
      && request.method() === "POST"
      && request.postData()?.includes('"id":')
    ) {
      legacyDetailRequests.push(request);
    }
  });

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("medusa_cart_id", "cart_missing");
  });
  await page.reload();

  const firstProduct = page.locator("#men-tshirt-products .product-card").first();
  await expect(firstProduct).toBeVisible();

  const productName = (await firstProduct.locator(".product-brand").textContent()).trim();
  const productResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/medusa-products/") && response.request().method() === "GET"
  );

  await firstProduct.click();
  await expect(page).toHaveURL(/\/products\/prod_.+/);

  const productResponse = await productResponsePromise;
  expect(productResponse.status()).toBe(200);

  const product = await productResponse.json();
  expect(product.source).toBe("medusa");
  expect(product.id).toMatch(/^prod_/);
  expect(product.variants.length).toBeGreaterThan(0);
  expect(product.options.length).toBeGreaterThan(0);

  await expect(page.locator(".product-brand")).toHaveText(productName);
  await expect(page.locator(".product-images img:visible").first()).toBeVisible();
  expect(legacyDetailRequests).toHaveLength(0);

  const cartButton = page.locator(".cart-btn");
  await cartButton.click();
  await expect(cartButton).toHaveText("add to cart");
  await expect(page.locator(".option-radio-btn.uncheck").first()).toBeVisible();

  const availableVariant = product.variants.find((variant) => variant.available && variant.price);
  expect(availableVariant).toBeTruthy();

  for (const selectedOption of availableVariant.options) {
    const group = page.locator(
      `.product-option-group[data-option-id="${selectedOption.optionId}"]`
    );
    const optionButton = group.locator(".option-radio-btn").filter({
      hasText: selectedOption.value,
    });

    await optionButton.click();
    await expect(optionButton).toHaveClass(/check/);
  }

  await expect(page.locator(".product-stock")).toHaveText("In stock");
  await expect(page.locator(".product-price")).not.toHaveText("Price unavailable");

  const cartResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/medusa-cart/items") && response.request().method() === "POST"
  );

  await cartButton.click();

  const cartResponse = await cartResponsePromise;
  expect(cartResponse.status()).toBe(200);

  const { cart: medusaCart } = await cartResponse.json();
  expect(medusaCart.id).toMatch(/^cart_/);
  expect(medusaCart.items.some((item) => item.variant_id === availableVariant.id)).toBe(true);
  await expect(cartButton).toHaveText("added");

  const storedState = await page.evaluate(() => ({
    cartId: localStorage.getItem("medusa_cart_id"),
    legacyCart: localStorage.getItem("cart"),
  }));

  expect(storedState.cartId).toBe(medusaCart.id);
  expect(storedState.cartId).not.toBe("cart_missing");
  expect(storedState.legacyCart).toBeNull();

  await page.goto("/cart");

  const cartProduct = page.locator(".cart .sm-product").first();
  await expect(cartProduct).toBeVisible();
  await expect(cartProduct.locator(".sm-product-name")).toHaveText(productName);
  await expect(cartProduct.locator(".item-count")).toHaveText("1");
  const renderedCart = await page.evaluate(() => window.currentMedusaCart);
  expect(renderedCart.id).toBe(medusaCart.id);
  expect(renderedCart.items[0].variant_id).toBe(availableVariant.id);

  if (availableVariant.price.currencyCode?.toLowerCase() === "eur") {
    await expect(cartProduct.locator(".sm-price")).toContainText("€");
    await expect(page.locator(".bill")).toContainText("€");
  }
});
