import { Modules } from "@medusajs/framework/utils"
import { GUEST_ORDER_ACCESS_MODULE } from "../../modules/guest-order-access"
import { retrieveGuestOrderForAccessToken } from "../guest-order-access"

const createContainer = ({
  accessGranted = true,
  order = {
    id: "order_guest",
    display_id: 42,
    status: "completed",
    customer_id: null,
    payment_status: "captured",
    fulfillment_status: "not_fulfilled",
    currency_code: "eur",
    total: 6000,
    email: "guest@example.test",
    shipping_address: { address_1: "Private address" },
    items: [{
      product_title: "Guest product",
      title: "Guest product / XL",
      variant_title: "XL",
      thumbnail: "https://example.test/product.jpg",
      quantity: 2,
      unit_price: 3000,
      metadata: { private: true },
    }],
  },
}: {
  accessGranted?: boolean
  order?: Record<string, unknown>
} = {}) => {
  const verifyGuestOrderAccess = jest.fn().mockResolvedValue(accessGranted)
  const retrieveOrder = jest.fn().mockResolvedValue(order)
  const resolve = jest.fn((key: string) => {
    if (key === GUEST_ORDER_ACCESS_MODULE) return { verifyGuestOrderAccess }
    if (key === Modules.ORDER) return { retrieveOrder }
    throw new Error(`Unexpected dependency: ${key}`)
  })

  return {
    container: { resolve } as any,
    retrieveOrder,
    verifyGuestOrderAccess,
  }
}

describe("guest Order access preparation", () => {
  it("returns only the safe guest Order projection after token verification", async () => {
    const { container, retrieveOrder, verifyGuestOrderAccess } = createContainer()

    const result = await retrieveGuestOrderForAccessToken(
      container,
      "order_guest",
      "valid-order-access-token"
    )

    expect(verifyGuestOrderAccess).toHaveBeenCalledWith("order_guest", "valid-order-access-token")
    expect(retrieveOrder).toHaveBeenCalledWith("order_guest", expect.objectContaining({
      relations: ["items"],
    }))
    expect(result).toEqual({
      id: "order_guest",
      display_id: 42,
      status: "completed",
      payment_status: "captured",
      fulfillment_status: "not_fulfilled",
      currency_code: "eur",
      total: 6000,
      items: [{
        product_title: "Guest product",
        title: "Guest product / XL",
        variant_title: "XL",
        thumbnail: "https://example.test/product.jpg",
        quantity: 2,
        unit_price: 3000,
      }],
    })
    expect(result).not.toHaveProperty("email")
    expect(result).not.toHaveProperty("shipping_address")
    expect(JSON.stringify(result)).not.toContain("private")
  })

  it("refuses absent, invalid, expired, revoked, cross-Order, and Cart HMAC values before reading an Order", async () => {
    for (const token of [
      undefined,
      "invalid-token",
      "expired-token",
      "revoked-token",
      "token-for-another-order",
      "v1.cart-proof.signature",
    ]) {
      const { container, retrieveOrder, verifyGuestOrderAccess } = createContainer({ accessGranted: false })

      await expect(retrieveGuestOrderForAccessToken(container, "order_guest", token)).resolves.toBeNull()
      expect(verifyGuestOrderAccess).toHaveBeenCalledWith("order_guest", token)
      expect(retrieveOrder).not.toHaveBeenCalled()
    }
  })

  it("does not accept an Order ID or an e-mail in place of a token", async () => {
    for (const token of ["order_guest", "guest@example.test"]) {
      const { container, retrieveOrder, verifyGuestOrderAccess } = createContainer({ accessGranted: false })

      await expect(retrieveGuestOrderForAccessToken(container, "order_guest", token)).resolves.toBeNull()
      expect(verifyGuestOrderAccess).toHaveBeenCalledWith("order_guest", token)
      expect(retrieveOrder).not.toHaveBeenCalled()
    }
  })

  it("keeps Customer and non-completed Orders closed even if token verification is mocked as successful", async () => {
    for (const order of [
      { id: "order_customer", status: "completed", customer_id: "cus_customer" },
      { id: "order_pending", status: "pending", customer_id: null },
    ]) {
      const { container } = createContainer({ order })

      await expect(retrieveGuestOrderForAccessToken(container, order.id, "valid-order-access-token"))
        .resolves.toBeNull()
    }
  })
})
