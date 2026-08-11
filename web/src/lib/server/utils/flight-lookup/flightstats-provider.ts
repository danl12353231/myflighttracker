import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

import type {
  FlightLookupProviderOptions,
  FlightLookupResult,
} from './flight-lookup';
import { scrapeFlightStatus } from './flightstats';

import {
  getAircraftByIcao,
  getAircraftByName,
} from '$lib/server/utils/aircraft';
import { getAirlineByIata, getAirlineByName } from '$lib/server/utils/airline';
import { getAirportByIata } from '$lib/server/utils/airport';

const toZonedDate = (value: string | null, timeZone: string): TZDate | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new TZDate(date, timeZone);
};

const toIcaoAircraftCode = (
  code: string | null,
  name: string | null,
): string | null => {
  if (!code) return null;
  if (!/^\d{3}$/.test(code)) return code;
  if (name?.startsWith('Boeing ')) return `B${code}`;
  if (name?.startsWith('Airbus ')) return `A${code}`;
  return code;
};

export async function getFlightRoute(
  flightNumber: string,
  opts?: FlightLookupProviderOptions,
): Promise<FlightLookupResult> {
  const status = await scrapeFlightStatus(
    flightNumber,
    opts?.date ? format(opts.date, 'yyyy-MM-dd') : undefined,
  );
  const flight = status.flight;
  const fromIata = flight.departure.airport.iata;
  const toIata = flight.arrival.airport.iata;
  if (!fromIata || !toIata)
    throw new Error('Flight airports were not provided');

  const aircraftIcao = toIcaoAircraftCode(
    flight.aircraft.typeCode,
    flight.aircraft.typeName,
  );

  const [from, to, airlineByCode, aircraftByName, aircraftByCode] =
    await Promise.all([
      getAirportByIata(fromIata),
      getAirportByIata(toIata),
      getAirlineByIata(flight.carrierCode),
      flight.aircraft.typeName
        ? getAircraftByName(flight.aircraft.typeName)
        : null,
      aircraftIcao ? getAircraftByIcao(aircraftIcao) : null,
    ]);
  if (!from || !to)
    throw new Error('Flight airports are not available in AirTrail');

  const airline =
    airlineByCode ??
    (flight.carrierName ? await getAirlineByName(flight.carrierName) : null);
  const departureTime = flight.departure.time;
  const arrivalTime = flight.arrival.time;

  return [
    {
      from,
      to,
      departure:
        departureTime.bestKnownType === 'actual'
          ? toZonedDate(departureTime.bestKnownUtc, from.tz)
          : null,
      arrival:
        arrivalTime.bestKnownType === 'actual'
          ? toZonedDate(arrivalTime.bestKnownUtc, to.tz)
          : null,
      departureScheduled: toZonedDate(departureTime.scheduledUtc, from.tz),
      arrivalScheduled: toZonedDate(arrivalTime.scheduledUtc, to.tz),
      airline,
      aircraft: aircraftByName ?? aircraftByCode,
      aircraftReg: flight.aircraft.registration,
      departureTerminal: flight.departure.airport.terminal,
      departureGate: flight.departure.airport.gate,
      arrivalTerminal: flight.arrival.airport.terminal,
      arrivalGate: flight.arrival.airport.gate,
    },
  ];
}
