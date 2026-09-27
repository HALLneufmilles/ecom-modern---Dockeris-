import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260921164623 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "managed_media" drop constraint if exists "managed_media_url_unique";`);
    this.addSql(`alter table if exists "managed_media" drop constraint if exists "managed_media_file_id_unique";`);
    this.addSql(`create table if not exists "managed_media" ("id" text not null, "file_id" text not null, "url" text not null, "status" text not null default 'pending', "product_id" text null, "product_image_id" text null, "last_error" text null, "deletion_attempts" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "managed_media_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_managed_media_deleted_at" ON "managed_media" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_managed_media_file_id_unique" ON "managed_media" ("file_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_managed_media_url_unique" ON "managed_media" ("url") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_managed_media_product_id" ON "managed_media" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_managed_media_status" ON "managed_media" ("status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "managed_media" cascade;`);
  }

}
