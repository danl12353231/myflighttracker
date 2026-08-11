import type { RequestHandler } from './$types';

import { trpcServer } from '$lib/server/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const withCors = (handler: RequestHandler): RequestHandler => {
  return async (event) => {
    const response = await handler(event);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  };
};

export const GET = withCors(trpcServer.handler);
export const POST = withCors(trpcServer.handler);

export const OPTIONS: RequestHandler = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });
