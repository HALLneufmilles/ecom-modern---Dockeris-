import { model } from "@medusajs/framework/utils"
import WishlistItem from "./wishlist-item"

const Wishlist = model.define("wishlist", {
  id: model.id({ prefix: "wish" }).primaryKey(),
  customer_id: model.text(),
  items: model.hasMany(() => WishlistItem, { mappedBy: "wishlist" }),
}).indexes([
  {
    name: "IDX_wishlist_customer_id_unique",
    on: ["customer_id"],
    unique: true,
    where: "deleted_at IS NULL",
  },
])

export default Wishlist
