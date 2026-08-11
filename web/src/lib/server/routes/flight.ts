import { parseISO } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, router } from '../trpc';

import { db } from '$lib/db';
import { flightUserAccessCondition, userCanAccessFlight } from '$lib/db/flight-access';
import type { CreateFlight } from '$lib/db/types';
import {
  createManyFlights,
  deleteFlight,
  getFlight,
  listAllFlights,
  listFlights,
  listUpcomingFlights,
  validateFlightDates,
} from '$lib/server/utils/flight';
import { getAircraftFromReg } from '$lib/server/utils/flight-lookup/aerodatabox';
import { getFlightRoute } from '$lib/server/utils/flight-lookup/flight-lookup';
import {
  FlightStatsError,
  scrapeFlightStatus,
} from '$lib/server/utils/flight-lookup/flightstats';
import { validateFlightImportPermissions } from '$lib/server/utils/flight-import';
import {
  createFlightPrimitiveWithConnection,
  updateFlightPrimitiveWithConnection,
} from '$lib/db/queries';
import {
  CustomFieldValidationError,
  persistEntityCustomFields,
} from '$lib/server/utils/custom-fields';
import { generateCsv } from '$lib/utils/csv';
import { generateBackup, serializeBackup } from '$lib/server/utils/backup';

const flightListInput = z
  .object({
    scope: z.enum(['mine', 'user', 'all']).default('mine'),
    userId: z.string().optional(),
  })
  .optional();

export const flightRouter = router({
  lookup: authedProcedure
    .input(
      z.object({
        flightNumber: z.string(),
        date: z.string().datetime({ offset: true }).optional(),
        preferredRoute: z
          .object({
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const results = await getFlightRoute(input.flightNumber, {
        // @ts-expect-error - We know the date string is a full ISO datetime string
        date: input.date ? parseISO(input.date.split('T')[0]) : undefined,
        preferredRoute: input.preferredRoute,
      });

      const [onlyFlight] = results;
      if (
        results.length === 1 &&
        onlyFlight?.aircraftReg &&
        !onlyFlight.aircraft
      ) {
        try {
          onlyFlight.aircraft = await getAircraftFromReg(
            onlyFlight.aircraftReg,
          );
        } catch {
          // Aircraft lookup is optional and requires an AeroDataBox key.
        }
      }

      // The below mess is required to maintain timezone through serialization
      return results.map((r) => ({
        ...r,
        departure: r.departure ? r.departure.toISOString() : null,
        departureTz: r.departure ? r.departure.timeZone : null,
        arrival: r.arrival ? r.arrival.toISOString() : null,
        arrivalTz: r.arrival ? r.arrival.timeZone : null,
        departureScheduled: r.departureScheduled
          ? r.departureScheduled.toISOString()
          : null,
        arrivalScheduled: r.arrivalScheduled
          ? r.arrivalScheduled.toISOString()
          : null,
      }));
    }),
  lookupAircraftByReg: authedProcedure
    .input(z.string())
    .query(async ({ input }) => {
      return await getAircraftFromReg(input);
    }),
  list: authedProcedure
    .input(flightListInput)
    .query(async ({ ctx: { user }, input }) => {
      const scope = input?.scope ?? 'mine';

      if (scope === 'mine') {
        return await listFlights(user.id);
      }

      if (user.role === 'user') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      if (scope === 'user') {
        if (!input?.userId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'A user is required for this scope',
          });
        }

        return await listFlights(input.userId);
      }

      return await listAllFlights();
    }),
  upcoming: authedProcedure
    .input(
      z
        .object({
          scope: z.enum(['mine', 'friends']).default('mine'),
        })
        .optional(),
    )
    .query(async ({ ctx: { user }, input }) => {
      return await listUpcomingFlights(user.id, input?.scope ?? 'mine');
    }),
  delete: authedProcedure
    .input(z.number())
    .mutation(async ({ ctx: { user }, input }) => {
      const accessibleFlight = await db
        .selectFrom('flight')
        .select('id')
        .where('id', '=', input)
        .where(flightUserAccessCondition(user.id))
        .executeTakeFirst();

      if (user.role === 'user' && !accessibleFlight) {
        throw new Error('You do not have access to this flight');
      }

      const resp = await deleteFlight(input);

      if (!resp.numDeletedRows) {
        throw new Error('Flight not found');
      }
    }),
  deleteMany: authedProcedure
    .input(z.array(z.number()))
    .mutation(async ({ ctx: { user }, input }) => {
      const result = await db
        .selectFrom('flight')
        .select('id')
        .where('id', 'in', input)
        .where(flightUserAccessCondition(user.id))
        .execute();
      const flightIds = result.map((flight) => flight.id);

      if (user.role === 'user' && flightIds.length !== input.length) {
        throw new Error('You do not have access to all flights');
      }

      await db.deleteFrom('flight').where('id', 'in', input).execute();
    }),
  deleteAll: authedProcedure.mutation(async ({ ctx: { user } }) => {
    const legacyFlightIds = await db
      .selectFrom('flight')
      .innerJoin('flightPassenger', 'flightPassenger.flightId', 'flight.id')
      .select('flight.id')
      .groupBy('flight.id')
      .having((eb) =>
        eb.and([
          eb(
            eb.fn.count(
              eb
                .case()
                .when('flightPassenger.userId', '=', user.id)
                .then(1)
                .else(null)
                .end(),
            ),
            '=',
            1,
          ),
          eb(
            eb.fn.count(
              eb
                .case()
                .when('flightPassenger.userId', 'is', null)
                .then(1)
                .else(null)
                .end(),
            ),
            '=',
            eb(eb.fn.count('flightPassenger.id'), '-', eb.lit(1)),
          ),
        ]),
      )
      .execute();

    const createdFlightIds = await db
      .selectFrom('flight')
      .select('id')
      .where('createdById', '=', user.id)
      .execute();

    const idsToDelete = Array.from(
      new Set([
        ...legacyFlightIds.map((flight) => flight.id),
        ...createdFlightIds.map((flight) => flight.id),
      ]),
    );

    if (idsToDelete.length === 0) {
      return;
    }

    await db.deleteFrom('flight').where('id', 'in', idsToDelete).execute();
  }),
  create: authedProcedure
    .input(z.custom<CreateFlight & { customFields?: Record<string, unknown> }>())
    .mutation(async ({ ctx: { user }, input }) => {
      const dateError = validateFlightDates(input);
      if (dateError) {
        throw new Error(dateError);
      }
      const { customFields, ...flight } = input;
      try {
        return await db.transaction().execute(async (trx) => {
          const created = await createFlightPrimitiveWithConnection(
            trx,
            flight,
            user.id,
          );
          await persistEntityCustomFields(trx, {
            entityType: 'flight',
            entityId: String(created.flightId),
            values: customFields ?? {},
          });
          for (const passenger of created.passengers) {
            await persistEntityCustomFields(trx, {
              entityType: 'flight_passenger',
              entityId: String(passenger.id),
              values: passenger.input.customFields ?? {},
            });
          }
          return created.flightId;
        });
      } catch (e) {
        if (e instanceof CustomFieldValidationError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
        throw e;
      }
    }),
  update: authedProcedure
    .input(
      z.custom<{ id: number; flight: CreateFlight; customFields?: Record<string, unknown> }>(),
    )
    .mutation(async ({ ctx: { user }, input }) => {
      const { id, flight, customFields } = input;
      const existing = await getFlight(id);
      if (
        !existing ||
        (user.role === 'user' && !userCanAccessFlight(existing, user.id))
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Flight not found or you do not have access to this flight',
        });
      }

      const dateError = validateFlightDates(flight);
      if (dateError) {
        throw new Error(dateError);
      }

      try {
        await db.transaction().execute(async (trx) => {
          const persistedPassengers = await updateFlightPrimitiveWithConnection(
            trx,
            id,
            flight,
          );
          await persistEntityCustomFields(trx, {
            entityType: 'flight',
            entityId: String(id),
            values: customFields ?? {},
          });
          for (const passenger of persistedPassengers) {
            await persistEntityCustomFields(trx, {
              entityType: 'flight_passenger',
              entityId: String(passenger.id),
              values: passenger.input.customFields ?? {},
            });
          }
        });
      } catch (e) {
        if (e instanceof CustomFieldValidationError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
        throw e;
      }
    }),
  createMany: authedProcedure
    .input(
      z.object({
        flights: z.custom<CreateFlight[]>(),
        dedupe: z.boolean().optional(),
        mode: z.enum(['personal', 'restore']).default('personal'),
      }),
    )
    .mutation(async ({ ctx: { user }, input }) => {
      for (const flight of input.flights) {
        const dateError = validateFlightDates(flight);
        if (dateError) {
          throw new Error(dateError);
        }
      }
      const permissionError = validateFlightImportPermissions(
        user,
        input.flights,
        input.mode,
      );
      if (permissionError) {
        throw new TRPCError({ code: 'FORBIDDEN', message: permissionError });
      }

      return await createManyFlights(
        input.flights,
        user.id,
        input.dedupe ?? true,
        input.mode,
      );
    }),
  exportJson: authedProcedure.query(async ({ ctx: { user } }) => {
    const backup = await generateBackup({ scope: 'mine', userId: user.id });
    return serializeBackup(backup, 'json');
  }),
  exportCsv: authedProcedure.query(async ({ ctx: { user } }) => {
    const res = await listFlights(user.id);
    const flights = res.map(({ id: _, passengers, ...flight }) => {
      const passenger = passengers.find(
        (passenger) => passenger.userId === user.id,
      );

      return {
        ...flight,
        from: flight.from?.name,
        to: flight.to?.name,
        airline: flight.airline?.name,
        aircraft: flight.aircraft?.name,
        seat: passenger?.seat,
        seatNumber: passenger?.seatNumber,
        seatClass: passenger?.seatClass,
        flightReason: passenger?.flightReason,
      };
    });

    return generateCsv(flights);
  }),
  status: authedProcedure
    .input(
      z.object({
        flightNumber: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await scrapeFlightStatus(
          input.flightNumber,
          input.date,
        );
      } catch (error) {
        if (error instanceof FlightStatsError) {
          throw new TRPCError({
            code: error.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve flight status',
        });
      }
    }),
});
