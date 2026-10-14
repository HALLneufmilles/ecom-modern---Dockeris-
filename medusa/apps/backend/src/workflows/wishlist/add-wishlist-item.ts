import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../../modules/wishlist"
import type WishlistModuleService from "../../modules/wishlist/service"
import {
  normalizeWishlistSelectedOptions,
  validateWishlistSelectedOptions,
  type WishlistSelectedOptions,
} from "./validate-wishlist-selection"

type AddWishlistItemInput = {
  customerId: string
  productId: string
  variantId?: string
  selectedOptions?: WishlistSelectedOptions | null
}

const addWishlistItemStep = createStep(
  "add-wishlist-item",
  async ({ customerId, productId, variantId, selectedOptions }: AddWishlistItemInput, { container }) => {
    if (variantId && selectedOptions) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "A wishlist item cannot contain both a variant and selected options")
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id"],
      filters: { id: productId },
    })

    if (!products.length) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
    }

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

    const service = container.resolve(WISHLIST_MODULE) as WishlistModuleService
    let wishlist = (await service.listWishlists({ customer_id: customerId }))[0]

    if (!wishlist) {
      wishlist = await service.createWishlists({ customer_id: customerId })
    }

    const item = await service.createWishlistItems({
      wishlist_id: wishlist.id,
      product_id: productId,
      variant_id: variantId ?? null,
      selected_options: normalizedSelectedOptions,
    })

    return new StepResponse(item)
  }
)

const addWishlistItemWorkflow = createWorkflow(
  "add-wishlist-item",
  (input: AddWishlistItemInput) => {
    const item = addWishlistItemStep(input)
    return new WorkflowResponse(item)
  }
)

export default addWishlistItemWorkflow
