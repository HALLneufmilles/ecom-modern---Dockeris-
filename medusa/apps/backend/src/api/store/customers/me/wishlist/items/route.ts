import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { isWishlistFeatureEnabled } from "../../../../../../config/wishlist-feature"
import addWishlistItemWorkflow from "../../../../../../workflows/wishlist/add-wishlist-item"

type PostWishlistItemBody = {
  product_id?: string
  variant_id?: string
  selected_options?: Record<string, string> | null
}

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

  if (req.body.variant_id !== undefined && (typeof req.body.variant_id !== "string" || !req.body.variant_id)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "variant_id must be a non-empty string")
  }

  if (req.body.variant_id && req.body.selected_options) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "variant_id and selected_options are mutually exclusive")
  }

  const { result: item } = await addWishlistItemWorkflow(req.scope).run({
    input: {
      customerId: req.auth_context.actor_id,
      productId: req.body.product_id,
      variantId: req.body.variant_id,
      selectedOptions: req.body.selected_options,
    },
  })

  return res.status(201).json({ wishlist_item: item })
}
