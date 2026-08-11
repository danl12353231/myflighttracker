ALTER TABLE "flight" ADD COLUMN "created_by_id" TEXT;

-- Legacy flights with one registered passenger can be attributed safely.
UPDATE "flight" AS f
SET "created_by_id" = passenger."user_id"
FROM (
    SELECT "flight_id", MIN("user_id") AS "user_id"
    FROM "flight_passenger"
    WHERE "user_id" IS NOT NULL
    GROUP BY "flight_id"
    HAVING COUNT(*) = 1
) AS passenger
WHERE f."id" = passenger."flight_id";

CREATE INDEX "flight_created_by_id_idx" ON "flight"("created_by_id");

ALTER TABLE "flight" ADD CONSTRAINT "flight_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "user"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
