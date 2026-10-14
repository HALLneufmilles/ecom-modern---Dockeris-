import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261012000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`drop index if exists "IDX_wishlist_item_wishlist_product_unique";`)
  }

  override async down(): Promise<void> {
    this.addSql(`create unique index if not exists "IDX_wishlist_item_wishlist_product_unique" on "wishlist_item" ("wishlist_id", "product_id") where deleted_at is null;`)
  }
}
