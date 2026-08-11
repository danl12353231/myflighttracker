import type { RequestEvent } from '@sveltejs/kit';
import type { inferAsyncReturnType } from '@trpc/server';

import { validateMobileSession } from '$lib/server/utils/mobile-session';

export async function createContext(event: RequestEvent) {
  let { user, session } = event.locals;

  if (!user || !session) {
    const auth = event.request.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (token) {
      const mobile = await validateMobileSession(token);
      if (mobile) {
        user = mobile.user;
        session = {
          id: `mobile:${mobile.expiresAt.getTime()}`,
          expiresAt: mobile.expiresAt,
          userId: mobile.user.id,
        } as typeof session;
      }
    }
  }

  return {
    cookies: event.cookies,
    url: event.url,
    user,
    session,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
