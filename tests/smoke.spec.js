const { test, expect } = require("@playwright/test");

test("la page d'accueil de la boutique fonctionne", async ({ page }) => {
  const response = await page.goto("/");

  expect(response).not.toBeNull();
  expect(response.status()).toBe(200);

  await expect(page).toHaveTitle("Clothing - Best Apparels Online Store");

  await expect(page.locator(".hero-section")).toBeVisible();
});
