import { assessCartInventoryAvailability } from "../cart-inventory-availability"

const cart = (items: Array<{ id: string, variant_id: string, quantity: number }>) => ({
  id: "cart_test",
  sales_channel_id: "sc_store",
  items,
})

const variant = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  manage_inventory: true,
  allow_backorder: false,
  product: { sales_channels: [{ id: "sc_store" }] },
  ...overrides,
})

describe("cart inventory availability", () => {
  it("accepts a managed variant when the requested quantity is available", () => {
    const result = assessCartInventoryAvailability({
      cart: cart([{ id: "line_1", variant_id: "variant_1", quantity: 2 }]),
      variants: [variant("variant_1")],
      availability: { variant_1: { availability: 2, sales_channel_id: "sc_store" } },
    })

    expect(result.sufficient).toBe(true)
    expect(result.lines[0]).toMatchObject({ available_quantity: 2, requested_variant_quantity: 2 })
  })

  it("reports a managed variant whose requested quantity exceeds availability without mutating the Cart", () => {
    const sourceCart = cart([{ id: "line_1", variant_id: "variant_1", quantity: 2 }])
    const result = assessCartInventoryAvailability({
      cart: sourceCart,
      variants: [variant("variant_1")],
      availability: { variant_1: { availability: 1, sales_channel_id: "sc_store" } },
    })

    expect(result).toMatchObject({ sufficient: false })
    expect(result.lines[0]).toMatchObject({ reason: "insufficient_inventory", available_quantity: 1 })
    expect(sourceCart.items[0].quantity).toBe(2)
  })

  it("reports zero stock, accepts unmanaged inventory, and accepts configured backorders", () => {
    const lines = [
      { id: "zero", variant_id: "zero", quantity: 1 },
      { id: "unmanaged", variant_id: "unmanaged", quantity: 3 },
      { id: "backorder", variant_id: "backorder", quantity: 4 },
    ]
    const result = assessCartInventoryAvailability({
      cart: cart(lines),
      variants: [
        variant("zero"),
        variant("unmanaged", { manage_inventory: false }),
        variant("backorder", { allow_backorder: true }),
      ],
      availability: {
        zero: { availability: 0, sales_channel_id: "sc_store" },
        unmanaged: { availability: 0, sales_channel_id: "sc_store" },
        backorder: { availability: 0, sales_channel_id: "sc_store" },
      },
    })

    expect(result.lines.map((line) => line.sufficient)).toEqual([false, true, true])
    expect(result.lines[0]).toMatchObject({ reason: "insufficient_inventory", available_quantity: 0 })
  })

  it("aggregates quantities of repeated variants and rejects variants outside the Cart sales channel", () => {
    const result = assessCartInventoryAvailability({
      cart: cart([
        { id: "line_1", variant_id: "shared", quantity: 1 },
        { id: "line_2", variant_id: "shared", quantity: 2 },
        { id: "line_3", variant_id: "other_channel", quantity: 1 },
      ]),
      variants: [
        variant("shared"),
        variant("other_channel", { product: { sales_channels: [{ id: "sc_other" }] } }),
      ],
      availability: {
        shared: { availability: 2, sales_channel_id: "sc_store" },
        other_channel: { availability: 10, sales_channel_id: "sc_store" },
      },
    })

    expect(result.sufficient).toBe(false)
    expect(result.lines[0]).toMatchObject({ requested_variant_quantity: 3, reason: "insufficient_inventory" })
    expect(result.lines[1]).toMatchObject({ requested_variant_quantity: 3, reason: "insufficient_inventory" })
    expect(result.lines[2]).toMatchObject({ reason: "unavailable_in_sales_channel" })
  })
})
