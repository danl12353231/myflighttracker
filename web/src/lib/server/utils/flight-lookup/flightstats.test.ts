import { describe, expect, it } from 'vitest';

import {
  buildFlightStatsUrl,
  FlightStatsError,
  parseFlightDesignator,
  parseFlightStatsHtml,
} from './flightstats';

const flight = {
  flightId: 1401089331,
  flightState: 'en-route',
  flightNote: {
    canceled: false,
    tracking: true,
    phase: 'Cruising',
  },
  schedule: {
    scheduledDepartureUTC: '2026-08-10T22:10:00.000Z',
    estimatedActualDepartureTitle: 'Actual',
    estimatedActualDepartureUTC: '2026-08-10T22:31:00.000Z',
    scheduledArrivalUTC: '2026-08-11T05:25:00.000Z',
    estimatedActualArrivalTitle: 'Estimated',
    estimatedActualArrivalUTC: '2026-08-11T05:52:00.000Z',
  },
  status: {
    statusCode: 'A',
    status: 'Departed',
    statusDescription: 'Delayed by 27m',
    diverted: false,
    delay: {
      departure: { minutes: 21 },
      arrival: { minutes: 27 },
    },
  },
  resultHeader: {
    flightNumber: '100',
    carrier: { fs: 'AA', name: 'American Airlines' },
  },
  departureAirport: {
    iata: 'JFK',
    fs: 'JFK',
    name: 'New York John F. Kennedy International Airport',
    timeZoneRegionName: 'America/New_York',
    terminal: '8',
    gate: '4',
  },
  arrivalAirport: {
    iata: 'LHR',
    fs: 'LHR',
    name: 'London Heathrow Airport',
    timeZoneRegionName: 'Europe/London',
    terminal: '3',
    gate: '27',
  },
  additionalFlightInfo: {
    equipment: { iata: '789', name: 'Boeing 787-9' },
  },
  positional: { flexTrack: { tailNumber: 'N842AA' } },
};

const page = (value: unknown) =>
  `<html><script>__NEXT_DATA__ = ${JSON.stringify(value)};__NEXT_LOADED_PAGES__=[];</script></html>`;

describe('FlightStats scraper', () => {
  it('parses common flight designator formats', () => {
    expect(parseFlightDesignator('AA100')).toEqual({
      carrierCode: 'AA',
      flightNumber: '100',
    });
    expect(parseFlightDesignator('AAL 100')).toEqual({
      carrierCode: 'AAL',
      flightNumber: '100',
    });
    expect(parseFlightDesignator('sk-728')).toEqual({
      carrierCode: 'SK',
      flightNumber: '728',
    });
  });

  it('builds a tracker URL and validates the date', () => {
    expect(buildFlightStatsUrl('AA', '100')).toBe(
      'https://www.flightstats.com/v2/flight-tracker/AA/100',
    );
    expect(buildFlightStatsUrl('AA', '100', '2026-08-10')).toBe(
      'https://www.flightstats.com/v2/flight-tracker/AA/100?year=2026&month=8&date=10',
    );
    expect(() => buildFlightStatsUrl('AA', '100', '2026-02-30')).toThrow(
      'date is not a valid calendar date',
    );
  });

  it('normalizes delays, gates, statuses, and time semantics', () => {
    const html = page({
      props: { initialState: { flightTracker: { flight } } },
    });
    const result = parseFlightStatsHtml(
      html,
      'https://example.test/flight',
      new Date('2026-08-10T23:00:00.000Z'),
    );

    expect(result).toMatchObject({
      source: {
        provider: 'FlightStats',
        flightId: 1401089331,
        retrievedAt: '2026-08-10T23:00:00.000Z',
      },
      flight: {
        flightNumber: 'AA100',
        status: {
          name: 'Departed',
          description: 'Delayed by 27m',
          state: 'en-route',
          phase: 'Cruising',
          tracking: true,
        },
        departure: {
          airport: { iata: 'JFK', terminal: '8', gate: '4' },
          delayMinutes: 21,
          time: {
            bestKnownType: 'actual',
            bestKnownUtc: '2026-08-10T22:31:00.000Z',
          },
        },
        arrival: {
          airport: { iata: 'LHR', terminal: '3', gate: '27' },
          delayMinutes: 27,
          time: {
            bestKnownType: 'estimated',
            bestKnownUtc: '2026-08-11T05:52:00.000Z',
          },
        },
        aircraft: {
          registration: 'N842AA',
          typeCode: '789',
          typeName: 'Boeing 787-9',
        },
      },
    });
  });

  it('does not mistake braces and escaped quotes inside strings for JSON boundaries', () => {
    const value = {
      props: { initialState: { flightTracker: { flight } } },
      text: 'a } brace and an escaped " quote',
    };
    expect(
      parseFlightStatsHtml(page(value), 'https://example.test').flight
        .flightNumber,
    ).toBe('AA100');
  });

  it('reports a missing flight as not found', () => {
    const html = page({
      props: { initialState: { flightTracker: { flight: null } } },
    });

    try {
      parseFlightStatsHtml(html, 'https://example.test');
      throw new Error('Expected parser to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(FlightStatsError);
      expect((error as FlightStatsError).status).toBe(404);
    }
  });
});
