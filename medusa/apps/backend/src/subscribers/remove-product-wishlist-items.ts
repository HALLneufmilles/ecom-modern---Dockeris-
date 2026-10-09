import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { isWishlistFeatureEnabled } from "../config/wishlist-feature"
import removeProductWishlistItemsWorkflow from "../workflows/wishlist/remove-product-wishlist-items"

export default async function removeProductWishlistItems({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (!isWishlistFeatureEnabled()) {
    return
  }

  await removeProductWishlistItemsWorkflow(container).run({
    input: { productId: data.id },
  })
}

export const config: SubscriberConfig = {
  event: "product.deleted",
}
