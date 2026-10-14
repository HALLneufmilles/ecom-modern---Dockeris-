const { createHmac, timingSafeEqual } = require("crypto");

const GUEST_CART_COOKIE = "mvdw_guest_cart_proof";
const GUEST_CART_PROOF_SECONDS = 7 * 24 * 60 * 60;

const getGuestCartSecret = () => {
  const secret = process.env.MVDW_GUEST_CART_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("MVDW_GUEST_CART_SECRET must contain at least 32 bytes");
  }
  return secret;
};

const signGuestCart = (cartId, now = Date.now()) => {
  const payload = Buffer.from(JSON.stringify({
    cartId,
    expiresAt: Math.floor(now / 1000) + GUEST_CART_PROOF_SECONDS,
  })).toString("base64url");
  const signed = `v1.${payload}`;
  const signature = createHmac("sha256", getGuestCartSecret()).update(signed).digest("base64url");
  return `${signed}.${signature}`;
};

const getGuestCartId = (proof, now = Date.now()) => {
  if (typeof proof !== "string" || proof.length > 512) return null;
  const parts = proof.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;

  let expected;
  try {
    expected = createHmac("sha256", getGuestCartSecret())
      .update(`${parts[0]}.${parts[1]}`).digest();
    const provided = Buffer.from(parts[2], "base64url");
    if (provided.toString("base64url") !== parts[2]
      || provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.cartId === "string" && payload.cartId.length > 0
      && Number.isSafeInteger(payload.expiresAt)
      && payload.expiresAt > Math.floor(now / 1000)
      && payload.expiresAt <= Math.floor(now / 1000) + GUEST_CART_PROOF_SECONDS
      ? payload.cartId : null;
  } catch {
    return null;
  }
};

const verifyGuestCart = (proof, cartId, now = Date.now()) =>
  typeof cartId === "string" && getGuestCartId(proof, now) === cartId;

module.exports = { GUEST_CART_COOKIE, GUEST_CART_PROOF_SECONDS, signGuestCart, verifyGuestCart, getGuestCartId };
