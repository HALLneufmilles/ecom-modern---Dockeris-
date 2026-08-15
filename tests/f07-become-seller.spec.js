const { test, expect } = require("@playwright/test");

async function seedUser(page, seller = false, tagsSeller = null) {
  await page.addInitScript(
    ({ seller, tagsSeller }) => {
      const char = "123abcde.fmnopqlABCDE@FJKLMNOPQRSTUVWXYZ456789stuvwxyz0!#$%&ijkrgh'*+-/=?^_`{|}~";

      const email = "seller@example.com";

      let authToken = "";

      for (const letter of email) {
        const index = char.indexOf(letter) || char.length / 2;
        authToken += char[0] + char[index];
      }

      if (!sessionStorage.getItem("user")) {
        sessionStorage.setItem(
          "user",
          JSON.stringify({
            name: "Seller Playwright",
            email,
            seller,
            tagsSeller,
            authToken
          })
        );
      }
    },
    { seller, tagsSeller }
  );
}

test("F-07 - devenir vendeur", async ({ page }) => {
  const baseUrl = "http://localhost:5000";

  await seedUser(page, false, null);

  await page.route("**/seller", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "true"
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/get-products", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify("no products")
    });
  });

  await page.goto(`${baseUrl}/seller`);

  await expect(page.locator(".become-seller")).toBeVisible();

  await page.locator("#apply-btn").click();

  await expect(page.locator(".apply-form")).toBeVisible();

  await page.locator("#business-name").fill("Boutique Playwright");
  await page.locator("#business-add").fill("10 rue du Test");
  await page.locator("#about").fill("Boutique utilisée pour les tests");
  await page.locator("#number").fill("0612345678");

  await page.locator("#terms-and-cond").check();
  await page.locator("#legitInfo").check();

  const sellerRequestPromise = page.waitForRequest(
    (request) => request.url().endsWith("/seller") && request.method() === "POST"
  );

  await page.locator("#apply-form-btn").click();

  const sellerRequest = await sellerRequestPromise;
  const body = sellerRequest.postDataJSON();

  expect(body.email).toBe("seller@example.com");
  expect(body.name).toBe("Boutique Playwright");
  expect(body.tagsSeller).toEqual([]);

  await page.waitForFunction(() => {
    const user = JSON.parse(sessionStorage.getItem("user"));

    return user && user.seller === true && Array.isArray(user.tagsSeller);
  });

  const user = await page.evaluate(() => JSON.parse(sessionStorage.getItem("user")));

  expect(user.seller).toBe(true);
  expect(user.tagsSeller).toEqual([]);
});
