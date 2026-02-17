-- CreateTable
CREATE TABLE "training_schedule_slots" (
    "id" SERIAL NOT NULL,
    "day_id" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,

    CONSTRAINT "training_schedule_slots_pkey" PRIMARY KEY ("id")
);

-- Backfill existing single-slot data
INSERT INTO "training_schedule_slots" ("day_id", "start_time", "end_time")
SELECT
    "id",
    "start_time",
    "end_time"
FROM "training_schedule"
WHERE
    "is_open" = true
    AND "start_time" IS NOT NULL
    AND "end_time" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "training_schedule_slots"
ADD CONSTRAINT "training_schedule_slots_day_id_fkey"
FOREIGN KEY ("day_id") REFERENCES "training_schedule"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove obsolete single-slot columns from day table
ALTER TABLE "training_schedule" DROP COLUMN "start_time";
ALTER TABLE "training_schedule" DROP COLUMN "end_time";
