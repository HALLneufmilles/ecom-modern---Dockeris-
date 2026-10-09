import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { isWishlistFeatureEnabled } from "../../../../../../config/wishlist-feature"
import addWishlistItemWorkflow from "../../../../../../workflows/wishlist/add-wishlist-item"

type PostWishlistItemBody = { product_id?: string }

export async function POST(
  req: AuthenticatedMedusaRequest<PostWishlistItemBody>,
  res: MedusaResponse
) {
  if (!isWishlistFeatureEnabled()) {
    return res.status(404).json({ error: "wishlist_disabled" })
  }

  if (!req.body.product_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "product_id is required")
  }

  const { result: item } = await addWishlistItemWorkflow(req.scope).run({
    input: {
      customerId: req.auth_context.actor_id,
      productId: req.body.product_id,
    },
  })

  return res.status(201).json({ wishlist_item: item })
}
