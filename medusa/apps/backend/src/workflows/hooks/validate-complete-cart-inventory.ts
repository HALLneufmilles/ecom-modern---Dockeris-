import { MedusaError } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { getCartInventoryAvailability } from "../../utils/cart-inventory-availability"

completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  const inventory = await getCartInventoryAvailability({ container, cart })
  if (!inventory.sufficient) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "insufficient_inventory"
    )
  }
})
