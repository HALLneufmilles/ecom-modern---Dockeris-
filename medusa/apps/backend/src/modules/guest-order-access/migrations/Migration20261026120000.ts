import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261026120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "guest_order_access" ("id" text not null, "order_id" text not null, "token_hash" text not null, "expires_at" timestamptz not null, "revoked_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "guest_order_access_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "IDX_guest_order_access_deleted_at" on "guest_order_access" ("deleted_at") where deleted_at is null;`)
    this.addSql(`create unique index if not exists "IDX_guest_order_access_token_hash_unique" on "guest_order_access" ("token_hash") where deleted_at is null;`)
    this.addSql(`create unique index if not exists "IDX_guest_order_access_one_active_order" on "guest_order_access" ("order_id") where revoked_at is null and deleted_at is null;`)
    this.addSql(`create index if not exists "IDX_guest_order_access_expires_at" on "guest_order_access" ("expires_at") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "guest_order_access" cascade;`)
  }
}
