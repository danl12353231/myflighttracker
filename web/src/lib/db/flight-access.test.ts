import { describe, expect, it } from 'vitest';

import { userCanAccessFlight } from './flight-access';

describe('userCanAccessFlight', () => {
  it('allows a creator who is not a passenger', () => {
    expect(
      userCanAccessFlight(
        { createdById: 'creator', passengers: [{ userId: null }] },
        'creator',
      ),
    ).toBe(true);
  });

  it('preserves access through legacy passenger membership', () => {
    expect(
      userCanAccessFlight(
        { createdById: null, passengers: [{ userId: 'passenger' }] },
        'passenger',
      ),
    ).toBe(true);
  });

  it('rejects unrelated users', () => {
    expect(
      userCanAccessFlight(
        { createdById: 'creator', passengers: [{ userId: null }] },
        'other-user',
      ),
    ).toBe(false);
  });
});
