import { model } from "@medusajs/framework/utils"
import Wishlist from "./wishlist"

const WishlistItem = model.define("wishlist_item", {
  id: model.id({ prefix: "witem" }).primaryKey(),
  product_id: model.text(),
  wishlist: model.belongsTo(() => Wishlist, { mappedBy: "items" }),
}).indexes([
  {
    name: "IDX_wishlist_item_wishlist_product_unique",
    on: ["wishlist_id", "product_id"],
    unique: true,
    where: "deleted_at IS NULL",
  },
  {
    name: "IDX_wishlist_item_product_id",
    on: ["product_id"],
    where: "deleted_at IS NULL",
  },
])

export default WishlistItem
