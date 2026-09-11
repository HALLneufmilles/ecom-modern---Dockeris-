import Stripe from "stripe"
import type { CreateAddressDTO } from "@medusajs/framework/types"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateCartWorkflow } from "@medusajs/medusa/core-flows"
import {
  ContainerRegistrationKeys,
  Modules,
  PaymentWebhookEvents,
} from "@medusajs/framework/utils"

const STRIPE_CHECKOUT_PROVIDER_ID = "stripe-checkout_stripe-checkout"
const SUCCESSFUL_CHECKOUT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
])

class StripeCheckoutWebhookError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

const optionalStripeValue = (value: string | null | undefined) => {
  const normalized = typeof value === "string" ? value.trim() : ""
  return normalized || undefined
}

export const mapStripeBillingAddress = (
  customerDetails: Stripe.Checkout.Session.CustomerDetails | null
): CreateAddressDTO | null => {
  const address = customerDetails?.address
  const address1 = optionalStripeValue(address?.line1)
  const countryCode = optionalStripeValue(address?.country)?.toLowerCase()
  if (!address || !address1 || !countryCode) return null

  const fullName = optionalStripeValue(customerDetails?.name)
  return {
    ...(fullName ? { first_name: fullName, last_name: "" } : {}),
    address_1: address1,
    ...(optionalStripeValue(address.line2) ? { address_2: optionalStripeValue(address.line2) } : {}),
    ...(optionalStripeValue(address.city) ? { city: optionalStripeValue(address.city) } : {}),
    country_code: countryCode,
    ...(optionalStripeValue(address.state) ? { province: optionalStripeValue(address.state) } : {}),
    ...(optionalStripeValue(address.postal_code)
      ? { postal_code: optionalStripeValue(address.postal_code) }
      : {}),
    ...(optionalStripeValue(customerDetails?.phone)
      ? { phone: optionalStripeValue(customerDetails?.phone) }
      : {}),
  }
}

const checkoutSessionIsPaid = (session: Stripe.Checkout.Session) => (
  session.payment_status === "paid" || session.payment_status === "no_payment_required"
)

const resolveCartId = (session: Stripe.Checkout.Session) => {
  const metadataCartId = optionalStripeValue(session.metadata?.medusa_cart_id)
  const referenceCartId = optionalStripeValue(session.client_reference_id)
  if (!metadataCartId || !referenceCartId) {
    throw new StripeCheckoutWebhookError("Missing Medusa Cart ID")
  }
  if (metadataCartId !== referenceCartId) {
    throw new StripeCheckoutWebhookError("Inconsistent Medusa Cart ID")
  }
  return metadataCartId
}

const cartAlreadyCompleted = (cart: {
  completed_at?: string | Date | null
  order?: { id?: string } | Array<{ id?: string }> | null
}) => Boolean(
  cart.completed_at
  || (Array.isArray(cart.order) ? cart.order.some((order) => order?.id) : cart.order?.id)
)

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const apiKey = process.env.STRIPE_API_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const signature = req.headers["stripe-signature"]
  if (!apiKey || !webhookSecret) {
    res.status(500).send("Stripe Checkout webhook is not configured")
    return
  }
  if (typeof signature !== "string" || !req.rawBody) {
    res.status(400).send("Invalid Stripe webhook request")
    return
  }

  try {
    const stripe = new Stripe(apiKey)
    const event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret)

    if (SUCCESSFUL_CHECKOUT_EVENTS.has(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session
      if (checkoutSessionIsPaid(session)) {
        const cartId = resolveCartId(session)
        const billingAddress = mapStripeBillingAddress(session.customer_details)
        if (!billingAddress) {
          throw new StripeCheckoutWebhookError("Missing Stripe billing address")
        }

        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
        const { data: carts } = await query.graph({
          entity: "cart",
          fields: ["id", "completed_at", "order.id"],
          filters: { id: cartId },
          pagination: { take: 1 },
        })
        const cart = carts[0]
        if (!cart) {
          throw new StripeCheckoutWebhookError("Medusa Cart not found")
        }

        if (!cartAlreadyCompleted(cart)) {
          await updateCartWorkflow(req.scope).run({
            input: {
              id: cartId,
              billing_address: billingAddress,
            },
          })
        }
      }
    }

    const paymentService = req.scope.resolve(Modules.PAYMENT) as unknown as {
      options?: { webhook_delay?: number; webhook_retries?: number }
    }
    const eventBus = req.scope.resolve(Modules.EVENT_BUS)
    await eventBus.emit({
      name: PaymentWebhookEvents.WebhookReceived,
      data: {
        provider: STRIPE_CHECKOUT_PROVIDER_ID,
        payload: {
          data: req.body,
          rawData: req.rawBody,
          headers: req.headers,
        },
      },
    }, {
      delay: paymentService.options?.webhook_delay || 5000,
      attempts: paymentService.options?.webhook_retries || 3,
    })

    res.sendStatus(200)
  } catch (error) {
    const signatureError = error instanceof Stripe.errors.StripeSignatureVerificationError
    const status = error instanceof StripeCheckoutWebhookError
      ? error.status
      : signatureError ? 400 : 500
    const message = error instanceof StripeCheckoutWebhookError
      ? error.message
      : signatureError ? "Invalid Stripe webhook signature" : "Stripe Checkout processing failed"
    res.status(status).send(`Webhook Error: ${message}`)
  }
}
