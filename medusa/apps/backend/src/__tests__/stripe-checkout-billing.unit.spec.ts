import Stripe from "stripe"
import { updateCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules, PaymentWebhookEvents } from "@medusajs/framework/utils"
import { POST, mapStripeBillingAddress } from "../api/hooks/stripe-checkout/route"

jest.mock("@medusajs/medusa/core-flows", () => ({
  updateCartWorkflow: jest.fn(),
}))

const TEST_API_KEY = "sk_test_not_a_real_key"
const TEST_WEBHOOK_SECRET = "whsec_not_a_real_secret"

const stripe = new Stripe(TEST_API_KEY)

const checkoutSession = (overrides: Record<string, unknown> = {}) => ({
  id: "cs_test_billing",
  object: "checkout.session",
  client_reference_id: "cart_test",
  metadata: { medusa_cart_id: "cart_test" },
  payment_status: "paid",
  payment_method_types: ["card"],
  customer_details: {
    name: "Jean Claude Van Damme",
    phone: "+33123456789",
    address: {
      line1: "10 rue Stripe",
      line2: "Bâtiment B",
      city: "Paris",
      postal_code: "75001",
      state: "Île-de-France",
      country: "FR",
    },
  },
  ...overrides,
})

const signedRequest = ({
  session = checkoutSession(),
  type = "checkout.session.completed",
  graph = jest.fn().mockResolvedValue({
    data: [{ id: "cart_test", completed_at: null, order: null }],
  }),
  emit = jest.fn().mockResolvedValue(undefined),
  paymentOptions = {
    webhook_delay: 10,
    webhook_retries: 2,
  } as { webhook_delay?: number; webhook_retries?: number } | null,
}: {
  session?: Record<string, unknown>
  type?: string
  graph?: jest.Mock
  emit?: jest.Mock
  paymentOptions?: { webhook_delay?: number; webhook_retries?: number } | null
} = {}) => {
  const event = {
    id: "evt_test_billing",
    object: "event",
    type,
    data: { object: session },
  }
  const payload = JSON.stringify(event)
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: TEST_WEBHOOK_SECRET,
  })
  const payment = paymentOptions ? { options: paymentOptions } : {}
  const scope = {
    resolve: jest.fn((key) => {
      if (key === ContainerRegistrationKeys.QUERY) return { graph }
      if (key === Modules.EVENT_BUS) return { emit }
      if (key === Modules.PAYMENT) return payment
      throw new Error(`Unexpected dependency: ${String(key)}`)
    }),
  }
  return {
    req: {
      body: event,
      rawBody: Buffer.from(payload),
      headers: { "stripe-signature": signature },
      scope,
    } as any,
    graph,
    emit,
  }
}

const response = () => {
  const res: any = {
    status: jest.fn(),
    send: jest.fn(),
    sendStatus: jest.fn(),
  }
  res.status.mockReturnValue(res)
  res.send.mockReturnValue(res)
  res.sendStatus.mockReturnValue(res)
  return res
}

describe("Stripe Checkout billing-address webhook", () => {
  const run = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.STRIPE_API_KEY = TEST_API_KEY
    process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET
    ;(updateCartWorkflow as unknown as jest.Mock).mockReturnValue({ run })
    run.mockResolvedValue(undefined)
  })

  test.each(["card", "link"])(
    "maps the same Checkout Session billing address for %s before emitting payment processing",
    async (paymentMethodType) => {
      const sequence: string[] = []
      run.mockImplementation(async () => { sequence.push("cart-updated") })
      const emit = jest.fn(async () => { sequence.push("payment-emitted") })
      const session = checkoutSession({ payment_method_types: [paymentMethodType] })
      const { req } = signedRequest({ session, emit })
      const res = response()

      await POST(req, res)

      expect(run).toHaveBeenCalledWith({
        input: {
          id: "cart_test",
          billing_address: {
            first_name: "Jean Claude Van Damme",
            last_name: "",
            address_1: "10 rue Stripe",
            address_2: "Bâtiment B",
            city: "Paris",
            country_code: "fr",
            province: "Île-de-France",
            postal_code: "75001",
            phone: "+33123456789",
          },
        },
      })
      expect(sequence).toEqual(["cart-updated", "payment-emitted"])
      expect(res.sendStatus).toHaveBeenCalledWith(200)
    }
  )

  it("keeps the complete Stripe name without guessing a last-name split", () => {
    expect(mapStripeBillingAddress(checkoutSession().customer_details as any)).toMatchObject({
      first_name: "Jean Claude Van Damme",
      last_name: "",
    })
  })

  it("rejects an invalid Stripe signature before any side effect", async () => {
    const { req, emit } = signedRequest()
    req.headers["stripe-signature"] = "invalid"
    const res = response()

    await POST(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(run).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  test.each([
    ["missing", checkoutSession({ client_reference_id: null })],
    ["inconsistent", checkoutSession({ client_reference_id: "cart_other" })],
  ])("rejects a %s Cart identity", async (_case, session) => {
    const { req, emit } = signedRequest({ session })
    const res = response()

    await POST(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(run).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it("rejects a paid Checkout Session without a billing address", async () => {
    const session = checkoutSession({ customer_details: { name: "Test User", address: null } })
    const { req, emit } = signedRequest({ session })
    const res = response()

    await POST(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(run).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it("does not synchronize an unpaid Checkout Session but preserves Medusa processing", async () => {
    const session = checkoutSession({ payment_status: "unpaid" })
    const { req, emit } = signedRequest({ session })
    const res = response()

    await POST(req, res)

    expect(run).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      name: PaymentWebhookEvents.WebhookReceived,
    }), { delay: 10, attempts: 2 })
    expect(res.sendStatus).toHaveBeenCalledWith(200)
  })

  it("emits payment processing immediately when no webhook delay is configured", async () => {
    const { req, emit } = signedRequest({ paymentOptions: null })
    const res = response()

    await POST(req, res)

    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      name: PaymentWebhookEvents.WebhookReceived,
    }), { delay: 0, attempts: 3 })
    expect(res.sendStatus).toHaveBeenCalledWith(200)
  })

  test.each([
    ["completed Cart", { id: "cart_test", completed_at: new Date(), order: null }],
    ["existing Order", { id: "cart_test", completed_at: null, order: { id: "order_test" } }],
  ])("does not rewrite an already processed %s", async (_case, cart) => {
    const graph = jest.fn().mockResolvedValue({ data: [cart] })
    const { req, emit } = signedRequest({ graph })
    const res = response()

    await POST(req, res)

    expect(run).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledTimes(1)
    expect(res.sendStatus).toHaveBeenCalledWith(200)
  })

  it("handles a repeated webhook safely after the first event completed the Cart", async () => {
    const graph = jest.fn()
      .mockResolvedValueOnce({ data: [{ id: "cart_test", completed_at: null, order: null }] })
      .mockResolvedValueOnce({
        data: [{ id: "cart_test", completed_at: new Date(), order: { id: "order_test" } }],
      })
    const { req, emit } = signedRequest({ graph })

    await POST(req, response())
    await POST(req, response())

    expect(run).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledTimes(2)
  })
})
