import { MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../../modules/wishlist"
import type WishlistModuleService from "../../modules/wishlist/service"

type RemoveWishlistItemInput = {
  customerId: string
  itemId: string
}

const removeWishlistItemStep = createStep(
  "remove-wishlist-item",
  async ({ customerId, itemId }: RemoveWishlistItemInput, { container }) => {
    const service = container.resolve(WISHLIST_MODULE) as WishlistModuleService
    const wishlist = (await service.listWishlists({ customer_id: customerId }))[0]
    const item = wishlist
      ? (await service.listWishlistItems({ id: itemId, wishlist_id: wishlist.id }))[0]
      : undefined

    if (!item) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Wishlist item not found")
    }

    await service.deleteWishlistItems(item.id)
    return new StepResponse({ id: item.id })
  }
)

const removeWishlistItemWorkflow = createWorkflow(
  "remove-wishlist-item",
  (input: RemoveWishlistItemInput) => {
    const item = removeWishlistItemStep(input)
    return new WorkflowResponse(item)
  }
)

export default removeWishlistItemWorkflow
