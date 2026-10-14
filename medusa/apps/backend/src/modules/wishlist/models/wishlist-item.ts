import { model } from "@medusajs/framework/utils"
import Wishlist from "./wishlist"

const WishlistItem = model.define("wishlist_item", {
  id: model.id({ prefix: "witem" }).primaryKey(),
  product_id: model.text(),
  variant_id: model.text().nullable(),
  selected_options: model.json().nullable(),
  wishlist: model.belongsTo(() => Wishlist, { mappedBy: "items" }),
}).indexes([
  {
    name: "IDX_wishlist_item_product_id",
    on: ["product_id"],
    where: "deleted_at IS NULL",
  },
])

export default WishlistItem
