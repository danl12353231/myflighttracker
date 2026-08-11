import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getConfig, getFlightStatsRoute, getAdsbdbRoute, getAerodataboxRoute } =
  vi.hoisted(() => ({
    getConfig: vi.fn(),
    getFlightStatsRoute: vi.fn(),
    getAdsbdbRoute: vi.fn(),
    getAerodataboxRoute: vi.fn(),
  }));

vi.mock('$lib/server/utils/config', () => ({
  appConfig: { get: getConfig },
}));
vi.mock('./flightstats-provider', () => ({
  getFlightRoute: getFlightStatsRoute,
}));
vi.mock('./adsbdb', () => ({ getFlightRoute: getAdsbdbRoute }));
vi.mock('./aerodatabox', () => ({ getFlightRoute: getAerodataboxRoute }));

import { getFlightRoute } from './flight-lookup';

describe('flight lookup provider selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfig.mockResolvedValue({ integrations: {} });
  });

  it('uses FlightStats for detailed lookups without an AeroDataBox key', async () => {
    const results = [{ from: { icao: 'KJFK' }, to: { icao: 'EGLL' } }];
    getFlightStatsRoute.mockResolvedValue(results);

    await expect(getFlightRoute('AA100')).resolves.toBe(results);
    expect(getFlightStatsRoute).toHaveBeenCalledWith('AA100', undefined);
    expect(getAdsbdbRoute).not.toHaveBeenCalled();
  });

  it('falls back to ADSBDB when FlightStats fails', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const results = [{ from: { icao: 'KJFK' }, to: { icao: 'EGLL' } }];
    getFlightStatsRoute.mockRejectedValue(new Error('page changed'));
    getAdsbdbRoute.mockResolvedValue(results);

    await expect(getFlightRoute('AA100')).resolves.toBe(results);
    expect(getAdsbdbRoute).toHaveBeenCalledWith('AA100');
    warning.mockRestore();
  });

  it('keeps configured AeroDataBox as the supported provider', async () => {
    const results = [{ from: { icao: 'KJFK' }, to: { icao: 'EGLL' } }];
    getConfig.mockResolvedValue({
      integrations: { aeroDataBoxKey: 'configured' },
    });
    getAerodataboxRoute.mockResolvedValue(results);

    await expect(getFlightRoute('AA100')).resolves.toBe(results);
    expect(getAerodataboxRoute).toHaveBeenCalledWith('AA100', undefined);
    expect(getFlightStatsRoute).not.toHaveBeenCalled();
  });
});
