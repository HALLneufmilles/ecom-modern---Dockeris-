const { test, expect } = require("@playwright/test");

test("F-05 - collecte l'identité de livraison sans billing storefront", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.setItem("user", JSON.stringify({
      name: "Username Playwright",
      email: "playwright@example.com",
      seller: false,
    }));
  });

  const cartSetup = await page.evaluate(async () => {
    const catalogue = await fetch("/medusa-home-products").then((response) => response.json());
    const product = await fetch(`/medusa-products/${catalogue[0].id}`).then((response) => response.json());
    const variant = product.variants.find((item) => item.available && item.price);
    const response = await fetch("/medusa-cart/items", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ variantId: variant.id, quantity: 1 }),
    });
    const { cart } = await response.json();
    localStorage.setItem("medusa_cart_id", cart.id);
    return { cart, productName: product.name };
  });

  const checkoutCart = {
    ...cartSetup.cart,
    shipping_methods: [{ shipping_option_id: "so_standard" }],
  };

  await page.route("https://js.stripe.com/**", (route) => route.fulfill({
    contentType: "text/javascript",
    body: "",
  }));
  await page.route("https://checkout.stripe.com/**", (route) => route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><title>Stripe Checkout test double</title>",
  }));
  await page.route("**/medusa-checkout/**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cart: checkoutCart,
          shippingOptions: [{ id: "so_standard", name: "Standard Shipping", amount: 0 }],
          stripeAvailable: true,
          stripeCheckoutAvailable: true,
          stripePublishableKey: "pk_test_playwright",
        }),
      });
    }
    if (request.url().endsWith("/stripe-checkout")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cart: checkoutCart,
          checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_playwright",
        }),
      });
    }
    return route.continue();
  });

  await page.goto("/checkout");
  await expect(page.locator(".heading")).toHaveText("checkout");
  await expect(page.locator(".sm-product-name")).toHaveText(cartSetup.productName);
  await expect(page.locator('label[for="last_name"]')).toContainText("Nom");
  await expect(page.locator('label[for="first_name"]')).toContainText("Prénom");
  await expect(page.locator("#last_name")).toHaveAttribute("required", "");
  await expect(page.locator("#first_name")).toHaveAttribute("required", "");
  const [lastNameBox, firstNameBox] = await Promise.all([
    page.locator("#last_name").boundingBox(),
    page.locator("#first_name").boundingBox(),
  ]);
  expect(Math.abs(lastNameBox.y - firstNameBox.y)).toBeLessThan(2);
  expect(lastNameBox.x + lastNameBox.width).toBeLessThanOrEqual(firstNameBox.x);
  await expect(page.locator("#billing-same-as-shipping")).toHaveCount(0);
  await expect(page.locator("#billing-address-section")).toHaveCount(0);
  await expect(page.getByText("Billing address same as delivery address", { exact: true })).toHaveCount(0);
  await expect(page.locator(".shipping-option input")).toBeChecked();

  await page.locator(".place-order-btn").click();
  await expect(page.locator("#last_name-error")).toHaveText("This field is required.");
  await expect(page.locator("#first_name-error")).toHaveText("This field is required.");

  await page.locator("#last_name").fill("Livraison");
  await page.locator("#first_name").fill("Camille");
  await page.locator("#address").fill("10 rue du Test");
  await page.locator("#street").fill("Rue du Test");
  await page.locator("#city").fill("La Rochelle");
  await page.locator("#state").fill("Charente-Maritime");
  await page.locator("#pincode").fill("17000");

  const checkoutRequestPromise = page.waitForRequest(
    (request) => request.url().endsWith(`/medusa-checkout/${cartSetup.cart.id}/stripe-checkout`)
      && request.method() === "POST"
  );
  await page.locator(".place-order-btn").click();

  const body = (await checkoutRequestPromise).postDataJSON();
  expect(body).toEqual({
    shippingOptionId: "so_standard",
    address: {
      last_name: "Livraison",
      first_name: "Camille",
      address: "10 rue du Test",
      street: "Rue du Test",
      city: "La Rochelle",
      state: "Charente-Maritime",
      pincode: "17000",
      landmark: "",
      country: "fr",
    },
  });
  expect(body.billingAddress).toBeUndefined();
  expect(body.billingAddressSameAsShipping).toBeUndefined();
  expect(body.billing_address).toBeUndefined();
  expect(Object.values(body.address)).not.toContain("Username Playwright");
  expect(body.email).toBeUndefined();
  expect(body.items).toBeUndefined();
  expect(body.total).toBeUndefined();
  await expect(page).toHaveURL("https://checkout.stripe.com/c/pay/cs_test_playwright");
});
