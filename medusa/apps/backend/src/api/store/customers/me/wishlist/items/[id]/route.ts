import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isWishlistFeatureEnabled } from "../../../../../../../config/wishlist-feature"
import removeWishlistItemWorkflow from "../../../../../../../workflows/wishlist/remove-wishlist-item"

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  if (!isWishlistFeatureEnabled()) {
    return res.status(404).json({ error: "wishlist_disabled" })
  }

  const { result } = await removeWishlistItemWorkflow(req.scope).run({
    input: {
      customerId: req.auth_context.actor_id,
      itemId: req.params.id,
    },
  })

  return res.json({ deleted: result.id })
}
