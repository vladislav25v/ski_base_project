-- Create new enum with updated protocol lifecycle
CREATE TYPE "ProtocolStatus_new" AS ENUM ('DRAFT', 'FORMED', 'PUBLISHED');

-- Add new columns for generated PDF metadata and publishing
ALTER TABLE "protocols"
  ADD COLUMN "formed_at" TIMESTAMP(3),
  ADD COLUMN "published_at" TIMESTAMP(3),
  ADD COLUMN "pdf_storage_path" TEXT,
  ADD COLUMN "pdf_file_name" TEXT;

-- Migrate enum values SIGNED -> PUBLISHED
ALTER TABLE "protocols" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "protocols"
  ALTER COLUMN "status" TYPE "ProtocolStatus_new"
  USING (
    CASE
      WHEN "status"::text = 'SIGNED' THEN 'PUBLISHED'
      ELSE "status"::text
    END
  )::"ProtocolStatus_new";

ALTER TABLE "protocols" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- Replace old enum type
ALTER TYPE "ProtocolStatus" RENAME TO "ProtocolStatus_old";
ALTER TYPE "ProtocolStatus_new" RENAME TO "ProtocolStatus";
DROP TYPE "ProtocolStatus_old";

-- Remove deprecated field
ALTER TABLE "protocols" DROP COLUMN "signed_at";
