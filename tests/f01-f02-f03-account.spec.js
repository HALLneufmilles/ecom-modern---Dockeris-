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
    // ---------------------------------
    // F-01 - INSCRIPTION
    // ---------------------------------

    await page.goto("/signup");

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

    const saveCartResponsePromise = page.waitForResponse((response) => {
      return response.url().endsWith("/savecart") && response.request().method() === "POST";
    });

    await userButton.click();

    // La déconnexion sauvegarde d'abord les données.
    const saveCartResponse = await saveCartResponsePromise;

    expect(saveCartResponse.status()).toBe(200);

    // Après location.replace("/"), la nouvelle page doit considérer
    // l'utilisateur comme déconnecté.
    await expect(page.locator("#user-btn")).toHaveText(/log in/i);

    // Maintenant seulement, le nouveau contexte de page est stable.
    user = await page.evaluate(() => sessionStorage.getItem("user"));

    expect(user).toBeNull();

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
  } finally {
    // Nettoyage systématique des données du compte de test.
    await Promise.all([
      db.collection("users").doc(email).delete(),
      db.collection("saved").doc(email).delete(),
      db.collection("sellers").doc(email).delete()
    ]);
  }
});
