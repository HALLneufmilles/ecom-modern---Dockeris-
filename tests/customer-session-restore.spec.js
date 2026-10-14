const { test, expect, request: playwrightRequest } = require("@playwright/test");
require("dotenv").config();

const bffBaseUrl = "http://127.0.0.1:5000";
const medusaBaseUrl = "http://127.0.0.1:9000";
const storeKey = process.env.MEDUSA_PUBLISHABLE_API_KEY;

const createMedusaCustomer = async (api) => {
  expect(storeKey).toBeTruthy();
  const email = `customer-session-${Date.now()}@example.test`;
  const password = "CustomerSession123!";
  const headers = { "x-publishable-api-key": storeKey };
  const registration = await api.post(`${medusaBaseUrl}/auth/customer/emailpass/register`, {
    headers,
    data: { email, password },
  });
  expect(registration.status()).toBe(200);
  const registrationToken = (await registration.json()).token;
  expect(registrationToken).toBeTruthy();

  const customer = await api.post(`${medusaBaseUrl}/store/customers`, {
    headers: { ...headers, Authorization: `Bearer ${registrationToken}` },
    data: { email, first_name: "Customer", last_name: "Session" },
  });
  expect(customer.status()).toBe(200);

  const login = await api.post(`${medusaBaseUrl}/auth/customer/emailpass`, {
    headers,
    data: { email, password },
  });
  expect(login.status()).toBe(200);
  return { email, token: (await login.json()).token };
};

const findPurchasableProduct = async (api) => {
  const home = await api.get(`${bffBaseUrl}/medusa-home-products`);
  expect(home.status()).toBe(200);
  for (const card of await home.json()) {
    const details = await api.get(`${bffBaseUrl}/medusa-products/${encodeURIComponent(card.id)}`);
    if (!details.ok()) continue;
    const product = await details.json();
    const variant = product.variants?.find((candidate) => candidate.available && candidate.price);
    if (variant) return { product, variant };
  }
  throw new Error("A purchasable Medusa product is required for customer-session restoration coverage");
};

const installCustomerCookie = async (context, token) => context.addCookies([{
  name: "medusa_customer_token",
  value: token,
  domain: "127.0.0.1",
  path: "/",
  httpOnly: true,
  secure: false,
  sameSite: "Lax",
}]);

test("Customer session restoration keeps Cart, Wishlist and navigation coherent after reload", async ({ page, context }) => {
  test.skip(process.env.MVDW_FEATURE_WISHLIST === "false", "This scenario requires wishlist=true.");

  const api = await playwrightRequest.newContext();
  const customer = await createMedusaCustomer(api);
  const { product, variant } = await findPurchasableProduct(api);
  const customerApi = await playwrightRequest.newContext({
    baseURL: bffBaseUrl,
    extraHTTPHeaders: { Cookie: `medusa_customer_token=${customer.token}` },
  });
  expect((await customerApi.post("/medusa-wishlist/items", { data: { productId: product.id } })).status()).toBe(201);
  expect((await customerApi.post("/medusa-cart/items", { data: { variantId: variant.id, quantity: 1 } })).status()).toBe(200);
  await customerApi.dispose();
  await api.dispose();

  await installCustomerCookie(context, customer.token);
  await page.addInitScript(() => sessionStorage.removeItem("user"));
  await page.goto("/cart");

  await expect(page.locator("#user-btn")).toHaveText(/log out/i);
  await expect(page.locator(".cart .sm-product")).toHaveCount(1);
  await expect(page.locator(".wishlist .sm-product")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("user"))?.email)).toBe(customer.email);

  await page.reload();
  await expect(page.locator("#user-btn")).toHaveText(/log out/i);
  await expect(page.locator(".cart .sm-product")).toHaveCount(1);
  await expect(page.locator(".wishlist .sm-product")).toHaveCount(1);
});

test("Customer session restoration clears stale UI cache after Medusa rejects the cookie", async ({ page, context }) => {
  await installCustomerCookie(context, "invalid-customer-token");
  await page.addInitScript(() => {
    sessionStorage.setItem("user", JSON.stringify({ name: "Stale", email: "stale@example.test" }));
  });
  await page.goto("/cart");

  await expect(page.locator("#user-btn")).toHaveText(/log in/i);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("user"))).toBeNull();
  await expect(page.locator(".wishlist .sm-product")).toHaveCount(0);
  expect((await context.cookies()).some((cookie) => cookie.name === "medusa_customer_token")).toBe(false);
});

test("A temporary customer-session failure does not clear the UI cache as a 401 would", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("user", JSON.stringify({ name: "Cached", email: "cached@example.test" }));
  });
  await page.route("**/medusa-customer/session", (route) => route.fulfill({
    status: 503,
    json: { error: "customer_session_unavailable" },
  }));
  await page.goto("/cart");

  await expect(page.locator(".account-info")).toHaveText("account temporarily unavailable");
  await expect(page.locator("#user-btn")).toBeDisabled();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("user"))?.email)).toBe("cached@example.test");
});
