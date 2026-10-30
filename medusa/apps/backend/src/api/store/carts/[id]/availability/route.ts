import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getCartInventoryAvailability } from "../../../../../utils/cart-inventory-availability"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "sales_channel_id", "items.id", "items.variant_id", "items.quantity"],
    filters: { id: req.params.id },
    pagination: { take: 1 },
  })
  const cart = carts[0]
  if (!cart) return res.status(404).json({ message: "Cart not found" })

  const inventory = await getCartInventoryAvailability({
    container: req.scope,
    cart,
  })
  return res.json({ inventory })
}
