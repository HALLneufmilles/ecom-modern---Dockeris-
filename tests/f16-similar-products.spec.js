const { test, expect } = require("@playwright/test");

test("F-16 - afficher des produits similaires sur une fiche produit", async ({ page, request }) => {
  const baseUrl = "http://localhost:5000";

  // Récupère les produits homme pour trouver un produit de départ.
  const response = await request.post(`${baseUrl}/get-products`, {
    data: { tag: "men" }
  });

  expect(response.ok()).toBeTruthy();

  const products = await response.json();

  expect(Array.isArray(products)).toBeTruthy();
  expect(products.length).toBeGreaterThan(0);

  // Cherche un produit ayant au moins un autre produit avec le même tag.
  let targetProduct = null;
  let sharedTag = null;

  for (const product of products) {
    for (const tag of product.tags || []) {
      const tagResponse = await request.post(`${baseUrl}/get-products`, {
        data: { tag }
      });

      const taggedProducts = await tagResponse.json();

      if (Array.isArray(taggedProducts) && taggedProducts.some((item) => item.id !== product.id)) {
        targetProduct = product;
        sharedTag = tag;
        break;
      }
    }

    if (targetProduct) {
      break;
    }
  }

  expect(targetProduct).not.toBeNull();
  expect(sharedTag).not.toBeNull();

  // Ouvre la fiche du produit choisi.
  await page.goto(`${baseUrl}/products/${encodeURIComponent(targetProduct.id)}`);

  // Vérifie que la fiche produit elle-même est bien chargée.
  await expect(page.locator(".product-brand").first()).not.toHaveText("");

  // Vérifie qu'un carrousel correspondant au tag partagé apparaît.
  const similarSection = page.locator(".container-for-card-slider .product").filter({
    has: page.locator(".product-category").filter({ hasText: `similar products: ${sharedTag}` })
  });

  await expect(similarSection).toBeVisible();

  // Le produit actuellement affiché est exclu :
  // il doit donc rester au moins un autre produit similaire.
  await expect(similarSection.locator(".product-card").first()).toBeVisible();
});
