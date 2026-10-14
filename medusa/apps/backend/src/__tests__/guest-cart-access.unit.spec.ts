import { createHmac } from "crypto"
import {
  protectStoreCart,
  protectStoreCartPath,
  verifyGuestCartProof,
} from "../api/guest-cart-access"

const secret = "unit-test-secret-with-at-least-thirty-two-bytes"
const proofFor = (cartId: string, expiresAt: number) => {
  const payload = Buffer.from(JSON.stringify({ cartId, expiresAt })).toString("base64url")
  const signed = `v1.${payload}`
  return `${signed}.${createHmac("sha256", secret).update(signed).digest("base64url")}`
}

const response = () => {
  const res: any = { status: jest.fn(), json: jest.fn() }
  res.status.mockReturnValue(res)
  return res
}

describe("Store Cart ownership", () => {
  const previous = process.env.MVDW_GUEST_CART_SECRET

  beforeEach(() => { process.env.MVDW_GUEST_CART_SECRET = secret })
  afterAll(() => {
    if (previous === undefined) delete process.env.MVDW_GUEST_CART_SECRET
    else process.env.MVDW_GUEST_CART_SECRET = previous
  })

  it("accepts a guest proof only for its cart before expiry", () => {
    const now = Date.UTC(2026, 9, 11)
    const proof = proofFor("cart_guest", Math.floor(now / 1000) + 7 * 24 * 60 * 60)
    expect(verifyGuestCartProof(proof, "cart_guest", now)).toBe(true)
    expect(verifyGuestCartProof(proof, "cart_other", now)).toBe(false)
    expect(verifyGuestCartProof(proof, "cart_guest", now + 7 * 24 * 60 * 60 * 1000)).toBe(false)
    expect(verifyGuestCartProof(`${proof.slice(0, -1)}x`, "cart_guest", now)).toBe(false)
  })

  it("allows an authenticated owner and refuses anonymous or different Customers", async () => {
    const listCarts = jest.fn().mockResolvedValue([{ id: "cart_customer", customer_id: "cus_owner" }])
    const next = jest.fn()
    const base = { scope: { resolve: () => ({ listCarts }) }, headers: {} }

    const ownerRes = response()
    await protectStoreCart({ ...base, auth_context: { actor_type: "customer", actor_id: "cus_owner" } } as any, ownerRes, next, "cart_customer")
    expect(next).toHaveBeenCalledTimes(1)
    expect(ownerRes.status).not.toHaveBeenCalled()

    for (const context of [undefined, { actor_type: "customer", actor_id: "cus_other" }]) {
      const res = response()
      await protectStoreCart({ ...base, auth_context: context } as any, res, jest.fn(), "cart_customer")
      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ message: "Cart not found" })
    }
  })

  it("refuses a guest cart without a matching proof and a transferred cart with an old proof", async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60
    const proof = proofFor("cart_guest", expiresAt)
    const listCarts = jest.fn().mockResolvedValue([{ id: "cart_guest", customer_id: null }])
    const base = { originalUrl: "/store/carts/cart_guest/line-items", scope: { resolve: () => ({ listCarts }) } }
    const validReq = { ...base, headers: { cookie: `mvdw_guest_cart_proof=${proof}` } }
    const next = jest.fn()
    await protectStoreCartPath(validReq as any, response(), next)
    expect(next).toHaveBeenCalledTimes(1)

    const missingRes = response()
    await protectStoreCartPath({ ...base, headers: {} } as any, missingRes, jest.fn())
    expect(missingRes.status).toHaveBeenCalledWith(404)

    listCarts.mockResolvedValue([{ id: "cart_guest", customer_id: "cus_owner" }])
    const transferredRes = response()
    await protectStoreCartPath(validReq as any, transferredRes, jest.fn())
    expect(transferredRes.status).toHaveBeenCalledWith(404)
  })
})
