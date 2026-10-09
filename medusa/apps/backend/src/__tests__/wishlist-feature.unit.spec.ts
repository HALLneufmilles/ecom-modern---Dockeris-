import { GET } from "../api/store/customers/me/wishlist/route"
import { POST } from "../api/store/customers/me/wishlist/items/route"
import { DELETE } from "../api/store/customers/me/wishlist/items/[id]/route"
import removeProductWishlistItems from "../subscribers/remove-product-wishlist-items"
import { isWishlistFeatureEnabled } from "../config/wishlist-feature"

const response = () => {
  const res: any = {
    status: jest.fn(),
    json: jest.fn(),
  }
  res.status.mockReturnValue(res)
  return res
}

describe("wishlist feature flag", () => {
  const originalWishlistFeature = process.env.MVDW_FEATURE_WISHLIST

  beforeEach(() => {
    process.env.MVDW_FEATURE_WISHLIST = "false"
  })

  afterAll(() => {
    if (originalWishlistFeature === undefined) {
      delete process.env.MVDW_FEATURE_WISHLIST
      return
    }

    process.env.MVDW_FEATURE_WISHLIST = originalWishlistFeature
  })

  it("is disabled only when explicitly configured as false", () => {
    expect(isWishlistFeatureEnabled()).toBe(false)

    process.env.MVDW_FEATURE_WISHLIST = "true"
    expect(isWishlistFeatureEnabled()).toBe(true)
  })

  it("makes every wishlist route unavailable before resolving a service or workflow", async () => {
    const scope = { resolve: jest.fn() }
    const req = {
      scope,
      auth_context: { actor_id: "cus_test" },
      body: { product_id: "prod_test" },
      params: { id: "witem_test" },
    } as any

    for (const handler of [GET, POST, DELETE]) {
      const res = response()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ error: "wishlist_disabled" })
    }

    expect(scope.resolve).not.toHaveBeenCalled()
  })

  it("does not run the product-deletion subscriber when disabled", async () => {
    const container = { resolve: jest.fn() }

    await removeProductWishlistItems({
      event: { data: { id: "prod_test" } },
      container,
    } as any)

    expect(isWishlistFeatureEnabled()).toBe(false)
    expect(container.resolve).not.toHaveBeenCalled()
  })
})
