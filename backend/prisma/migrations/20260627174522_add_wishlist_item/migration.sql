-- CreateTable
CREATE TABLE "wishlist_item" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "creator" TEXT,
    "cover_url" TEXT,
    "provider_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_wishlist_user_recent" ON "wishlist_item"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_item_user_id_media_type_provider_id_key" ON "wishlist_item"("user_id", "media_type", "provider_id");

-- AddForeignKey
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
