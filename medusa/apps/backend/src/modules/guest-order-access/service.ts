import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { ContainerRegistrationKeys, MedusaService, generateEntityId } from "@medusajs/framework/utils"
import GuestOrderAccess from "./models/guest-order-access"
import GuestOrderSession from "./models/guest-order-session"

export const GUEST_ORDER_ACCESS_TOKEN_BYTES = 32
export const GUEST_ORDER_ACCESS_TOKEN_DAYS = 90
export const GUEST_ORDER_SESSION_TOKEN_BYTES = 32
export const GUEST_ORDER_SESSION_HOURS = 24

const tokenPattern = /^[A-Za-z0-9_-]{43}$/

export type GuestOrderAccessRecord = {
  id: string
  order_id: string
  token_hash: string
  expires_at: Date | string
  revoked_at: Date | string | null
}

export type GuestOrderSessionRecord = {
  id: string
  order_id: string
  access_id: string
  session_hash: string
  expires_at: Date | string
  revoked_at: Date | string | null
}

type GuestOrder = {
  id: string
  status: string
  customer_id?: string | null
}

type GuestOrderAccessTransaction = {
  retrieveGuestOrder: (orderId: string) => Promise<GuestOrder | undefined>
  revokeActive: (orderId: string, revokedAt: Date) => Promise<void>
  revokeActiveSessions: (orderId: string, revokedAt: Date) => Promise<void>
  create: (record: GuestOrderAccessRecord) => Promise<void>
  createSession: (record: GuestOrderSessionRecord) => Promise<void>
  findByOrderAndHash: (orderId: string, tokenHash: string) => Promise<GuestOrderAccessRecord | undefined>
  findById: (accessId: string) => Promise<GuestOrderAccessRecord | undefined>
  findSessionByOrderAndHash: (
    orderId: string,
    sessionHash: string
  ) => Promise<GuestOrderSessionRecord | undefined>
}

export type GuestOrderAccessStore = {
  withOrderLock: <T>(
    orderId: string,
    callback: (transaction: GuestOrderAccessTransaction) => Promise<T>
  ) => Promise<T>
}

export type IssuedGuestOrderAccess = {
  token: string
  expiresAt: Date
}

export type IssuedGuestOrderSession = {
  token: string
  expiresAt: Date
}

export class GuestOrderAccessUnavailableError extends Error {
  constructor() {
    super("Guest order access cannot be issued for this order.")
  }
}

export const generateGuestOrderAccessToken = (): string => (
  randomBytes(GUEST_ORDER_ACCESS_TOKEN_BYTES).toString("base64url")
)

export const generateGuestOrderSessionToken = (): string => (
  randomBytes(GUEST_ORDER_SESSION_TOKEN_BYTES).toString("base64url")
)

export const hashGuestOrderAccessToken = (token: string): string => (
  createHash("sha256").update(token).digest("hex")
)

export const hashGuestOrderSessionToken = (token: string): string => (
  createHash("sha256").update(token).digest("hex")
)

const hashesMatch = (storedHash: string, candidateHash: string): boolean => {
  if (!/^[a-f0-9]{64}$/i.test(storedHash) || !/^[a-f0-9]{64}$/i.test(candidateHash)) {
    return false
  }

  const stored = Buffer.from(storedHash, "hex")
  const candidate = Buffer.from(candidateHash, "hex")
  return stored.length === candidate.length && timingSafeEqual(
    stored as unknown as DataView,
    candidate as unknown as DataView
  )
}

export const isConfirmedGuestOrder = (order: GuestOrder): boolean => (
  order.status === "completed" && !order.customer_id
)

const expiresAtFrom = (now: Date): Date => {
  const expiresAt = new Date(now)
  expiresAt.setUTCDate(expiresAt.getUTCDate() + GUEST_ORDER_ACCESS_TOKEN_DAYS)
  return expiresAt
}

const sessionExpiresAtFrom = (now: Date): Date => {
  const expiresAt = new Date(now)
  expiresAt.setUTCHours(expiresAt.getUTCHours() + GUEST_ORDER_SESSION_HOURS)
  return expiresAt
}

const isActive = (
  record: Pick<GuestOrderAccessRecord | GuestOrderSessionRecord, "expires_at" | "revoked_at">,
  now: Date
): boolean => {
  if (record.revoked_at) return false
  const expiresAt = new Date(record.expires_at)
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime()
}

export class GuestOrderAccessTokenService {
  constructor(
    private readonly store: GuestOrderAccessStore,
    private readonly now: () => Date = () => new Date()
  ) {}

  async issue(orderId: string): Promise<IssuedGuestOrderAccess> {
    return this.store.withOrderLock(orderId, async (transaction) => {
      const order = await transaction.retrieveGuestOrder(orderId)
      if (!order || !isConfirmedGuestOrder(order)) {
        throw new GuestOrderAccessUnavailableError()
      }

      const issuedAt = this.now()
      const token = generateGuestOrderAccessToken()
      const expiresAt = expiresAtFrom(issuedAt)

      await transaction.revokeActive(orderId, issuedAt)
      await transaction.revokeActiveSessions(orderId, issuedAt)
      await transaction.create({
        id: generateEntityId(undefined, "goa"),
        order_id: orderId,
        token_hash: hashGuestOrderAccessToken(token),
        expires_at: expiresAt,
        revoked_at: null,
      })

      return { token, expiresAt }
    })
  }

  async renew(orderId: string): Promise<IssuedGuestOrderAccess> {
    return this.issue(orderId)
  }

  async revoke(orderId: string): Promise<void> {
    await this.store.withOrderLock(orderId, async (transaction) => {
      const revokedAt = this.now()
      await transaction.revokeActive(orderId, revokedAt)
      await transaction.revokeActiveSessions(orderId, revokedAt)
    })
  }

  async verify(orderId: string, token: unknown): Promise<boolean> {
    if (typeof token !== "string" || !tokenPattern.test(token)) {
      return false
    }

    const tokenHash = hashGuestOrderAccessToken(token)
    return this.store.withOrderLock(orderId, async (transaction) => {
      const access = await transaction.findByOrderAndHash(orderId, tokenHash)
      return Boolean(access && isActive(access, this.now()) && hashesMatch(access.token_hash, tokenHash))
    })
  }

  async exchange(orderId: string, accessToken: unknown): Promise<IssuedGuestOrderSession | null> {
    if (typeof accessToken !== "string" || !tokenPattern.test(accessToken)) return null

    const accessHash = hashGuestOrderAccessToken(accessToken)
    return this.store.withOrderLock(orderId, async (transaction) => {
      const order = await transaction.retrieveGuestOrder(orderId)
      const access = await transaction.findByOrderAndHash(orderId, accessHash)
      const exchangedAt = this.now()

      if (
        !order
        || !isConfirmedGuestOrder(order)
        || !access
        || !isActive(access, exchangedAt)
        || !hashesMatch(access.token_hash, accessHash)
      ) {
        return null
      }

      const token = generateGuestOrderSessionToken()
      const expiresAt = sessionExpiresAtFrom(exchangedAt)
      await transaction.createSession({
        id: generateEntityId(undefined, "gos"),
        order_id: orderId,
        access_id: access.id,
        session_hash: hashGuestOrderSessionToken(token),
        expires_at: expiresAt,
        revoked_at: null,
      })

      return { token, expiresAt }
    })
  }

  async verifySession(orderId: string, sessionToken: unknown): Promise<boolean> {
    if (typeof sessionToken !== "string" || !tokenPattern.test(sessionToken)) return false

    const sessionHash = hashGuestOrderSessionToken(sessionToken)
    return this.store.withOrderLock(orderId, async (transaction) => {
      const [order, session] = await Promise.all([
        transaction.retrieveGuestOrder(orderId),
        transaction.findSessionByOrderAndHash(orderId, sessionHash),
      ])
      if (!order || !isConfirmedGuestOrder(order) || !session || !isActive(session, this.now())) {
        return false
      }

      const access = await transaction.findById(session.access_id)
      return Boolean(
        access
        && access.order_id === orderId
        && isActive(access, this.now())
        && hashesMatch(session.session_hash, sessionHash)
      )
    })
  }
}

type KnexQuery = {
  select: (...columns: string[]) => KnexQuery
  where: (filters: Record<string, unknown>) => KnexQuery
  whereNull: (column: string) => KnexQuery
  first: () => Promise<unknown>
  update: (data: Record<string, unknown>) => Promise<unknown>
  insert: (data: Record<string, unknown>) => Promise<unknown>
}

type KnexTransaction = {
  raw: (sql: string, bindings: unknown[]) => Promise<unknown>
  (table: string): KnexQuery
}

type KnexConnection = {
  transaction: <T>(callback: (transaction: KnexTransaction) => Promise<T>) => Promise<T>
}

const createStore = (connection: KnexConnection): GuestOrderAccessStore => ({
  withOrderLock: (orderId, callback) => connection.transaction(async (transaction) => {
    // Serializes issuance, renewal, revocation, exchange, and session checks
    // for one Order. The lock is released automatically on commit/rollback.
    await transaction.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [orderId])

    return callback({
      retrieveGuestOrder: async (lockedOrderId) => (
        transaction("order")
          .select("id", "status", "customer_id")
          .where({ id: lockedOrderId })
          .whereNull("deleted_at")
          .first() as Promise<GuestOrder | undefined>
      ),
      revokeActive: async (lockedOrderId, revokedAt) => {
        await transaction("guest_order_access")
          .where({ order_id: lockedOrderId })
          .whereNull("revoked_at")
          .whereNull("deleted_at")
          .update({ revoked_at: revokedAt, updated_at: revokedAt })
      },
      revokeActiveSessions: async (lockedOrderId, revokedAt) => {
        await transaction("guest_order_session")
          .where({ order_id: lockedOrderId })
          .whereNull("revoked_at")
          .whereNull("deleted_at")
          .update({ revoked_at: revokedAt, updated_at: revokedAt })
      },
      create: async (record) => {
        await transaction("guest_order_access").insert(record)
      },
      createSession: async (record) => {
        await transaction("guest_order_session").insert(record)
      },
      findByOrderAndHash: async (lockedOrderId, tokenHash) => (
        transaction("guest_order_access")
          .select("id", "order_id", "token_hash", "expires_at", "revoked_at")
          .where({ order_id: lockedOrderId, token_hash: tokenHash })
          .whereNull("deleted_at")
          .first() as Promise<GuestOrderAccessRecord | undefined>
      ),
      findById: async (accessId) => (
        transaction("guest_order_access")
          .select("id", "order_id", "token_hash", "expires_at", "revoked_at")
          .where({ id: accessId })
          .whereNull("deleted_at")
          .first() as Promise<GuestOrderAccessRecord | undefined>
      ),
      findSessionByOrderAndHash: async (lockedOrderId, sessionHash) => (
        transaction("guest_order_session")
          .select("id", "order_id", "access_id", "session_hash", "expires_at", "revoked_at")
          .where({ order_id: lockedOrderId, session_hash: sessionHash })
          .whereNull("deleted_at")
          .first() as Promise<GuestOrderSessionRecord | undefined>
      ),
    })
  }),
})

class GuestOrderAccessModuleService extends MedusaService({
  GuestOrderAccess,
  GuestOrderSession,
}) {
  private readonly tokenService: GuestOrderAccessTokenService

  constructor(container: Record<string, unknown>) {
    super(container)
    const connection = container[ContainerRegistrationKeys.PG_CONNECTION] as KnexConnection

    this.tokenService = new GuestOrderAccessTokenService(
      createStore(connection)
    )
  }

  async issueGuestOrderAccess(orderId: string): Promise<IssuedGuestOrderAccess> {
    return this.tokenService.issue(orderId)
  }

  async renewGuestOrderAccess(orderId: string): Promise<IssuedGuestOrderAccess> {
    return this.tokenService.renew(orderId)
  }

  async revokeGuestOrderAccess(orderId: string): Promise<void> {
    return this.tokenService.revoke(orderId)
  }

  async verifyGuestOrderAccess(orderId: string, token: unknown): Promise<boolean> {
    return this.tokenService.verify(orderId, token)
  }

  async exchangeGuestOrderAccessForSession(
    orderId: string,
    token: unknown
  ): Promise<IssuedGuestOrderSession | null> {
    return this.tokenService.exchange(orderId, token)
  }

  async verifyGuestOrderSession(orderId: string, token: unknown): Promise<boolean> {
    return this.tokenService.verifySession(orderId, token)
  }
}

export default GuestOrderAccessModuleService
