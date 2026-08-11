import { describe, expect, it } from 'vitest';

import { isGuestFlight, matchesFlightAudience } from './flight-audience';

const personal = { passengers: [{ guestName: null }] };
const guest = {
  passengers: [{ guestName: null }, { guestName: 'Mark' }],
};

describe('flight audience', () => {
  it('identifies flights containing a guest passenger', () => {
    expect(isGuestFlight(personal)).toBe(false);
    expect(isGuestFlight(guest)).toBe(true);
  });

  it('keeps personal and guest views mutually exclusive', () => {
    expect(matchesFlightAudience(personal, 'personal')).toBe(true);
    expect(matchesFlightAudience(personal, 'guests')).toBe(false);
    expect(matchesFlightAudience(guest, 'personal')).toBe(false);
    expect(matchesFlightAudience(guest, 'guests')).toBe(true);
  });
});
