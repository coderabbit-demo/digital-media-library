-- CreateTable
CREATE TABLE "recommendation" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "creator" TEXT,
    "cover_url" TEXT,
    "provider_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_recommendation_recent" ON "recommendation"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_user_id_media_type_provider_id_key" ON "recommendation"("user_id", "media_type", "provider_id");

-- AddForeignKey
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
