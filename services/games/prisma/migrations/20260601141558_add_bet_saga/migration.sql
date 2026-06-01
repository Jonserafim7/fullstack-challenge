-- CreateTable
CREATE TABLE "bet" (
    "bet_id" TEXT NOT NULL,
    "round_number" INTEGER NOT NULL,
    "player_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "stake" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "bet_pkey" PRIMARY KEY ("bet_id")
);

-- CreateTable
CREATE TABLE "inbox_message" (
    "message_key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_message_pkey" PRIMARY KEY ("message_key")
);

-- CreateIndex
CREATE INDEX "bet_round_number_idx" ON "bet"("round_number");

-- CreateIndex
CREATE UNIQUE INDEX "bet_round_number_player_id_key" ON "bet"("round_number", "player_id");
