import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { apiError, unauthorized, validateApiKey } from '$lib/server/utils/api';
import {
  FlightStatsError,
  scrapeFlightStatus,
} from '$lib/server/utils/flight-lookup/flightstats';

export const GET: RequestHandler = async ({ request, url }) => {
  const user = await validateApiKey(request);
  if (!user) return unauthorized();

  const flightNumber = url.searchParams.get('flightNumber');
  const date = url.searchParams.get('date') ?? undefined;
  if (!flightNumber) {
    return apiError('flightNumber query parameter is required', 400);
  }

  try {
    const flight = await scrapeFlightStatus(flightNumber, date);
    return json({ success: true, flight });
  } catch (error) {
    if (error instanceof FlightStatsError) {
      return apiError(error.message, error.status);
    }
    console.error('[flight-status] unexpected error:', error);
    return apiError('Failed to retrieve flight status');
  }
};
