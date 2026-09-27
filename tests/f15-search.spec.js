const { test, expect } = require("@playwright/test");

test("F-15 - rechercher un produit Medusa par clic et ouvrir un résultat", async ({ page }) => {
  const legacySearchRequests = [];

  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/get-products") {
      legacySearchRequests.push(request);
    }
  });

  await page.goto("/");

  const searchBox = page.locator(".search-box");
  const searchButton = page.locator(".search-btn");
  await expect(searchBox).toBeVisible();
  await expect(searchButton).toBeVisible();

  await searchBox.fill("Medusa T-Shirt");
  const productsResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/medusa-search-products" && url.searchParams.get("q") === "Medusa T-Shirt";
  });

  await searchButton.click();
  await expect(page).toHaveURL(/\/search\/Medusa%20T-Shirt$/);

  const productsResponse = await productsResponsePromise;
  expect(productsResponse.status()).toBe(200);
  await expect(page.locator("#search-key")).toHaveText("Medusa T-Shirt");
  expect(legacySearchRequests).toHaveLength(0);

  const firstProduct = page.locator(".card-container .product-card").first();
  await expect(firstProduct).toBeVisible();
  await expect(firstProduct.locator(".product-thumb")).toBeVisible();
  await expect(firstProduct.locator(".product-brand")).not.toHaveText("");
  await expect(firstProduct.locator(".price")).not.toHaveText("");

  await firstProduct.click();
  await expect(page).toHaveURL(/\/products\/.+/);
});

test("F-15 - rechercher par Entrée sans normaliser la requête", async ({ page }) => {
  await page.goto("/");
  await page.locator(".search-box").fill("SHIRT");
  const productsResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/medusa-search-products" && url.searchParams.get("q") === "SHIRT";
  });

  await page.locator(".search-box").press("Enter");
  await expect(page).toHaveURL(/\/search\/SHIRT$/);
  expect((await productsResponsePromise).status()).toBe(200);
  await expect(page.locator(".card-container .product-card").first()).toBeVisible();
});

test("F-15 - affiche des états distincts pour aucun résultat, erreur et terme non fiable", async ({ page }) => {
  await page.route("**/medusa-search-products*", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");

    if (query === "indisponible") {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "catalogue_unavailable" }) });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/search/xyzproduitinexistant123");
  await expect(page.locator(".search-state")).toHaveText("Aucun produit ne correspond à votre recherche.");
  await expect(page.locator(".card-container .product-card")).toHaveCount(0);

  await page.goto("/search/indisponible");
  await expect(page.locator(".search-state")).toHaveText("La recherche est temporairement indisponible. Veuillez réessayer.");

  await page.goto("/search/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E");
  await expect(page.locator("#search-key")).toHaveText("<img src=x onerror=alert(1)>");
  await expect(page.locator(".heading img")).toHaveCount(0);
});
