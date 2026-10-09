import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WISHLIST_MODULE } from "../../../../../modules/wishlist"
import type WishlistModuleService from "../../../../../modules/wishlist/service"
import { isWishlistFeatureEnabled } from "../../../../../config/wishlist-feature"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  if (!isWishlistFeatureEnabled()) {
    return res.status(404).json({ error: "wishlist_disabled" })
  }

  const service = req.scope.resolve(WISHLIST_MODULE) as WishlistModuleService
  const customerId = req.auth_context.actor_id
  const wishlist = (await service.listWishlists({ customer_id: customerId }))[0]
  const items = wishlist
    ? await service.listWishlistItems({ wishlist_id: wishlist.id })
    : []

  return res.json({ wishlist: wishlist ? { id: wishlist.id, items } : null })
}
