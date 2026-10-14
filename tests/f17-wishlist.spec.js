const { test, expect } = require("@playwright/test");
const { request: playwrightRequest } = require("@playwright/test");
require("dotenv").config();

const medusaBaseUrl = "http://127.0.0.1:9000";
const bffBaseUrl = "http://127.0.0.1:5000";
const medusaStoreKey = process.env.MEDUSA_PUBLISHABLE_API_KEY;

const mockAuthenticatedCustomerSession = async (page) => {
  await page.route("**/medusa-customer/session", (route) => route.fulfill({
    json: {
      authenticated: true,
      user: { name: "Wishlist Test", email: "wishlist-test@example.test" },
    },
  }));
};

const createDirectMedusaCustomer = async (api, suffix) => {
  expect(medusaStoreKey).toBeTruthy();
  const email = `wishlist-selected-options-${suffix}-${Date.now()}@example.test`;
  const password = "Wishlist123!";
  const headers = { "x-publishable-api-key": medusaStoreKey };
  const registration = await api.post(`${medusaBaseUrl}/auth/customer/emailpass/register`, {
    headers,
    data: { email, password },
  });
  expect(registration.status()).toBe(200);
  const registrationData = await registration.json();
  expect(registrationData.token).toBeTruthy();

  const customer = await api.post(`${medusaBaseUrl}/store/customers`, {
    headers: { ...headers, Authorization: `Bearer ${registrationData.token}` },
    data: { email, first_name: "Wishlist", last_name: suffix, phone: "0612345678" },
  });
  expect(customer.status()).toBe(200);

  const login = await api.post(`${medusaBaseUrl}/auth/customer/emailpass`, {
    headers,
    data: { email, password },
  });
  expect(login.status()).toBe(200);
  const loginData = await login.json();
  expect(loginData.token).toBeTruthy();
  return { email, token: loginData.token };
};

const findProductWithColorMedia = async (api) => {
  const products = await (await api.get(`${bffBaseUrl}/medusa-home-products`)).json();
  for (const card of products) {
    const response = await api.get(`${bffBaseUrl}/medusa-products/${encodeURIComponent(card.id)}`);
    if (!response.ok()) continue;
    const product = await response.json();
    const colorOption = product.options?.find((option) => ["color", "couleur"].includes(option.title.toLowerCase()));
    const sizeOption = product.options?.find((option) => ["size", "taille"].includes(option.title.toLowerCase()));
    if (!colorOption || !sizeOption) continue;

    const usableColors = colorOption.values.filter((color) => (
      product.mediaByColor?.[color]?.some((image) => image?.url)
      && product.variants.some((variant) => variant.available && variant.price
        && variant.options.some((option) => option.optionId === colorOption.id && option.value === color)
        && variant.options.some((option) => option.optionId === sizeOption.id))
    ));
    if (usableColors.length >= 2) {
      return { product, colorOption, sizeOption, firstColor: usableColors[0], secondColor: usableColors[1] };
    }
  }
  throw new Error("A Medusa product with two purchasable color galleries is required for F-17")
};

const signup = async (page, email, password) => {
  await page.goto("/signup");
  await page.locator("#name").fill("Wishlist Test");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#number").fill("0612345678");
  await page.locator(".submit-btn").click();
  await expect(page).toHaveURL(/\/$/);
};

const login = async (page, email, password) => {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator(".submit-btn").click();
  await expect(page).toHaveURL(/\/$/);
};

const logoutForCustomerIsolation = async (page) => {
  await page.evaluate(async () => {
    await fetch("/logout", { method: "POST" });
    sessionStorage.clear();
  });
  await page.goto("/");
};

test("F-17 - wishlist Customer persistante au niveau Product", async ({ page }) => {
  test.skip(process.env.MVDW_FEATURE_WISHLIST === "false", "Ce scénario requiert wishlist=true.");

  const email = `wishlist-${Date.now()}@example.test`;
  const password = "Wishlist123!";

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("wishlist", JSON.stringify([{ productId: "legacy" }]));
    sessionStorage.clear();
  });

  const anonymousWishlist = await page.request.get("/medusa-wishlist");
  expect(anonymousWishlist.status()).toBe(401);
  await expect(anonymousWishlist.json()).resolves.toEqual({ error: "authentication_required" });

  const productId = await page.evaluate(async () => {
    const products = await fetch("/medusa-home-products").then((response) => response.json());
    for (const product of products) {
      const detail = await fetch(`/medusa-products/${product.id}`).then((response) => response.json());
      const sizeOption = detail.options.find((option) => ["size", "taille"].includes(option.title.toLowerCase()));
      const colorOption = detail.options.find((option) => ["color", "couleur"].includes(option.title.toLowerCase()));
      const availableColors = new Set(detail.variants
        .filter((variant) => variant.available && variant.price)
        .map((variant) => variant.options.find((option) => option.optionId === colorOption?.id)?.value)
        .filter(Boolean));
      if (detail.source === "medusa" && sizeOption && colorOption && availableColors.size > 1) return detail.id;
    }
    return null;
  });
  expect(productId).not.toBeNull();

  await page.goto(`/products/${productId}`);
  const wishlistButton = page.locator(".wishlist-btn");
  await expect(wishlistButton).toBeVisible();
  await expect(wishlistButton).toHaveClass(/wishlist-auth-required/);
  await wishlistButton.click();
  await expect(page.locator(".product-state")).toHaveText("Connectez-vous pour utiliser la Wishlist.");

  await signup(page, email, password);
  expect(await page.evaluate(() => localStorage.getItem("wishlist"))).toBeNull();
  await page.goto(`/products/${productId}`);

  await expect(page.locator(".cart-btn")).toBeEnabled();
  await expect(page.locator(".cart-btn")).toHaveClass(/cart-btn-disabled/);
  await expect(page.locator(".cart-btn")).not.toHaveAttribute("aria-disabled");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const wishlistRequest = page.waitForRequest((request) => (
      request.url().endsWith("/medusa-wishlist/items") && request.method() === "POST"
    ));
    await wishlistButton.click();
    expect((await wishlistRequest).postDataJSON()).toEqual({ productId });
  }
  await expect(wishlistButton).toHaveText("Ajouté");
  expect(await page.evaluate(() => localStorage.getItem("wishlist"))).toBeNull();

  const savedWishlist = await page.evaluate(async () => (
    fetch("/medusa-wishlist").then((response) => response.json())
  ));
  const genericItems = savedWishlist.wishlist.items.filter((item) => item.variantId === null && item.product.id === productId);
  expect(genericItems).toHaveLength(2);
  expect(new Set(genericItems.map((item) => item.id)).size).toBe(2);
  const [genericItem, preservedGenericItem] = genericItems;

  await page.reload();
  const reloadedWishlist = await page.evaluate(async () => (
    fetch("/medusa-wishlist").then((response) => response.json())
  ));
  expect(reloadedWishlist.wishlist.items.filter((item) => item.product.id === productId)).toHaveLength(2);

  await page.locator("#user-img").click();
  await page.locator("#user-btn").click();
  await expect(page.locator("#user-btn")).toHaveText(/log in/i);
  await login(page, email, password);

  await page.goto("/cart");
  const wishlistProduct = page.locator(".wishlist .sm-product").first();
  await expect(wishlistProduct).toBeVisible();
  await expect(wishlistProduct.locator(".item-counter")).toHaveCount(0);
  await expect(wishlistProduct.locator(".wishlist-variant-options")).toHaveCount(0);
  await expect(wishlistProduct.locator(".wishlist-choose-options")).toBeVisible();
  await expect(wishlistProduct.locator(".sm-product-image-link")).toHaveCount(0);
  await expect(wishlistProduct.locator(".sm-text.sm-product-link")).toHaveCount(0);

  await Promise.all([
    page.waitForURL(new RegExp(`/products/${productId}\\?wishlistItemId=${genericItem.id}`)),
    wishlistProduct.locator(".wishlist-choose-options").click(),
  ]);
  const selectedProduct = await page.evaluate(async (id) => (
    fetch(`/medusa-products/${id}`).then((response) => response.json())
  ), productId);
  const colorOption = selectedProduct.options.find((option) => ["color", "couleur"].includes(option.title.toLowerCase()));
  const defaultColor = colorOption.values[0];
  const selectedVariant = selectedProduct.variants.find((variant) => (
    variant.available && variant.price
      && variant.options.some((option) => option.optionId === colorOption.id && option.value === defaultColor)
  ));
  expect(selectedVariant).toBeTruthy();
  for (const option of selectedVariant.options.filter((option) => option.optionId !== colorOption.id)) {
    await page.locator(`.product-option-group[data-option-id="${option.optionId}"] .option-radio-btn[data-option-value="${option.value}"]`).click();
  }

  const updateWishlistRequest = page.waitForRequest((request) => (
    request.url().endsWith(`/medusa-wishlist/items/${genericItem.id}`) && request.method() === "PUT"
  ));
  const updateWishlistResponse = page.waitForResponse((response) => (
    response.url().endsWith(`/medusa-wishlist/items/${genericItem.id}`)
      && response.request().method() === "PUT"
  ));
  await wishlistButton.click();
  expect((await updateWishlistRequest).postDataJSON()).toEqual({ productId, variantId: selectedVariant.id });
  expect((await updateWishlistResponse).status()).toBe(200);
  await expect(page.locator(".product-state")).toHaveText("Produit mis à jour.");

  const selectedWishlist = await page.evaluate(async () => (
    fetch("/medusa-wishlist").then((response) => response.json())
  ));
  expect(selectedWishlist.wishlist.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: genericItem.id, variantId: selectedVariant.id }),
    expect.objectContaining({ id: preservedGenericItem.id, variantId: null }),
  ]));

  await page.goto("/cart");
  const selectedOptionsLabel = selectedVariant.options.map((option) => option.value).join(" / ");
  await expect(page.locator(".wishlist .wishlist-variant-options")).toHaveText(selectedOptionsLabel);
  const addFromWishlistResponse = page.waitForResponse((response) => (
    response.url().endsWith("/medusa-cart/items") && response.request().method() === "POST"
  ));
  await page.locator(".wishlist .wishlist-add-to-cart").click();
  const addedFromWishlist = await addFromWishlistResponse;
  const cartAfterWishlistTransfer = (await addedFromWishlist.json()).cart;
  expect(cartAfterWishlistTransfer.items.some((item) => item.variant_id === selectedVariant.id)).toBe(true);
  expect(cartAfterWishlistTransfer.items.every((item) => Number.isFinite(Number(item.total)))).toBe(true);
  const pricesAfterTransfer = await page.locator(".cart .sm-price").allTextContents();
  expect(pricesAfterTransfer.every((price) => !price.includes("NaN"))).toBe(true);
  await expect(page.locator(`.wishlist .sm-product[data-wishlist-item-id="${preservedGenericItem.id}"]`)).toBeVisible();
  await page.reload();
  await expect(page.locator(".cart .sm-price").first()).toBeVisible();
  expect(await page.locator(".cart .sm-price").allTextContents()).toEqual(pricesAfterTransfer);

  await page.goto(`/products/${productId}`);
  for (const option of selectedVariant.options) {
    await page.locator(`.product-option-group[data-option-id="${option.optionId}"] .option-radio-btn[data-option-value="${option.value}"]`).click();
  }
  const initialVariantWishlistRequest = page.waitForRequest((request) => (
    request.url().endsWith("/medusa-wishlist/items") && request.method() === "POST"
  ));
  await wishlistButton.click();
  expect((await initialVariantWishlistRequest).postDataJSON()).toEqual({ productId, variantId: selectedVariant.id });

  const alternateVariant = selectedProduct.variants.find((variant) => (
    variant.available && variant.price
      && variant.options.some((option) => option.optionId === colorOption.id && option.value !== defaultColor)
  ));
  expect(alternateVariant).toBeTruthy();
  for (const option of alternateVariant.options) {
    await page.locator(`.product-option-group[data-option-id="${option.optionId}"] .option-radio-btn[data-option-value="${option.value}"]`).click();
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const alternateWishlistRequest = page.waitForRequest((request) => (
      request.url().endsWith("/medusa-wishlist/items") && request.method() === "POST"
    ));
    await wishlistButton.click();
    expect((await alternateWishlistRequest).postDataJSON()).toEqual({ productId, variantId: alternateVariant.id });
  }
  const addFromProductResponse = page.waitForResponse((response) => (
    response.url().endsWith("/medusa-cart/items") && response.request().method() === "POST"
  ));
  await page.locator(".cart-btn").click();
  expect((await addFromProductResponse).status()).toBe(200);
  const wishlistAfterProductCart = await page.evaluate(async () => (
    fetch("/medusa-wishlist").then((response) => response.json())
  ));
  expect(wishlistAfterProductCart.wishlist.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: preservedGenericItem.id, variantId: null }),
    expect.objectContaining({ product: expect.objectContaining({ id: productId }), variantId: selectedVariant.id }),
    expect.objectContaining({ product: expect.objectContaining({ id: productId }), variantId: alternateVariant.id }),
  ]));
  const alternateWishlistItems = wishlistAfterProductCart.wishlist.items.filter((item) => item.variantId === alternateVariant.id);
  expect(alternateWishlistItems).toHaveLength(2);
  expect(new Set(alternateWishlistItems.map((item) => item.id)).size).toBe(2);

  await logoutForCustomerIsolation(page);
  const otherEmail = `wishlist-other-${Date.now()}@example.test`;
  await signup(page, otherEmail, password);
  const otherCustomerDelete = await page.request.delete(`/medusa-wishlist/items/${preservedGenericItem.id}`);
  expect(otherCustomerDelete.status()).toBe(404);
  const otherCustomerUpdate = await page.request.put(`/medusa-wishlist/items/${preservedGenericItem.id}`, {
    data: { productId, variantId: selectedVariant.id },
  });
  expect(otherCustomerUpdate.status()).toBe(404);
  const otherCustomerTransfer = await page.request.post("/medusa-cart/items", {
    data: { variantId: selectedVariant.id, quantity: 1, wishlistItemId: preservedGenericItem.id },
  });
  expect(otherCustomerTransfer.status()).toBe(404);
  await expect(otherCustomerTransfer.json()).resolves.toEqual({ error: "wishlist_item_not_found" });
  await logoutForCustomerIsolation(page);
  await login(page, email, password);
  const wishlistAfterForeignAttempt = await page.evaluate(async () => (
    fetch("/medusa-wishlist").then((response) => response.json())
  ));
  expect(wishlistAfterForeignAttempt.wishlist.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: preservedGenericItem.id }),
  ]));

  await page.addInitScript(() => sessionStorage.setItem("medusa_cart_id", "cart_wishlist"));

  let mockedWishlistItems = [
    {
      id: "wishlist_item_direct",
      variantId: "variant_direct",
      product: {
        id: "product_direct",
        name: "Direct Product",
        shortDes: "One purchasable variant",
        image: null,
        price: { amount: 12, currencyCode: "eur" },
        options: [],
        variants: [{ id: "variant_direct", available: true, price: { amount: 12, currencyCode: "eur" } }],
      },
    },
    {
      id: "wishlist_item_direct_duplicate",
      variantId: "variant_direct",
      product: {
        id: "product_direct",
        name: "Direct Product",
        shortDes: "A second independent copy",
        image: null,
        price: { amount: 12, currencyCode: "eur" },
        options: [],
        variants: [{ id: "variant_direct", available: true, price: { amount: 12, currencyCode: "eur" } }],
      },
    },
    {
      id: "wishlist_item_failing",
      variantId: "variant_failing",
      product: {
        id: "product_failing",
        name: "Failing Product",
        shortDes: "The wishlist item must remain on failure",
        image: null,
        price: { amount: 14, currencyCode: "eur" },
        options: [],
        variants: [{ id: "variant_failing", available: true, price: { amount: 14, currencyCode: "eur" } }],
      },
    },
    {
      id: "wishlist_item_options",
      variantId: null,
      product: {
        id: "product_options",
        name: "Options Product",
        shortDes: "A size must be selected on the product page",
        image: null,
        price: { amount: 16, currencyCode: "eur" },
        options: [{ id: "option_size", title: "Size" }],
        variants: [{ id: "variant_options", available: true, price: { amount: 16, currencyCode: "eur" } }],
      },
    },
    {
      id: "wishlist_item_without_variant",
      variantId: null,
      product: {
        id: "product_without_variant",
        name: "Product Without Saved Variant",
        shortDes: "An item without a saved variant must not be added automatically",
        image: null,
        price: { amount: 17, currencyCode: "eur" },
        options: [],
        variants: [{ id: "variant_without_saved_selection", available: true, price: { amount: 17, currencyCode: "eur" } }],
      },
    },
    {
      id: "wishlist_item_unavailable",
      variantId: "variant_unavailable",
      product: {
        id: "product_unavailable",
        name: "Unavailable Product",
        shortDes: "A stale variant must not be added automatically",
        image: null,
        price: { amount: 18, currencyCode: "eur" },
        options: [{ id: "option_size", title: "Size" }],
        variants: [{ id: "variant_available", available: true, price: { amount: 18, currencyCode: "eur" } }],
      },
    },
  ];
  const cartBeforeTransfer = {
    id: "cart_wishlist",
    currency_code: "eur",
    item_subtotal: 0,
    items: [],
  };
  const cartAfterTransfer = {
    ...cartBeforeTransfer,
    item_subtotal: 12,
    items: [{
      id: "cali_direct",
      product_id: "product_direct",
      variant_id: "variant_direct",
      product_title: "Direct Product",
      variant_title: "",
      thumbnail: null,
      quantity: 1,
      unit_price: 12,
      total: 12,
    }],
  };
  const calls = [];

  await page.route("**/medusa-wishlist", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({ json: { wishlist: { items: mockedWishlistItems } } });
  });
  await page.route("**/medusa-cart/**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") return route.fulfill({ json: { cart: cartBeforeTransfer } });
    if (request.method() !== "POST" || !request.url().endsWith("/medusa-cart/items")) return route.fallback();

    const { variantId, wishlistItemId } = request.postDataJSON();
    calls.push(`cart:${variantId}`);
    if (variantId === "variant_failing") {
      return route.fulfill({ status: 502, json: { error: "cart_unavailable" } });
    }
    mockedWishlistItems = mockedWishlistItems.filter((item) => item.id !== wishlistItemId);
    return route.fulfill({ json: { cart: cartAfterTransfer, wishlistRemoved: true } });
  });

  await page.goto("/cart");
  await expect(page.locator(".wishlist .item-counter")).toHaveCount(0);

  const optionsProduct = page.locator(".wishlist .sm-product").filter({ hasText: "Options Product" });
  await expect(optionsProduct.locator(".wishlist-choose-options")).toBeVisible();
  await expect(optionsProduct.locator(".sm-product-image-link")).toHaveCount(0);
  await expect(optionsProduct.locator(".sm-text.sm-product-link")).toHaveCount(0);
  await Promise.all([
    page.waitForURL(/\/products\/product_options\?wishlistItemId=wishlist_item_options/),
    optionsProduct.locator(".wishlist-choose-options").click(),
  ]);
  expect(calls).toEqual([]);

  await page.goto("/cart");
  const productWithoutVariant = page.locator(".wishlist .sm-product").filter({ hasText: "Product Without Saved Variant" });
  await expect(productWithoutVariant.locator(".wishlist-choose-options")).toBeVisible();
  await productWithoutVariant.locator(".wishlist-choose-options").click();
  await expect(page).toHaveURL(/\/products\/product_without_variant\?wishlistItemId=wishlist_item_without_variant/);
  expect(calls).toEqual([]);

  await page.goto("/cart");
  const unavailableProduct = page.locator(".wishlist .sm-product").filter({ hasText: "Unavailable Product" });
  await expect(unavailableProduct.locator(".wishlist-choose-options")).toBeVisible();
  await unavailableProduct.locator(".wishlist-choose-options").click();
  await expect(page).toHaveURL(/\/products\/product_unavailable\?wishlistItemId=wishlist_item_unavailable/);
  expect(calls).toEqual([]);

  await page.goto("/cart");
  const failingProduct = page.locator(".wishlist .sm-product").filter({ hasText: "Failing Product" });
  await failingProduct.locator(".wishlist-add-to-cart").click();
  await expect(failingProduct).toBeVisible();
  await expect(page.locator(".wishlist-state")).toHaveText("Unable to add this product to the cart.");
  expect(calls).toEqual([
    "cart:variant_failing",
  ]);

  const directProduct = page.locator(".wishlist .sm-product").filter({ hasText: "Direct Product" });
  await expect(directProduct.first().locator(".sm-product-image-link")).toHaveAttribute("href", "/products/product_direct?wishlistItemId=wishlist_item_direct");
  await directProduct.first().locator(".wishlist-add-to-cart").click();
  await expect(page.locator('.wishlist .sm-product[data-wishlist-item-id="wishlist_item_direct"]')).toHaveCount(0);
  await expect(page.locator('.wishlist .sm-product[data-wishlist-item-id="wishlist_item_direct_duplicate"]')).toBeVisible();
  await expect(page.locator('.cart .sm-product[data-line-id="cali_direct"]')).toBeVisible();
  expect(calls).toEqual([
    "cart:variant_failing",
    "cart:variant_direct",
  ]);

  await page.route("**/medusa-wishlist/items", async (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ status: 502, json: { error: "wishlist_unavailable" } });
    }
    return route.fallback();
  });
  const cartProductOnWishlistFailure = page.locator('.cart .sm-product[data-line-id="cali_direct"]');
  await cartProductOnWishlistFailure.locator(".cart-wishlist-move-btn").click();
  await expect(cartProductOnWishlistFailure).toBeVisible();
  await expect(page.locator(".wishlist-state")).toHaveText("Impossible de déplacer ce produit vers la Wishlist.");
});

test("F-17 - contexte d'une ligne Wishlist sur la fiche produit", async ({ page }) => {
  test.skip(process.env.MVDW_FEATURE_WISHLIST === "false", "Ce scénario requiert wishlist=true.");

  const product = {
    id: "prod_wishlist_context",
    source: "medusa",
    name: "Context Hoodie",
    shortDes: "Produit de contexte",
    des: "Description",
    images: [],
    mediaByColor: {},
    options: [
      { id: "color", title: "Color", values: ["Gris", "Noir"] },
      { id: "size", title: "Size", values: ["M", "L"] },
    ],
    variants: [
      { id: "variant_gris_m", available: true, price: { amount: 20, originalAmount: 20, currencyCode: "eur" }, options: [{ optionId: "color", value: "Gris" }, { optionId: "size", value: "M" }] },
      { id: "variant_gris_l", available: true, price: { amount: 20, originalAmount: 20, currencyCode: "eur" }, options: [{ optionId: "color", value: "Gris" }, { optionId: "size", value: "L" }] },
      { id: "variant_noir_m", available: true, price: { amount: 20, originalAmount: 20, currencyCode: "eur" }, options: [{ optionId: "color", value: "Noir" }, { optionId: "size", value: "M" }] },
    ],
  };
  const cart = { id: "cart_context", currency_code: "eur", item_subtotal: 20, items: [] };
  const requests = [];

  await mockAuthenticatedCustomerSession(page);
  await page.route(`**/medusa-products/${product.id}`, (route) => route.fulfill({ json: product }));
  await page.route(`**/medusa-products/${product.id}/recommendations`, (route) => route.fulfill({ json: [] }));
  await page.route("**/medusa-wishlist/items/**", (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fulfill({ json: {
        wishlistItem: {
          id: "wi_context",
          productId: product.id,
          variantId: "variant_gris_m",
          selectedOptions: null,
        },
      } });
    }
    requests.push({ method: request.method(), url: request.url(), body: request.postDataJSON() });
    return route.fulfill({ json: { wishlistItem: { id: "wi_context" } } });
  });
  await page.route("**/medusa-wishlist/items", (route) => {
    requests.push({ method: route.request().method(), url: route.request().url(), body: route.request().postDataJSON() });
    return route.fulfill({ status: 201, json: { wishlistItem: { id: "wi_created" } } });
  });
  await page.route("**/medusa-cart/items", (route) => {
    requests.push({ method: route.request().method(), url: route.request().url(), body: route.request().postDataJSON() });
    return route.fulfill({ json: { cart, wishlistRemoved: true } });
  });

  await page.goto(`/products/${product.id}?wishlistItemId=wi_context`);
  await expect(page.locator('.color-radio-btn[data-option-value="Gris"]')).toHaveClass(/check/);
  await expect(page.locator('.size-radio-btn[data-option-value="M"]')).toHaveClass(/check/);
  await page.locator(".wishlist-btn").click();
  await expect(page.locator(".product-state")).toHaveText("Produit déjà en Wishlist.");
  expect(requests).toEqual([]);

  await page.locator('.size-radio-btn[data-option-value="L"]').click();
  await page.locator(".wishlist-btn").click();
  await expect(page.locator(".product-state")).toHaveText("Produit mis à jour.");
  expect(requests).toEqual([expect.objectContaining({
    method: "PUT",
    body: { productId: product.id, variantId: "variant_gris_l" },
  })]);

  await page.locator(".cart-btn").click();
  expect(requests.at(-1)).toEqual(expect.objectContaining({
    method: "POST",
    body: expect.objectContaining({ variantId: "variant_gris_l", wishlistItemId: "wi_context" }),
  }));

  requests.length = 0;
  await page.goto(`/products/${product.id}`);
  await page.locator('.size-radio-btn[data-option-value="M"]').click();
  await page.locator(".wishlist-btn").click();
  await page.locator(".cart-btn").click();
  expect(requests).toEqual([
    expect.objectContaining({ method: "POST", body: { productId: product.id, variantId: "variant_gris_m" } }),
    expect.objectContaining({ method: "POST", body: expect.not.objectContaining({ wishlistItemId: expect.anything() }) }),
  ]);
});

test("F-17 - une sélection partielle explicite reste attachée à sa ligne Wishlist", async ({ page }) => {
  test.skip(process.env.MVDW_FEATURE_WISHLIST === "false", "Ce scénario requiert wishlist=true.");

  const product = {
    id: "prod_wishlist_partial",
    source: "medusa",
    name: "Partial Hoodie",
    shortDes: "Produit avec préférence couleur",
    des: "Description",
    images: ["https://cdn.example/default.jpg"],
    mediaByColor: {
      Gris: [{ url: "https://cdn.example/gris.jpg" }],
      Noir: [{ url: "https://cdn.example/noir.jpg" }],
      Bleu: [{ url: "https://cdn.example/bleu.jpg" }],
    },
    options: [
      { id: "option_color", title: "Color", values: ["Gris", "Noir", "Bleu"] },
      { id: "option_size", title: "Size", values: ["M", "L"] },
    ],
    variants: [
      { id: "variant_gris_m", available: true, price: { amount: 20, originalAmount: 20, currencyCode: "eur" }, options: [{ optionId: "option_color", value: "Gris" }, { optionId: "option_size", value: "M" }] },
      { id: "variant_noir_l", available: true, price: { amount: 20, originalAmount: 20, currencyCode: "eur" }, options: [{ optionId: "option_color", value: "Noir" }, { optionId: "option_size", value: "L" }] },
      { id: "variant_bleu_m", available: true, price: { amount: 20, originalAmount: 20, currencyCode: "eur" }, options: [{ optionId: "option_color", value: "Bleu" }, { optionId: "option_size", value: "M" }] },
    ],
  };
  const requests = [];
  let cartPosts = 0;
  const partialItem = {
    id: "wi_partial",
    productId: product.id,
    variantId: null,
    selectedOptions: { option_color: "Noir" },
  };

  await mockAuthenticatedCustomerSession(page);
  await page.route(`**/medusa-products/${product.id}`, (route) => route.fulfill({ json: product }));
  await page.route(`**/medusa-products/${product.id}/recommendations`, (route) => route.fulfill({ json: [] }));
  await page.route("**/medusa-cart/current", (route) => route.fulfill({ json: { cart: null } }));
  await page.route("**/medusa-cart/items", (route) => {
    cartPosts += 1;
    return route.fulfill({ json: { cart: { id: "cart_partial", items: [] }, wishlistRemoved: true } });
  });
  await page.route("**/medusa-wishlist", (route) => route.fulfill({ json: {
    wishlist: {
      items: [{
        ...partialItem,
        image: "https://cdn.example/noir.jpg",
        product: {
          id: product.id,
          name: product.name,
          shortDes: product.shortDes,
          image: product.images[0],
          price: product.variants[0].price,
          options: product.options,
          variants: product.variants,
        },
      }],
    },
  }}));
  await page.route("**/medusa-wishlist/items/wi_partial", (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fulfill({ json: { wishlistItem: partialItem } });
    }
    requests.push({ method: request.method(), body: request.postDataJSON() });
    return route.fulfill({ json: { wishlistItem: partialItem } });
  });
  await page.route("**/medusa-wishlist/items", (route) => {
    requests.push({ method: route.request().method(), body: route.request().postDataJSON() });
    return route.fulfill({ status: 201, json: { wishlistItem: partialItem } });
  });

  await page.goto(`/products/${product.id}`);
  await expect(page.locator('.color-radio-btn[data-option-value="Gris"]')).toHaveClass(/check/);
  await expect(page.locator(".cart-btn")).toHaveText("Ajouter au panier");
  await expect(page.locator(".wishlist-btn")).toHaveText("Liste de souhaits");
  await expect(page.locator(".cart-btn")).toBeEnabled();
  await expect(page.locator(".cart-btn")).toHaveClass(/cart-btn-disabled/);
  await expect(page.locator(".cart-btn")).not.toHaveAttribute("aria-disabled");
  await expect(page.locator(".cart-btn")).toHaveAttribute("data-state", "incomplete");
  await expect(page.locator(".product-stock")).not.toHaveText("Sélectionnez toutes les options.");
  await page.locator('.color-radio-btn[data-option-value="Noir"]').click();
  await expect(page.locator(".cart-btn")).toBeEnabled();
  await expect(page.locator(".cart-btn")).toHaveClass(/cart-btn-disabled/);
  await expect(page.locator(".cart-btn")).not.toHaveAttribute("aria-disabled");
  await page.locator(".cart-btn").click();
  expect(cartPosts).toBe(0);
  const missingSizeButton = page.locator('.size-radio-btn[data-option-value="L"]');
  await expect(missingSizeButton).toHaveClass(/uncheck/);
  await expect(missingSizeButton).toHaveCSS("border-top-color", "rgb(242, 92, 58)");
  await expect(page.locator(".product-stock")).not.toHaveText("Sélectionnez toutes les options.");
  await page.locator(".wishlist-btn").click();
  await expect(page.locator(".wishlist-btn")).toHaveText("Ajouté");
  expect(requests).toEqual([{
    method: "POST",
    body: { productId: product.id, selectedOptions: { option_color: "Noir" } },
  }]);
  await page.locator('.color-radio-btn[data-option-value="Bleu"]').click();
  await expect(page.locator(".wishlist-btn")).toHaveText("Liste de souhaits");

  await page.goto("/cart");
  const partialCard = page.locator('.wishlist .sm-product[data-wishlist-item-id="wi_partial"]');
  await expect(partialCard.locator(".sm-product-img")).toHaveAttribute("src", "https://cdn.example/noir.jpg");
  await expect(partialCard.locator(".wishlist-add-to-cart")).toHaveCount(0);
  await Promise.all([
    page.waitForURL(`/products/${product.id}?wishlistItemId=wi_partial`),
    partialCard.locator(".wishlist-choose-options").click(),
  ]);
  await expect(page.locator('.color-radio-btn[data-option-value="Noir"]')).toHaveClass(/check/);
  await expect(page.locator('.size-radio-btn.check')).toHaveCount(0);
  await expect(page.locator(".cart-btn")).toBeEnabled();
  await expect(page.locator(".cart-btn")).toHaveClass(/cart-btn-disabled/);

  await page.locator(".wishlist-btn").click();
  await expect(page.locator(".product-state")).toHaveText("Produit déjà en Wishlist.");
  expect(requests).toHaveLength(1);

  await page.locator('.color-radio-btn[data-option-value="Bleu"]').click();
  await page.locator(".wishlist-btn").click();
  await expect(page.locator(".product-state")).toHaveText("Produit mis à jour.");
  expect(requests.at(-1)).toEqual({
    method: "PUT",
    body: { productId: product.id, selectedOptions: { option_color: "Bleu" } },
  });

  await page.locator('.size-radio-btn[data-option-value="M"]').click();
  await expect(page.locator(".cart-btn")).toBeEnabled();
  await expect(page.locator(".cart-btn")).not.toHaveClass(/cart-btn-disabled/);
  await expect(page.locator(".cart-btn")).not.toHaveAttribute("aria-disabled");
  await expect(page.locator(".cart-btn")).toHaveAttribute("data-state", "ready");
  await page.locator(".wishlist-btn").click();
  await expect(page.locator(".product-state")).toHaveText("Produit mis à jour.");
  expect(requests.at(-1)).toEqual({
    method: "PUT",
    body: { productId: product.id, variantId: "variant_bleu_m" },
  });
  await page.locator(".cart-btn").click();
  await expect(page.locator(".cart-btn")).toHaveText("Ajouté");
  expect(cartPosts).toBe(1);

  await page.locator('.color-radio-btn[data-option-value="Noir"]').click();
  await expect(page.locator(".cart-btn")).toHaveText("Ajouter au panier");
  await expect(page.locator(".cart-btn")).toHaveClass(/cart-btn-disabled/);
  await page.locator(".cart-btn").click();
  expect(cartPosts).toBe(1);
  await expect(page.locator('.size-radio-btn[data-option-value="L"]')).toHaveClass(/uncheck/);
  await page.locator('.size-radio-btn[data-option-value="L"]').click();
  await expect(page.locator(".cart-btn")).toHaveText("Ajouter au panier");
  await expect(page.locator(".cart-btn")).not.toHaveClass(/cart-btn-disabled/);
  await page.locator(".cart-btn").click();
  await expect(page.locator(".cart-btn")).toHaveText("Ajouté");
  expect(cartPosts).toBe(2);
});

test("F-17 - selected_options persiste, isole les lignes et protège les Customers réels", async ({ page, context }) => {
  test.skip(process.env.MVDW_FEATURE_WISHLIST === "false", "Ce scénario requiert wishlist=true.");

  const bootstrap = await playwrightRequest.newContext();
  const primaryCustomer = await createDirectMedusaCustomer(bootstrap, "primary");
  const otherCustomer = await createDirectMedusaCustomer(bootstrap, "other");
  const { product, colorOption, sizeOption, firstColor, secondColor } = await findProductWithColorMedia(bootstrap);
  await bootstrap.dispose();

  await context.addCookies([{
    name: "medusa_customer_token",
    value: primaryCustomer.token,
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);
  const defaultColor = product.options
    .find((option) => option.id === colorOption.id)
    .values.find((value) => product.variants.some((variant) => (
      variant.available && variant.price
      && variant.options.some((option) => option.optionId === colorOption.id && option.value === value)
    )));
  const partialColor = [firstColor, secondColor].find((color) => color !== defaultColor) || firstColor;
  const updatedColor = [firstColor, secondColor].find((color) => color !== partialColor);
  expect(partialColor).toBeTruthy();
  expect(updatedColor).toBeTruthy();

  await page.goto(`/products/${product.id}`);
  const saveWishlist = async () => {
    const responsePromise = page.waitForResponse((response) => (
      /\/medusa-wishlist\/items(?:\/[^/]+)?$/.test(new URL(response.url()).pathname)
      && ["POST", "PUT"].includes(response.request().method())
    ));
    await page.locator(".wishlist-btn").click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
  };
  await expect(page.locator(`.product-option-group[data-option-id="${colorOption.id}"] .option-radio-btn.check`)).toHaveCount(1);
  await saveWishlist();
  await expect(page.locator(".wishlist-btn")).toHaveText("Ajouté");

  await page.locator(`.product-option-group[data-option-id="${colorOption.id}"] .option-radio-btn[data-option-value="${partialColor}"]`).click();
  await saveWishlist();
  await saveWishlist();
  await page.locator(`.product-option-group[data-option-id="${colorOption.id}"] .option-radio-btn[data-option-value="${updatedColor}"]`).click();
  await saveWishlist();

  const savedWishlist = await page.request.get("/medusa-wishlist");
  expect(savedWishlist.status()).toBe(200);
  const savedItems = (await savedWishlist.json()).wishlist.items.filter((item) => item.product.id === product.id);
  const genericItem = savedItems.find((item) => item.variantId === null && item.selectedOptions === null);
  const partialItems = savedItems.filter((item) => item.variantId === null && item.selectedOptions?.[colorOption.id] === partialColor);
  const otherPartialItem = savedItems.find((item) => item.variantId === null && item.selectedOptions?.[colorOption.id] === updatedColor);
  expect(genericItem).toBeTruthy();
  expect(partialItems).toHaveLength(2);
  expect(new Set(partialItems.map((item) => item.id)).size).toBe(2);
  expect(otherPartialItem).toBeTruthy();
  const partialItem = partialItems[0];

  await page.goto("/cart");
  const partialCard = page.locator(`.wishlist .sm-product[data-wishlist-item-id="${partialItem.id}"]`);
  await expect(partialCard.locator(".wishlist-add-to-cart")).toHaveCount(0);
  await expect(partialCard.locator(".wishlist-choose-options")).toBeVisible();
  await expect(partialCard.locator(".sm-product-img")).toHaveAttribute("src", product.mediaByColor[partialColor][0].url);
  await page.reload();
  await expect(page.locator(`.wishlist .sm-product[data-wishlist-item-id="${partialItem.id}"] .sm-product-img`)).toHaveAttribute("src", product.mediaByColor[partialColor][0].url);

  await Promise.all([
    page.waitForURL(new RegExp(`/products/${product.id}\\?wishlistItemId=${partialItem.id}`)),
    partialCard.locator(".wishlist-choose-options").click(),
  ]);
  await expect(page.locator(`.product-option-group[data-option-id="${colorOption.id}"] .option-radio-btn[data-option-value="${partialColor}"]`)).toHaveClass(/check/);
  await expect(page.locator(`.product-option-group[data-option-id="${sizeOption.id}"] .option-radio-btn.check`)).toHaveCount(0);
  await page.locator(".wishlist-btn").click();
  await expect(page.locator(".product-state")).toHaveText("Produit déjà en Wishlist.");

  await page.locator(`.product-option-group[data-option-id="${colorOption.id}"] .option-radio-btn[data-option-value="${updatedColor}"]`).click();
  await saveWishlist();
  await expect(page.locator(".product-state")).toHaveText("Produit mis à jour.");

  let wishlistAfterUpdate = await page.request.get("/medusa-wishlist");
  let updatedItem = (await wishlistAfterUpdate.json()).wishlist.items.find((item) => item.id === partialItem.id);
  expect(updatedItem).toEqual(expect.objectContaining({ variantId: null, selectedOptions: { [colorOption.id]: updatedColor } }));

  const resolvedVariant = product.variants.find((variant) => (
    variant.available && variant.price
    && variant.options.some((option) => option.optionId === colorOption.id && option.value === updatedColor)
    && variant.options.some((option) => option.optionId === sizeOption.id)
  ));
  expect(resolvedVariant).toBeTruthy();
  const sizeValue = resolvedVariant.options.find((option) => option.optionId === sizeOption.id).value;
  await page.locator(`.product-option-group[data-option-id="${sizeOption.id}"] .option-radio-btn[data-option-value="${sizeValue}"]`).click();
  await saveWishlist();
  await expect(page.locator(".product-state")).toHaveText("Produit mis à jour.");

  wishlistAfterUpdate = await page.request.get("/medusa-wishlist");
  updatedItem = (await wishlistAfterUpdate.json()).wishlist.items.find((item) => item.id === partialItem.id);
  expect(updatedItem).toEqual(expect.objectContaining({ variantId: resolvedVariant.id, selectedOptions: null }));

  await page.goto("/cart");
  const fullCard = page.locator(`.wishlist .sm-product[data-wishlist-item-id="${partialItem.id}"]`);
  await expect(fullCard.locator(".wishlist-add-to-cart")).toBeVisible();
  await expect(fullCard.locator(".wishlist-variant-options")).toContainText(sizeValue);
  await expect(fullCard.locator(".sm-product-img")).toHaveAttribute("src", product.mediaByColor[updatedColor][0].url);

  const beforeInvalidUpdate = await page.request.get("/medusa-wishlist");
  const beforeInvalidItems = (await beforeInvalidUpdate.json()).wishlist.items.filter((item) => item.product.id === product.id);
  const invalidUpdate = await page.request.put(`/medusa-wishlist/items/${partialItem.id}`, {
    data: { productId: product.id, selectedOptions: { invalid_option: "invalid_value" } },
  });
  expect(invalidUpdate.status()).toBe(400);
  await expect(invalidUpdate.json()).resolves.toEqual({ error: "invalid_wishlist_item" });
  const afterInvalidUpdate = await page.request.get("/medusa-wishlist");
  expect((await afterInvalidUpdate.json()).wishlist.items.filter((item) => item.product.id === product.id)).toHaveLength(beforeInvalidItems.length);

  const foreignApi = await playwrightRequest.newContext({
    baseURL: bffBaseUrl,
    extraHTTPHeaders: { Cookie: `medusa_customer_token=${otherCustomer.token}` },
  });
  const foreignRead = await foreignApi.get(`/medusa-wishlist/items/${partialItem.id}`);
  expect(foreignRead.status()).toBe(404);
  const foreignUpdate = await foreignApi.put(`/medusa-wishlist/items/${partialItem.id}`, {
    data: { productId: product.id, selectedOptions: { [colorOption.id]: partialColor } },
  });
  expect(foreignUpdate.status()).toBe(404);
  await foreignApi.dispose();

  const finalWishlist = await page.request.get("/medusa-wishlist");
  const finalItem = (await finalWishlist.json()).wishlist.items.find((item) => item.id === partialItem.id);
  expect(finalItem).toEqual(expect.objectContaining({ variantId: resolvedVariant.id, selectedOptions: null }));
});

test("F-17 - wishlist désactivée", async ({ page }) => {
  test.skip(process.env.MVDW_FEATURE_WISHLIST !== "false", "Exécuter ce scénario avec MVDW_FEATURE_WISHLIST=false.");

  const cart = {
    id: "cart_wishlist_feature_off",
    currency_code: "eur",
    item_subtotal: 20,
    items: [{
      id: "line_wishlist_feature_off",
      product_id: "prod_wishlist_feature_off",
      variant_id: "variant_wishlist_feature_off",
      product_title: "Produit sans Wishlist",
      variant_title: "Unique",
      quantity: 1,
      unit_price: 20,
      total: 20,
    }],
  };
  const product = {
    id: "prod_wishlist_feature_off",
    source: "medusa",
    name: "Produit sans Wishlist",
    shortDes: "Description de test",
    des: "Produit utilisé pour vérifier la désactivation de Wishlist.",
    images: [],
    mediaByColor: {},
    tags: [],
    options: [],
    variants: [{
      id: "variant_wishlist_feature_off",
      available: true,
      price: { amount: 20, originalAmount: 20, currencyCode: "eur" },
      options: [],
    }],
  };
  let wishlistRequests = 0;

  await mockAuthenticatedCustomerSession(page);
  await page.route("**/medusa-cart/current", (route) => route.fulfill({ json: { cart } }));
  await page.route("**/medusa-wishlist", (route) => {
    wishlistRequests += 1;
    return route.fulfill({ status: 500, json: { error: "wishlist_should_not_be_requested" } });
  });
  await page.goto("/cart");
  await expect.poll(() => page.evaluate(() => window.storefrontConfig?.features?.wishlist)).toBe(false);
  await expect(page.locator(`.cart .sm-product[data-line-id="${cart.items[0].id}"]`)).toBeVisible();
  await expect(page.locator(".wishlist-section")).toBeHidden();
  await expect(page.locator(".cart-wishlist-move-btn")).toHaveCount(0);
  expect(wishlistRequests).toBe(0);

  await page.route(`**/medusa-products/${product.id}`, (route) => route.fulfill({ json: product }));
  await page.route(`**/medusa-products/${product.id}/recommendations`, (route) => route.fulfill({ json: [] }));
  await page.goto(`/products/${product.id}`);
  await expect(page.locator(".wishlist-btn")).toBeHidden();

  const response = await page.request.get("/medusa-wishlist");
  expect(response.status()).toBe(404);
  await expect(response.json()).resolves.toEqual({ error: "wishlist_disabled" });
});

test("F-17 - produit indisponible : Wishlist autorisée, Cart bloqué", async ({ page }) => {
  test.skip(process.env.MVDW_FEATURE_WISHLIST === "false", "Ce scénario requiert wishlist=true.");

  await mockAuthenticatedCustomerSession(page);
  const unavailableProduct = {
    id: "prod_unavailable_wishlist",
    source: "medusa",
    name: "Produit indisponible",
    shortDes: "Toutes les variantes sont indisponibles",
    des: "Produit de test",
    images: [],
    mediaByColor: {},
    options: [
      { id: "option_color", title: "Color", values: ["Noir"] },
      { id: "option_size", title: "Size", values: ["M"] },
    ],
    variants: [{
      id: "variant_unavailable_wishlist",
      available: false,
      price: { amount: 30, originalAmount: 30, currencyCode: "eur" },
      options: [
        { optionId: "option_color", value: "Noir" },
        { optionId: "option_size", value: "M" },
      ],
    }],
  };
  let cartPosts = 0;
  await page.route("**/medusa-products/prod_unavailable_wishlist", (route) => route.fulfill({ json: unavailableProduct }));
  await page.route("**/medusa-products/prod_unavailable_wishlist/recommendations", (route) => route.fulfill({ json: [] }));
  await page.route("**/medusa-cart/items", (route) => {
    cartPosts += 1;
    return route.fulfill({ status: 500, json: { error: "cart_should_not_be_called" } });
  });
  await page.route("**/medusa-wishlist/items", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ productId: unavailableProduct.id });
    return route.fulfill({ status: 201, json: { wishlist_item: { id: "wi_unavailable" } } });
  });

  await page.goto(`/products/${unavailableProduct.id}`);
  await expect(page.locator(".product-stock")).toHaveText("Rupture de stock");
  await expect(page.locator(".size-radio-btn")).toBeDisabled();
  await expect(page.locator(".cart-btn")).toBeDisabled();
  await expect(page.locator(".cart-btn")).toHaveClass(/cart-btn-disabled/);
  expect(cartPosts).toBe(0);
  await page.locator(".wishlist-btn").click();
  await expect(page.locator(".wishlist-btn")).toHaveText("Ajouté");
});

test("F-17 - un visiteur peut tenter d'enregistrer un produit indisponible sans écriture Wishlist", async ({ page }) => {
  test.skip(process.env.MVDW_FEATURE_WISHLIST === "false", "Ce scénario requiert wishlist=true.");

  const unavailableProduct = {
    id: "prod_unavailable_anonymous_wishlist",
    source: "medusa",
    name: "Produit indisponible anonyme",
    shortDes: "Toutes les variantes sont indisponibles",
    des: "Produit de test",
    images: [],
    mediaByColor: {},
    options: [
      { id: "option_color", title: "Color", values: ["Noir"] },
      { id: "option_size", title: "Size", values: ["M"] },
    ],
    variants: [{
      id: "variant_unavailable_anonymous_wishlist",
      available: false,
      price: { amount: 30, originalAmount: 30, currencyCode: "eur" },
      options: [
        { optionId: "option_color", value: "Noir" },
        { optionId: "option_size", value: "M" },
      ],
    }],
  };
  let wishlistWrites = 0;

  await page.addInitScript(() => sessionStorage.clear());
  await page.route(`**/medusa-products/${unavailableProduct.id}`, (route) => route.fulfill({ json: unavailableProduct }));
  await page.route(`**/medusa-products/${unavailableProduct.id}/recommendations`, (route) => route.fulfill({ json: [] }));
  await page.route("**/medusa-wishlist/items", (route) => {
    wishlistWrites += 1;
    return route.fulfill({ status: 500, json: { error: "wishlist_should_not_be_called" } });
  });

  await page.goto(`/products/${unavailableProduct.id}`);
  const wishlistButton = page.locator(".wishlist-btn");
  await expect(page.locator(".product-stock")).toHaveText("Rupture de stock");
  await expect(wishlistButton).toHaveClass(/wishlist-auth-required/);
  await expect(wishlistButton).toBeEnabled();
  await wishlistButton.click();
  await expect(page).toHaveURL(`/products/${unavailableProduct.id}`);
  await expect(page.locator(".product-state")).toHaveText("Connectez-vous pour utiliser la Wishlist.");
  expect(wishlistWrites).toBe(0);
});
