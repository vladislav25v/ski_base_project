-- CreateEnum
CREATE TYPE "ProtocolStatus" AS ENUM ('DRAFT', 'SIGNED');

-- CreateTable
CREATE TABLE "protocols" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "formation_date" TIMESTAMP(3) NOT NULL,
    "start_interval_seconds" INTEGER NOT NULL DEFAULT 30,
    "chief_judge_name" TEXT,
    "secretary_name" TEXT,
    "status" "ProtocolStatus" NOT NULL DEFAULT 'DRAFT',
    "signed_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "local_source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocol_participants" (
    "id" TEXT NOT NULL,
    "protocol_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "last_name" TEXT NOT NULL,
    "start_time_sec" INTEGER,
    "finish_time_sec" INTEGER,
    "net_time_sec" INTEGER,
    "dsq" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protocol_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocol_participant_laps" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "lap_index" INTEGER NOT NULL,
    "lap_time_sec" INTEGER,

    CONSTRAINT "protocol_participant_laps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "protocols_local_source_id_key" ON "protocols"("local_source_id");

-- CreateIndex
CREATE INDEX "protocols_status_formation_date_idx" ON "protocols"("status", "formation_date");

-- CreateIndex
CREATE INDEX "protocol_participants_protocol_order_idx" ON "protocol_participants"("protocol_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "protocol_participant_laps_participant_lap_idx" ON "protocol_participant_laps"("participant_id", "lap_index");

-- AddForeignKey
ALTER TABLE "protocol_participants" ADD CONSTRAINT "protocol_participants_protocol_id_fkey" FOREIGN KEY ("protocol_id") REFERENCES "protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_participant_laps" ADD CONSTRAINT "protocol_participant_laps_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "protocol_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

