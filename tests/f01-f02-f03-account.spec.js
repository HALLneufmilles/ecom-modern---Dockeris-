const { test, expect } = require("@playwright/test");
const admin = require("firebase-admin");
const dotenv = require("dotenv");

dotenv.config();

// Connexion Firestore uniquement pour nettoyer les données du test.
if (!admin.apps.length) {
  const serviceAccount = {
    type: process.env.TYPE,
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.replace(/\\n/gm, "\n") : undefined,
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    auth_uri: process.env.AUTH_URI,
    token_uri: process.env.TOKEN_URI,
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER,
    client_x509_cert_url: process.env.CLIENT_X509
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

test("F-01 / F-02 / F-03 - inscription, déconnexion et reconnexion", async ({ page }) => {
  const email = `playwright-${Date.now()}@example.test`;
  const password = "Baseline123!";

  try {
    await page.goto("/");
    const initialCart = await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      const products = await fetch("/medusa-home-products").then((response) => response.json());
      const product = await fetch(`/medusa-products/${products[0].id}`).then((response) => response.json());
      const variant = product.variants.find((item) => item.available && item.price);
      const { cart } = await fetch("/medusa-cart/items", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ variantId: variant.id, quantity: 1 }),
      }).then((response) => response.json());
      localStorage.setItem("medusa_cart_id", cart.id);
      return { id: cart.id, variantId: variant.id };
    });

    // ---------------------------------
    // F-01 - INSCRIPTION
    // ---------------------------------

    await page.goto("/signup");

    await expect(page.locator("#name")).toHaveAttribute("placeholder", "Username");
    await page.locator("#name").fill("Playwright Test");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#number").fill("0612345678");

    await expect(page.locator("#terms-and-cond")).toBeChecked();

    await page.locator(".submit-btn").click();

    // Après inscription, l'application doit revenir sur l'accueil.
    await expect(page).toHaveURL(/\/$/);

    // Vérifier la session créée dans le navigateur.
    let user = await page.evaluate(() => JSON.parse(sessionStorage.getItem("user")));

    expect(user).not.toBeNull();
    expect(user.email).toBe(email);
    expect(user.name).toBe("Playwright Test");
    expect(await page.evaluate(() => localStorage.getItem("medusa_cart_id"))).toBe(initialCart.id);
    expect(await page.evaluate(() => localStorage.getItem("cart"))).toBeNull();

    // ---------------------------------
    // F-03 - DÉCONNEXION
    // ---------------------------------

    await page.locator("#user-img").click();

    const userButton = page.locator("#user-btn");

    await expect(userButton).toHaveText(/log out/i);

    // await userButton.click();

    // await page.waitForFunction(() => sessionStorage.getItem("user") === null);

    // user = await page.evaluate(() => sessionStorage.getItem("user"));

    // expect(user).toBeNull();

    const saveStateResponsePromise = page.waitForResponse((response) => {
      return response.url().endsWith("/save-user-state") && response.request().method() === "POST";
    });
    const logoutResponsePromise = page.waitForResponse((response) => (
      response.url().endsWith("/logout") && response.request().method() === "POST"
    ));

    await userButton.click();

    // La déconnexion sauvegarde d'abord les données.
    const saveStateResponse = await saveStateResponsePromise;
    const logoutResponse = await logoutResponsePromise;

    expect(saveStateResponse.status()).toBe(200);
    expect(logoutResponse.status()).toBe(200);

    // Après location.replace("/"), la nouvelle page doit considérer
    // l'utilisateur comme déconnecté.
    await expect(page.locator("#user-btn")).toHaveText(/log in/i);

    // Maintenant seulement, le nouveau contexte de page est stable.
    user = await page.evaluate(() => sessionStorage.getItem("user"));

    expect(user).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("medusa_cart_id"))).toBeNull();

    // ---------------------------------
    // F-02 - CONNEXION
    // ---------------------------------

    await page.goto("/login");

    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);

    await page.locator(".submit-btn").click();

    await expect(page).toHaveURL(/\/$/);

    user = await page.evaluate(() => JSON.parse(sessionStorage.getItem("user")));

    expect(user).not.toBeNull();
    expect(user.email).toBe(email);
    expect(user.name).toBe("Playwright Test");

    const restoredCartId = await page.evaluate(() => localStorage.getItem("medusa_cart_id"));
    expect(restoredCartId).toBe(initialCart.id);
    const restoredCart = await page.evaluate(async (cartId) => {
      const response = await fetch(`/medusa-cart/${cartId}`);
      return (await response.json()).cart;
    }, restoredCartId);
    expect(restoredCart.items).toHaveLength(1);
    expect(restoredCart.items[0].variant_id).toBe(initialCart.variantId);
    expect(await page.evaluate(() => localStorage.getItem("cart"))).toBeNull();

    await page.goto("/checkout");
    await page.locator("#last_name").fill("Livraison");
    await page.locator("#first_name").fill("Camille");
    await page.locator("#address").fill("10 rue du Test");
    await page.locator("#street").fill("Rue du Test");
    await page.locator("#city").fill("La Rochelle");
    await page.locator("#state").fill("Charente-Maritime");
    await page.locator("#pincode").fill("17000");
    await expect(page.locator(".shipping-option")).toHaveCount(2);

    const standardResponsePromise = page.waitForResponse((response) => (
      response.url().endsWith(`/medusa-checkout/${initialCart.id}/shipping`)
      && response.request().method() === "POST"
    ));
    await page.locator(".shipping-option").filter({ hasText: "Standard Shipping" }).locator("input").click();
    const standardResponse = await standardResponsePromise;
    const standardCart = (await standardResponse.json()).cart;
    expect(standardCart.shipping_address.first_name).toBe("Camille");
    expect(standardCart.shipping_address.last_name).toBe("Livraison");
    expect(standardCart.shipping_address.first_name).not.toBe("Playwright");
    expect(standardCart.shipping_address.last_name).not.toBe("Test");
    expect(Number(standardCart.shipping_total)).toBe(0);
    expect(Number(standardCart.total)).toBe(10);
    await expect(page.locator('[data-summary="shipping_total"]')).toHaveText("0,00 €");
    await expect(page.locator('[data-summary="total"]')).toHaveText("10,00 €");

    const expressResponsePromise = page.waitForResponse((response) => (
      response.url().endsWith(`/medusa-checkout/${initialCart.id}/shipping`)
      && response.request().method() === "POST"
    ));
    await page.locator(".shipping-option").filter({ hasText: "Express Shipping" }).locator("input").click();
    const expressResponse = await expressResponsePromise;
    const expressCart = (await expressResponse.json()).cart;
    expect(Number(expressCart.shipping_total)).toBe(10);
    expect(Number(expressCart.total)).toBe(20);
    await expect(page.locator(".checkout-status")).not.toHaveText("Unable to update the delivery method.");
    await expect(page.locator('[data-summary="shipping_total"]')).toHaveText("10,00 €");
    await expect(page.locator('[data-summary="total"]')).toHaveText("20,00 €");
  } finally {
    // Nettoyage systématique des données du compte de test.
    await Promise.all([
      db.collection("users").doc(email).delete(),
      db.collection("saved").doc(email).delete(),
      db.collection("sellers").doc(email).delete()
    ]);
  }
});
