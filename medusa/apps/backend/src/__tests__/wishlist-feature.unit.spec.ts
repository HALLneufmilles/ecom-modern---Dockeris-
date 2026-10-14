import { GET } from "../api/store/customers/me/wishlist/route"
import { POST } from "../api/store/customers/me/wishlist/items/route"
import { DELETE, GET as GET_ITEM, PUT } from "../api/store/customers/me/wishlist/items/[id]/route"
import removeProductWishlistItems from "../subscribers/remove-product-wishlist-items"
import { isWishlistFeatureEnabled } from "../config/wishlist-feature"
import {
  normalizeWishlistSelectedOptions,
  validateWishlistSelectedOptions,
} from "../workflows/wishlist/validate-wishlist-selection"

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

    for (const handler of [GET, POST, GET_ITEM, PUT, DELETE]) {
      const res = response()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ error: "wishlist_disabled" })
    }

    expect(scope.resolve).not.toHaveBeenCalled()
  })

  it("accepts only Product option selections belonging to the Product", async () => {
    const graph = jest.fn().mockResolvedValue({
      data: [{
        options: [{
          id: "opt_color",
          values: [{ value: "Noir" }, { value: "Bleu" }],
        }],
      }],
    })
    const container = { resolve: jest.fn(() => ({ graph })) }

    const selectedOptions = normalizeWishlistSelectedOptions({ opt_color: "Noir" })
    await expect(validateWishlistSelectedOptions(container, "prod_test", selectedOptions))
      .resolves.toEqual({ opt_color: "Noir" })
    await expect(validateWishlistSelectedOptions(container, "prod_test", { opt_color: "Inconnue" }))
      .rejects.toThrow("Selected option does not belong to product")
    expect(() => normalizeWishlistSelectedOptions({ opt_unknown: "" }))
      .toThrow("selected_options must contain option values")
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
