import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../../modules/wishlist"
import type WishlistModuleService from "../../modules/wishlist/service"

type RemoveProductWishlistItemsInput = { productId: string }

const removeProductWishlistItemsStep = createStep(
  "remove-product-wishlist-items",
  async ({ productId }: RemoveProductWishlistItemsInput, { container }) => {
    const service = container.resolve(WISHLIST_MODULE) as WishlistModuleService
    const items = await service.listWishlistItems({ product_id: productId })

    if (items.length) {
      await service.deleteWishlistItems(items.map((item) => item.id))
    }

    return new StepResponse({ deleted: items.length })
  }
)

const removeProductWishlistItemsWorkflow = createWorkflow(
  "remove-product-wishlist-items",
  (input: RemoveProductWishlistItemsInput) => {
    const result = removeProductWishlistItemsStep(input)
    return new WorkflowResponse(result)
  }
)

export default removeProductWishlistItemsWorkflow
