-- CreateTable
CREATE TABLE "outbox_message" (
    "id" TEXT NOT NULL,
    "message_key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "routing_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "outbox_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_message_message_key_key" ON "outbox_message"("message_key");

-- CreateIndex
CREATE INDEX "outbox_message_status_created_at_idx" ON "outbox_message"("status", "created_at");
