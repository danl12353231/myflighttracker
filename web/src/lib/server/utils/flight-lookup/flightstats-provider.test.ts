import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFlightRoute } from './flightstats-provider';

const {
  scrapeFlightStatus,
  getAirportByIata,
  getAirlineByIata,
  getAirlineByName,
  getAircraftByIcao,
  getAircraftByName,
} = vi.hoisted(() => ({
  scrapeFlightStatus: vi.fn(),
  getAirportByIata: vi.fn(),
  getAirlineByIata: vi.fn(),
  getAirlineByName: vi.fn(),
  getAircraftByIcao: vi.fn(),
  getAircraftByName: vi.fn(),
}));

vi.mock('./flightstats', () => ({ scrapeFlightStatus }));
vi.mock('$lib/server/utils/airport', () => ({ getAirportByIata }));
vi.mock('$lib/server/utils/airline', () => ({
  getAirlineByIata,
  getAirlineByName,
}));
vi.mock('$lib/server/utils/aircraft', () => ({
  getAircraftByIcao,
  getAircraftByName,
}));

const jfk = { id: 1, iata: 'JFK', icao: 'KJFK', tz: 'America/New_York' };
const lhr = { id: 2, iata: 'LHR', icao: 'EGLL', tz: 'Europe/London' };
const airline = { id: 3, iata: 'AA', icao: 'AAL', name: 'American Airlines' };
const aircraft = { id: 4, icao: 'B789', name: 'Boeing 787-9' };

const status = {
  source: {
    provider: 'FlightStats',
    url: 'https://example.test',
    flightId: 1,
    retrievedAt: '2026-08-10T23:00:00.000Z',
  },
  flight: {
    flightNumber: 'AA100',
    carrierCode: 'AA',
    carrierName: 'American Airlines',
    status: {
      code: 'A',
      name: 'Departed',
      description: 'Delayed by 27m',
      state: 'en-route',
      phase: 'Cruising',
      cancelled: false,
      diverted: false,
      tracking: true,
    },
    departure: {
      airport: {
        iata: 'JFK',
        name: 'John F. Kennedy International Airport',
        timeZone: 'America/New_York',
        terminal: '8',
        gate: '4',
      },
      delayMinutes: 21,
      time: {
        scheduledUtc: '2026-08-10T22:10:00.000Z',
        bestKnownUtc: '2026-08-10T22:31:00.000Z',
        bestKnownType: 'actual',
      },
    },
    arrival: {
      airport: {
        iata: 'LHR',
        name: 'London Heathrow Airport',
        timeZone: 'Europe/London',
        terminal: '3',
        gate: '27',
      },
      delayMinutes: 27,
      time: {
        scheduledUtc: '2026-08-11T05:25:00.000Z',
        bestKnownUtc: '2026-08-11T05:52:00.000Z',
        bestKnownType: 'estimated',
      },
    },
    aircraft: {
      registration: 'N842AA',
      typeCode: '789',
      typeName: 'Boeing 787-9',
    },
  },
} as const;

describe('FlightStats flight lookup provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scrapeFlightStatus.mockResolvedValue(status);
    getAirportByIata.mockImplementation(async (code: string) =>
      code === 'JFK' ? jfk : lhr,
    );
    getAirlineByIata.mockResolvedValue(airline);
    getAirlineByName.mockResolvedValue(null);
    getAircraftByName.mockResolvedValue(aircraft);
    getAircraftByIcao.mockResolvedValue(null);
  });

  it('maps scraped fields into the add-flight lookup result', async () => {
    const [result] = await getFlightRoute('AA100');

    expect(scrapeFlightStatus).toHaveBeenCalledWith('AA100', undefined);
    expect(result).toMatchObject({
      from: jfk,
      to: lhr,
      airline,
      aircraft,
      aircraftReg: 'N842AA',
      departureTerminal: '8',
      departureGate: '4',
      arrivalTerminal: '3',
      arrivalGate: '27',
    });
    expect(result?.departure?.getTime()).toBe(
      new Date('2026-08-10T22:31:00.000Z').getTime(),
    );
    expect(result?.arrival).toBeNull();
    expect(result?.departureScheduled?.getTime()).toBe(
      new Date('2026-08-10T22:10:00.000Z').getTime(),
    );
    expect(result?.arrivalScheduled?.getTime()).toBe(
      new Date('2026-08-11T05:25:00.000Z').getTime(),
    );
    expect(getAircraftByIcao).toHaveBeenCalledWith('B789');
  });

  it('maps numeric Boeing equipment codes to AirTrail ICAO codes', async () => {
    scrapeFlightStatus.mockResolvedValue({
      ...status,
      flight: {
        ...status.flight,
        aircraft: {
          registration: 'G-VIIT',
          typeCode: '772',
          typeName: 'Boeing 777-200 / 200ER',
        },
      },
    });
    getAircraftByName.mockResolvedValue(null);
    getAircraftByIcao.mockResolvedValue(aircraft);

    const [result] = await getFlightRoute('BA2278');

    expect(getAircraftByIcao).toHaveBeenCalledWith('B772');
    expect(result?.aircraft).toBe(aircraft);
  });

  it('passes a selected departure date to FlightStats', async () => {
    await getFlightRoute('AA100', {
      date: new Date('2026-08-10T00:00:00.000Z'),
    });

    expect(scrapeFlightStatus).toHaveBeenCalledWith('AA100', '2026-08-10');
  });

  it('requires both airports to exist in AirTrail', async () => {
    getAirportByIata.mockResolvedValueOnce(null).mockResolvedValueOnce(lhr);

    await expect(getFlightRoute('AA100')).rejects.toThrow(
      'Flight airports are not available in AirTrail',
    );
  });
});
