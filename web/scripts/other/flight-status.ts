import { scrapeFlightStatus } from '../../src/lib/server/utils/flight-lookup/flightstats.ts';

const [flightNumber, date] = process.argv.slice(2);
if (!flightNumber) {
  console.error(
    'Usage: bun run prototype:flight-status <flight-number> [YYYY-MM-DD]',
  );
  process.exit(1);
}

try {
  const result = await scrapeFlightStatus(flightNumber, date);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(JSON.stringify({ success: false, message }, null, 2));
  process.exit(1);
}
