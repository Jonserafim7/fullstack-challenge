-- CreateTable
CREATE TABLE "round" (
    "round_number" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "crash_point" INTEGER NOT NULL,
    "server_seed" TEXT NOT NULL,
    "client_seed" TEXT NOT NULL,
    "house_edge" DOUBLE PRECISION NOT NULL,
    "betting_ends_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "crashed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "round_pkey" PRIMARY KEY ("round_number")
);

-- CreateIndex
CREATE INDEX "round_phase_round_number_idx" ON "round"("phase", "round_number");
