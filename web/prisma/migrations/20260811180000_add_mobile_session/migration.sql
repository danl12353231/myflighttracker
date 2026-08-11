CREATE TABLE "mobile_session" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "last_used" TIMESTAMPTZ,

    CONSTRAINT "mobile_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mobile_session_token_key" ON "mobile_session"("token");
CREATE INDEX "mobile_session_user_id_idx" ON "mobile_session"("user_id");

ALTER TABLE "mobile_session" ADD CONSTRAINT "mobile_session_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
