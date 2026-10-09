import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../../modules/wishlist"
import type WishlistModuleService from "../../modules/wishlist/service"

type AddWishlistItemInput = {
  customerId: string
  productId: string
}

const addWishlistItemStep = createStep(
  "add-wishlist-item",
  async ({ customerId, productId }: AddWishlistItemInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id"],
      filters: { id: productId },
    })

    if (!products.length) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
    }

    const service = container.resolve(WISHLIST_MODULE) as WishlistModuleService
    let wishlist = (await service.listWishlists({ customer_id: customerId }))[0]

    if (!wishlist) {
      wishlist = await service.createWishlists({ customer_id: customerId })
    }

    const existingItem = (await service.listWishlistItems({
      wishlist_id: wishlist.id,
      product_id: productId,
    }))[0]

    if (existingItem) {
      return new StepResponse(existingItem)
    }

    const item = await service.createWishlistItems({
      wishlist_id: wishlist.id,
      product_id: productId,
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
