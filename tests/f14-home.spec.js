const { test, expect } = require("@playwright/test");

test("F-14 - l'accueil charge les produits homme et femme", async ({ page }) => {
  // On attend les deux appels API effectués par la page d'accueil.
  const menResponsePromise = page.waitForResponse((response) => {
    const request = response.request();

    return (
      response.url().endsWith("/get-products") &&
      request.method() === "POST" &&
      request.postData()?.includes('"tag":"men"')
    );
  });

  const womenResponsePromise = page.waitForResponse((response) => {
    const request = response.request();

    return (
      response.url().endsWith("/get-products") &&
      request.method() === "POST" &&
      request.postData()?.includes('"tag":"women"')
    );
  });

  // Ouverture de l'accueil.
  await page.goto("/");

  // Récupération des réponses de l'API.
  const [menResponse, womenResponse] = await Promise.all([menResponsePromise, womenResponsePromise]);

  // Express doit répondre correctement.
  expect(menResponse.status()).toBe(200);
  expect(womenResponse.status()).toBe(200);

  // Firestore doit réellement retourner des produits.
  const menProducts = await menResponse.json();
  const womenProducts = await womenResponse.json();

  expect(Array.isArray(menProducts)).toBe(true);
  expect(Array.isArray(womenProducts)).toBe(true);

  expect(menProducts.length).toBeGreaterThan(0);
  expect(womenProducts.length).toBeGreaterThan(0);

  // Les produits doivent ensuite être affichés dans la page.
  await expect(page.locator("#men-tshirt-products .product-category")).toHaveText("Men");

  await expect(page.locator("#men-tshirt-products-2 .product-category")).toHaveText("Women");

  await expect(page.locator("#men-tshirt-products .product-card").first()).toBeVisible();

  await expect(page.locator("#men-tshirt-products-2 .product-card").first()).toBeVisible();
});
