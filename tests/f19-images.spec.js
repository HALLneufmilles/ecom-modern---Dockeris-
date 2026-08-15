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

test("F-19 - retirer puis remplacer une image produit", async ({ page }) => {
  const baseUrl = "http://localhost:5000";

  await seedSeller(page);

  await page.route("**/get-products", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        name: "Produit images",
        shortDes: "Description courte existante",
        des: "Description détaillée existante",
        images: [`${baseUrl}/img/card1.png`, `${baseUrl}/img/card2.png`, null, null],
        sizes: ["m"],
        actualPrice: "100",
        discount: "20",
        sellPrice: "80",
        stock: "30",
        tags: ["men"],
        tac: true,
        email: "seller@example.com"
      })
    });
  });

  await page.route("**/s3url", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(`${baseUrl}/fake-new-image-playwright?signature=test`)
    });
  });

  await page.route("**/fake-new-image-playwright*", async (route) => {
    await route.fulfill({
      status: 200,
      body: ""
    });
  });

  await page.goto(`${baseUrl}/add-product/image-playwright`);

  await expect(page.locator("#product-name")).toHaveValue("Produit images");

  const secondLabel = page.locator('label[for="second-file-upload-btn"]');

  const secondDeleteButton = page.locator(".delete-image").nth(1);

  await expect(secondDeleteButton).toBeVisible();

  // Comme dans l'interface réelle, on survole d'abord l'image
  // pour faire apparaître et activer le bouton de suppression.
  await secondLabel.hover();

  await secondDeleteButton.click();

  await expect(page.locator('label[for="second-file-upload-btn"]')).toHaveCSS("background-image", "none");

  // L'aperçu principal revient sur la première image.
  await expect(page.locator(".product-image")).toHaveCSS("background-image", /card1\.png/);

  // Remplace ensuite ce même emplacement.
  await page.locator("#second-file-upload-btn").setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from("fake-replacement-image")
  });

  await expect(page.locator('label[for="second-file-upload-btn"]')).toHaveCSS(
    "background-image",
    /fake-new-image-playwright/
  );

  await expect(page.locator(".product-image")).toHaveCSS("background-image", /fake-new-image-playwright/);
});
