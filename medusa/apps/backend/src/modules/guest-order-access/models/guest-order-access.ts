import { model } from "@medusajs/framework/utils"

const GuestOrderAccess = model.define("guest_order_access", {
  id: model.id({ prefix: "goa" }).primaryKey(),
  order_id: model.text(),
  token_hash: model.text(),
  expires_at: model.dateTime(),
  revoked_at: model.dateTime().nullable(),
}).indexes([
  {
    name: "IDX_guest_order_access_token_hash_unique",
    on: ["token_hash"],
    unique: true,
    where: "deleted_at IS NULL",
  },
  {
    name: "IDX_guest_order_access_one_active_order",
    on: ["order_id"],
    unique: true,
    where: "revoked_at IS NULL AND deleted_at IS NULL",
  },
  {
    name: "IDX_guest_order_access_expires_at",
    on: ["expires_at"],
    where: "deleted_at IS NULL",
  },
])

export default GuestOrderAccess
