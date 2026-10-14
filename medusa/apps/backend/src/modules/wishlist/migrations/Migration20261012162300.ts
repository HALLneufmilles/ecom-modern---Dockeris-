import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261012162300 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "wishlist_item" add column if not exists "selected_options" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "wishlist_item" drop column if exists "selected_options";`);
  }

}
