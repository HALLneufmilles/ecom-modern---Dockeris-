const { test, expect } = require("@playwright/test");

const colorDisplayCases = {
  "Alpine Cargo Short": { "Gris pierre": "GRIS", Kaki: "KAKI" },
  "Atlantic Logo Tee": { "Bleu océan": "BLEU", Écru: "ÉCRU" },
  "Break Cap": { "Bleu délavé": "BLEU" },
  "Coast Cargo Short": { Sable: "SABLE", "Vert olive": "VERT" },
  "Ridge Technical Tee": { "Vert forêt": "VERT", "Gris ardoise": "GRIS" },
  "Dockyard Overshirt": { "Bleu marine": "BLEU" },
  "Harbor Tee": { "Bleu marine": "BLEU" },
  "Rivet Heavy Tee": { Anthracite: "GRIS" },
  "Summit Fleece": { "Beige pierre": "BEIGE" },
  "Metro Zip Hoodie": { Olive: "VERT", "Gris anthracite": "GRIS" },
  "Block Hoodie": { "Gris chiné": "GRIS", Noir: "NOIR" },
  "Core Oversize Tee": { "Blanc cassé": "BLANC" },
  "Low Tide Long Sleeve": { Bordeaux: "ROUGE" },
  "Sunset Crewneck": { "Bordeaux délavé": "ROUGE" },
  "District Wide Pant": { "Gris ciment": "GRIS" },
  "Transit Windbreaker": { "Bleu nuit": "BLEU", "Gris clair": "GRIS" },
  "Wharf Worker Jacket": { "Brun tabac": "BRUN" },
  "Medusa T-Shirt": { Black: "NOIR", White: "BLANC" },
};

test("F-04 - ouvrir un produit Medusa, choisir sa variante et l'ajouter au panier Medusa", async ({ page }) => {
  const legacyDetailRequests = [];

  page.on("request", (request) => {
    if (
      request.url().endsWith("/get-products")
      && request.method() === "POST"
      && request.postData()?.includes('"id":')
    ) {
      legacyDetailRequests.push(request);
    }
  });

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("medusa_cart_id", "cart_missing");
  });
  await page.reload();

  const firstProduct = page.locator("#men-tshirt-products .product-card").first();
  await expect(firstProduct).toBeVisible();

  const productResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/medusa-products/") && response.request().method() === "GET"
  );

  await firstProduct.click();
  await expect(page).toHaveURL(/\/products\/prod_.+/);

  const productResponse = await productResponsePromise;
  expect(productResponse.status()).toBe(200);

  const product = await productResponse.json();
  expect(product.source).toBe("medusa");
  expect(product.id).toMatch(/^prod_/);
  expect(product.variants.length).toBeGreaterThan(0);
  expect(product.options.length).toBeGreaterThan(0);
  const productName = product.name;

  await expect(page.locator(".product-details .details > .product-brand")).toHaveText(productName);
  await expect(page.locator(".product-images img:visible").first()).toBeVisible();
  expect(legacyDetailRequests).toHaveLength(0);

  const cartButton = page.locator(".cart-btn");
  const colorOption = product.options.find((option) => ["color", "couleur"].includes(option.title.toLowerCase()));
  const sizeOption = product.options.find((option) => ["size", "taille"].includes(option.title.toLowerCase()));
  expect(colorOption).toBeTruthy();
  expect(sizeOption).toBeTruthy();

  const colorGroup = page.locator(`.product-option-group[data-option-id="${colorOption.id}"]`);
  const sizeGroup = page.locator(`.product-option-group[data-option-id="${sizeOption.id}"]`);
  const availableVariant = product.variants.find((variant) => variant.available && variant.price);
  expect(availableVariant).toBeTruthy();
  const colorValue = availableVariant.options.find((option) => option.optionId === colorOption.id)?.value;
  const sizeValue = availableVariant.options.find((option) => option.optionId === sizeOption.id)?.value;
  const colorButton = colorGroup.locator(`.option-radio-btn[data-option-value="${colorValue}"]`);
  const sizeButton = sizeGroup.locator(`.option-radio-btn[data-option-value="${sizeValue}"]`);

  await expect(page.locator(".option-radio-btn.uncheck")).toHaveCount(0);

  await colorButton.click();
  await expect(page.locator(".option-radio-btn.uncheck")).toHaveCount(0);
  await expect(colorButton).toHaveClass(/check/);

  await sizeButton.click();
  await expect(page.locator(".option-radio-btn.uncheck")).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".product-details .details > .product-brand")).toHaveText(productName);
  await cartButton.click();
  await expect(colorGroup.locator(".option-radio-btn.uncheck")).toHaveCount(0);
  await expect(sizeGroup.locator(".option-radio-btn.uncheck").first()).toBeVisible();

  await colorButton.click();
  await expect(colorGroup.locator(".option-radio-btn.uncheck")).toHaveCount(0);
  await expect(colorButton).toHaveClass(/check/);
  await expect(sizeGroup.locator(".option-radio-btn.uncheck").first()).toBeVisible();

  await sizeButton.click();
  await expect(colorGroup.locator(".option-radio-btn.uncheck")).toHaveCount(0);
  await expect(sizeGroup.locator(".option-radio-btn.uncheck")).toHaveCount(0);

  await expect(page.locator(".product-stock")).toHaveText("In stock");
  await expect(page.locator(".product-price")).not.toHaveText("Price unavailable");

  const cartResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/medusa-cart/items") && response.request().method() === "POST"
  );

  await cartButton.click();

  const cartResponse = await cartResponsePromise;
  expect(cartResponse.status()).toBe(200);

  const { cart: medusaCart } = await cartResponse.json();
  expect(medusaCart.id).toMatch(/^cart_/);
  expect(medusaCart.items.some((item) => item.variant_id === availableVariant.id)).toBe(true);
  await expect(cartButton).toHaveText("added");

  const storedState = await page.evaluate(() => ({
    cartId: localStorage.getItem("medusa_cart_id"),
    legacyCart: localStorage.getItem("cart"),
  }));

  expect(storedState.cartId).toBe(medusaCart.id);
  expect(storedState.cartId).not.toBe("cart_missing");
  expect(storedState.legacyCart).toBeNull();

  await page.reload();
  await expect(page.locator(".product-details .details > .product-brand")).toHaveText(productName);
  await cartButton.click();
  await expect(colorGroup.locator(".option-radio-btn.uncheck")).toHaveCount(0);
  await expect(sizeGroup.locator(".option-radio-btn.uncheck").first()).toBeVisible();
  await sizeButton.click();
  await expect(sizeGroup.locator(".option-radio-btn.uncheck")).toHaveCount(0);
  await expect(sizeButton).toHaveClass(/check/);
  await expect(colorGroup.locator(".option-radio-btn.uncheck")).toHaveCount(0);

  await page.goto("/cart");

  const cartProduct = page.locator(".cart .sm-product").first();
  await expect(cartProduct).toBeVisible();
  await expect(cartProduct.locator(".sm-product-name")).toHaveText(productName);
  await expect(cartProduct.locator(".item-count")).toHaveText("1");
  const renderedCart = await page.evaluate(() => window.currentMedusaCart);
  expect(renderedCart.id).toBe(medusaCart.id);
  expect(renderedCart.items[0].variant_id).toBe(availableVariant.id);

  if (availableVariant.price.currencyCode?.toLowerCase() === "eur") {
    await expect(cartProduct.locator(".sm-price")).toContainText("€");
    await expect(page.locator(".bill")).toContainText("€");
  }
});

test("F-04 - les libellés Couleur sont simplifiés sans modifier les valeurs de variante", async ({ page, request }) => {
  const catalogueResponse = await request.get("/medusa-home-products");
  expect(catalogueResponse.ok()).toBeTruthy();
  const catalogue = await catalogueResponse.json();

  for (const [productName, expectedLabels] of Object.entries(colorDisplayCases)) {
    const productCard = catalogue.find((product) => product.name === productName);
    expect(productCard, `${productName} must be present in the local catalogue`).toBeTruthy();

    const productResponse = await request.get(`/medusa-products/${productCard.id}`);
    expect(productResponse.ok()).toBeTruthy();
    const product = await productResponse.json();
    const colorOption = product.options.find((option) => ["color", "couleur"].includes(option.title.toLowerCase()));
    const sizeOption = product.options.find((option) => ["size", "taille"].includes(option.title.toLowerCase()));

    await page.goto(`/products/${product.id}`);

    const optionGroups = page.locator(".product-option-group");
    await expect(optionGroups).toHaveCount(product.options.length);
    await expect(optionGroups.nth(0)).toHaveAttribute("data-option-id", colorOption.id);
    if (sizeOption) {
      await expect(optionGroups.nth(1)).toHaveAttribute("data-option-id", sizeOption.id);
    }

    const colorGroup = page.locator(`.product-option-group[data-option-id="${colorOption.id}"]`);
    for (const [medusaValue, displayLabel] of Object.entries(expectedLabels)) {
      const colorButton = colorGroup.locator(`.option-radio-btn[data-option-value="${medusaValue}"]`);
      await expect(colorButton).toHaveText(displayLabel);
      await expect(colorButton).toHaveAttribute("data-option-value", medusaValue);
    }

    const availableVariant = product.variants.find((variant) => variant.available && variant.price);
    expect(availableVariant).toBeTruthy();
    for (const option of availableVariant.options) {
      const optionButton = page.locator(`.product-option-group[data-option-id="${option.optionId}"] .option-radio-btn[data-option-value="${option.value}"]`);
      await optionButton.click();
      await expect(optionButton).toHaveClass(/check/);
    }
    await expect(page.locator(".product-stock")).not.toHaveText("Select all options");
  }
});

test("F-04 - une couleur indisponible conserve son clic, sa galerie et bloque ses tailles", async ({ page }) => {
  const cartRequests = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/medusa-cart/items")) {
      cartRequests.push(request);
    }
  });
  const product = {
    source: "medusa",
    id: "prod_color-gallery",
    name: "Color gallery fixture",
    shortDes: "",
    des: "",
    images: ["/images/sable-front.jpg"],
    mediaByColor: {
      Sable: [
        { id: "img-sable-front", url: "/images/sable-front.jpg" },
        { id: "img-sable-back", url: "/images/sable-back.jpg" },
      ],
      "Vert olive": [
        { id: "img-olive-front", url: "/images/olive-front.jpg" },
        { id: "img-olive-back", url: "/images/olive-back.jpg" },
      ],
    },
    options: [
      { id: "color", title: "Couleur", values: ["Sable", "Vert olive"] },
      { id: "size", title: "Taille", values: ["S", "M"] },
    ],
    variants: [
      {
        id: "variant-sable-s",
        options: [{ optionId: "color", value: "Sable" }, { optionId: "size", value: "S" }],
        images: ["/images/sable-front.jpg"],
        available: true,
        price: { amount: 10, originalAmount: 10, currencyCode: "eur" },
      },
      {
        id: "variant-sable-m",
        options: [{ optionId: "color", value: "Sable" }, { optionId: "size", value: "M" }],
        images: ["/images/sable-back.jpg"],
        available: true,
        price: { amount: 10, originalAmount: 10, currencyCode: "eur" },
      },
      {
        id: "variant-olive-s",
        options: [{ optionId: "color", value: "Vert olive" }, { optionId: "size", value: "S" }],
        images: ["/images/olive-front.jpg"],
        available: false,
        price: { amount: 10, originalAmount: 10, currencyCode: "eur" },
      },
      {
        id: "variant-olive-m",
        options: [{ optionId: "color", value: "Vert olive" }, { optionId: "size", value: "M" }],
        images: ["/images/olive-back.jpg"],
        available: false,
        price: { amount: 10, originalAmount: 10, currencyCode: "eur" },
      },
    ],
    tags: [],
  };

  await page.route("**/medusa-products/prod_color-gallery", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(product) });
  });
  await page.route("**/medusa-products/prod_color-gallery/recommendations", async (route) => {
    await route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.goto("/products/prod_color-gallery");

  const colorGroup = page.locator('.product-option-group[data-option-id="color"]');
  const sizeGroup = page.locator('.product-option-group[data-option-id="size"]');
  const oliveButton = colorGroup.locator('[data-option-value="Vert olive"]');
  const sableButton = colorGroup.locator('[data-option-value="Sable"]');

  await expect(oliveButton).toHaveText("VERT");
  await expect(oliveButton).toHaveAttribute("data-option-value", "Vert olive");
  await expect(oliveButton).toBeEnabled();
  await expect(sableButton).toHaveClass(/check/);
  await expect(page.locator(".image-slider")).toHaveCSS("background-image", /sable-front\.jpg/);
  const sizeButtons = sizeGroup.locator(".option-radio-btn");
  await expect(sizeButtons).toHaveCount(2);
  await expect(sizeButtons.nth(0)).toBeEnabled();
  await expect(sizeButtons.nth(1)).toBeEnabled();
  await oliveButton.click();
  await expect(page.locator(".image-slider")).toHaveCSS("background-image", /olive-front\.jpg/);
  await expect(page.locator(".product-images img").nth(1)).toHaveAttribute("src", /olive-back\.jpg/);
  await expect(sizeButtons.nth(0)).toBeDisabled();
  await expect(sizeButtons.nth(1)).toBeDisabled();
  await expect(page.locator(".cart-btn")).toBeEnabled();
  await page.locator(".cart-btn").click();
  expect(cartRequests).toHaveLength(0);
});

test("F-04 - un produit sans Couleur conserve sa galerie générale", async ({ page }) => {
  const product = {
    source: "medusa",
    id: "prod_general-gallery",
    name: "General gallery fixture",
    shortDes: "",
    des: "",
    images: ["/images/general-front.jpg", "/images/general-back.jpg"],
    options: [{ id: "size", title: "Taille", values: ["S"] }],
    variants: [{
      id: "variant-general-s",
      options: [{ optionId: "size", value: "S" }],
      available: true,
      price: { amount: 10, originalAmount: 10, currencyCode: "eur" },
    }],
    tags: [],
  };

  await page.route("**/medusa-products/prod_general-gallery", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(product) });
  });
  await page.route("**/medusa-products/prod_general-gallery/recommendations", async (route) => {
    await route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.goto("/products/prod_general-gallery");

  await expect(page.locator(".image-slider")).toHaveCSS("background-image", /general-front\.jpg/);
  await expect(page.locator(".product-images img").nth(1)).toHaveAttribute("src", /general-back\.jpg/);
  await expect(page.locator(".color-radio-btn")).toHaveCount(0);
});

test("F-04 - le backend expose les galeries Medusa par leurs vraies valeurs Couleur", async ({ request }) => {
  const catalogueResponse = await request.get("/medusa-home-products");
  expect(catalogueResponse.ok()).toBeTruthy();
  const catalogue = await catalogueResponse.json();

  for (const productName of ["District Wide Pant", "Metro Zip Hoodie", "Coast Cargo Short", "Harbor Tee"]) {
    const card = catalogue.find((product) => product.name === productName);
    expect(card, `${productName} must be present in the local catalogue`).toBeTruthy();

    const productResponse = await request.get(`/medusa-products/${card.id}`);
    expect(productResponse.ok()).toBeTruthy();
    const product = await productResponse.json();
    const colorOption = product.options.find((option) => ["color", "couleur"].includes(option.title.toLowerCase()));
    expect(colorOption).toBeTruthy();

    for (const color of colorOption.values) {
      expect(product.mediaByColor[color], `${productName} must expose ${color}`).toHaveLength(4);
      expect(product.mediaByColor[color].every((image) => image.id && image.url)).toBe(true);
    }
  }
});
