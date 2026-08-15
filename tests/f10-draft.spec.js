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

test("F-10 - enregistrer un produit incomplet comme brouillon", async ({ page }) => {
  const baseUrl = "http://localhost:5000";

  await seedSeller(page);

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

  await page.route("**/seller", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>seller test</body></html>"
    });
  });

  await page.goto(`${baseUrl}/add-product`);

  // Seul le nom est renseigné.
  await page.locator("#product-name").fill("Brouillon Playwright");

  const requestPromise = page.waitForRequest(
    (request) => request.url().endsWith("/add-product") && request.method() === "POST"
  );

  await page.locator("#save-btn").click();

  const request = await requestPromise;
  const body = request.postDataJSON();

  expect(body.name).toBe("Brouillon Playwright");
  expect(body.draft).toBe(true);
  expect(body.sizes).toEqual([]);
  expect(body.email).toBe("seller@example.com");

  await page.waitForURL("**/seller");
});
