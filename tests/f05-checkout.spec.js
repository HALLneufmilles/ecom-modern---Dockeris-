const { test, expect } = require("@playwright/test");

const formatCartPrice = (amount, currencyCode = "eur") => new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: currencyCode,
}).format(Number(amount));

const checkoutRegressionCart = ({ quantity = 1, shippingOptionId, shippingTotal = 0 } = {}) => {
  const itemSubtotal = 25 * quantity;

  return {
    id: "cart_checkout_regression",
    currency_code: "eur",
    items: [{
      id: "line_checkout_regression",
      product_title: "Checkout regression product",
      variant_title: "M / Blue",
      thumbnail: "/img/no image.png",
      quantity,
      unit_price: 25,
      total: itemSubtotal,
    }],
    item_subtotal: itemSubtotal,
    shipping_total: shippingTotal,
    discount_total: 0,
    tax_total: 0,
    total: itemSubtotal + shippingTotal,
    shipping_methods: shippingOptionId ? [{ shipping_option_id: shippingOptionId }] : [],
  };
};

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

test("F-05 - synchronise livraison, quantités, totaux Medusa et erreurs de checkout", async ({ page }) => {
  const cartId = "cart_checkout_regression";
  const standardOption = { id: "so_standard", name: "Standard Shipping", amount: 0 };
  const expressOption = { id: "so_express", name: "Express Shipping", amount: 7 };
  let currentCart = checkoutRegressionCart();
  let expressAttempts = 0;

  await page.addInitScript(({ cartId }) => {
    sessionStorage.setItem("user", JSON.stringify({
      name: "Username Playwright",
      email: "playwright@example.com",
      seller: false,
    }));
    localStorage.setItem("medusa_cart_id", cartId);
  }, { cartId });

  await page.route(`**/medusa-cart/${cartId}`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ cart: currentCart }),
  }));
  await page.route(`**/medusa-cart/${cartId}/items/line_checkout_regression`, (route) => {
    const quantity = Number(route.request().postDataJSON().quantity);
    const shippingOptionId = currentCart.shipping_methods[0]?.shipping_option_id;
    currentCart = checkoutRegressionCart({
      quantity,
      shippingOptionId,
      shippingTotal: Number(currentCart.shipping_total),
    });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cart: currentCart }),
    });
  });
  await page.route(`**/medusa-checkout/${cartId}`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      cart: currentCart,
      shippingOptions: [standardOption, expressOption],
      stripeCheckoutAvailable: true,
    }),
  }));
  await page.route(`**/medusa-checkout/${cartId}/shipping`, (route) => {
    const { shippingOptionId } = route.request().postDataJSON();
    if (shippingOptionId === expressOption.id && expressAttempts++ === 0) {
      return route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "shipping_update_failed" }),
      });
    }

    currentCart = checkoutRegressionCart({
      quantity: currentCart.items[0].quantity,
      shippingOptionId,
      shippingTotal: shippingOptionId === expressOption.id ? expressOption.amount : standardOption.amount,
    });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cart: currentCart }),
    });
  });

  await page.goto("/checkout");

  const summary = async (field, amount) => {
    await expect(page.locator(`[data-summary="${field}"]`)).toHaveText(
      formatCartPrice(amount, currentCart.currency_code)
    );
  };
  const standardInput = page.locator(`.shipping-option input[value="${standardOption.id}"]`);
  const expressInput = page.locator(`.shipping-option input[value="${expressOption.id}"]`);

  await expect(standardInput).not.toBeChecked();
  await expect(expressInput).not.toBeChecked();
  await expect(page.locator(".item-count")).toHaveText("1");
  await summary("subtotal", currentCart.item_subtotal);
  await summary("shipping_total", currentCart.shipping_total);
  await summary("discount_total", currentCart.discount_total);
  await summary("tax_total", currentCart.tax_total);
  await summary("total", currentCart.total);

  await page.locator(".place-order-btn").click();
  await expect(page.locator("#last_name-error")).toHaveText("This field is required.");
  await expect(page.locator("#first_name-error")).toHaveText("This field is required.");
  await expect(page.locator("#address-error")).toHaveText("This field is required.");

  await page.locator("#last_name").fill("Livraison");
  await expect(page.locator("#last_name-error")).toHaveText("");
  await expect(page.locator("#first_name-error")).toHaveText("This field is required.");
  await expect(page.locator("#address-error")).toHaveText("This field is required.");

  await page.locator("#first_name").fill("Camille");
  await page.locator("#address").fill("10 rue du Test");
  await page.locator("#street").fill("Rue du Test");
  await page.locator("#city").fill("La Rochelle");
  await page.locator("#state").fill("Charente-Maritime");
  await page.locator("#pincode").fill("17000");
  await expect(page.locator("#landmark-error")).toHaveText("");

  const standardResponse = page.waitForResponse((response) => (
    response.url().endsWith(`/medusa-checkout/${cartId}/shipping`) && response.status() === 200
  ));
  await standardInput.click();
  const standardCart = (await standardResponse).json().then((data) => data.cart);
  await expect(standardInput).toBeChecked();
  await expect(page.locator(".checkout-status")).not.toHaveClass(/error/);
  await summary("shipping_total", (await standardCart).shipping_total);
  await summary("total", (await standardCart).total);

  const rejectedExpressResponse = page.waitForResponse((response) => (
    response.url().endsWith(`/medusa-checkout/${cartId}/shipping`) && response.status() === 502
  ));
  await expressInput.click();
  await rejectedExpressResponse;
  await expect(page.locator(".checkout-status")).toHaveText("shipping_update_failed");
  await expect(standardInput).toBeChecked();
  await expect(expressInput).not.toBeChecked();
  await summary("shipping_total", currentCart.shipping_total);
  await summary("total", currentCart.total);

  const expressResponse = page.waitForResponse((response) => (
    response.url().endsWith(`/medusa-checkout/${cartId}/shipping`) && response.status() === 200
  ));
  await expressInput.click();
  const expressCart = (await expressResponse).json().then((data) => data.cart);
  await expect(expressInput).toBeChecked();
  await expect(page.locator(".checkout-status")).not.toHaveClass(/error/);
  await summary("shipping_total", (await expressCart).shipping_total);
  await summary("discount_total", (await expressCart).discount_total);
  await summary("tax_total", (await expressCart).tax_total);
  await summary("total", (await expressCart).total);

  const incrementResponse = page.waitForResponse((response) => (
    response.url().endsWith(`/medusa-cart/${cartId}/items/line_checkout_regression`) && response.request().method() === "PATCH"
  ));
  await page.locator(".increment").click();
  const incrementedCart = (await incrementResponse).json().then((data) => data.cart);
  await expect(page.locator(".item-count")).toHaveText("2");
  await expect(page.locator(".sm-price")).toHaveText(formatCartPrice((await incrementedCart).items[0].total));
  await summary("subtotal", (await incrementedCart).item_subtotal);
  await summary("shipping_total", (await incrementedCart).shipping_total);
  await summary("total", (await incrementedCart).total);

  const decrementResponse = page.waitForResponse((response) => (
    response.url().endsWith(`/medusa-cart/${cartId}/items/line_checkout_regression`) && response.request().method() === "PATCH"
  ));
  await page.locator(".decrement").click();
  const decrementedCart = (await decrementResponse).json().then((data) => data.cart);
  await expect(page.locator(".item-count")).toHaveText("1");
  await expect(page.locator(".sm-price")).toHaveText(formatCartPrice((await decrementedCart).items[0].total));
  await summary("subtotal", (await decrementedCart).item_subtotal);
  await summary("shipping_total", (await decrementedCart).shipping_total);
  await summary("total", (await decrementedCart).total);
  expect(await page.evaluate(() => window.currentMedusaCart.shipping_methods[0].shipping_option_id)).toBe(expressOption.id);
});
