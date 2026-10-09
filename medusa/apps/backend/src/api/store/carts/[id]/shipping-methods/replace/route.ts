import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { ICartModuleService } from "@medusajs/types"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const cartService = req.scope.resolve(Modules.CART) as ICartModuleService
  const [cart] = await cartService.listCarts({
    id: req.params.id,
    customer_id: req.auth_context.actor_id,
  })

  if (!cart) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
  }

  const shippingMethods = await cartService.listShippingMethods({ cart_id: cart.id })
  if (shippingMethods.length) {
    await cartService.softDeleteShippingMethods(shippingMethods.map((method) => method.id))
  }

  return res.status(200).json({})
}
