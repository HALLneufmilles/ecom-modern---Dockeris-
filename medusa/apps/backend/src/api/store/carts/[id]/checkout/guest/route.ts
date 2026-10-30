import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules, validateEmail } from "@medusajs/framework/utils"
import type { ICartModuleService } from "@medusajs/types"
import type { UpdateCartDataDTO } from "@medusajs/types/dist/cart/mutations"
import { refreshCartItemsWorkflow } from "@medusajs/medusa/core-flows"
import { canAccessGuestStoreCart } from "../../../../../guest-cart-access"

type GuestCheckoutBody = {
  email?: unknown
  shipping_address?: unknown
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const cartService = req.scope.resolve(Modules.CART) as ICartModuleService
  const [cart] = await cartService.listCarts({ id: req.params.id })

  if (!cart || !canAccessGuestStoreCart(req, cart)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
  }

  const body = req.body as GuestCheckoutBody
  if (
    typeof body.email !== "string"
    || !validateEmail(body.email)
    || !body.shipping_address
    || typeof body.shipping_address !== "object"
    || Array.isArray(body.shipping_address)
  ) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid guest checkout details")
  }

  await cartService.updateCarts(cart.id, {
    email: body.email,
    shipping_address: body.shipping_address as UpdateCartDataDTO["shipping_address"],
  })
  await refreshCartItemsWorkflow(req.scope).run({
    input: { cart_id: cart.id, force_tax_calculation: true },
  })

  return res.status(200).json({})
}
