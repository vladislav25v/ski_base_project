ALTER TABLE "protocols"
  ADD COLUMN "sort_by_net_time" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "protocol_participants"
  ADD COLUMN "number" INTEGER NOT NULL DEFAULT 1;

UPDATE "protocol_participants"
SET "number" = GREATEST("sort_order", 1);
