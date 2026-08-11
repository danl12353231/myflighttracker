import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { getUserWithPassword } from '$lib/server/utils/auth';
import { verifyArgon2 } from '$lib/server/utils/hash';
import { createMobileSession } from '$lib/server/utils/mobile-session';
import { signInSchema } from '$lib/zod/auth';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const parsed = signInSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return json({ error: 'Invalid request' }, { status: 400 });
  }

  const { username, password } = parsed.data;

  const user = await getUserWithPassword(username);
  if (!user || !user.password) {
    return json({ error: 'Invalid username or password' }, { status: 401 });
  }

  const validPassword = await verifyArgon2(user.password, password);
  if (!validPassword) {
    return json({ error: 'Invalid username or password' }, { status: 401 });
  }

  const session = await createMobileSession(user.id);

  return json({ token: session.token, expiresAt: session.expiresAt });
};
