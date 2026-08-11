import { z } from 'zod';

const BASE_URL = 'https://www.flightstats.com/v2/flight-tracker';
const FETCH_TIMEOUT_MS = 10_000;

const nullableString = z.string().nullable().optional();

const airportSchema = z.object({
  iata: nullableString,
  fs: nullableString,
  name: nullableString,
  timeZoneRegionName: nullableString,
  terminal: nullableString,
  gate: nullableString,
});

const flightSchema = z.object({
  flightId: z.number(),
  flightState: nullableString,
  flightNote: z
    .object({
      canceled: z.boolean().optional(),
      tracking: z.boolean().optional(),
      phase: nullableString,
    })
    .optional(),
  schedule: z.object({
    scheduledDepartureUTC: nullableString,
    estimatedActualDepartureTitle: nullableString,
    estimatedActualDepartureUTC: nullableString,
    scheduledArrivalUTC: nullableString,
    estimatedActualArrivalTitle: nullableString,
    estimatedActualArrivalUTC: nullableString,
  }),
  status: z.object({
    statusCode: nullableString,
    status: nullableString,
    statusDescription: nullableString,
    diverted: z.boolean().optional(),
    delay: z
      .object({
        departure: z
          .object({ minutes: z.number().nullable().optional() })
          .optional(),
        arrival: z
          .object({ minutes: z.number().nullable().optional() })
          .optional(),
      })
      .optional(),
  }),
  resultHeader: z.object({
    flightNumber: z.string(),
    carrier: z.object({
      fs: z.string(),
      name: nullableString,
    }),
  }),
  departureAirport: airportSchema,
  arrivalAirport: airportSchema,
  additionalFlightInfo: z
    .object({
      equipment: z
        .object({
          iata: nullableString,
          name: nullableString,
        })
        .nullable()
        .optional(),
    })
    .optional(),
  positional: z
    .object({
      flexTrack: z
        .object({
          tailNumber: nullableString,
        })
        .optional(),
    })
    .optional(),
});

const pageSchema = z.object({
  props: z.object({
    initialState: z.object({
      flightTracker: z.object({
        flight: flightSchema.nullable().optional(),
      }),
    }),
  }),
});

type UpstreamFlight = z.infer<typeof flightSchema>;

export type FlightStatusTime = {
  scheduledUtc: string | null;
  bestKnownUtc: string | null;
  bestKnownType: 'actual' | 'estimated' | null;
};

export type FlightStatusAirport = {
  iata: string | null;
  name: string | null;
  timeZone: string | null;
  terminal: string | null;
  gate: string | null;
};

export type FlightStatusResult = {
  source: {
    provider: 'FlightStats';
    url: string;
    flightId: number;
    retrievedAt: string;
  };
  flight: {
    flightNumber: string;
    carrierCode: string;
    carrierName: string | null;
    status: {
      code: string | null;
      name: string | null;
      description: string | null;
      state: string | null;
      phase: string | null;
      cancelled: boolean;
      diverted: boolean;
      tracking: boolean;
    };
    departure: {
      airport: FlightStatusAirport;
      delayMinutes: number | null;
      time: FlightStatusTime;
    };
    arrival: {
      airport: FlightStatusAirport;
      delayMinutes: number | null;
      time: FlightStatusTime;
    };
    aircraft: {
      registration: string | null;
      typeCode: string | null;
      typeName: string | null;
    };
  };
};

export class FlightStatsError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'FlightStatsError';
    this.status = status;
  }
}

export function parseFlightDesignator(value: string): {
  carrierCode: string;
  flightNumber: string;
} {
  const cleaned = value.trim();
  const match =
    /^([A-Z0-9]{2})\s*(\d{1,4}[A-Z]?)$/i.exec(cleaned) ??
    /^([A-Z0-9]{2,3})[\s-]+(\d{1,4}[A-Z]?)$/i.exec(cleaned);
  if (!match?.[1] || !match[2]) {
    throw new FlightStatsError(
      'flightNumber must include an airline code, for example AA100',
      400,
    );
  }

  return {
    carrierCode: match[1].toUpperCase(),
    flightNumber: match[2].toUpperCase(),
  };
}

export function parseFlightDate(value: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new FlightStatsError('date must use YYYY-MM-DD format', 400);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new FlightStatsError('date is not a valid calendar date', 400);
  }

  return { year, month, day };
}

export function buildFlightStatsUrl(
  carrierCode: string,
  flightNumber: string,
  date?: string,
): string {
  const path = `${BASE_URL}/${encodeURIComponent(carrierCode)}/${encodeURIComponent(flightNumber)}`;
  if (!date) return path;

  const parsedDate = parseFlightDate(date);
  const query = new URLSearchParams({
    year: String(parsedDate.year),
    month: String(parsedDate.month),
    date: String(parsedDate.day),
  });

  return `${path}?${query}`;
}

function extractNextData(html: string): unknown {
  const assignment = /__NEXT_DATA__\s*=\s*/g.exec(html);
  if (!assignment) {
    throw new FlightStatsError(
      'FlightStats page did not contain structured flight data',
      502,
    );
  }

  const start = assignment.index + assignment[0].length;
  if (html[start] !== '{') {
    throw new FlightStatsError(
      'FlightStats returned an unexpected data format',
      502,
    );
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, index + 1));
        } catch {
          throw new FlightStatsError(
            'FlightStats returned malformed structured data',
            502,
          );
        }
      }
    }
  }

  throw new FlightStatsError('FlightStats structured data was incomplete', 502);
}

function normalizeAirport(
  airport: z.infer<typeof airportSchema>,
): FlightStatusAirport {
  return {
    iata: airport.iata ?? airport.fs ?? null,
    name: airport.name ?? null,
    timeZone: airport.timeZoneRegionName ?? null,
    terminal: airport.terminal ?? null,
    gate: airport.gate ?? null,
  };
}

function normalizeTime(
  scheduledUtc: string | null | undefined,
  bestKnownUtc: string | null | undefined,
  bestKnownTitle: string | null | undefined,
): FlightStatusTime {
  const type = bestKnownTitle?.toLowerCase();
  return {
    scheduledUtc: scheduledUtc ?? null,
    bestKnownUtc: bestKnownUtc ?? null,
    bestKnownType: type === 'actual' || type === 'estimated' ? type : null,
  };
}

export function parseFlightStatsHtml(
  html: string,
  sourceUrl: string,
  retrievedAt = new Date(),
): FlightStatusResult {
  const page = pageSchema.safeParse(extractNextData(html));
  if (!page.success) {
    throw new FlightStatsError(
      'FlightStats flight data no longer matches the expected format',
      502,
    );
  }

  const upstream = page.data.props.initialState.flightTracker.flight;
  if (!upstream) {
    throw new FlightStatsError('No matching flight found', 404);
  }

  return normalizeFlight(upstream, sourceUrl, retrievedAt);
}

function normalizeFlight(
  upstream: UpstreamFlight,
  sourceUrl: string,
  retrievedAt: Date,
): FlightStatusResult {
  const equipment = upstream.additionalFlightInfo?.equipment;
  return {
    source: {
      provider: 'FlightStats',
      url: sourceUrl,
      flightId: upstream.flightId,
      retrievedAt: retrievedAt.toISOString(),
    },
    flight: {
      flightNumber: `${upstream.resultHeader.carrier.fs}${upstream.resultHeader.flightNumber}`,
      carrierCode: upstream.resultHeader.carrier.fs,
      carrierName: upstream.resultHeader.carrier.name ?? null,
      status: {
        code: upstream.status.statusCode ?? null,
        name: upstream.status.status ?? null,
        description: upstream.status.statusDescription ?? null,
        state: upstream.flightState ?? null,
        phase: upstream.flightNote?.phase ?? null,
        cancelled: upstream.flightNote?.canceled ?? false,
        diverted: upstream.status.diverted ?? false,
        tracking: upstream.flightNote?.tracking ?? false,
      },
      departure: {
        airport: normalizeAirport(upstream.departureAirport),
        delayMinutes: upstream.status.delay?.departure?.minutes ?? null,
        time: normalizeTime(
          upstream.schedule.scheduledDepartureUTC,
          upstream.schedule.estimatedActualDepartureUTC,
          upstream.schedule.estimatedActualDepartureTitle,
        ),
      },
      arrival: {
        airport: normalizeAirport(upstream.arrivalAirport),
        delayMinutes: upstream.status.delay?.arrival?.minutes ?? null,
        time: normalizeTime(
          upstream.schedule.scheduledArrivalUTC,
          upstream.schedule.estimatedActualArrivalUTC,
          upstream.schedule.estimatedActualArrivalTitle,
        ),
      },
      aircraft: {
        registration: upstream.positional?.flexTrack?.tailNumber ?? null,
        typeCode: equipment?.iata ?? null,
        typeName: equipment?.name ?? null,
      },
    },
  };
}

export async function scrapeFlightStatus(
  flightDesignator: string,
  date?: string,
): Promise<FlightStatusResult> {
  const { carrierCode, flightNumber } = parseFlightDesignator(flightDesignator);
  const url = buildFlightStatsUrl(carrierCode, flightNumber, date);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html',
        'User-Agent':
          'AirTrail flight-status prototype (+https://github.com/johanohly/AirTrail)',
      },
      signal: controller.signal,
    });
    if (response.status === 404) {
      throw new FlightStatsError('No matching flight found', 404);
    }
    if (!response.ok) {
      throw new FlightStatsError(
        `FlightStats request failed with status ${response.status}`,
        502,
      );
    }

    return parseFlightStatsHtml(await response.text(), url);
  } catch (error) {
    if (error instanceof FlightStatsError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FlightStatsError('FlightStats request timed out', 504);
    }
    throw new FlightStatsError('FlightStats request failed', 502);
  } finally {
    clearTimeout(timer);
  }
}
