const { test, expect } = require("@playwright/test");

test("F-05 - saisir une adresse et lancer le checkout", async ({ page }) => {
  const baseUrl = "http://localhost:5000";

  // Simule un utilisateur connecté et un panier existant
  // avant le chargement des scripts de la page.
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "user",
      JSON.stringify({
        name: "Playwright",
        email: "playwright@example.com",
        seller: false
      })
    );

    localStorage.setItem(
      "cart",
      JSON.stringify([
        {
          item: 1,
          name: "Produit test",
          sellPrice: 25,
          size: "m",
          shortDes: "Produit utilisé pour le test Playwright",
          image: "/img/card1.png"
        }
      ])
    );

    localStorage.setItem("wishlist", JSON.stringify([]));
  });

  // Empêche le test d'appeler réellement Stripe.
  await page.route("**/stripe-checkout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(`${baseUrl}/`)
    });
  });

  await page.goto(`${baseUrl}/checkout`);

  // Vérifie que la page checkout est accessible
  // pour l'utilisateur simulé.
  await expect(page.locator(".heading")).toHaveText("checkout");

  // Vérifie que le panier est bien repris sur la page.
  await expect(page.locator(".sm-product-name")).toHaveText("Produit test");
  await expect(page.locator(".bill")).toHaveText("$25.00");

  // Sans adresse, la commande ne doit pas partir.
  await page.locator(".place-order-btn").click();

  await expect(page.locator(".alert-msg")).toHaveText("fill all the inputs first");

  // Remplit l'adresse de livraison.
  await page.locator("#address").fill("10 rue du Test");
  await page.locator("#street").fill("Rue du Test");
  await page.locator("#city").fill("La Rochelle");
  await page.locator("#state").fill("Charente-Maritime");
  await page.locator("#pincode").fill("17000");
  await page.locator("#landmark").fill("Près du port");

  // Attend l'appel au checkout avant de cliquer.
  const checkoutRequestPromise = page.waitForRequest(
    (request) => request.url().endsWith("/stripe-checkout") && request.method() === "POST"
  );

  await page.locator(".place-order-btn").click();

  const checkoutRequest = await checkoutRequestPromise;
  const body = checkoutRequest.postDataJSON();

  // Vérifie ce que le navigateur transmet au serveur.
  expect(body.email).toBe("playwright@example.com");

  expect(body.address).toEqual({
    address: "10 rue du Test",
    street: "Rue du Test",
    city: "La Rochelle",
    state: "Charente-Maritime",
    pincode: "17000",
    landmark: "Près du port"
  });

  expect(body.items).toHaveLength(1);
  expect(body.items[0].name).toBe("Produit test");
  expect(body.items[0].sellPrice).toBe(25);
  expect(body.items[0].item).toBe(1);
});
