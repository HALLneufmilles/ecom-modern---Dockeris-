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

test("F-09 - créer et publier un produit", async ({ page }) => {
  const baseUrl = "http://localhost:5000";

  await seedSeller(page);

  // Faux lien S3.
  await page.route("**/s3url", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(`${baseUrl}/fake-upload-playwright?signature=test`)
    });
  });

  // Faux upload S3.
  await page.route("**/fake-upload-playwright*", async (route) => {
    await route.fulfill({
      status: 200,
      body: ""
    });
  });

  // Empêche toute écriture réelle dans Firestore.
  await page.route("**/add-product", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          product: body.name
        })
      });
    } else {
      await route.continue();
    }
  });

  // Évite de charger le vrai catalogue après la redirection.
  await page.route("**/seller", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>seller test</body></html>"
      });
    } else {
      await route.continue();
    }
  });

  await page.goto(`${baseUrl}/add-product`);

  await page.locator("#product-name").fill("Produit Playwright");
  await page.locator("#short-des").fill("Description courte du produit Playwright");
  await page.locator("#des").fill("Description détaillée du produit utilisé pour le test.");

  await page.locator("#first-file-upload-btn").setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from("fake-image-playwright")
  });

  await expect(page.locator('label[for="first-file-upload-btn"]')).toHaveCSS(
    "background-image",
    /fake-upload-playwright/
  );

  await page.locator("#m").check();

  await page.locator("#actual-price").fill("100");
  await page.locator("#discount").fill("20");
  await page.locator("#sell-price").fill("80");
  await page.locator("#stock").fill("25");
  await page.locator("#selected").fill("men, shirts");
  await page.locator("#tac").check();

  const requestPromise = page.waitForRequest(
    (request) => request.url().endsWith("/add-product") && request.method() === "POST"
  );

  await page.locator("#add-btn").click();

  const request = await requestPromise;
  const body = request.postDataJSON();

  expect(body.name).toBe("Produit Playwright");
  expect(body.email).toBe("seller@example.com");

  expect(body.images[0]).toBe(`${baseUrl}/fake-upload-playwright`);

  expect(body.sizes).toContain("m");
  expect(body.tags).toEqual(["men", "shirts"]);
  expect(body.actualPrice).toBe("100");
  expect(body.sellPrice).toBe("80");
  expect(body.stock).toBe("25");
  expect(body.draft).toBeUndefined();

  await page.waitForURL("**/seller");
});
