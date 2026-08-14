const { test, expect } = require("@playwright/test");

test("F-18 - modifier la quantité puis supprimer un produit du panier", async ({ page }) => {
  // 1. Partir d'un navigateur propre.
  await page.goto("/");

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // 2. Trouver un vrai produit.
  await page.goto("/search/men");

  const firstProduct = page.locator(".card-container .product-card").first();

  await expect(firstProduct).toBeVisible();

  await firstProduct.click();

  await expect(page).toHaveURL(/\/products\/.+/);

  // 3. Attendre que la fiche soit réellement chargée.
  await expect(page.locator(".product-brand")).not.toHaveText("");

  // 4. Choisir une taille disponible.
  const availableSize = page.locator(".size-radio-btn:visible").first();

  await availableSize.click();

  // 5. Ajouter le produit au panier.
  await page.locator(".cart-btn").click();

  await expect(page.locator(".cart-btn")).toHaveText("added");

  // 6. Ouvrir le panier.
  await page.goto("/cart");

  const cartProduct = page.locator(".cart .sm-product").first();

  await expect(cartProduct).toBeVisible();

  const count = cartProduct.locator(".item-count");
  const increment = cartProduct.locator(".increment");
  const decrement = cartProduct.locator(".decrement");

  // État initial.
  await expect(count).toHaveText("1");

  // 7. Augmenter la quantité.
  await increment.click();

  await expect(count).toHaveText("2");

  let cart = await page.evaluate(() => JSON.parse(localStorage.getItem("cart")));

  expect(Number(cart[0].item)).toBe(2);

  // 8. Redescendre à 1.
  await decrement.click();

  await expect(count).toHaveText("1");

  cart = await page.evaluate(() => JSON.parse(localStorage.getItem("cart")));

  expect(Number(cart[0].item)).toBe(1);

  // 9. Supprimer le produit.
  await cartProduct.locator(".sm-delete-btn").click();

  // La suppression modifie localStorage puis recharge la page.
  await page.waitForFunction(() => {
    const cart = JSON.parse(localStorage.getItem("cart"));
    return Array.isArray(cart) && cart.length === 0;
  });

  // 10. Vérifier que le panier est maintenant vide.
  await expect(page.locator(".cart .sm-product")).toHaveCount(0);
});
