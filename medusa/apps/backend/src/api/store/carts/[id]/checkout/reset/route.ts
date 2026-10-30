import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { ICartModuleService } from "@medusajs/types"
import { refreshCartItemsWorkflow, updateCartWorkflow } from "@medusajs/medusa/core-flows"
import { canAccessGuestStoreCart, canAccessStoreCart } from "../../../../../guest-cart-access"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const cartService = req.scope.resolve(Modules.CART) as ICartModuleService
  const [cart] = await cartService.listCarts({
    id: req.params.id,
  })

  const guestAccess = !!cart && canAccessGuestStoreCart(req, cart)
  if (!cart || (!guestAccess && !canAccessStoreCart(req, cart))) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
  }

  if (guestAccess) {
    await cartService.updateCarts(cart.id, { shipping_address: null })
    await refreshCartItemsWorkflow(req.scope).run({
      input: { cart_id: cart.id, force_tax_calculation: true },
    })
  } else {
    await updateCartWorkflow(req.scope).run({
      input: {
        id: cart.id,
        shipping_address: null,
      },
    })
  }

  const shippingMethods = await cartService.listShippingMethods({ cart_id: cart.id })
  if (shippingMethods.length) {
    await cartService.softDeleteShippingMethods(shippingMethods.map((method) => method.id))
  }

  return res.status(200).json({})
}
