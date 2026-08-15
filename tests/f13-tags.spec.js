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
        tagsSeller: ["men", "shirts"],
        authToken
      })
    );
  });
}

test("F-13 - ajouter, sélectionner et retirer des tags", async ({ page }) => {
  const baseUrl = "http://localhost:5000";

  await seedSeller(page);

  await page.goto(`${baseUrl}/add-product`);

  await expect(page.locator("#tagList li").filter({ hasText: "men" })).toHaveCount(1);

  await expect(page.locator("#tagList li").filter({ hasText: "shirts" })).toHaveCount(1);

  // Ajoute un nouveau tag.
  await page.locator("#inputTag").fill("summer");
  await page.locator("#newElement").click();

  const summerTag = page.locator("#tagList li").filter({ hasText: "summer" });

  await expect(summerTag).toHaveCount(1);

  // Sélectionne le tag pour le produit.
  await summerTag.click({
    position: {
      x: 5,
      y: 5
    }
  });

  await expect(page.locator("#selected")).toHaveValue(/summer/);

  // Retire "men" de la liste affichée.
  const menTag = page.locator("#tagList li").filter({ hasText: "men" });

  await menTag.locator("span").click();

  await expect(page.locator("#tagList li").filter({ hasText: "men" })).toHaveCount(0);

  // Comportement AS-IS :
  // bing5.js modifie son tableau mémoire mais pas immédiatement
  // sessionStorage.
  const storedTags = await page.evaluate(() => JSON.parse(sessionStorage.user).tagsSeller);

  expect(storedTags).toEqual(["men", "shirts"]);
});
