import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from './auth';
import { createTrpcClient, invalidateClient } from './trpc';
import type {
  Airport,
  Aircraft,
  Airline,
  ApiKey,
  CreateFlight,
  Flight,
  FlightScope,
  FlightTrackRow,
  Preferences,
  PublicShare,
  ShareCreateInput,
  ShareUpdateInput,
  UpcomingScope,
  UpdateFlightInput,
  User,
  VisitedCountry,
} from './router';

const useClient = () => {
  const { serverUrl, token } = useAuth();
  if (!serverUrl) throw new Error('Server not configured');
  return createTrpcClient(serverUrl, token);
};

export const useMe = () => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['me'],
    queryFn: () => client.user.me.query() as Promise<User>,
    enabled: status === 'authenticated',
  });
};

export const useUsers = () => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['users'],
    queryFn: () => client.user.list.query() as Promise<User[]>,
    enabled: status === 'authenticated',
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  const client = useClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      username?: string;
      displayName?: string;
      role?: 'user' | 'admin' | 'owner';
    }) => client.user.updateUser.mutate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  const client = useClient();
  return useMutation({
    mutationFn: (id: string) => client.user.delete.mutate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useFlights = (scope: FlightScope = 'mine', userId?: string) => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['flights', scope, userId],
    queryFn: () =>
      client.flight.list.query({ scope, userId }) as Promise<Flight[]>,
    enabled: status === 'authenticated',
  });
};

export const useUpcomingFlights = (scope: UpcomingScope = 'mine') => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['upcoming', scope],
    queryFn: () => client.flight.upcoming.query({ scope }) as Promise<Flight[]>,
    enabled: status === 'authenticated',
  });
};

export const useFlightTracks = (scope: FlightScope = 'mine') => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['flightTracks', scope],
    queryFn: () =>
      client.flightTrack.list.query({ scope }) as Promise<FlightTrackRow[]>,
    enabled: status === 'authenticated',
  });
};

export const useAirportSearch = (query: string, enabled: boolean) => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['airportSearch', query],
    queryFn: () => client.autocomplete.airport.query(query) as Promise<Airport[]>,
    enabled: enabled && query.trim().length > 0 && status === 'authenticated',
  });
};

export const useAircraftSearch = (query: string, enabled: boolean) => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['aircraftSearch', query],
    queryFn: () =>
      client.autocomplete.aircraft.query(query) as Promise<Aircraft[]>,
    enabled: enabled && query.trim().length > 0 && status === 'authenticated',
  });
};

export const useAirlineSearch = (query: string, enabled: boolean) => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['airlineSearch', query],
    queryFn: () =>
      client.autocomplete.airline.query(query) as Promise<Airline[]>,
    enabled: enabled && query.trim().length > 0 && status === 'authenticated',
  });
};

export const useVisitedCountries = () => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['visitedCountries'],
    queryFn: () =>
      client.visitedCountries.list.query() as Promise<VisitedCountry[]>,
    enabled: status === 'authenticated',
  });
};

export const useListApiKeys = () => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => client.user.listApiKeys.query() as Promise<ApiKey[]>,
    enabled: status === 'authenticated',
  });
};

export const useCreateFlight = () => {
  const queryClient = useQueryClient();
  const client = useClient();
  return useMutation({
    mutationFn: (flight: CreateFlight) => client.flight.create.mutate(flight),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['flightTracks'] });
      queryClient.invalidateQueries({ queryKey: ['visitedCountries'] });
    },
  });
};

export const useUpdateFlight = () => {
  const queryClient = useQueryClient();
  const client = useClient();
  return useMutation({
    mutationFn: (input: UpdateFlightInput) => client.flight.update.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['flightTracks'] });
      queryClient.invalidateQueries({ queryKey: ['visitedCountries'] });
    },
  });
};

export const useDeleteFlight = () => {
  const queryClient = useQueryClient();
  const client = useClient();
  return useMutation({
    mutationFn: (id: number) => client.flight.delete.mutate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['flightTracks'] });
      queryClient.invalidateQueries({ queryKey: ['visitedCountries'] });
    },
  });
};

export const useUpdatePreferences = () => {
  const queryClient = useQueryClient();
  const client = useClient();
  return useMutation({
    mutationFn: (prefs: Preferences) => client.user.updatePreferences.mutate(prefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
};

export const useCreateApiKey = () => {
  const queryClient = useQueryClient();
  const client = useClient();
  return useMutation({
    mutationFn: (name: string) => client.user.createApiKey.mutate(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apiKeys'] }),
  });
};

export const useDeleteApiKey = () => {
  const queryClient = useQueryClient();
  const client = useClient();
  return useMutation({
    mutationFn: (id: number) => client.user.deleteApiKey.mutate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apiKeys'] }),
  });
};

export const useSaveVisitedCountry = () => {
  const queryClient = useQueryClient();
  const client = useClient();
  return useMutation({
    mutationFn: (input: {
      code: string;
      status: VisitedCountry['status'] | null;
      note?: string | null;
    }) => client.visitedCountries.save.mutate(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['visitedCountries'] }),
  });
};

export const useImportVisitedCountries = () => {
  const queryClient = useQueryClient();
  const client = useClient();
  return useMutation({
    mutationFn: () => client.visitedCountries.importFlights.mutate(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['visitedCountries'] }),
  });
};

export const useShares = () => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['shares'],
    queryFn: () => client.share.list.query() as Promise<PublicShare[]>,
    enabled: status === 'authenticated',
  });
};

export const useCreateShare = () => {
  const queryClient = useQueryClient();
  const client = useClient();
  return useMutation({
    mutationFn: (input: ShareCreateInput) => client.share.create.mutate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shares'] }),
  });
};

export const useUpdateShare = () => {
  const queryClient = useQueryClient();
  const client = useClient();
  return useMutation({
    mutationFn: (input: ShareUpdateInput) => client.share.update.mutate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shares'] }),
  });
};

export const useDeleteShare = () => {
  const queryClient = useQueryClient();
  const client = useClient();
  return useMutation({
    mutationFn: (slug: string) => client.share.delete.mutate(slug),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shares'] }),
  });
};

export const useCustomFieldDefinitions = (
  entityType: 'flight' | 'flight_passenger',
) => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['customFieldDefinitions', entityType],
    queryFn: () => client.customField.listDefinitions.query({ entityType }),
    enabled: status === 'authenticated',
  });
};

export const useExportJson = () => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['exportJson'],
    queryFn: () => client.flight.exportJson.query(),
    enabled: status === 'authenticated',
  });
};

export const useExportCsv = () => {
  const { status } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: ['exportCsv'],
    queryFn: () => client.flight.exportCsv.query(),
    enabled: status === 'authenticated',
  });
};

export const resetApiClient = invalidateClient;
