export type FlightAudience = 'personal' | 'guests';

type FlightWithPassengers = {
  passengers: Array<{ guestName: string | null }>;
};

export const isGuestFlight = (flight: FlightWithPassengers): boolean =>
  flight.passengers.some((passenger) => Boolean(passenger.guestName));

export const matchesFlightAudience = (
  flight: FlightWithPassengers,
  audience: FlightAudience,
): boolean =>
  audience === 'guests' ? isGuestFlight(flight) : !isGuestFlight(flight);
