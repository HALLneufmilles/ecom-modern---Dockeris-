const { test } = require("node:test");
const assert = require("node:assert/strict");
const { signGuestCart, verifyGuestCart, getGuestCartId } = require("../guest-cart-proof");

test("guest cart proof is bound to one cart and expires after seven days", () => {
  const previous = process.env.MVDW_GUEST_CART_SECRET;
  process.env.MVDW_GUEST_CART_SECRET = "unit-test-secret-with-at-least-thirty-two-bytes";
  try {
    const createdAt = Date.UTC(2026, 9, 11);
    const proof = signGuestCart("cart_guest", createdAt);
    assert.equal(verifyGuestCart(proof, "cart_guest", createdAt), true);
    assert.equal(getGuestCartId(proof, createdAt), "cart_guest");
    assert.equal(verifyGuestCart(proof, "cart_other", createdAt), false);
    assert.equal(getGuestCartId(proof, createdAt + 7 * 24 * 60 * 60 * 1000), null);
    assert.equal(verifyGuestCart(proof, "cart_guest", createdAt + 7 * 24 * 60 * 60 * 1000), false);
    assert.equal(verifyGuestCart(`${proof.slice(0, -1)}x`, "cart_guest", createdAt), false);
    assert.equal(getGuestCartId(`${proof.slice(0, -1)}x`, createdAt), null);
    assert.equal(getGuestCartId(null, createdAt), null);
    assert.equal(verifyGuestCart(null, "cart_guest", createdAt), false);
  } finally {
    if (previous === undefined) delete process.env.MVDW_GUEST_CART_SECRET;
    else process.env.MVDW_GUEST_CART_SECRET = previous;
  }
});

test("guest cart proof cannot be issued without a stable server secret", () => {
  const previous = process.env.MVDW_GUEST_CART_SECRET;
  delete process.env.MVDW_GUEST_CART_SECRET;
  try {
    assert.throws(() => signGuestCart("cart_guest"), /MVDW_GUEST_CART_SECRET/);
  } finally {
    if (previous !== undefined) process.env.MVDW_GUEST_CART_SECRET = previous;
  }
});
