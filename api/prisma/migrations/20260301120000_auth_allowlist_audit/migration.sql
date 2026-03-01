-- CreateTable
CREATE TABLE "allowed_emails" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "comment" TEXT,
    "created_by_user_id" TEXT,
    "updated_by_user_id" TEXT,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allowed_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_events" (
    "id" BIGSERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "email_normalized" TEXT,
    "user_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allowed_emails_email_normalized_key" ON "allowed_emails"("email_normalized");

-- CreateIndex
CREATE INDEX "auth_events_created_at_idx" ON "auth_events"("created_at");

-- CreateIndex
CREATE INDEX "auth_events_action_status_idx" ON "auth_events"("action", "status");

-- CreateIndex
CREATE INDEX "auth_events_email_normalized_idx" ON "auth_events"("email_normalized");
