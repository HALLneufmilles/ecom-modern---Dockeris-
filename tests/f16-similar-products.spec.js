const { test, expect } = require("@playwright/test");
const { selectCategoryRecommendations } = require("../recommendations");
const { storefrontConfig, isStorefrontFeatureEnabled } = require("../public/js/storefront-features");

const baseUrl = "http://localhost:5000";

const getMedusaProductId = async (request) => {
  const response = await request.get(`${baseUrl}/medusa-home-products`);
  expect(response.ok()).toBeTruthy();

  const products = await response.json();
  expect(products.length).toBeGreaterThan(0);
  return products[0].id;
};

const createRecommendations = (count) => Array.from({ length: count }, (_, index) => ({
  id: `recommendation-${index + 1}`,
  name: `Recommendation ${index + 1}`,
  category: "Test category",
  brand: "Test brand",
  image: "/img/no image.png",
  sellPrice: 10 + index,
  actualPrice: 10 + index,
  discount: 0,
  currencyCode: "eur",
}));

test("F-16 - sélection générique par catégorie feuille, parent, déduplication et limite", async () => {
  const categories = [
    { id: "root", parent_category_id: null },
    { id: "apparel", parent_category_id: "root" },
    { id: "tee", parent_category_id: "apparel" },
    { id: "hoodie", parent_category_id: "apparel" },
  ];
  const currentProduct = { id: "current", categories: [{ id: "tee" }] };
  const calls = [];
  const recommendations = await selectCategoryRecommendations({
    currentProduct,
    categories,
    loadProductsForCategories: async (categoryIds) => {
      calls.push(categoryIds);

      if (categoryIds.length === 1 && categoryIds[0] === "tee") {
        return [{ id: "current" }, { id: "tee-peer" }, { id: "tee-peer" }];
      }

      return [{ id: "current" }, { id: "tee-peer" }, { id: "hoodie-peer" }];
    },
    mapProduct: (product) => product,
  });

  expect(recommendations.map((product) => product.id)).toEqual(["tee-peer", "hoodie-peer"]);
  expect(calls[0]).toEqual(["tee"]);
  expect(calls[1]).toEqual(expect.arrayContaining(["tee", "hoodie"]));

  const cappedRecommendations = await selectCategoryRecommendations({
    currentProduct,
    categories,
    loadProductsForCategories: async () => [
      { id: "current" },
      { id: "one" },
      { id: "two" },
      { id: "three" },
      { id: "four" },
      { id: "five" },
      { id: "six" },
      { id: "seven" },
      { id: "eight" },
      { id: "nine" },
    ],
    mapProduct: (product) => product,
  });

  expect(cappedRecommendations.map((product) => product.id)).toEqual([
    "one", "two", "three", "four", "five", "six", "seven", "eight",
  ]);

  const noRecommendations = await selectCategoryRecommendations({
    currentProduct,
    categories,
    loadProductsForCategories: async () => [],
    mapProduct: (product) => product,
  });

  expect(noRecommendations).toEqual([]);
});

test("F-16 - huit recommandations restent parcourables avec le carrousel existant", async ({ page, request }) => {
  const productId = await getMedusaProductId(request);
  const recommendations = createRecommendations(8);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/medusa-products/*/recommendations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(recommendations),
    });
  });
  await page.goto(`${baseUrl}/products/${encodeURIComponent(productId)}`);

  const slider = page.locator(".recommendation-slider .product-container");
  const cards = slider.locator(".product-card");
  const previousButton = page.locator(".recommendation-slider .pre-btn");
  const nextButton = page.locator(".recommendation-slider .nxt-btn");

  await expect(cards).toHaveCount(8);
  await expect(previousButton).toBeDisabled();
  await expect(nextButton).toBeEnabled();
  expect(await slider.evaluate((container) => [...container.querySelectorAll(".product-card")]
    .filter((card) => {
      const cardRect = card.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return cardRect.left >= containerRect.left && cardRect.right <= containerRect.right;
    }).length)).toBe(4);

  await nextButton.click();
  await expect.poll(() => slider.evaluate((container) => container.scrollLeft)).toBeGreaterThan(0);
  await expect(previousButton).toBeEnabled();
});

test("F-16 - quatre recommandations ou moins ne rendent pas les flèches actives", async ({ page, request }) => {
  const productId = await getMedusaProductId(request);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/medusa-products/*/recommendations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createRecommendations(4)),
    });
  });
  await page.goto(`${baseUrl}/products/${encodeURIComponent(productId)}`);

  await expect(page.locator(".recommendation-slider .product-card")).toHaveCount(4);
  await expect(page.locator(".recommendation-slider .pre-btn")).toBeDisabled();
  await expect(page.locator(".recommendation-slider .nxt-btn")).toBeDisabled();
});

test("F-16 - recommandations Medusa, cartes et absence de fallback Firestore", async ({ page, request }) => {
  const productId = await getMedusaProductId(request);
  const legacyRequests = [];
  page.on("request", (requestItem) => {
    if (requestItem.url().endsWith("/get-products")) {
      legacyRequests.push(requestItem);
    }
  });

  const recommendationsResponsePromise = page.waitForResponse((response) => (
    response.url().endsWith(`/medusa-products/${productId}/recommendations`)
  ));
  await page.goto(`${baseUrl}/products/${encodeURIComponent(productId)}`);

  const recommendationsResponse = await recommendationsResponsePromise;
  expect(recommendationsResponse.status()).toBe(200);
  const recommendations = await recommendationsResponse.json();

  expect(recommendations.length).toBeLessThanOrEqual(8);
  expect(recommendations.map((product) => product.id)).not.toContain(productId);
  expect(new Set(recommendations.map((product) => product.id)).size).toBe(recommendations.length);
  expect(recommendations.every((product) => product.image && product.sellPrice !== null)).toBe(true);

  const cards = page.locator(".container-for-card-slider .product-card");
  await expect(cards).toHaveCount(recommendations.length);
  if (recommendations.length) {
    await expect(cards.first().locator(".price")).toBeVisible();
    await expect(cards.first().locator(".product-thumb")).toHaveAttribute("src", /.+/);
    await expect(cards.first()).toHaveAttribute("onclick", new RegExp(`/products/${recommendations[0].id}`));
  }

  expect(legacyRequests).toHaveLength(0);
});

test("F-16 - liste vide et erreur technique ne bloquent pas la fiche produit", async ({ page, request }) => {
  const productId = await getMedusaProductId(request);

  await page.route("**/medusa-products/*/recommendations", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.goto(`${baseUrl}/products/${encodeURIComponent(productId)}`);
  await expect(page.locator(".product-brand").first()).not.toHaveText("");
  await expect(page.locator(".container-for-card-slider")).toHaveAttribute("data-recommendations-state", "empty");
  await expect(page.locator(".container-for-card-slider .product-card")).toHaveCount(0);

  await page.unroute("**/medusa-products/*/recommendations");
  await page.route("**/medusa-products/*/recommendations", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "catalogue_unavailable" }),
    });
  });
  await page.reload();
  await expect(page.locator(".product-brand").first()).not.toHaveText("");
  await expect(page.locator(".container-for-card-slider")).toHaveAttribute("data-recommendations-state", "error");
  await expect(page.locator(".container-for-card-slider .product-card")).toHaveCount(0);
});

test("F-16 - configuration recommendations ON et OFF", async ({ page, request }) => {
  expect(isStorefrontFeatureEnabled(storefrontConfig, "recommendations")).toBe(true);
  expect(isStorefrontFeatureEnabled({ features: { recommendations: false } }, "recommendations")).toBe(false);

  const productId = await getMedusaProductId(request);
  const recommendationRequests = [];
  page.on("request", (requestItem) => {
    if (requestItem.url().endsWith(`/medusa-products/${productId}/recommendations`)) {
      recommendationRequests.push(requestItem);
    }
  });

  await page.route("**/js/storefront-features.js", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: "window.storefrontConfig = { version: 1, features: { recommendations: false } };",
    });
  });
  await page.goto(`${baseUrl}/products/${encodeURIComponent(productId)}`);

  await expect(page.locator(".product-brand").first()).not.toHaveText("");
  await expect(page.locator(".container-for-card-slider")).toHaveAttribute("data-recommendations-state", "disabled");
  await expect(page.locator(".container-for-card-slider .product-card")).toHaveCount(0);
  expect(recommendationRequests).toHaveLength(0);
});
