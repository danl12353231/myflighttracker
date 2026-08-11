// Self-contained mirror of the myFlightTracker tRPC API.
// Kept in sync with web/src/lib/server/routes/*. Procedures and types
// intentionally mirror the server so the mobile client stays decoupled.

export type Airport = {
  id: number;
  icao: string;
  iata: string | null;
  lat: number;
  lon: number;
  tz: string;
  name: string;
  municipality: string | null;
  type:
    | 'large_airport'
    | 'medium_airport'
    | 'small_airport'
    | 'heliport'
    | 'seaplane_base'
    | 'balloonport'
    | 'closed';
  continent: 'EU' | 'NA' | 'SA' | 'AS' | 'AF' | 'OC' | 'AN';
  country: string;
  custom: boolean;
};

export type Aircraft = {
  id: number;
  name: string;
  icao: string | null;
  sourceId: string | null;
};

export type Airline = {
  id: number;
  name: string;
  icao: string | null;
  iata: string | null;
  iconPath: string | null;
  sourceId: string | null;
};

export type UserRole = 'user' | 'admin' | 'owner';

export type User = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  distanceUnit: 'km' | 'mi' | 'nm';
  windSpeedUnit: 'kt' | 'mph' | 'kmh' | 'ms';
  temperatureUnit: 'c' | 'f';
  pressureUnit: 'hpa' | 'inhg';
  timeFormat: '12h' | '24h' | 'auto';
  dateFormat: 'iso' | 'us' | 'eu' | 'auto';
  weekStartsOn: 'mon' | 'sun' | 'auto';
  flightTimeDisplay: 'airport' | 'utc' | 'system';
};

export type FlightPassenger = {
  id: number;
  flightId: number;
  userId: string | null;
  guestName: string | null;
  seat:
    | 'window'
    | 'aisle'
    | 'middle'
    | 'pilot'
    | 'copilot'
    | 'jumpseat'
    | 'other'
    | null;
  seatNumber: string | null;
  seatClass: 'economy' | 'economy+' | 'business' | 'first' | 'private' | null;
  flightReason: 'leisure' | 'business' | 'crew' | 'other' | null;
  user: { id: string; displayName: string; username: string } | null;
};

export type Flight = {
  id: number;
  date: string;
  datePrecision: 'day' | 'month' | 'year';
  departure: string | null;
  arrival: string | null;
  departureScheduled: string | null;
  arrivalScheduled: string | null;
  takeoffScheduled: string | null;
  takeoffActual: string | null;
  landingScheduled: string | null;
  landingActual: string | null;
  duration: number | null;
  departureTerminal: string | null;
  departureGate: string | null;
  arrivalTerminal: string | null;
  arrivalGate: string | null;
  flightNumber: string | null;
  aircraftReg: string | null;
  note: string | null;
  createdById: string | null;
  from: Airport | null;
  to: Airport | null;
  passengers: FlightPassenger[];
  aircraft: Aircraft | null;
  airline: Airline | null;
};

export type CreateFlightPassenger = {
  id?: number;
  userId?: string | null;
  guestName?: string | null;
  seat?: FlightPassenger['seat'];
  seatNumber?: string | null;
  seatClass?: FlightPassenger['seatClass'];
  flightReason?: FlightPassenger['flightReason'];
  customFields?: Record<string, unknown>;
};

export type CreateFlight = {
  date: string;
  datePrecision?: 'day' | 'month' | 'year';
  departure?: string | null;
  arrival?: string | null;
  departureScheduled?: string | null;
  arrivalScheduled?: string | null;
  takeoffScheduled?: string | null;
  takeoffActual?: string | null;
  landingScheduled?: string | null;
  landingActual?: string | null;
  duration?: number | null;
  departureTerminal?: string | null;
  departureGate?: string | null;
  arrivalTerminal?: string | null;
  arrivalGate?: string | null;
  flightNumber?: string | null;
  aircraftReg?: string | null;
  note?: string | null;
  from: Partial<Airport> | { id: number } | null;
  to: Partial<Airport> | { id: number } | null;
  aircraft: ({ id: number | null } & Partial<Aircraft>) | null;
  airline: ({ id: number | null } & Partial<Airline>) | null;
  passengers?: CreateFlightPassenger[];
  track?: unknown;
  customFields?: Record<string, unknown>;
};

export type UpdateFlightInput = {
  id: number;
  flight: CreateFlight;
  customFields?: Record<string, unknown>;
};

export type FlightTrackRow = {
  flightId: number;
  track: unknown;
  sourceFormat: 'gpx' | 'kml' | 'csv' | 'readsb';
  sourceName: string | null;
  pointCount: number;
};

export type VisitedCountry = {
  id: number;
  code: string;
  status: 'lived' | 'visited' | 'layover' | 'wishlist';
  note: string | null;
  userId: string;
};

export type PublicShare = {
  id: number;
  userId: string;
  slug: string;
  expiresAt: string | null;
  createdAt: string;
  showMap: boolean;
  showStats: boolean;
  showFlightList: boolean;
  dateFrom: string | null;
  dateTo: string | null;
  showFlightNumbers: boolean;
  showAirlines: boolean;
  showAircraft: boolean;
  showTimes: boolean;
  showTracks: boolean;
  showDates: boolean;
  showSeat: boolean;
};

export type ApiKey = {
  id: number;
  name: string;
  createdAt: string;
  lastUsed: string | null;
};

export type CustomFieldDefinition = {
  id: number;
  entityType: 'flight' | 'flight_passenger';
  key: string;
  label: string;
  description: string | null;
  fieldType:
    | 'text'
    | 'textarea'
    | 'number'
    | 'boolean'
    | 'date'
    | 'select'
    | 'multi-select'
    | 'airport'
    | 'airline'
    | 'aircraft';
  required: boolean;
  active: boolean;
  order: number;
  defaultValue: unknown | null;
  options: unknown | null;
};

export type Preferences = Partial<
  Pick<
    User,
    | 'distanceUnit'
    | 'windSpeedUnit'
    | 'temperatureUnit'
    | 'pressureUnit'
    | 'timeFormat'
    | 'dateFormat'
    | 'weekStartsOn'
    | 'flightTimeDisplay'
  >
>;

export type ShareCreateInput = {
  slug?: string;
  expiresAt?: string;
  showMap: boolean;
  showStats: boolean;
  showFlightList: boolean;
  dateFrom?: string;
  dateTo?: string;
  showFlightNumbers: boolean;
  showAirlines: boolean;
  showAircraft: boolean;
  showTimes: boolean;
  showTracks: boolean;
  showDates: boolean;
  showSeat: boolean;
};

export type ShareUpdateInput = Partial<ShareCreateInput> & { id: number };

export type PublicShareSettings = {
  showMap: boolean;
  showStats: boolean;
  showFlightList: boolean;
  showTracks: boolean;
};

export type FlightScope = 'mine' | 'user' | 'all';
export type UpcomingScope = 'mine' | 'friends';

// -- Router declaration ------------------------------------------------------

export type AppRouter = {
  user: {
    me: { query: { input: void; output: User } };
    isSetup: { query: { input: void; output: boolean } };
    list: { query: { input: void; output: Array<Omit<User, never>> } };
    updatePreferences: {
      mutation: { input: Preferences; output: boolean };
    };
    listApiKeys: { query: { input: void; output: ApiKey[] } };
    createApiKey: {
      mutation: { input: string; output: string | null };
    };
    deleteApiKey: { mutation: { input: number; output: boolean } };
    delete: { mutation: { input: string; output: boolean } };
  };
  flight: {
    list: {
      query: {
        input: { scope: FlightScope; userId?: string };
        output: Flight[];
      };
    };
    upcoming: {
      query: {
        input: { scope: UpcomingScope };
        output: Flight[];
      };
    };
    create: {
      mutation: { input: CreateFlight; output: void };
    };
    update: {
      mutation: { input: UpdateFlightInput; output: void };
    };
    delete: { mutation: { input: number; output: void } };
    deleteMany: { mutation: { input: number[]; output: void } };
    deleteAll: { mutation: { input: void; output: void } };
    exportJson: { query: { input: void; output: string } };
    exportCsv: { query: { input: void; output: string } };
    lookup: {
      query: {
        input: { flightNumber: string; date?: string; preferredRoute?: string };
        output: unknown;
      };
    };
    lookupAircraftByReg: {
      query: { input: string; output: Aircraft | null };
    };
  };
  flightTrack: {
    list: {
      query: {
        input: { scope: FlightScope; userId?: string };
        output: FlightTrackRow[];
      };
    };
    get: { query: { input: number; output: FlightTrackRow | null } };
  };
  airport: {
    get: { query: { input: number; output: Airport | null } };
    getFromIcao: { query: { input: string; output: Airport | null } };
    getFromIata: { query: { input: string; output: Airport | null } };
  };
  aircraft: {
    get: { query: { input: number; output: Aircraft | null } };
    getByIcao: { query: { input: string; output: Aircraft | null } };
    getByName: { query: { input: string; output: Aircraft | null } };
    list: { query: { input: void; output: Aircraft[] } };
  };
  airline: {
    get: { query: { input: number; output: Airline | null } };
    getByIcao: { query: { input: string; output: Airline | null } };
    getByIata: { query: { input: string; output: Airline | null } };
    getByName: { query: { input: string; output: Airline | null } };
    list: { query: { input: void; output: Airline[] } };
  };
  autocomplete: {
    airport: { query: { input: string; output: Airport[] } };
    aircraft: { query: { input: string; output: Aircraft[] } };
    airline: { query: { input: string; output: Airline[] } };
  };
  customField: {
    listDefinitions: {
      query: {
        input: { entityType: 'flight' | 'flight_passenger'; includeInactive?: boolean };
        output: CustomFieldDefinition[];
      };
    };
    getEntityValues: {
      query: {
        input: { entityType: 'flight' | 'flight_passenger'; entityId: number | string };
        output: Record<string, unknown>;
      };
    };
    setEntityValues: {
      mutation: {
        input: {
          entityType: 'flight' | 'flight_passenger';
          entityId: number | string;
          values: Record<string, unknown>;
        };
        output: boolean;
      };
    };
  };
  visitedCountries: {
    list: { query: { input: void; output: VisitedCountry[] } };
    save: {
      mutation: {
        input: { code: string; status: VisitedCountry['status'] | null; note?: string | null };
        output: boolean;
      };
    };
    importFlights: { mutation: { input: void; output: number } };
  };
  share: {
    list: { query: { input: void; output: PublicShare[] } };
    create: {
      mutation: {
        input: ShareCreateInput;
        output: PublicShare;
      };
    };
    update: {
      mutation: {
        input: ShareUpdateInput;
        output: PublicShare;
      };
    };
    delete: { mutation: { input: string; output: boolean } };
    public: {
      query: {
        input: { slug: string };
        output: { settings: PublicShareSettings; flights: unknown[] };
      };
    };
  };
  weather: {
    getMetar: { query: { input: string; output: unknown } };
  };
};
