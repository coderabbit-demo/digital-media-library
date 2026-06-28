-- CreateIndex
CREATE INDEX "idx_activity_item" ON "activity"("media_type", "provider_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_library_item" ON "library_item"("media_type", "provider_id");

-- CreateIndex
CREATE INDEX "idx_rating_item" ON "rating"("media_type", "provider_id");
