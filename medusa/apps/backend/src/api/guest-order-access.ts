import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { IOrderModuleService } from "@medusajs/types"
import { GUEST_ORDER_ACCESS_MODULE } from "../modules/guest-order-access"
import type GuestOrderAccessModuleService from "../modules/guest-order-access/service"

type GuestOrderItemSource = {
  product_title?: string | null
  quantity?: number
  thumbnail?: string | null
  title?: string | null
  unit_price?: number
  variant_title?: string | null
}

type GuestOrderSource = {
  currency_code?: string
  customer_id?: string | null
  display_id?: number | null
  fulfillment_status?: string | null
  id: string
  items?: GuestOrderItemSource[]
  payment_status?: string | null
  status?: string
  total?: number
}

export type GuestOrderView = {
  currency_code: string
  display_id: number | null
  fulfillment_status: string | null
  id: string
  items: Array<{
    product_title: string | null
    quantity: number
    thumbnail: string | null
    title: string | null
    unit_price: number
    variant_title: string | null
  }>
  payment_status: string | null
  status: string
  total: number
}

const asFiniteNumber = (value: unknown): number => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const projectGuestOrder = (order: GuestOrderSource): GuestOrderView => ({
  id: order.id,
  display_id: order.display_id ?? null,
  status: order.status || "completed",
  payment_status: order.payment_status ?? null,
  fulfillment_status: order.fulfillment_status ?? null,
  currency_code: order.currency_code || "",
  total: asFiniteNumber(order.total),
  items: (order.items || []).map((item) => ({
    product_title: item.product_title ?? null,
    quantity: asFiniteNumber(item.quantity),
    thumbnail: item.thumbnail ?? null,
    title: item.title ?? null,
    unit_price: asFiniteNumber(item.unit_price),
    variant_title: item.variant_title ?? null,
  })),
})

// This is deliberately an internal helper. No Store or Express route calls it yet.
// A future route must add abuse controls before exposing guest token verification.
export const retrieveGuestOrderForAccessToken = async (
  container: MedusaContainer,
  orderId: unknown,
  token: unknown
): Promise<GuestOrderView | null> => {
  if (typeof orderId !== "string" || !orderId) return null

  const accessService = container.resolve<GuestOrderAccessModuleService>(
    GUEST_ORDER_ACCESS_MODULE
  )
  const accessGranted = await accessService.verifyGuestOrderAccess(orderId, token)
  if (!accessGranted) return null

  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
  const order = await orderService.retrieveOrder(orderId, {
    select: [
      "id",
      "display_id",
      "status",
      "customer_id",
      "payment_status",
      "fulfillment_status",
      "currency_code",
      "total",
    ],
    relations: ["items"],
  }) as unknown as GuestOrderSource

  // Keep the guest and completed constraints at the retrieval boundary as well.
  if (order.status !== "completed" || order.customer_id) return null

  return projectGuestOrder(order)
}
