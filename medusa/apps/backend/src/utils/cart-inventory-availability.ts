import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  getVariantAvailability,
} from "@medusajs/framework/utils"

type CartLine = {
  id: string
  variant_id?: string | null
  quantity: number
}

type CartForInventory = {
  id: string
  sales_channel_id?: string | null
  items?: CartLine[] | null
}

type VariantForInventory = {
  id: string
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  product?: {
    sales_channels?: Array<{ id?: string | null } | null> | null
  } | null
}

type VariantAvailability = Record<string, {
  availability?: number | null
  sales_channel_id?: string | null
}>

export type CartInventoryLine = {
  line_id: string
  variant_id: string | null
  requested_quantity: number
  requested_variant_quantity: number | null
  available_quantity: number | null
  manage_inventory: boolean | null
  allow_backorder: boolean | null
  sufficient: boolean
  reason?: "missing_variant" | "missing_sales_channel" | "unavailable_in_sales_channel" | "insufficient_inventory"
}

export type CartInventoryAvailability = {
  cart_id: string
  sales_channel_id: string | null
  sufficient: boolean
  lines: CartInventoryLine[]
}

export const assessCartInventoryAvailability = ({
  cart,
  variants,
  availability,
}: {
  cart: CartForInventory
  variants: VariantForInventory[]
  availability: VariantAvailability
}): CartInventoryAvailability => {
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]))
  const requestedByVariant = new Map<string, number>()

  for (const item of cart.items || []) {
    if (!item.variant_id) continue
    requestedByVariant.set(
      item.variant_id,
      (requestedByVariant.get(item.variant_id) || 0) + Number(item.quantity || 0)
    )
  }

  const lines = (cart.items || []).map((item): CartInventoryLine => {
    const variantId = item.variant_id || null
    if (!variantId) {
      return {
        line_id: item.id,
        variant_id: null,
        requested_quantity: Number(item.quantity || 0),
        requested_variant_quantity: null,
        available_quantity: null,
        manage_inventory: null,
        allow_backorder: null,
        sufficient: false,
        reason: "missing_variant",
      }
    }

    const variant = variantsById.get(variantId)
    const requestedVariantQuantity = requestedByVariant.get(variantId) || 0
    const salesChannelId = cart.sales_channel_id || null
    const availableQuantity = availability[variantId]?.availability
    const manageInventory = variant?.manage_inventory === true
    const allowBackorder = variant?.allow_backorder === true

    if (!variant) {
      return {
        line_id: item.id,
        variant_id: variantId,
        requested_quantity: Number(item.quantity || 0),
        requested_variant_quantity: requestedVariantQuantity,
        available_quantity: null,
        manage_inventory: null,
        allow_backorder: null,
        sufficient: false,
        reason: "missing_variant",
      }
    }

    if (!salesChannelId) {
      return {
        line_id: item.id,
        variant_id: variantId,
        requested_quantity: Number(item.quantity || 0),
        requested_variant_quantity: requestedVariantQuantity,
        available_quantity: typeof availableQuantity === "number" ? availableQuantity : null,
        manage_inventory: manageInventory,
        allow_backorder: allowBackorder,
        sufficient: false,
        reason: "missing_sales_channel",
      }
    }

    const productIsInSalesChannel = (variant.product?.sales_channels || [])
      .some((salesChannel) => salesChannel?.id === salesChannelId)
    if (!productIsInSalesChannel) {
      return {
        line_id: item.id,
        variant_id: variantId,
        requested_quantity: Number(item.quantity || 0),
        requested_variant_quantity: requestedVariantQuantity,
        available_quantity: typeof availableQuantity === "number" ? availableQuantity : null,
        manage_inventory: manageInventory,
        allow_backorder: allowBackorder,
        sufficient: false,
        reason: "unavailable_in_sales_channel",
      }
    }

    const sufficient = !manageInventory
      || allowBackorder
      || (typeof availableQuantity === "number" && availableQuantity >= requestedVariantQuantity)

    return {
      line_id: item.id,
      variant_id: variantId,
      requested_quantity: Number(item.quantity || 0),
      requested_variant_quantity: requestedVariantQuantity,
      available_quantity: typeof availableQuantity === "number" ? availableQuantity : null,
      manage_inventory: manageInventory,
      allow_backorder: allowBackorder,
      sufficient,
      ...(!sufficient ? { reason: "insufficient_inventory" as const } : {}),
    }
  })

  return {
    cart_id: cart.id,
    sales_channel_id: cart.sales_channel_id || null,
    sufficient: lines.every((line) => line.sufficient),
    lines,
  }
}

export const getCartInventoryAvailability = async ({
  container,
  cart,
}: {
  container: MedusaContainer
  cart: CartForInventory
}): Promise<CartInventoryAvailability> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const variantIds = [...new Set((cart.items || [])
    .map((item) => item.variant_id)
    .filter((variantId): variantId is string => Boolean(variantId)))]
  const { data: variants } = variantIds.length
    ? await query.graph({
      entity: "variant",
      fields: ["id", "manage_inventory", "allow_backorder", "product.sales_channels.id"],
      filters: { id: variantIds },
    })
    : { data: [] }
  const availability = cart.sales_channel_id && variantIds.length
    ? await getVariantAvailability(query, {
      variant_ids: variantIds,
      sales_channel_id: cart.sales_channel_id,
    })
    : {}

  return assessCartInventoryAvailability({
    cart,
    variants: variants as VariantForInventory[],
    availability,
  })
}
