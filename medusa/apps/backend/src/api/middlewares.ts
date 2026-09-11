import { defineMiddlewares } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/hooks/stripe-checkout",
      methods: ["POST"],
      bodyParser: { preserveRawBody: true },
    },
  ],
})
