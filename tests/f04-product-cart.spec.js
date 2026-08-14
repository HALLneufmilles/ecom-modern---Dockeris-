const { test, expect } = require("@playwright/test");

test("F-04 - ouvrir un produit, choisir une taille et l'ajouter au panier", async ({ page }) => {
  // 1. Partir avec un stockage navigateur propre.
  await page.goto("/");

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // 2. Ouvrir une recherche qui contient déjà des produits connus.
  await page.goto("/search/men");

  const firstProduct = page.locator(".card-container .product-card").first();

  await expect(firstProduct).toBeVisible();

  // 3. Attendre la récupération du produit précis depuis le backend.
  const productResponsePromise = page.waitForResponse((response) => {
    const request = response.request();

    return (
      response.url().endsWith("/get-products") && request.method() === "POST" && request.postData()?.includes('"id":')
    );
  });

  // 4. Ouvrir le premier produit.
  await firstProduct.click();

  await expect(page).toHaveURL(/\/products\/.+/);

  const productResponse = await productResponsePromise;

  expect(productResponse.status()).toBe(200);

  const product = await productResponse.json();

  // 5. Vérifier que les vraies informations du produit apparaissent.
  await expect(page.locator(".product-brand")).toHaveText(product.name);

  await expect(page.locator(".product-price")).toContainText(String(product.sellPrice));

  // 6. Choisir la première taille réellement disponible.
  const availableSize = page.locator(".size-radio-btn:visible").first();

  await expect(availableSize).toBeVisible();

  const selectedSize = (await availableSize.textContent()).trim();

  await availableSize.click();

  await expect(availableSize).toHaveClass(/check/);

  // 7. Ajouter au panier.
  const cartButton = page.locator(".cart-btn");

  await cartButton.click();

  await expect(cartButton).toHaveText("added");

  // 8. Vérifier ce qui a réellement été enregistré dans le navigateur.
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("cart")));

  expect(Array.isArray(cart)).toBe(true);
  expect(cart).toHaveLength(1);

  expect(cart[0].name).toBe(product.name);
  expect(cart[0].size).toBe(selectedSize);
  expect(Number(cart[0].item)).toBe(1);

  // 9. Ouvrir réellement le panier.
  await page.goto("/cart");

  // 10. Vérifier que le produit est affiché.
  const cartProduct = page.locator(".cart .sm-product").first();

  await expect(cartProduct).toBeVisible();

  await expect(cartProduct.locator(".sm-product-name")).toHaveText(product.name);

  await expect(cartProduct.locator(".item-count")).toHaveText("1");
});
