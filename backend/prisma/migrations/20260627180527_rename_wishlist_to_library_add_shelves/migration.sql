-- CreateEnum
CREATE TYPE "Shelf" AS ENUM ('want', 'current', 'done', 'dnf');

-- Rename the wishlist table to the library table (preserves existing rows;
-- prior "wishlist" items become the default "Want to Read" shelf).
ALTER TABLE "wishlist_item" RENAME TO "library_item";

-- New columns: the shelf (default Want to Read) and an updated-at timestamp.
ALTER TABLE "library_item" ADD COLUMN "shelf" "Shelf" NOT NULL DEFAULT 'want';
-- Backfill updated_at for existing rows, then drop the DB default so Prisma's
-- application-managed @updatedAt is the single source of truth (no drift).
ALTER TABLE "library_item" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "library_item" ALTER COLUMN "updated_at" DROP DEFAULT;

-- Rename indexes/constraints to the names Prisma expects for library_item.
ALTER TABLE "library_item" RENAME CONSTRAINT "wishlist_item_pkey" TO "library_item_pkey";
ALTER TABLE "library_item" RENAME CONSTRAINT "wishlist_item_user_id_fkey" TO "library_item_user_id_fkey";
ALTER INDEX "idx_wishlist_user_recent" RENAME TO "idx_library_user_recent";
ALTER INDEX "wishlist_item_user_id_media_type_provider_id_key" RENAME TO "library_item_user_id_media_type_provider_id_key";
