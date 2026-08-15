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

test("F-11 - charger puis modifier un produit existant", async ({ page }) => {
  const baseUrl = "http://localhost:5000";
  const productId = "produit-edit-playwright";

  await seedSeller(page);

  await page.route("**/get-products", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        name: "Ancien produit",
        shortDes: "Description courte existante",
        des: "Description détaillée existante",
        images: [`${baseUrl}/img/card1.png`, null, null, null],
        sizes: ["m", "l"],
        actualPrice: "100",
        discount: "20",
        sellPrice: "80",
        stock: "30",
        tags: ["men", "shirts"],
        tac: true,
        email: "seller@example.com"
      })
    });
  });

  await page.route("**/add-product", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          product: "Produit modifié"
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

  await page.goto(`${baseUrl}/add-product/${productId}`);

  await expect(page.locator("#product-name")).toHaveValue("Ancien produit");

  await expect(page.locator("#m")).toBeChecked();
  await expect(page.locator("#l")).toBeChecked();

  await page.locator("#product-name").fill("Produit modifié");

  const requestPromise = page.waitForRequest(
    (request) => request.url().endsWith("/add-product") && request.method() === "POST"
  );

  await page.locator("#add-btn").click();

  const request = await requestPromise;
  const body = request.postDataJSON();

  expect(body.id).toBe(productId);
  expect(body.name).toBe("Produit modifié");
  expect(body.sizes).toEqual(["m", "l"]);
  expect(body.tags).toEqual(["men", "shirts"]);
  expect(body.images[0]).toBe(`${baseUrl}/img/card1.png`);

  await page.waitForURL("**/seller");
});
