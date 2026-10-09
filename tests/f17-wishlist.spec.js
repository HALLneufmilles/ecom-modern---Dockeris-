const { test, expect } = require("@playwright/test");

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

  await signup(page, email, password);
  expect(await page.evaluate(() => localStorage.getItem("wishlist"))).toBeNull();

  const productId = await page.evaluate(async () => {
    const products = await fetch("/medusa-home-products").then((response) => response.json());
    for (const product of products) {
      const detail = await fetch(`/medusa-products/${product.id}`).then((response) => response.json());
      if (detail.source === "medusa" && detail.options.some((option) => (
        ["size", "taille"].includes(option.title.toLowerCase())
      ))) return detail.id;
    }
    return null;
  });
  expect(productId).not.toBeNull();

  await page.goto(`/products/${productId}`);
  const wishlistButton = page.locator(".wishlist-btn");
  await expect(wishlistButton).toBeVisible();

  await page.locator(".cart-btn").click();
  await expect(page.locator(".size-radio-btn.uncheck").first()).toBeVisible();

  const wishlistRequest = page.waitForRequest((request) => (
    request.url().endsWith("/medusa-wishlist/items") && request.method() === "POST"
  ));
  await wishlistButton.click();
  const request = await wishlistRequest;

  expect(request.postDataJSON()).toEqual({ productId });
  await expect(wishlistButton).toHaveText("added");
  expect(await page.evaluate(() => localStorage.getItem("wishlist"))).toBeNull();

  const savedWishlist = await page.evaluate(async () => (
    fetch("/medusa-wishlist").then((response) => response.json())
  ));
  expect(savedWishlist.wishlist.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ product: expect.objectContaining({ id: productId }) }),
  ]));

  await page.reload();
  const reloadedWishlist = await page.evaluate(async () => (
    fetch("/medusa-wishlist").then((response) => response.json())
  ));
  expect(reloadedWishlist.wishlist.items).toHaveLength(1);

  await page.locator("#user-img").click();
  await page.locator("#user-btn").click();
  await expect(page.locator("#user-btn")).toHaveText(/log in/i);
  await login(page, email, password);

  await page.goto("/cart");
  const wishlistProduct = page.locator(".wishlist .sm-product").first();
  await expect(wishlistProduct).toBeVisible();
  await expect(wishlistProduct.locator(".sm-product-name")).not.toHaveText("");

  const deleteResponse = page.waitForResponse((response) => (
    /\/medusa-wishlist\/items\/[^/]+$/.test(new URL(response.url()).pathname)
    && response.request().method() === "DELETE"
  ));
  await wishlistProduct.locator(".sm-delete-btn").click();
  expect((await deleteResponse).status()).toBe(204);
  await expect(page.locator(".wishlist .empty-img")).toBeVisible();
});

test("F-17 - wishlist désactivée", async ({ page }) => {
  test.skip(process.env.MVDW_FEATURE_WISHLIST !== "false", "Exécuter ce scénario avec MVDW_FEATURE_WISHLIST=false.");

  await page.goto("/cart");
  await expect(page.locator(".wishlist-section")).toBeHidden();

  const response = await page.request.get("/medusa-wishlist");
  expect(response.status()).toBe(404);
  await expect(response.json()).resolves.toEqual({ error: "wishlist_disabled" });
});
