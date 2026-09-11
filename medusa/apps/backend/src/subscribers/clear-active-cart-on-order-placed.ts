import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateCustomersWorkflow } from "@medusajs/medusa/core-flows"

export default async function clearActiveCartOnOrderPlaced({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "cart.id", "customer.id", "customer.metadata"],
    filters: { id: data.id },
  })
  const order = orders[0] as typeof orders[number] & {
    cart?: {
      id: string
    }
    customer?: {
      id: string
      metadata?: Record<string, unknown> | null
    }
  }
  const cartId = order?.cart?.id
  const customer = order?.customer

  if (!cartId || !customer?.id || customer.metadata?.active_cart_id !== cartId) {
    return
  }

  await updateCustomersWorkflow(container).run({
    input: {
      selector: { id: customer.id },
      update: {
        metadata: { ...customer.metadata, active_cart_id: null },
      },
    },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
