import type { Flight, VisitedAirport } from "./router";

/**
 * Build visited airports from a set of flights, mirroring the web app's
 * prepareVisitedAirports. Each airport is enriched with departure/arrival
 * counts and distinct airline ids, deduped by airport name.
 */
export function prepareVisitedAirports(flights: Flight[]): VisitedAirport[] {
  const byName = new Map<string, VisitedAirport>();

  for (const f of flights) {
    const touch = (airport: Flight["from"], isDeparture: boolean) => {
      if (!airport) return;
      const existing = byName.get(airport.name);
      const entry: VisitedAirport = existing ?? {
        ...airport,
        departures: 0,
        arrivals: 0,
        airlines: [],
        frequency: 1,
      };
      if (isDeparture) entry.departures += 1;
      else entry.arrivals += 1;
      if (f.airline?.id != null && !entry.airlines.includes(f.airline.id)) {
        entry.airlines.push(f.airline.id);
      }
      byName.set(airport.name, entry);
    };

    touch(f.from, true);
    touch(f.to, false);
  }

  const airports = [...byName.values()];
  const total = airports.reduce((acc, a) => acc + a.departures + a.arrivals, 0);
  if (airports.length <= 1) {
    airports.forEach((a) => (a.frequency = 2));
    return airports;
  }
  const raw = airports.map((a) => a.departures + a.arrivals);
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const span = max - min || 1;
  airports.forEach((a, i) => {
    a.frequency = ((raw[i]! - min) / span) * 2 + 1;
  });
  void total;
  return airports;
}
