import { db } from '$lib/db';
import type { User } from '$lib/db/types';
import { hashSha256 } from '$lib/server/utils/hash';
import { generateString } from '$lib/server/utils/random';

const MOBILE_SESSION_DAYS = 365;
const MOBILE_SESSION_NAME = 'mobile';

export const createMobileSession = async (userId: string) => {
  const token = generateString();
  const hash = hashSha256(token);
  const expiresAt = new Date(
    Date.now() + MOBILE_SESSION_DAYS * 24 * 60 * 60 * 1000,
  );

  await db
    .insertInto('mobileSession')
    .values({ userId, token: hash, expiresAt })
    .execute();

  return {
    token,
    expiresAt: expiresAt.toISOString(),
  };
};

export const validateMobileSession = async (
  token: string,
): Promise<{ user: User; expiresAt: Date } | null> => {
  const hash = hashSha256(token);
  const row = await db
    .selectFrom('mobileSession')
    .where('token', '=', hash)
    .select(['userId', 'expiresAt', 'id'])
    .executeTakeFirst();

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  const user = await db
    .selectFrom('user')
    .selectAll()
    .where('id', '=', row.userId)
    .executeTakeFirst();

  if (!user) return null;

  await db
    .updateTable('mobileSession')
    .set({ lastUsed: new Date() })
    .where('id', '=', row.id)
    .execute();

  return { user, expiresAt: row.expiresAt };
};

export const deleteMobileSession = async (token: string) => {
  const hash = hashSha256(token);
  await db
    .deleteFrom('mobileSession')
    .where('token', '=', hash)
    .execute();
};

export const MOBILE_SESSION_NAME_EXPORT = MOBILE_SESSION_NAME;
