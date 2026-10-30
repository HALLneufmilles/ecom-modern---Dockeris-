import {
  ContainerRegistrationKeys,
  Modules,
  OrderStatus,
} from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { IOrderModuleService } from "@medusajs/types"
import { GUEST_ORDER_ACCESS_MODULE } from "../index"
import GuestOrderAccessModuleService, {
  GuestOrderAccessUnavailableError,
  generateGuestOrderAccessToken,
  hashGuestOrderAccessToken,
  hashGuestOrderSessionToken,
} from "../service"

// The Medusa integration runner creates a database, applies module migrations,
// and starts an application in its beforeAll hook.
jest.setTimeout(60_000)

const databaseName = process.env.MVDW_GUEST_ORDER_ACCESS_TEST_DB
const missingDatabaseEnvironment = ["DB_HOST", "DB_PORT", "DB_USERNAME", "DB_PASSWORD"]
  .filter((name) => !process.env[name])

if (!databaseName || !/^mvdw_goa_it_[a-z0-9_]{1,40}$/.test(databaseName)) {
  throw new Error(
    "MVDW_GUEST_ORDER_ACCESS_TEST_DB must name a dedicated mvdw_goa_it_* PostgreSQL database."
  )
}

if (missingDatabaseEnvironment.length) {
  throw new Error(
    `Missing PostgreSQL test environment: ${missingDatabaseEnvironment.join(", ")}.`
  )
}

type GuestOrderAccessRow = {
  order_id: string
  token_hash: string
  expires_at: Date
  revoked_at: Date | null
}

type GuestOrderSessionRow = {
  order_id: string
  access_id: string
  session_hash: string
  expires_at: Date
  revoked_at: Date | null
}

medusaIntegrationTestRunner({
  dbName: databaseName,
  cwd: process.cwd(),
  hooks: {
    beforeServerStart: async (container) => {
      // The test runner treats the Docker hostname "postgres" as remote and
      // forces SSL. The local PostgreSQL service intentionally does not use SSL.
      const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as {
        projectConfig: {
          databaseDriverOptions?: Record<string, unknown>
        }
      }
      config.projectConfig.databaseDriverOptions = {
        ssl: false,
        sslmode: "disable",
      }
    },
  },
  testSuite: ({ dbConnection, getContainer }) => {
    const createCompletedGuestOrder = async () => {
      const orderService = getContainer().resolve<IOrderModuleService>(Modules.ORDER)

      return orderService.createOrders({
        currency_code: "eur",
        email: "guest-order-access-integration@example.test",
        no_notification: true,
        status: OrderStatus.COMPLETED,
      })
    }

    const getAccessService = () => (
      getContainer().resolve<GuestOrderAccessModuleService>(GUEST_ORDER_ACCESS_MODULE)
    )

    const getRows = async (orderId: string): Promise<GuestOrderAccessRow[]> => {
      const { rows } = await dbConnection.raw(
        `SELECT order_id, token_hash, expires_at, revoked_at
         FROM "guest_order_access"
         WHERE order_id = ? AND deleted_at IS NULL`,
        [orderId]
      )

      return rows as GuestOrderAccessRow[]
    }

    const getSessions = async (orderId: string): Promise<GuestOrderSessionRow[]> => {
      const { rows } = await dbConnection.raw(
        `SELECT order_id, access_id, session_hash, expires_at, revoked_at
         FROM "guest_order_session"
         WHERE order_id = ? AND deleted_at IS NULL`,
        [orderId]
      )

      return rows as GuestOrderSessionRow[]
    }

    describe("guest-order-access PostgreSQL persistence", () => {
      it("persists only the SHA-256 hash and verifies the matching token", async () => {
        const order = await createCompletedGuestOrder()
        const service = getAccessService()
        const issued = await service.issueGuestOrderAccess(order.id)
        const [row] = await getRows(order.id)

        expect(row).toEqual(expect.objectContaining({
          order_id: order.id,
          token_hash: hashGuestOrderAccessToken(issued.token),
          revoked_at: null,
        }))
        expect(row).not.toHaveProperty("token")
        expect(JSON.stringify(row)).not.toContain(issued.token)
        expect(await service.verifyGuestOrderAccess(order.id, issued.token)).toBe(true)
        expect(await service.verifyGuestOrderAccess(order.id, "invalid-token")).toBe(false)
      })

      it("rejects expired and revoked access records", async () => {
        const order = await createCompletedGuestOrder()
        const service = getAccessService()
        const expired = await service.issueGuestOrderAccess(order.id)

        await dbConnection.raw(
          `UPDATE "guest_order_access"
           SET expires_at = ?
           WHERE order_id = ? AND deleted_at IS NULL`,
          [new Date(Date.now() - 1_000), order.id]
        )
        expect(await service.verifyGuestOrderAccess(order.id, expired.token)).toBe(false)

        const renewed = await service.renewGuestOrderAccess(order.id)
        expect(await service.verifyGuestOrderAccess(order.id, renewed.token)).toBe(true)
        await service.revokeGuestOrderAccess(order.id)
        expect(await service.verifyGuestOrderAccess(order.id, renewed.token)).toBe(false)
      })

      it("persists only a session hash and keeps the session fixed at 24 hours", async () => {
        const order = await createCompletedGuestOrder()
        const service = getAccessService()
        const access = await service.issueGuestOrderAccess(order.id)
        const session = await service.exchangeGuestOrderAccessForSession(order.id, access.token)
        const [row] = await getSessions(order.id)

        expect(session).not.toBeNull()
        expect(row).toEqual(expect.objectContaining({
          order_id: order.id,
          session_hash: hashGuestOrderSessionToken(session!.token),
          revoked_at: null,
        }))
        expect(new Date(row.expires_at).getTime()).toBe(session!.expiresAt.getTime())
        expect(row).not.toHaveProperty("token")
        expect(JSON.stringify(row)).not.toContain(session!.token)
        expect(await service.verifyGuestOrderSession(order.id, session!.token)).toBe(true)
        expect(await service.verifyGuestOrderSession("order_other", session!.token)).toBe(false)

        await dbConnection.raw(
          `UPDATE "guest_order_session"
           SET expires_at = ?
           WHERE order_id = ? AND deleted_at IS NULL`,
          [new Date(Date.now() - 1_000), order.id]
        )
        expect(await service.verifyGuestOrderSession(order.id, session!.token)).toBe(false)
      })

      it("renews by revoking the prior token and retaining one active record", async () => {
        const order = await createCompletedGuestOrder()
        const service = getAccessService()
        const initial = await service.issueGuestOrderAccess(order.id)
        const renewed = await service.renewGuestOrderAccess(order.id)
        const rows = await getRows(order.id)

        expect(rows).toHaveLength(2)
        expect(rows.filter((row) => row.revoked_at === null)).toHaveLength(1)
        expect(await service.verifyGuestOrderAccess(order.id, initial.token)).toBe(false)
        expect(await service.verifyGuestOrderAccess(order.id, renewed.token)).toBe(true)
      })

      it("serializes two concurrent renewals in PostgreSQL", async () => {
        const order = await createCompletedGuestOrder()
        const service = getAccessService()
        const initial = await service.issueGuestOrderAccess(order.id)
        const [first, second] = await Promise.all([
          service.renewGuestOrderAccess(order.id),
          service.renewGuestOrderAccess(order.id),
        ])
        const rows = await getRows(order.id)
        const activeTokens = await Promise.all([
          service.verifyGuestOrderAccess(order.id, first.token),
          service.verifyGuestOrderAccess(order.id, second.token),
        ])

        expect(rows).toHaveLength(3)
        expect(rows.filter((row) => row.revoked_at === null)).toHaveLength(1)
        expect(await service.verifyGuestOrderAccess(order.id, initial.token)).toBe(false)
        expect(activeTokens.filter(Boolean)).toHaveLength(1)
      })

      it("invalidates sessions when access is renewed and serializes exchange with renewal", async () => {
        const order = await createCompletedGuestOrder()
        const service = getAccessService()
        const initial = await service.issueGuestOrderAccess(order.id)
        const session = await service.exchangeGuestOrderAccessForSession(order.id, initial.token)

        await service.renewGuestOrderAccess(order.id)
        expect(await service.verifyGuestOrderSession(order.id, session!.token)).toBe(false)
        expect((await getSessions(order.id)).every((row) => row.revoked_at)).toBe(true)

        const active = await service.renewGuestOrderAccess(order.id)
        const [exchanged] = await Promise.all([
          service.exchangeGuestOrderAccessForSession(order.id, active.token),
          service.renewGuestOrderAccess(order.id),
        ])
        if (exchanged) {
          expect(await service.verifyGuestOrderSession(order.id, exchanged.token)).toBe(false)
        }
      })

      it("refuses a non-completed Order and an Order with customer_id", async () => {
        const orderService = getContainer().resolve<IOrderModuleService>(Modules.ORDER)
        const service = getAccessService()
        const pending = await orderService.createOrders({
          currency_code: "eur",
          no_notification: true,
          status: OrderStatus.PENDING,
        })
        const customerOrder = await orderService.createOrders({
          currency_code: "eur",
          customer_id: "cus_guest_order_access_integration",
          no_notification: true,
          status: OrderStatus.COMPLETED,
        })

        await expect(service.issueGuestOrderAccess(pending.id))
          .rejects.toBeInstanceOf(GuestOrderAccessUnavailableError)
        await expect(service.issueGuestOrderAccess(customerOrder.id))
          .rejects.toBeInstanceOf(GuestOrderAccessUnavailableError)
        expect(await getRows(pending.id)).toHaveLength(0)
        expect(await getRows(customerOrder.id)).toHaveLength(0)

        const manuallySeededToken = generateGuestOrderAccessToken()
        await dbConnection.raw(
          `INSERT INTO "guest_order_access" (id, order_id, token_hash, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, now(), now())`,
          [
            "goa_seeded_customer_order",
            customerOrder.id,
            hashGuestOrderAccessToken(manuallySeededToken),
            new Date(Date.now() + 60_000),
          ]
        )
        await expect(service.exchangeGuestOrderAccessForSession(
          customerOrder.id,
          manuallySeededToken
        )).resolves.toBeNull()
        expect(await getSessions(customerOrder.id)).toHaveLength(0)
      })
    })
  },
})
