import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261027160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "guest_order_session" ("id" text not null, "order_id" text not null, "access_id" text not null, "session_hash" text not null, "expires_at" timestamptz not null, "revoked_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "guest_order_session_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "IDX_guest_order_session_deleted_at" on "guest_order_session" ("deleted_at") where deleted_at is null;`)
    this.addSql(`create unique index if not exists "IDX_guest_order_session_session_hash_unique" on "guest_order_session" ("session_hash") where deleted_at is null;`)
    this.addSql(`create index if not exists "IDX_guest_order_session_order_id_active" on "guest_order_session" ("order_id") where revoked_at is null and deleted_at is null;`)
    this.addSql(`create index if not exists "IDX_guest_order_session_access_id_active" on "guest_order_session" ("access_id") where revoked_at is null and deleted_at is null;`)
    this.addSql(`create index if not exists "IDX_guest_order_session_expires_at" on "guest_order_session" ("expires_at") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "guest_order_session" cascade;`)
  }
}
