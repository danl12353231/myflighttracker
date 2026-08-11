import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import SuperJSON from "superjson";

import { getServerUrl, getToken } from "./storage";
import type { AppRouter } from "./router";

/**
 * Typed proxy shape mirroring AppRouter, used to keep the mobile client
 * decoupled from the SvelteKit backend while preserving type safety.
 */
export type TrpcClient = {
  user: {
    me: { query: () => Promise<import("./router").User> };
    isSetup: { query: () => Promise<boolean> };
    list: { query: () => Promise<Array<import("./router").User>> };
    updatePreferences: {
      mutate: (prefs: import("./router").Preferences) => Promise<boolean>;
    };
    listApiKeys: {
      query: () => Promise<import("./router").ApiKey[]>;
    };
    createApiKey: {
      mutate: (name: string) => Promise<string | null>;
    };
    deleteApiKey: { mutate: (id: number) => Promise<boolean> };
    delete: { mutate: (userId: string) => Promise<boolean> };
    updateUser: {
      mutate: (input: {
        id: string;
        username?: string;
        displayName?: string;
        role?: "user" | "admin" | "owner";
      }) => Promise<boolean>;
    };
  };
  flight: {
    list: {
      query: (input: {
        scope: import("./router").FlightScope;
        userId?: string;
      }) => Promise<import("./router").Flight[]>;
    };
    upcoming: {
      query: (input: {
        scope: import("./router").UpcomingScope;
      }) => Promise<import("./router").Flight[]>;
    };
    create: {
      mutate: (input: import("./router").CreateFlight) => Promise<void>;
    };
    update: {
      mutate: (input: import("./router").UpdateFlightInput) => Promise<void>;
    };
    delete: { mutate: (id: number) => Promise<void> };
    deleteMany: { mutate: (ids: number[]) => Promise<void> };
    deleteAll: { mutate: () => Promise<void> };
    exportJson: { query: () => Promise<string> };
    exportCsv: { query: () => Promise<string> };
    status: {
      query: (input: { flightNumber: string; date?: string }) => Promise<
        import("./router").FlightStatusResult
      >;
    };
  };
  flightTrack: {
    list: {
      query: (input: {
        scope: import("./router").FlightScope;
        userId?: string;
      }) => Promise<import("./router").FlightTrackRow[]>;
    };
    get: {
      query: (id: number) => Promise<import("./router").FlightTrackRow | null>;
    };
  };
  airport: {
    get: { query: (id: number) => Promise<import("./router").Airport | null> };
    getFromIcao: {
      query: (icao: string) => Promise<import("./router").Airport | null>;
    };
    getFromIata: {
      query: (iata: string) => Promise<import("./router").Airport | null>;
    };
  };
  aircraft: {
    get: { query: (id: number) => Promise<import("./router").Aircraft | null> };
    getByIcao: {
      query: (icao: string) => Promise<import("./router").Aircraft | null>;
    };
    getByName: {
      query: (name: string) => Promise<import("./router").Aircraft | null>;
    };
    list: { query: () => Promise<import("./router").Aircraft[]> };
  };
  airline: {
    get: { query: (id: number) => Promise<import("./router").Airline | null> };
    getByIcao: {
      query: (icao: string) => Promise<import("./router").Airline | null>;
    };
    getByIata: {
      query: (iata: string) => Promise<import("./router").Airline | null>;
    };
    getByName: {
      query: (name: string) => Promise<import("./router").Airline | null>;
    };
    list: { query: () => Promise<import("./router").Airline[]> };
  };
  autocomplete: {
    airport: { query: (q: string) => Promise<import("./router").Airport[]> };
    aircraft: { query: (q: string) => Promise<import("./router").Aircraft[]> };
    airline: { query: (q: string) => Promise<import("./router").Airline[]> };
  };
  customField: {
    listDefinitions: {
      query: (input: {
        entityType: "flight" | "flight_passenger";
        includeInactive?: boolean;
      }) => Promise<import("./router").CustomFieldDefinition[]>;
    };
    getEntityValues: {
      query: (input: {
        entityType: "flight" | "flight_passenger";
        entityId: number | string;
      }) => Promise<Record<string, unknown>>;
    };
    setEntityValues: {
      mutate: (input: {
        entityType: "flight" | "flight_passenger";
        entityId: number | string;
        values: Record<string, unknown>;
      }) => Promise<boolean>;
    };
  };
  visitedCountries: {
    list: { query: () => Promise<import("./router").VisitedCountry[]> };
    save: {
      mutate: (input: {
        code: string;
        status: import("./router").VisitedCountry["status"] | null;
        note?: string | null;
      }) => Promise<boolean>;
    };
    importFlights: { mutate: () => Promise<number> };
  };
  share: {
    list: { query: () => Promise<import("./router").PublicShare[]> };
    create: {
      mutate: (
        input: import("./router").ShareCreateInput,
      ) => Promise<import("./router").PublicShare>;
    };
    update: {
      mutate: (
        input: import("./router").ShareUpdateInput,
      ) => Promise<import("./router").PublicShare>;
    };
    delete: { mutate: (slug: string) => Promise<boolean> };
    public: {
      query: (input: { slug: string }) => Promise<{
        settings: import("./router").PublicShareSettings;
        flights: unknown[];
      }>;
    };
  };
  weather: {
    getMetar: {
      query: (icao: string) => Promise<import("./router").ParsedMetar | null>;
    };
  };
};

export const createTrpcClient = (url: string, token: string | null) => {
  const proxy = createTRPCProxyClient<any>({
    links: [
      httpBatchLink({
        url: `${url}/api/trpc`,
        headers() {
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
    transformer: {
      input: {
        serialize: (object: unknown) => SuperJSON.stringify(object),
        deserialize: (object: string) => SuperJSON.parse(object),
      },
      output: {
        serialize: (object: unknown) => SuperJSON.stringify(object),
        deserialize: (object: string) => SuperJSON.parse(object),
      },
    },
  });
  return proxy as unknown as TrpcClient;
};

let cachedClient: TrpcClient | null = null;

/**
 * Builds (and caches) the tRPC client from the persisted server URL and
 * token. Call `invalidateClient` after login/logout or server URL changes.
 */
export const getTrpcClient = async () => {
  if (cachedClient) return cachedClient;
  const url = await getServerUrl();
  if (!url) throw new Error("Server not configured");
  const token = await getToken();
  cachedClient = createTrpcClient(url, token);
  return cachedClient;
};

export const invalidateClient = () => {
  cachedClient = null;
};

export const getBaseUrl = async () => {
  const url = await getServerUrl();
  if (!url) throw new Error("Server not configured");
  return url;
};
