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

test("F-08 - afficher le catalogue vendeur", async ({ page }) => {
  const baseUrl = "http://localhost:5000";

  await seedSeller(page);

  await page.route("**/get-products", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "produit-playwright",
          draft: true,
          images: ["/img/card1.png"],
          name: "Produit vendeur Playwright",
          shortDes: "Description du produit vendeur",
          sellPrice: "25",
          actualPrice: "40"
        }
      ])
    });
  });

  await page.goto(`${baseUrl}/seller`);

  await expect(page.locator(".product-listing")).toBeVisible();

  await expect(page.locator(".product-card")).toHaveCount(1);

  await expect(page.locator(".product-brand")).toHaveText("Produit vendeur Playwright");

  await expect(page.locator(".tag")).toHaveText("Draft");

  await expect(page.locator(".edit-btn")).toBeVisible();
  await expect(page.locator(".open-btn")).toBeVisible();
  await expect(page.locator(".delete-popup-btn")).toBeVisible();
});
