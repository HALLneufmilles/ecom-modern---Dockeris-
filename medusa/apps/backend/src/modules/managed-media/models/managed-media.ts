import { model } from "@medusajs/framework/utils"

const ManagedMedia = model.define("managed_media", {
  id: model.id({ prefix: "mmedia" }).primaryKey(),
  file_id: model.text(),
  url: model.text(),
  status: model.text().default("pending"),
  product_id: model.text().nullable(),
  product_image_id: model.text().nullable(),
  last_error: model.text().nullable(),
  deletion_attempts: model.number().default(0),
}).indexes([
  {
    name: "IDX_managed_media_file_id_unique",
    on: ["file_id"],
    unique: true,
    where: "deleted_at IS NULL",
  },
  {
    name: "IDX_managed_media_url_unique",
    on: ["url"],
    unique: true,
    where: "deleted_at IS NULL",
  },
  {
    name: "IDX_managed_media_product_id",
    on: ["product_id"],
    where: "deleted_at IS NULL",
  },
  {
    name: "IDX_managed_media_status",
    on: ["status"],
    where: "deleted_at IS NULL",
  },
])

export default ManagedMedia
