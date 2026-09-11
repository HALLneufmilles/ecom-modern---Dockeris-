import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

export default async function enableStripePaymentProvider({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name"],
  })

  for (const region of regions) {
    await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: region.id },
        update: {
          payment_providers: ["pp_stripe_stripe", "pp_stripe-checkout_stripe-checkout"],
        },
      },
    })
    logger.info(`Enabled Stripe and Stripe Checkout payments for region ${region.name}`)
  }
}
