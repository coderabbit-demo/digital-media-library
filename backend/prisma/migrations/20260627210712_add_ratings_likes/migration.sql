-- CreateTable
CREATE TABLE "rating" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "provider_id" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "creator" TEXT,
    "cover_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_like" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_like_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rating_user_id_media_type_provider_id_key" ON "rating"("user_id", "media_type", "provider_id");

-- CreateIndex
CREATE INDEX "idx_like_activity" ON "activity_like"("activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_like_user_id_activity_id_key" ON "activity_like"("user_id", "activity_id");

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "rating_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_like" ADD CONSTRAINT "activity_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_like" ADD CONSTRAINT "activity_like_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
