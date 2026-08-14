const { test, expect } = require("@playwright/test");

test("F-17 - ajouter un produit à la wishlist et l'afficher", async ({ page }) => {
  // 1. Initialiser proprement le stockage navigateur.
  await page.goto("/");

  await page.evaluate(() => {
    localStorage.setItem("cart", JSON.stringify([]));
    localStorage.setItem("wishlist", JSON.stringify([]));
    sessionStorage.clear();
  });

  // 2. Trouver un vrai produit.
  await page.goto("/search/men");

  const firstProduct = page.locator(".card-container .product-card").first();

  await expect(firstProduct).toBeVisible();

  await firstProduct.click();

  await expect(page).toHaveURL(/\/products\/.+/);

  // 3. Attendre le chargement de la fiche.
  const productName = page.locator(".product-details .product-brand");

  await expect(productName).not.toHaveText("");

  const name = (await productName.textContent()).trim();

  // 4. Choisir une taille réellement disponible.
  const availableSize = page.locator(".size-radio-btn:visible").first();

  await expect(availableSize).toBeVisible();

  const selectedSize = (await availableSize.textContent()).trim();

  await availableSize.click();

  // 5. Ajouter à la wishlist.
  const wishlistButton = page.locator(".wishlist-btn");

  await wishlistButton.click();

  await expect(wishlistButton).toHaveText("added");

  // 6. Vérifier le contenu réellement enregistré.
  const wishlist = await page.evaluate(() => JSON.parse(localStorage.getItem("wishlist")));

  expect(Array.isArray(wishlist)).toBe(true);
  expect(wishlist).toHaveLength(1);

  expect(wishlist[0].name).toBe(name);
  expect(wishlist[0].size).toBe(selectedSize);
  expect(Number(wishlist[0].item)).toBe(1);

  // 7. Ouvrir la page panier, qui affiche aussi la wishlist.
  await page.goto("/cart");

  const wishlistProduct = page.locator(".wishlist .sm-product").first();

  await expect(wishlistProduct).toBeVisible();

  await expect(wishlistProduct.locator(".sm-product-name")).toHaveText(name);
});
