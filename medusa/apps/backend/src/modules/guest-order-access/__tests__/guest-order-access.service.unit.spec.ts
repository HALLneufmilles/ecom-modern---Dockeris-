import {
  GUEST_ORDER_ACCESS_TOKEN_DAYS,
  GUEST_ORDER_SESSION_HOURS,
  GuestOrderAccessTokenService,
  GuestOrderAccessUnavailableError,
  generateGuestOrderAccessToken,
  hashGuestOrderAccessToken,
  hashGuestOrderSessionToken,
  type GuestOrderAccessRecord,
  type GuestOrderAccessStore,
  type GuestOrderSessionRecord,
} from "../service"

const now = new Date("2026-10-26T12:00:00.000Z")

type StoredRecord = GuestOrderAccessRecord
type StoredSession = GuestOrderSessionRecord

const createStore = ({
  status = "completed",
  customerId = null,
}: {
  status?: string
  customerId?: string | null
} = {}): { store: GuestOrderAccessStore; records: StoredRecord[]; sessions: StoredSession[] } => {
  const records: StoredRecord[] = []
  const sessions: StoredSession[] = []
  let lock = Promise.resolve()

  const withOrderLock: GuestOrderAccessStore["withOrderLock"] = async (orderId, callback) => {
    const previous = lock
    let release: () => void = () => undefined
    lock = new Promise<void>((resolve) => { release = resolve })
    await previous

    try {
      return await callback({
        retrieveGuestOrder: async (lockedOrderId) => ({
          id: lockedOrderId,
          status,
          customer_id: customerId,
        }),
        revokeActive: async (lockedOrderId, revokedAt) => {
          records
            .filter((record) => record.order_id === lockedOrderId && !record.revoked_at)
            .forEach((record) => { record.revoked_at = revokedAt })
        },
        revokeActiveSessions: async (lockedOrderId, revokedAt) => {
          sessions
            .filter((session) => session.order_id === lockedOrderId && !session.revoked_at)
            .forEach((session) => { session.revoked_at = revokedAt })
        },
        create: async (record) => { records.push(record) },
        createSession: async (session) => { sessions.push(session) },
        findByOrderAndHash: async (lockedOrderId, tokenHash) => (
          records.find((record) => (
            record.order_id === lockedOrderId && record.token_hash === tokenHash
          ))
        ),
        findById: async (accessId) => records.find((record) => record.id === accessId),
        findSessionByOrderAndHash: async (lockedOrderId, sessionHash) => (
          sessions.find((session) => (
            session.order_id === lockedOrderId && session.session_hash === sessionHash
          ))
        ),
      })
    } finally {
      release()
    }
  }

  return { store: { withOrderLock }, records, sessions }
}

const createService = ({
  status = "completed",
  customerId = null,
  currentNow = now,
}: {
  status?: string
  customerId?: string | null
  currentNow?: Date
} = {}) => {
  const fixture = createStore({ status, customerId })
  return {
    ...fixture,
    service: new GuestOrderAccessTokenService(
      fixture.store,
      () => currentNow
    ),
  }
}

describe("guest order access tokens", () => {
  it("generates opaque random values and only persists a SHA-256 hash", async () => {
    const first = generateGuestOrderAccessToken()
    const second = generateGuestOrderAccessToken()
    const { service, records } = createService()

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(first).not.toBe(second)

    const issued = await service.issue("order_guest_1")
    expect(records).toHaveLength(1)
    expect(records[0]).toEqual(expect.objectContaining({
      order_id: "order_guest_1",
      token_hash: hashGuestOrderAccessToken(issued.token),
      revoked_at: null,
    }))
    expect(records[0]).not.toHaveProperty("token")
    expect(JSON.stringify(records[0])).not.toContain(issued.token)
    expect(issued).not.toHaveProperty("token_hash")
  })

  it("associates a token with one confirmed guest Order and expires it after 90 days", async () => {
    const { service, records } = createService()
    const issued = await service.issue("order_guest_1")

    expect(issued.expiresAt.toISOString()).toBe("2027-01-24T12:00:00.000Z")
    expect(GUEST_ORDER_ACCESS_TOKEN_DAYS).toBe(90)
    expect(await service.verify("order_guest_1", issued.token)).toBe(true)
    expect(await service.verify("order_guest_2", issued.token)).toBe(false)
    expect(records[0].order_id).toBe("order_guest_1")
  })

  it("refuses absent, malformed, incorrect, expired, and revoked tokens", async () => {
    const { service } = createService()
    const issued = await service.issue("order_guest_1")

    expect(await service.verify("order_guest_1", undefined)).toBe(false)
    expect(await service.verify("order_guest_1", "not-a-token")).toBe(false)
    expect(await service.verify("order_guest_1", generateGuestOrderAccessToken())).toBe(false)

    const expired = createService()
    const expiredStored = await expired.service.issue("order_guest_3")
    expired.records[0].expires_at = new Date(now.getTime() - 1)
    expect(await expired.service.verify("order_guest_3", expiredStored.token)).toBe(false)

    await service.revoke("order_guest_1")
    expect(await service.verify("order_guest_1", issued.token)).toBe(false)
  })

  it("does not issue access for a pending Order or an authenticated Customer Order", async () => {
    const pending = createService({ status: "pending" })
    const customer = createService({ customerId: "cus_1" })

    await expect(pending.service.issue("order_pending")).rejects.toBeInstanceOf(GuestOrderAccessUnavailableError)
    await expect(customer.service.issue("order_customer")).rejects.toBeInstanceOf(GuestOrderAccessUnavailableError)
    expect(pending.records).toHaveLength(0)
    expect(customer.records).toHaveLength(0)
  })

  it("renews access by revoking the previous token and serializes concurrent renewals", async () => {
    const { service, records } = createService()
    const initial = await service.issue("order_guest_1")
    const [firstRenewal, secondRenewal] = await Promise.all([
      service.renew("order_guest_1"),
      service.renew("order_guest_1"),
    ])

    const active = records.filter((record) => !record.revoked_at)
    expect(active).toHaveLength(1)
    expect(await service.verify("order_guest_1", initial.token)).toBe(false)
    expect(await service.verify("order_guest_1", firstRenewal.token)).toBe(false)
    expect(await service.verify("order_guest_1", secondRenewal.token)).toBe(true)
  })

  it("exchanges a valid access token for a fixed 24-hour session without storing it raw", async () => {
    const { service, records, sessions } = createService()
    const access = await service.issue("order_guest_1")
    const session = await service.exchange("order_guest_1", access.token)

    expect(session).not.toBeNull()
    expect(session?.expiresAt.toISOString()).toBe("2026-10-27T12:00:00.000Z")
    expect(GUEST_ORDER_SESSION_HOURS).toBe(24)
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toEqual(expect.objectContaining({
      order_id: "order_guest_1",
      access_id: records[0].id,
      session_hash: hashGuestOrderSessionToken(session!.token),
      revoked_at: null,
    }))
    expect(sessions[0]).not.toHaveProperty("token")
    expect(JSON.stringify(sessions[0])).not.toContain(session!.token)
    expect(await service.verifySession("order_guest_1", session!.token)).toBe(true)
  })

  it("refuses absent, incorrect, expired, revoked, and cross-Order sessions", async () => {
    const { service, records, sessions } = createService()
    const access = await service.issue("order_guest_1")
    const session = await service.exchange("order_guest_1", access.token)

    expect(await service.exchange("order_guest_1", undefined)).toBeNull()
    expect(await service.exchange("order_guest_1", generateGuestOrderAccessToken())).toBeNull()
    expect(await service.exchange("order_guest_2", access.token)).toBeNull()
    expect(await service.verifySession("order_guest_1", undefined)).toBe(false)
    expect(await service.verifySession("order_guest_2", session!.token)).toBe(false)

    sessions[0].expires_at = new Date(now.getTime() - 1)
    expect(await service.verifySession("order_guest_1", session!.token)).toBe(false)
    sessions[0].expires_at = session!.expiresAt

    records[0].expires_at = new Date(now.getTime() - 1)
    expect(await service.exchange("order_guest_1", access.token)).toBeNull()
    records[0].expires_at = access.expiresAt
    records[0].revoked_at = now
    expect(await service.exchange("order_guest_1", access.token)).toBeNull()
    expect(await service.verifySession("order_guest_1", session!.token)).toBe(false)
  })

  it("does not exchange access for a pending Order or an authenticated Customer Order", async () => {
    const accessToken = generateGuestOrderAccessToken()
    const createIneligibleService = (options: { status?: string; customerId?: string | null }) => {
      const fixture = createService(options)
      fixture.records.push({
        id: "goa_ineligible",
        order_id: "order_ineligible",
        token_hash: hashGuestOrderAccessToken(accessToken),
        expires_at: new Date(now.getTime() + 1_000),
        revoked_at: null,
      })
      return fixture.service
    }

    await expect(createIneligibleService({ status: "pending" })
      .exchange("order_ineligible", accessToken)).resolves.toBeNull()
    await expect(createIneligibleService({ customerId: "cus_1" })
      .exchange("order_ineligible", accessToken)).resolves.toBeNull()
  })

  it("revokes every session when the parent access is renewed or revoked", async () => {
    const { service, sessions } = createService()
    const initial = await service.issue("order_guest_1")
    const session = await service.exchange("order_guest_1", initial.token)

    await service.renew("order_guest_1")
    expect(sessions[0].revoked_at).toEqual(now)
    expect(await service.verifySession("order_guest_1", session!.token)).toBe(false)

    const renewed = await service.renew("order_guest_1")
    const renewedSession = await service.exchange("order_guest_1", renewed.token)
    await service.revoke("order_guest_1")
    expect(await service.verifySession("order_guest_1", renewedSession!.token)).toBe(false)
  })

  it("serializes a concurrent exchange and renewal so no session survives replacement", async () => {
    const { service } = createService()
    const initial = await service.issue("order_guest_1")
    const [session] = await Promise.all([
      service.exchange("order_guest_1", initial.token),
      service.renew("order_guest_1"),
    ])

    if (session) {
      expect(await service.verifySession("order_guest_1", session.token)).toBe(false)
    }
    expect(await service.verify("order_guest_1", initial.token)).toBe(false)
  })
})
