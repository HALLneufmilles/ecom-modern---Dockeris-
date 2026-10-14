import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { isWishlistFeatureEnabled } from "../../../../../../../config/wishlist-feature"
import { WISHLIST_MODULE } from "../../../../../../../modules/wishlist"
import type WishlistModuleService from "../../../../../../../modules/wishlist/service"
import removeWishlistItemWorkflow from "../../../../../../../workflows/wishlist/remove-wishlist-item"
import updateWishlistItemWorkflow from "../../../../../../../workflows/wishlist/update-wishlist-item"

type PutWishlistItemBody = {
  product_id?: string
  variant_id?: string
  selected_options?: Record<string, string> | null
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  if (!isWishlistFeatureEnabled()) {
    return res.status(404).json({ error: "wishlist_disabled" })
  }

  const service = req.scope.resolve(WISHLIST_MODULE) as WishlistModuleService
  const wishlist = (await service.listWishlists({ customer_id: req.auth_context.actor_id }))[0]
  const item = wishlist
    ? (await service.listWishlistItems({ id: req.params.id, wishlist_id: wishlist.id }))[0]
    : undefined

  if (!item) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Wishlist item not found")
  }

  return res.json({ wishlist_item: item })
}

export async function PUT(
  req: AuthenticatedMedusaRequest<PutWishlistItemBody>,
  res: MedusaResponse
) {
  if (!isWishlistFeatureEnabled()) {
    return res.status(404).json({ error: "wishlist_disabled" })
  }

  if (typeof req.body.product_id !== "string" || !req.body.product_id
    || (req.body.variant_id !== undefined && (typeof req.body.variant_id !== "string" || !req.body.variant_id))
    || (req.body.variant_id && req.body.selected_options)) {
    return res.status(400).json({ error: "invalid_wishlist_item" })
  }

  const { result: item } = await updateWishlistItemWorkflow(req.scope).run({
    input: {
      customerId: req.auth_context.actor_id,
      itemId: req.params.id,
      productId: req.body.product_id,
      variantId: req.body.variant_id,
      selectedOptions: req.body.selected_options,
    },
  })

  return res.json({ wishlist_item: item })
}

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
