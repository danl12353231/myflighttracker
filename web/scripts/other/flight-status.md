# Flight status scraper prototype

This prototype reads the structured flight data embedded in FlightStats tracker
pages and normalizes status, delays, gates, terminals, times, and aircraft data.

Run it directly:

```bash
bun run prototype:flight-status AA100
bun run prototype:flight-status AA100 2026-08-10
```

Or call the authenticated AirTrail endpoint:

```bash
curl -H "Authorization: Bearer <api-key>" \
  "http://localhost:3000/api/flight/status?flightNumber=AA100"
```

When no date is supplied, FlightStats selects the current flight operation.
The add-flight form uses this lookup automatically when AeroDataBox is not
configured. If FlightStats is unavailable, AirTrail falls back to ADSBDB's
route-only result.

FlightStats is an unsupported HTML source, not a stable API. Cirium's terms
restrict downloading, storage, reproduction, and reuse of its data. Obtain
permission before production use, do not cache data for more than three days,
and do not use this data for safety-critical or passenger-rights decisions.
Gates and terminals are nullable and can change close to departure.
