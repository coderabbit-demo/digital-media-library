-- AlterTable
ALTER TABLE "activity" ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "reply" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "reply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_reply_activity" ON "reply"("activity_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_reply_parent" ON "reply"("parent_id");

-- AddForeignKey
ALTER TABLE "reply" ADD CONSTRAINT "reply_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply" ADD CONSTRAINT "reply_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply" ADD CONSTRAINT "reply_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
