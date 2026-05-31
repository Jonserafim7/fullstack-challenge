-- CreateTable
CREATE TABLE "wallet" (
    "player_id" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "wallet_pkey" PRIMARY KEY ("player_id")
);
