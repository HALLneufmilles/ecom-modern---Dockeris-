const { test, expect } = require("@playwright/test");

test("panier invité partagé entre deux onglets indépendants", async ({ context }) => {
  const firstTab = await context.newPage();
  await firstTab.goto("/");
  const variants = await firstTab.evaluate(async () => {
    const products = await fetch("/medusa-home-products").then((response) => response.json());
    const found = [];
    for (const product of products) {
      const details = await fetch(`/medusa-products/${encodeURIComponent(product.id)}`).then((response) => response.json());
      const variant = details.variants?.find((candidate) => candidate.available && candidate.price);
      if (variant) found.push({ id: variant.id, name: details.name });
      if (found.length === 2) break;
    }
    return found;
  });
  expect(variants).toHaveLength(2);

  const addItem = async (page, variantId) => page.evaluate(async (id) => {
    const response = await fetch("/medusa-cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId: sessionStorage.getItem("medusa_cart_id"), variantId: id, quantity: 1 }),
    });
    const data = await response.json();
    if (response.ok) sessionStorage.setItem("medusa_cart_id", data.cart.id);
    return { status: response.status, cart: data.cart };
  }, variantId);

  const firstAdd = await addItem(firstTab, variants[0].id);
  expect(firstAdd.status).toBe(200);

  const secondTab = await context.newPage();
  await secondTab.goto("/");
  expect(await secondTab.evaluate(() => sessionStorage.getItem("medusa_cart_id"))).toBeNull();
  const secondAdd = await addItem(secondTab, variants[1].id);
  expect(secondAdd.status).toBe(200);
  expect(secondAdd.cart.id).toBe(firstAdd.cart.id);

  await firstTab.goto("/cart");
  await firstTab.evaluate(() => sessionStorage.setItem("medusa_cart_id", "cart_stale_tab"));
  await firstTab.reload();
  for (const variant of variants) {
    await expect(firstTab.locator(".cart .sm-product-name").filter({ hasText: variant.name })).toHaveCount(1);
  }
  expect(await firstTab.evaluate(() => sessionStorage.getItem("medusa_cart_id"))).toBe(firstAdd.cart.id);

  await secondTab.goto("/cart");
  for (const variant of variants) {
    await expect(secondTab.locator(".cart .sm-product-name").filter({ hasText: variant.name })).toHaveCount(1);
  }
  expect(await secondTab.evaluate(() => localStorage.getItem("medusa_cart_id"))).toBeNull();
});
