import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { userCanAccessFlight } from '$lib/db/flight-access';
import { apiError, unauthorized, validateApiKey } from '$lib/server/utils/api';
import { getFlight } from '$lib/server/utils/flight';

export const GET: RequestHandler = async ({ request, params }) => {
  const user = await validateApiKey(request);
  if (!user) {
    return unauthorized();
  }

  const id = +params.id;
  if (isNaN(id)) {
    return apiError('Flight id is not a number', 400);
  }

  const flight = await getFlight(id);
  if (!flight) {
    return apiError('Flight not found', 404);
  }
  if (user.role === 'user' && !userCanAccessFlight(flight, user.id)) {
    return apiError('You do not have access to this flight', 403);
  }

  return json({ success: true, flight });
};
