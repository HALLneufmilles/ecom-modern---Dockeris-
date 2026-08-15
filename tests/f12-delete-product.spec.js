const { test, expect } = require("@playwright/test");

async function seedSeller(page) {
  await page.addInitScript(() => {
    const char = "123abcde.fmnopqlABCDE@FJKLMNOPQRSTUVWXYZ456789stuvwxyz0!#$%&ijkrgh'*+-/=?^_`{|}~";

    const email = "seller@example.com";
    let authToken = "";

    for (const letter of email) {
      const index = char.indexOf(letter) || char.length / 2;
      authToken += char[0] + char[index];
    }

    sessionStorage.setItem(
      "user",
      JSON.stringify({
        name: "Seller Playwright",
        email,
        seller: true,
        tagsSeller: [],
        authToken
      })
    );
  });
}

test("F-12 - confirmer la suppression d'un produit", async ({ page }) => {
  const baseUrl = "http://localhost:5000";
  const productId = "delete-playwright";

  await seedSeller(page);

  await page.route("**/get-products", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: productId,
          draft: false,
          images: ["/img/card1.png"],
          name: "Produit à supprimer",
          shortDes: "Description du produit",
          sellPrice: "25",
          actualPrice: "40"
        }
      ])
    });
  });

  // Aucune vraie suppression Firestore/S3.
  await page.route("**/delete-product", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify("success")
    });
  });

  await page.goto(`${baseUrl}/seller`);

  await expect(page.locator(".product-card")).toHaveCount(1);

  const productCard = page.locator(".product-card").first();

  await productCard.hover();

  await productCard.locator(".delete-popup-btn").click();

  await expect(page.locator(".delete-alert")).toBeVisible();

  const requestPromise = page.waitForRequest(
    (request) => request.url().endsWith("/delete-product") && request.method() === "POST"
  );

  await page.locator(".delete-btn").click();

  const request = await requestPromise;
  const body = request.postDataJSON();

  expect(body.id).toBe(productId);
});
