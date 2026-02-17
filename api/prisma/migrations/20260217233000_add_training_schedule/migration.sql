-- CreateTable
CREATE TABLE "training_schedule" (
    "id" SERIAL NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT false,
    "start_time" TEXT,
    "end_time" TEXT,

    CONSTRAINT "training_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_schedule_day_of_week_key" ON "training_schedule"("day_of_week");
