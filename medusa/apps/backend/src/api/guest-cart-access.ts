import { createHmac, timingSafeEqual } from "crypto"
import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules, remoteQueryObjectFromString } from "@medusajs/framework/utils"
import type { ICartModuleService } from "@medusajs/types"

const COOKIE_NAME = "mvdw_guest_cart_proof"
const PROOF_SECONDS = 7 * 24 * 60 * 60

const readGuestProof = (req: MedusaRequest): string | null => {
  const prefix = `${COOKIE_NAME}=`
  const cookie = (req.headers.cookie || "").split(";").map((value) => value.trim())
    .find((value) => value.startsWith(prefix))
  return cookie ? cookie.slice(prefix.length) : null
}

export const verifyGuestCartProof = (
  proof: string | null,
  cartId: string,
  now = Date.now()
): boolean => {
  const secret = process.env.MVDW_GUEST_CART_SECRET
  if (!secret || Buffer.byteLength(secret) < 32 || !proof || proof.length > 512) return false
  const parts = proof.split(".")
  if (parts.length !== 3 || parts[0] !== "v1") return false

  try {
    const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest()
    const provided = Buffer.from(parts[2], "base64url")
    if (provided.toString("base64url") !== parts[2]
      || provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))
    return payload.cartId === cartId
      && Number.isSafeInteger(payload.expiresAt)
      && payload.expiresAt > Math.floor(now / 1000)
      && payload.expiresAt <= Math.floor(now / 1000) + PROOF_SECONDS
  } catch {
    return false
  }
}

const cartIdFromPath = (req: MedusaRequest): string | null => {
  const match = req.originalUrl.match(/^\/store\/carts\/([^/?]+)(?:\/|\?|$)/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

export const protectStoreCart = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: (error?: Error) => void,
  cartId: string | null
) => {
  if (!cartId) return res.status(404).json({ message: "Cart not found" })

  try {
    const cartService = req.scope.resolve(Modules.CART) as ICartModuleService
    const [cart] = await cartService.listCarts({ id: cartId })
    if (!cart || cart.completed_at) {
      return res.status(404).json({ message: "Cart not found" })
    }

    const authContext = (req as AuthenticatedMedusaRequest).auth_context
    const permitted = cart.customer_id
      ? authContext?.actor_type === "customer" && authContext.actor_id === cart.customer_id
      : verifyGuestCartProof(readGuestProof(req), cartId)
    if (!permitted) return res.status(404).json({ message: "Cart not found" })
    return next()
  } catch (error) {
    return next(error as Error)
  }
}

export const protectStoreCartPath = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: (error?: Error) => void
) => protectStoreCart(req, res, next, cartIdFromPath(req))

export const protectStoreCartBody = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: (error?: Error) => void
) => {
  const body = req.body as { cart_id?: unknown } | undefined
  return protectStoreCart(req, res, next, typeof body?.cart_id === "string" ? body.cart_id : null)
}

export const protectStoreCartQuery = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: (error?: Error) => void
) => {
  if (typeof req.query.cart_id !== "string") return next()
  return protectStoreCart(req, res, next, req.query.cart_id)
}

export const protectPaymentCollection = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: (error?: Error) => void
) => {
  try {
    const collectionId = req.originalUrl.match(/^\/store\/payment-collections\/([^/?]+)/)?.[1]
    if (!collectionId) return res.status(404).json({ message: "Cart not found" })
    const remoteQuery = req.scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY) as Function
    const [relation] = await remoteQuery(remoteQueryObjectFromString({
      entryPoint: "cart_payment_collection",
      variables: { filters: { payment_collection_id: collectionId } },
      fields: ["cart_id"],
    }))
    return protectStoreCart(req, res, next, relation?.cart_id || null)
  } catch (error) {
    return next(error as Error)
  }
}
