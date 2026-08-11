import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { deleteMobileSession } from '$lib/server/utils/mobile-session';

export const POST: RequestHandler = async ({ request }) => {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) {
    return json({ ok: true });
  }

  await deleteMobileSession(token);
  return json({ ok: true });
};
