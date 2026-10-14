import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../../modules/wishlist"
import type WishlistModuleService from "../../modules/wishlist/service"
import {
  normalizeWishlistSelectedOptions,
  validateWishlistSelectedOptions,
  type WishlistSelectedOptions,
} from "./validate-wishlist-selection"

type UpdateWishlistItemInput = {
  customerId: string
  itemId: string
  productId: string
  variantId?: string
  selectedOptions?: WishlistSelectedOptions | null
}

const updateWishlistItemStep = createStep(
  "update-wishlist-item",
  async ({ customerId, itemId, productId, variantId, selectedOptions }: UpdateWishlistItemInput, { container }) => {
    const service = container.resolve(WISHLIST_MODULE) as WishlistModuleService
    const wishlist = (await service.listWishlists({ customer_id: customerId }))[0]
    const item = wishlist
      ? (await service.listWishlistItems({ id: itemId, wishlist_id: wishlist.id }))[0]
      : undefined

    if (!item) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Wishlist item not found")
    }

    if (item.product_id !== productId) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Wishlist item does not belong to product")
    }

    if (variantId && selectedOptions) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "A wishlist item cannot contain both a variant and selected options")
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    if (variantId) {
      const { data: variants } = await query.graph({
        entity: "product_variant",
        fields: ["id"],
        filters: { id: variantId, product_id: productId },
      })

      if (!variants.length) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "Variant does not belong to product")
      }
    }

    const normalizedSelectedOptions = normalizeWishlistSelectedOptions(selectedOptions)
    await validateWishlistSelectedOptions(container, productId, normalizedSelectedOptions)
    const updated = await service.updateWishlistItems({
      id: item.id,
      variant_id: variantId ?? null,
      selected_options: normalizedSelectedOptions,
    })
    return new StepResponse(updated)
  }
)

const updateWishlistItemWorkflow = createWorkflow(
  "update-wishlist-item",
  (input: UpdateWishlistItemInput) => {
    const item = updateWishlistItemStep(input)
    return new WorkflowResponse(item)
  }
)

export default updateWishlistItemWorkflow
