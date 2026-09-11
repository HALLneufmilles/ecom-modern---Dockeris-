import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import StripeCheckoutProviderService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [StripeCheckoutProviderService],
})
