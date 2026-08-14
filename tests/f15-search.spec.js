const { test, expect } = require("@playwright/test");

test("F-15 - rechercher un produit et ouvrir un résultat", async ({ page }) => {
  // 1. Ouvrir l'accueil
  await page.goto("/");

  // 2. Vérifier que la barre de recherche est disponible
  const searchBox = page.locator(".search-box");
  const searchButton = page.locator(".search-btn");

  await expect(searchBox).toBeVisible();
  await expect(searchButton).toBeVisible();

  // 3. Saisir une recherche connue de la boutique
  await searchBox.fill("men");

  // Préparer l'attente de l'appel à /get-products
  const productsResponsePromise = page.waitForResponse((response) => {
    const request = response.request();

    return (
      response.url().endsWith("/get-products") &&
      request.method() === "POST" &&
      request.postData()?.includes('"tag":"men"')
    );
  });

  // 4. Lancer la recherche
  await searchButton.click();

  // 5. Vérifier qu'on arrive bien sur /search/men
  await expect(page).toHaveURL(/\/search\/men$/);

  // 6. Vérifier la réponse du backend
  const productsResponse = await productsResponsePromise;

  // Le backend doit avoir traité correctement la recherche.
  expect(productsResponse.status()).toBe(200);

  // 7. Vérifier que le terme recherché est affiché
  await expect(page.locator("#search-key")).toHaveText("men");

  // 8. Vérifier qu'au moins un produit est réellement affiché
  const firstProduct = page.locator(".card-container .product-card").first();

  await expect(firstProduct).toBeVisible();

  // 9. Ouvrir le premier résultat
  await firstProduct.click();

  // 10. Vérifier qu'on arrive sur une fiche produit
  await expect(page).toHaveURL(/\/products\/.+/);
});
