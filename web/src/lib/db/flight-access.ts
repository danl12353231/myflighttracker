import { sql } from 'kysely';

export const flightUserAccessCondition = (userId: string) => sql<boolean>`
  ("flight"."created_by_id" = ${userId} OR EXISTS (
    SELECT 1
    FROM "flight_passenger"
    WHERE "flight_passenger"."flight_id" = "flight"."id"
      AND "flight_passenger"."user_id" = ${userId}
  ))
`;

export const userCanAccessFlight = (
  flight: {
    createdById: string | null;
    passengers: Array<{ userId: string | null }>;
  },
  userId: string,
) =>
  flight.createdById === userId ||
  flight.passengers.some((passenger) => passenger.userId === userId);
