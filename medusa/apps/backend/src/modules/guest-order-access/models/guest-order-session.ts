import { model } from "@medusajs/framework/utils"

const GuestOrderSession = model.define("guest_order_session", {
  id: model.id({ prefix: "gos" }).primaryKey(),
  order_id: model.text(),
  access_id: model.text(),
  session_hash: model.text(),
  expires_at: model.dateTime(),
  revoked_at: model.dateTime().nullable(),
}).indexes([
  {
    name: "IDX_guest_order_session_session_hash_unique",
    on: ["session_hash"],
    unique: true,
    where: "deleted_at IS NULL",
  },
  {
    name: "IDX_guest_order_session_order_id_active",
    on: ["order_id"],
    where: "revoked_at IS NULL AND deleted_at IS NULL",
  },
  {
    name: "IDX_guest_order_session_access_id_active",
    on: ["access_id"],
    where: "revoked_at IS NULL AND deleted_at IS NULL",
  },
  {
    name: "IDX_guest_order_session_expires_at",
    on: ["expires_at"],
    where: "deleted_at IS NULL",
  },
])

export default GuestOrderSession
