import { TRPCError } from '@trpc/server';
import { sql } from 'kysely';
import { z } from 'zod';

import {
  adminProcedure,
  authedProcedure,
  publicProcedure,
  router,
} from '../trpc';

import { db } from '$lib/db';
import { createApiKey, usernameExists } from '$lib/server/utils/auth';
import { publicUserSelect } from '$lib/server/utils/user';
import { updatePreferencesSchema } from '$lib/zod/user';

export const userRouter = router({
  me: authedProcedure.query(({ ctx: { user } }) => {
    return user;
  }),
  isSetup: publicProcedure.query(async () => {
    const users = await db
      .selectFrom('user')
      .select(sql`1`.as('exists'))
      .limit(1)
      .execute();
    return users.length > 0;
  }),
  delete: authedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {    if (ctx.user.id !== input && ctx.user.role === 'user') {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    const user = await db
      .selectFrom('user')
      .selectAll()
      .where('id', '=', input)
      .executeTakeFirst();
    if (!user) {
      return false;
    }

    // Only allow deleting users if the user is an owner or the user is an admin and the user is not an admin or owner
    if (
      user.role === 'owner' ||
      (ctx.user.role === 'admin' &&
        user.role !== 'user' &&
        ctx.user.id !== user.id)
    ) {
      return false;
    }

    return await db.transaction().execute(async (trx) => {
      const affectedFlights = await trx
        .selectFrom('flightPassenger')
        .select('flightId')
        .where('userId', '=', input)
        .execute();

      const result = await trx
        .deleteFrom('user')
        .where('id', '=', input)
        .executeTakeFirst();

      const affectedFlightIds = affectedFlights.map(({ flightId }) => flightId);
      if (affectedFlightIds.length > 0) {
        await trx
          .deleteFrom('flight')
          .where('id', 'in', affectedFlightIds)
          .where(({ not, exists, selectFrom }) =>
            not(
              exists(
                selectFrom('flightPassenger')
                  .select('id')
                  .whereRef('flightPassenger.flightId', '=', 'flight.id'),
              ),
            ),
          )
          .execute();
      }

      return result.numDeletedRows > 0;
    });
  }),
  list: authedProcedure.query(async () => {
    return db.selectFrom('user').select(publicUserSelect).execute();
  }),
  updateUser: adminProcedure
    .input(
      z.object({
        id: z.string(),
        username: z.string().min(1).optional(),
        displayName: z.string().min(1).optional(),
        role: z.enum(['user', 'admin', 'owner']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const target = await db
        .selectFrom('user')
        .selectAll()
        .where('id', '=', input.id)
        .executeTakeFirst();
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      if (target.role === 'owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot edit the owner' });
      }
      if (target.role === 'admin' && ctx.user.role === 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admins cannot edit other admins',
        });
      }

      const updates: Record<string, string> = {};
      if (input.username !== undefined && input.username !== target.username) {
        const exists = await usernameExists(input.username, target.id);
        if (exists) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Username already exists',
          });
        }
        updates.username = input.username;
      }
      if (input.displayName !== undefined && input.displayName !== target.displayName) {
        updates.displayName = input.displayName;
      }
      if (input.role !== undefined && input.role !== target.role) {
        updates.role = input.role;
      }

      if (Object.keys(updates).length === 0) return true;

      await db.updateTable('user').set(updates).where('id', '=', target.id).execute();
      return true;
    }),
  listApiKeys: authedProcedure.query(async ({ ctx }) => {
    return db
      .selectFrom('apiKey')
      .select(['id', 'name', 'createdAt', 'lastUsed'])
      .where('userId', '=', ctx.user.id)
      .execute();
  }),
  createApiKey: authedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return await createApiKey(ctx.user.id, input);
    }),
  deleteApiKey: authedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .deleteFrom('apiKey')
        .where('id', '=', input)
        .where('userId', '=', ctx.user.id)
        .executeTakeFirst();
      return result.numDeletedRows > 0;
    }),
  updatePreferences: authedProcedure
    .input(updatePreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      if (Object.keys(input).length === 0) return true;
      const result = await db
        .updateTable('user')
        .set(input)
        .where('id', '=', ctx.user.id)
        .executeTakeFirst();
      return Number(result.numUpdatedRows) > 0;
    }),
});
