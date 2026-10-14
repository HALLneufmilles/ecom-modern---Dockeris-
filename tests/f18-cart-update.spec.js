const { test, expect } = require("@playwright/test");

const addTwoCatalogueVariantsToCart = async (page) => page.evaluate(async () => {
  const catalogue = await fetch("/medusa-home-products").then((response) => response.json());
  const selections = [];

  for (const productSummary of catalogue) {
    const product = await fetch(`/medusa-products/${productSummary.id}`).then((response) => response.json());
    const variant = product.variants.find((item) => item.available && item.price);
    if (variant) selections.push({ product, variant });
    if (selections.length === 2) break;
  }

  if (selections.length !== 2) throw new Error("two_available_variants_required");

  let cart = null;
  for (const { variant } of selections) {
    const response = await fetch("/medusa-cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(cart ? { cartId: cart.id } : {}), variantId: variant.id, quantity: 1 }),
    });
    const data = await response.json();
    if (!response.ok || !data.cart) throw new Error("cart_setup_failed");
    cart = data.cart;
    sessionStorage.setItem("medusa_cart_id", cart.id);
  }

  return {
    cartId: cart.id,
    variants: selections.map(({ variant }) => variant.id),
  };
});

const expectButtonHitTarget = async (locator) => {
  const hitTargetIsButton = await locator.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return target === button || target?.closest("button") === button;
  });
  expect(hitTargetIsButton).toBe(true);
};

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
    await page.locator(`.product-option-group[data-option-id="${option.optionId}"] .option-radio-btn[data-option-value="${option.value}"]`).click();
  }

  await page.locator(".cart-btn").click();
  await expect(page.locator(".cart-btn")).toHaveText("Ajouté");
  await page.goto("/cart");

  const cartProduct = page.locator(".cart .sm-product").first();
  await expect(cartProduct).toBeVisible();
  const lineId = await cartProduct.getAttribute("data-line-id");
  const cartId = await page.evaluate(() => sessionStorage.getItem("medusa_cart_id"));
  expect(lineId).toMatch(/^cali_/);
  expect(cartId).toMatch(/^cart_/);

  const productHref = `/products/${await cartProduct.getAttribute("data-product-id")}`;
  await expect(cartProduct.locator(".sm-product-image-link")).toHaveAttribute("href", productHref);
  const moveToWishlist = cartProduct.locator(".cart-wishlist-move-btn");
  await expect(moveToWishlist).toBeVisible();
  await expect(moveToWishlist).toHaveClass(/wishlist-auth-required/);
  let anonymousWishlistPosts = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/medusa-wishlist/items") && request.method() === "POST") {
      anonymousWishlistPosts += 1;
    }
  });
  await moveToWishlist.click();
  await expect(page.locator(".wishlist-state")).toHaveText("Connectez-vous pour utiliser la Wishlist.");
  expect(anonymousWishlistPosts).toBe(0);
  await expect(cartProduct).toBeVisible();
  await Promise.all([
    page.waitForURL(productHref),
    cartProduct.locator(".sm-product-name").click(),
  ]);
  await page.goto("/cart");

  const cartProductAfterReturn = page.locator(`.cart .sm-product[data-line-id="${lineId}"]`);
  await expect(cartProductAfterReturn).toBeVisible();

  const incrementResponsePromise = page.waitForResponse((response) => (
    response.url().includes(`/medusa-cart/${cartId}/items/${lineId}`)
    && response.request().method() === "PATCH"
  ));
  await cartProductAfterReturn.locator(".increment").click();
  const incrementResponse = await incrementResponsePromise;
  expect(incrementResponse.status()).toBe(200);
  await expect(page).toHaveURL(/\/cart$/);
  const incrementedCart = (await incrementResponse.json()).cart;
  expect(incrementedCart.items[0].quantity).toBe(2);
  await expect(page.locator(`[data-line-id="${lineId}"] .item-count`)).toHaveText("2");
  await expect(page.locator(".bill")).toHaveText(
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: incrementedCart.currency_code }).format(Number(incrementedCart.item_subtotal))
  );

  const decrementResponsePromise = page.waitForResponse((response) => (
    response.url().includes(`/medusa-cart/${cartId}/items/${lineId}`)
    && response.request().method() === "PATCH"
  ));
  await page.locator(`[data-line-id="${lineId}"] .decrement`).click();
  const decrementResponse = await decrementResponsePromise;
  const decrementedCart = (await decrementResponse.json()).cart;
  expect(decrementedCart.items[0].quantity).toBe(1);
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.locator(`[data-line-id="${lineId}"] .item-count`)).toHaveText("1");
  await expect(page.locator(".bill")).toHaveText(
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: decrementedCart.currency_code }).format(Number(decrementedCart.item_subtotal))
  );

  const deleteResponsePromise = page.waitForResponse((response) => (
    response.url().includes(`/medusa-cart/${cartId}/items/${lineId}`)
    && response.request().method() === "DELETE"
  ));
  await page.locator(`[data-line-id="${lineId}"] .sm-delete-btn`).click();
  const deleteResponse = await deleteResponsePromise;
  expect(deleteResponse.status()).toBe(200);
  await expect(page).toHaveURL(/\/cart$/);
  expect((await deleteResponse.json()).cart.items).toHaveLength(0);
  await expect(page.locator(".cart .sm-product")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("cart"))).toBeNull();

  await page.evaluate(() => sessionStorage.setItem("medusa_cart_id", "cart_missing"));
  await page.reload();
  await page.evaluate(() => window.medusaCartReady);
  await expect(page.locator(".cart .sm-product")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("medusa_cart_id"))).toBe(cartId);
  expect(await page.evaluate(() => window.currentMedusaCart.items)).toHaveLength(0);
  await expect(page.locator(".bill")).toHaveText("0,00 €");
});

test("F-18 - plusieurs lignes, liens produit et contrôles de quantité indépendants", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const setup = await addTwoCatalogueVariantsToCart(page);
  await page.goto("/cart");

  const lines = page.locator(".cart .sm-product");
  await expect(lines).toHaveCount(2);
  const firstLine = lines.nth(0);
  const secondLine = lines.nth(1);
  const firstLineId = await firstLine.getAttribute("data-line-id");
  const secondLineId = await secondLine.getAttribute("data-line-id");
  const firstVariantId = await firstLine.getAttribute("data-variant-id");
  const secondVariantId = await secondLine.getAttribute("data-variant-id");
  expect([firstVariantId, secondVariantId].sort()).toEqual([...setup.variants].sort());

  const firstProductHref = `/products/${await firstLine.getAttribute("data-product-id")}`;
  await Promise.all([
    page.waitForURL(firstProductHref),
    firstLine.locator(".sm-des").last().click(),
  ]);
  await page.goto("/cart");

  const firstAfterReturn = page.locator(`.cart .sm-product[data-line-id="${firstLineId}"]`);
  const secondAfterReturn = page.locator(`.cart .sm-product[data-line-id="${secondLineId}"]`);
  await expect(firstAfterReturn).toBeVisible();
  await expect(secondAfterReturn).toBeVisible();
  await expectButtonHitTarget(firstAfterReturn.locator(".increment"));
  await expectButtonHitTarget(firstAfterReturn.locator(".decrement"));
  await expectButtonHitTarget(secondAfterReturn.locator(".increment"));

  const firstQuantity = Number(await firstAfterReturn.locator(".item-count").textContent());
  const secondQuantity = Number(await secondAfterReturn.locator(".item-count").textContent());
  const incrementResponse = page.waitForResponse((response) => (
    response.url().includes(`/medusa-cart/${setup.cartId}/items/${secondLineId}`)
      && response.request().method() === "PATCH"
  ));
  await secondAfterReturn.locator(".increment").click();
  const incrementedCart = (await incrementResponse).json().then((data) => data.cart);
  await expect(page).toHaveURL(/\/cart$/);
  await expect(secondAfterReturn.locator(".item-count")).toHaveText(String(secondQuantity + 1));
  await expect(firstAfterReturn.locator(".item-count")).toHaveText(String(firstQuantity));
  expect((await incrementedCart).items.find((item) => item.id === firstLineId).quantity).toBe(firstQuantity);

  const removeResponse = page.waitForResponse((response) => (
    response.url().includes(`/medusa-cart/${setup.cartId}/items/${secondLineId}`)
      && response.request().method() === "DELETE"
  ));
  await secondAfterReturn.locator(".sm-delete-btn").click();
  const cartAfterRemoval = (await removeResponse).json().then((data) => data.cart);
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.locator(`.cart .sm-product[data-line-id="${secondLineId}"]`)).toHaveCount(0);
  await expect(page.locator(`.cart .sm-product[data-line-id="${firstLineId}"]`)).toBeVisible();
  expect((await cartAfterRemoval).items).toHaveLength(1);
});

test("F-18 - files indépendantes conservent les rafales +, -, mixtes et sur deux lignes", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const setup = await addTwoCatalogueVariantsToCart(page);
  await page.goto("/cart");
  const lineA = page.locator(`.cart .sm-product[data-variant-id="${setup.variants[0]}"]`);
  const lineB = page.locator(`.cart .sm-product[data-variant-id="${setup.variants[1]}"]`);
  const clickCenter = async (locator) => {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  const expectCartConsistency = async () => {
    const cart = await page.evaluate(() => window.currentMedusaCart);
    const itemSubtotal = cart.items.reduce((sum, item) => sum + Number(item.total), 0);
    expect(cart.item_subtotal).toBe(itemSubtotal);
    await expect(page.locator(".bill")).toHaveText(
      new Intl.NumberFormat("fr-FR", { style: "currency", currency: cart.currency_code }).format(itemSubtotal)
    );
    expect((await page.locator(".cart .sm-price").allTextContents()).every((price) => !price.includes("NaN"))).toBe(true);
    await expect(page).toHaveURL(/\/cart$/);
  };

  await expect(lineA.locator(".item-count")).toHaveText("1");
  await expect(lineB.locator(".item-count")).toHaveText("1");
  await expectButtonHitTarget(lineA.locator(".increment"));
  await expectButtonHitTarget(lineA.locator(".decrement"));

  await clickCenter(lineA.locator(".increment"));
  await clickCenter(lineA.locator(".increment"));
  await clickCenter(lineA.locator(".increment"));
  await expect(lineA.locator(".item-count")).toHaveText("4");
  await expectCartConsistency();

  await clickCenter(lineA.locator(".decrement"));
  await clickCenter(lineA.locator(".decrement"));
  await expect(lineA.locator(".item-count")).toHaveText("2");
  await expectCartConsistency();

  await clickCenter(lineA.locator(".increment"));
  await clickCenter(lineA.locator(".decrement"));
  await clickCenter(lineA.locator(".increment"));
  await clickCenter(lineA.locator(".decrement"));
  await expect(lineA.locator(".item-count")).toHaveText("2");
  await expectCartConsistency();

  await clickCenter(lineA.locator(".increment"));
  await clickCenter(lineA.locator(".increment"));
  await clickCenter(lineB.locator(".increment"));
  await clickCenter(lineB.locator(".decrement"));
  await expect(lineA.locator(".item-count")).toHaveText("4");
  await expect(lineB.locator(".item-count")).toHaveText("1");
  await expectCartConsistency();

  const lineBId = await lineB.getAttribute("data-line-id");
  await lineB.locator(".sm-delete-btn").click();
  await expect(page.locator(`.cart .sm-product[data-line-id="${lineBId}"]`)).toHaveCount(0);
  await expect(lineA).toBeVisible();
  await expectCartConsistency();
});

test("F-18 - une erreur de mutation abandonne les intentions restantes et relit le Cart", async ({ page }) => {
  const cartId = "cart_line_queue_failure";
  const lineId = "line_queue_failure";
  const cart = {
    id: cartId,
    currency_code: "eur",
    item_subtotal: 25,
    items: [{
      id: lineId,
      product_id: "product_queue_failure",
      variant_id: "variant_queue_failure",
      product_title: "Produit erreur file",
      variant_title: "M",
      thumbnail: null,
      quantity: 1,
      unit_price: 25,
      total: 25,
    }],
  };
  let patchCalls = 0;

  await page.addInitScript(({ id }) => {
    sessionStorage.setItem("medusa_cart_id", id);
    window.__cartMutationErrors = [];
    window.addEventListener("medusa-cart-error", (event) => window.__cartMutationErrors.push(event.detail));
  }, { id: cartId });
  await page.route("**/medusa-cart/**", (route) => {
    const request = route.request();
    if (request.method() === "GET") return route.fulfill({ json: { cart } });
    if (request.method() === "PATCH") {
      patchCalls += 1;
      return route.fulfill({ status: 502, json: { error: "cart_mutation_failed" } });
    }
    return route.fallback();
  });

  await page.goto("/cart");
  const line = page.locator(`.cart .sm-product[data-line-id="${lineId}"]`);
  const increment = line.locator(".increment");
  const box = await increment.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect.poll(() => patchCalls).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__cartMutationErrors.length)).toBe(1);
  await expect(line.locator(".item-count")).toHaveText("1");
  await expect(page).toHaveURL(/\/cart$/);
});

test("F-18 - le stock Medusa limite uniquement la ligne concernée, sans plafond artificiel", async ({ page }) => {
  const cartId = "cart_inventory_limit";
  const stockByLineId = { line_limited: 2, line_high_stock: 12 };
  const cart = {
    id: cartId,
    currency_code: "eur",
    item_subtotal: 965,
    items: [
      {
        id: "line_limited",
        product_id: "product_limited",
        variant_id: "variant_limited",
        product_title: "Produit à stock limité avec une description volontairement longue",
        variant_title: "M",
        thumbnail: null,
        quantity: 1,
        unit_price: 25,
        total: 25,
      },
      {
        id: "line_high_stock",
        product_id: "product_high_stock",
        variant_id: "variant_high_stock",
        product_title: "Produit avec stock élevé",
        variant_title: "Unique",
        thumbnail: null,
        quantity: 10,
        unit_price: 94,
        total: 940,
      },
    ],
  };
  const refreshTotals = () => {
    cart.item_subtotal = cart.items.reduce((sum, item) => sum + item.total, 0);
  };
  const cartResponse = () => JSON.parse(JSON.stringify({ cart }));

  await page.addInitScript(({ id }) => sessionStorage.setItem("medusa_cart_id", id), { id: cartId });
  await page.route("**/medusa-cart/**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") return route.fulfill({ json: cartResponse() });
    if (request.method() !== "PATCH") return route.fallback();

    const lineId = request.url().split("/").at(-1);
    const quantity = request.postDataJSON().quantity;
    const item = cart.items.find((candidate) => candidate.id === lineId);
    if (quantity > stockByLineId[lineId]) {
      return route.fulfill({ status: 409, json: { error: "insufficient_inventory" } });
    }

    item.quantity = quantity;
    item.total = item.unit_price * quantity;
    refreshTotals();
    return route.fulfill({ json: cartResponse() });
  });

  await page.goto("/cart");
  const limited = page.locator(".cart .sm-product[data-line-id='line_limited']");
  const highStock = page.locator(".cart .sm-product[data-line-id='line_high_stock']");
  const limitedCounter = limited.locator(".item-counter");
  const highStockCounter = highStock.locator(".item-counter");

  const limitedCounterBox = await limitedCounter.boundingBox();
  const highStockCounterBox = await highStockCounter.boundingBox();
  expect(limitedCounterBox).not.toBeNull();
  expect(highStockCounterBox).not.toBeNull();
  expect(Math.abs(limitedCounterBox.x - highStockCounterBox.x)).toBeLessThanOrEqual(1);
  await expectButtonHitTarget(limited.locator(".increment"));

  await page.evaluate(() => {
    const limitedIncrement = document.querySelector("[data-line-id='line_limited'] .increment");
    const highStockIncrement = document.querySelector("[data-line-id='line_high_stock'] .increment");
    limitedIncrement.click();
    limitedIncrement.click();
    highStockIncrement.click();
    highStockIncrement.click();
  });

  await expect(limited.locator(".item-count")).toHaveText("2");
  await expect(highStock.locator(".item-count")).toHaveText("12");
  await expect(limited.locator(".cart-inventory-message")).toHaveText("Quantité max en stock.");
  await expect(highStock.locator(".cart-inventory-message")).toHaveCount(0);
  await expect(page.locator(".cart-state")).toHaveCount(0);
  await expect(limited.locator(".cart-inventory-message")).toHaveCSS("color", "rgb(247, 101, 72)");
  await expect(limited.locator(".increment")).toBeDisabled();
  await expect(highStock.locator(".increment")).toBeEnabled();
  expect(await limited.locator(".sm-price").evaluate((price) => getComputedStyle(price).whiteSpace)).toBe("nowrap");
  const limitedPriceBox = await limited.locator(".sm-price").boundingBox();
  expect(limitedPriceBox.x).toBeGreaterThan(limitedCounterBox.x + limitedCounterBox.width);
  await expect(page).toHaveURL(/\/cart$/);
  expect((await page.locator(".cart .sm-price").allTextContents()).every((price) => !price.includes("NaN"))).toBe(true);

  await highStock.locator(".increment").click();
  await expect(highStock.locator(".cart-inventory-message")).toHaveText("Quantité max en stock.");
  await expect(highStock.locator(".increment")).toBeDisabled();

  await limited.locator(".decrement").click();
  await expect(limited.locator(".item-count")).toHaveText("1");
  await expect(limited.locator(".cart-inventory-message")).toHaveCount(0);
  await expect(highStock.locator(".cart-inventory-message")).toHaveText("Quantité max en stock.");
  await expect(limited.locator(".increment")).toBeEnabled();
  await limited.locator(".increment").click();
  await expect(limited.locator(".item-count")).toHaveText("2");
  await expect(page).toHaveURL(/\/cart$/);
});
