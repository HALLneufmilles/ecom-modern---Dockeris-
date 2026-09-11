import Stripe from "stripe"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  AbstractPaymentProvider,
  BigNumber,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"

type StripeCheckoutOptions = {
  apiKey: string
  webhookSecret?: string
}

type CheckoutProjectionLine = {
  name: string
  description?: string
  image?: string
  quantity: number
  unit_amount: number
}

type CheckoutSessionData = Record<string, unknown> & {
  session_id?: string
  cart_id?: string
  payment_collection_id?: string
  success_url?: string
  cancel_url?: string
  customer_email?: string
  line_items?: CheckoutProjectionLine[]
  discount_amount?: number
  expected_total?: number
  currency_code?: string
  id?: string
  checkout_url?: string
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg",
  "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
])
const THREE_DECIMAL_CURRENCIES = new Set(["bhd", "jod", "kwd", "omr", "tnd"])

const currencyMultiplier = (currencyCode: string) => {
  const currency = currencyCode.toLowerCase()
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) return 1
  if (THREE_DECIMAL_CURRENCIES.has(currency)) return 1000
  return 100
}

const toSmallestUnit = (amount: unknown, currencyCode: string) => {
  const numericAmount = Number(amount)
  const smallestUnit = Math.round(numericAmount * currencyMultiplier(currencyCode))
  if (!Number.isFinite(numericAmount) || !Number.isSafeInteger(smallestUnit) || smallestUnit < 0) {
    throw new Error("Invalid Stripe Checkout amount")
  }
  return smallestUnit
}

const fromSmallestUnit = (amount: number, currencyCode: string) => (
  new BigNumber(amount / currencyMultiplier(currencyCode))
)

const isHttpsUrl = (value: unknown): value is string => (
  typeof value === "string" && /^https:\/\//i.test(value)
)

class StripeCheckoutProviderService extends AbstractPaymentProvider<StripeCheckoutOptions> {
  static identifier = "stripe-checkout"

  protected stripe_: Stripe
  protected options_: StripeCheckoutOptions

  static validateOptions(options: StripeCheckoutOptions) {
    if (!options.apiKey) {
      throw new Error("Required option `apiKey` is missing in Stripe Checkout provider")
    }
    if (!options.webhookSecret) {
      console.warn(
        "STRIPE_WEBHOOK_SECRET is missing. Stripe Checkout sessions can be created, "
        + "but signed webhooks cannot finalize Medusa orders."
      )
    }
  }

  constructor(container: Record<string, unknown>, options: StripeCheckoutOptions) {
    super(container, options)
    this.options_ = options
    this.stripe_ = new Stripe(options.apiKey)
  }

  private sessionStatus(session: Stripe.Checkout.Session): PaymentSessionStatus {
    if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
      return PaymentSessionStatus.CAPTURED
    }
    if (session.status === "expired") return PaymentSessionStatus.CANCELED
    return PaymentSessionStatus.PENDING
  }

  private sessionData(
    session: Stripe.Checkout.Session,
    base: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      ...base,
      id: session.id,
      checkout_url: session.url,
      status: session.status,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_intent: typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id,
    }
  }

  private projection(data?: Record<string, unknown>) {
    const projection = (data || {}) as CheckoutSessionData
    const currencyCode = String(projection.currency_code || "").toLowerCase()
    const expectedTotal = Number(projection.expected_total)
    const lineItems = Array.isArray(projection.line_items) ? projection.line_items : []

    if (
      !projection.session_id
      || !projection.cart_id
      || !projection.payment_collection_id
      || !projection.success_url
      || !projection.cancel_url
      || !currencyCode
      || !Number.isFinite(expectedTotal)
      || expectedTotal < 0
      || !lineItems.length
    ) {
      throw new Error("Incomplete Stripe Checkout projection")
    }

    return { ...projection, currencyCode, expectedTotal, lineItems }
  }

  async initiatePayment({ amount, currency_code, data, context }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const projection = this.projection(data)
    const requestedAmount = toSmallestUnit(amount, currency_code)
    const expectedAmount = toSmallestUnit(projection.expectedTotal, projection.currencyCode)
    if (currency_code.toLowerCase() !== projection.currencyCode || requestedAmount !== expectedAmount) {
      throw new Error("Stripe Checkout projection does not match the Medusa Payment Session")
    }

    const metadata: Stripe.MetadataParam = {
      medusa_cart_id: projection.cart_id!,
      medusa_payment_collection_id: projection.payment_collection_id!,
      medusa_payment_session_id: projection.session_id!,
      medusa_expected_total: String(expectedAmount),
    }
    const idempotencyKey = context?.idempotency_key
    const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = projection.lineItems.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: projection.currencyCode,
        unit_amount: toSmallestUnit(line.unit_amount, projection.currencyCode),
        product_data: {
          name: line.name,
          description: line.description || undefined,
          images: isHttpsUrl(line.image) ? [line.image] : undefined,
        },
      },
    }))

    let couponId: string | undefined
    const discountAmount = Number(projection.discount_amount || 0)
    if (discountAmount > 0) {
      const coupon = await this.stripe_.coupons.create({
        duration: "once",
        amount_off: toSmallestUnit(discountAmount, projection.currencyCode),
        currency: projection.currencyCode,
        name: "Medusa discount",
        metadata,
      }, idempotencyKey ? { idempotencyKey: `${idempotencyKey}:discount` } : undefined)
      couponId = coupon.id
    }

    const session = await this.stripe_.checkout.sessions.create({
      mode: "payment",
      ui_mode: "hosted",
      payment_method_types: ["card", "link"],
      billing_address_collection: "required",
      client_reference_id: projection.cart_id,
      customer_email: projection.customer_email || undefined,
      line_items: stripeLineItems,
      discounts: couponId ? [{ coupon: couponId }] : undefined,
      success_url: projection.success_url,
      cancel_url: projection.cancel_url,
      metadata,
      payment_intent_data: { metadata },
    }, idempotencyKey ? { idempotencyKey: `${idempotencyKey}:session` } : undefined)

    if (session.amount_total !== expectedAmount || session.currency !== projection.currencyCode) {
      if (session.status === "open") await this.stripe_.checkout.sessions.expire(session.id)
      throw new Error("Stripe Checkout total does not match the Medusa total")
    }

    return {
      id: session.id,
      status: this.sessionStatus(session),
      data: this.sessionData(session, data),
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const currentId = input.data?.id
    if (typeof currentId === "string") {
      const current = await this.stripe_.checkout.sessions.retrieve(currentId)
      const expected = toSmallestUnit(input.amount, input.currency_code)
      if (current.status === "open" && current.amount_total === expected) {
        return { status: this.sessionStatus(current), data: this.sessionData(current, input.data) }
      }
      if (current.status === "open") await this.stripe_.checkout.sessions.expire(current.id)
    }
    return this.initiatePayment(input)
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const result = await this.getPaymentStatus(input)
    return { status: result.status, data: result.data }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const result = await this.getPaymentStatus(input)
    if (result.status !== PaymentSessionStatus.CAPTURED) {
      throw new Error("Stripe Checkout payment has not been captured")
    }
    return { data: result.data }
  }

  async refundPayment({ amount, data, context }: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const sessionId = data?.id
    if (typeof sessionId !== "string") throw new Error("Missing Stripe Checkout Session ID")
    const session = await this.stripe_.checkout.sessions.retrieve(sessionId)
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id
    if (!paymentIntentId || !session.currency) throw new Error("Missing Stripe PaymentIntent for refund")
    await this.stripe_.refunds.create({
      payment_intent: paymentIntentId,
      amount: toSmallestUnit(amount, session.currency),
    }, context?.idempotency_key ? { idempotencyKey: context.idempotency_key } : undefined)
    return { data: { ...data, payment_intent: paymentIntentId } }
  }

  async retrievePayment({ data }: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const sessionId = data?.id
    if (typeof sessionId !== "string") throw new Error("Missing Stripe Checkout Session ID")
    const session = await this.stripe_.checkout.sessions.retrieve(sessionId)
    return { data: this.sessionData(session, data) }
  }

  async cancelPayment({ data }: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const sessionId = data?.id
    if (typeof sessionId !== "string") return { data }
    const session = await this.stripe_.checkout.sessions.retrieve(sessionId)
    const canceled = session.status === "open"
      ? await this.stripe_.checkout.sessions.expire(session.id)
      : session
    return { data: this.sessionData(canceled, data) }
  }

  async getPaymentStatus({ data }: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const sessionId = data?.id
    if (typeof sessionId !== "string") throw new Error("Missing Stripe Checkout Session ID")
    const session = await this.stripe_.checkout.sessions.retrieve(sessionId)
    return { status: this.sessionStatus(session), data: this.sessionData(session, data) }
  }

  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    if (!this.options_.webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured")
    const signature = payload.headers["stripe-signature"]
    if (typeof signature !== "string") throw new Error("Missing Stripe webhook signature")
    const event = this.stripe_.webhooks.constructEvent(
      payload.rawData || "",
      signature,
      this.options_.webhookSecret
    )
    const supportedEventTypes = new Set<string>([
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
    ])
    if (!supportedEventTypes.has(event.type)) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const session = event.data.object as Stripe.Checkout.Session
    const paymentSessionId = session.metadata?.medusa_payment_session_id
    if (
      !paymentSessionId
      || !session.currency
      || typeof session.amount_total !== "number"
      || !Number.isFinite(session.amount_total)
    ) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    const expectedAmount = session.metadata?.medusa_expected_total
    if (expectedAmount && Number(expectedAmount) !== session.amount_total) {
      return { action: PaymentActions.FAILED, data: {
        session_id: paymentSessionId,
        amount: fromSmallestUnit(session.amount_total, session.currency),
      } }
    }
    const webhookData = {
      session_id: paymentSessionId,
      amount: fromSmallestUnit(session.amount_total, session.currency),
    }

    if (
      (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded")
      && (session.payment_status === "paid" || session.payment_status === "no_payment_required")
    ) {
      return { action: PaymentActions.SUCCESSFUL, data: webhookData }
    }
    if (event.type === "checkout.session.async_payment_failed") {
      return { action: PaymentActions.FAILED, data: webhookData }
    }
    if (event.type === "checkout.session.expired") {
      return { action: PaymentActions.CANCELED, data: webhookData }
    }
    return { action: PaymentActions.NOT_SUPPORTED }
  }
}

export default StripeCheckoutProviderService
