const { test, expect } = require("@playwright/test");

test("F-06 - payment=done déclenche actuellement un faux succès local", async ({ page }) => {
  const baseUrl = "http://localhost:5000";

  // Prépare un utilisateur connecté et un panier existant
  // avant le chargement des scripts.
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "user",
      JSON.stringify({
        name: "Playwright",
        email: "playwright@example.com",
        seller: false
      })
    );

    localStorage.setItem("medusa_cart_id", "cart_payment_test");

    localStorage.setItem("wishlist", JSON.stringify([]));
  });

  // On accède directement à l'URL de retour "succès",
  // sans passer par Stripe.
  await page.goto(`${baseUrl}/checkout?payment=done`);

  // Le code actuel considère quand même le paiement comme réussi.
  await expect(page.locator(".alert-msg")).toHaveText("order is placed");

  // La référence technique du panier est également supprimée localement.
  const cart = await page.evaluate(() => localStorage.getItem("medusa_cart_id"));

  expect(cart).toBeNull();
});
