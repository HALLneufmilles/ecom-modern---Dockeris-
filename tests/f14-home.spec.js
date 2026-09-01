const { test, expect } = require("@playwright/test");

test("F-14 - l'accueil charge les quatre produits Medusa sans fallback Firestore", async ({ page }) => {
  const firestoreHomeRequests = [];

  page.on("request", (request) => {
    if (
      request.url().endsWith("/get-products") &&
      request.method() === "POST" &&
      (request.postData()?.includes('"tag":"men"') || request.postData()?.includes('"tag":"women"'))
    ) {
      firestoreHomeRequests.push(request);
    }
  });

  const proxyResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/medusa-home-products")
  );

  await page.goto("/");

  const proxyResponse = await proxyResponsePromise;
  expect(proxyResponse.status()).toBe(200);

  const products = await proxyResponse.json();
  expect(Array.isArray(products)).toBe(true);
  expect(products).toHaveLength(4);

  const catalogue = page.locator("#men-tshirt-products");
  const cards = catalogue.locator(".product-card");

  await expect(catalogue.locator(".product-category")).toHaveText("Catalogue");
  await expect(cards).toHaveCount(4);
  await expect(cards.first().locator(".product-brand")).not.toHaveText("");
  await expect(cards.first().locator(".product-thumb")).toBeVisible();

  for (const card of await cards.all()) {
    const price = card.locator(".price");

    await expect(price).toBeVisible();
    await expect(price).toContainText("€");

    const priceIsInsideCard = await price.evaluate((element) => {
      const cardRect = element.closest(".product-card").getBoundingClientRect();
      const priceRect = element.getBoundingClientRect();

      return priceRect.top >= cardRect.top && priceRect.bottom <= cardRect.bottom;
    });

    expect(priceIsInsideCard).toBe(true);
  }

  expect(firestoreHomeRequests).toHaveLength(0);

  await page.route("**/medusa-home-products", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "catalogue_unavailable" }),
    });
  });
  await page.reload();
  await expect(page.locator("#men-tshirt-products .catalogue-state")).toBeVisible();
  await expect(page.locator("#men-tshirt-products .product-card")).toHaveCount(0);
  expect(firestoreHomeRequests).toHaveLength(0);

  await page.unroute("**/medusa-home-products");
  await page.route("**/medusa-home-products", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.reload();
  await expect(page.locator("#men-tshirt-products .catalogue-state")).toBeVisible();
  await expect(page.locator("#men-tshirt-products .product-card")).toHaveCount(0);
  expect(firestoreHomeRequests).toHaveLength(0);
});
