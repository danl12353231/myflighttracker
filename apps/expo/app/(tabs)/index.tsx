import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useFlights, useUpcomingFlights } from '../../lib/api';
import type { Flight } from '../../lib/router';

const airportCode = (flight: Flight) =>
  flight.from?.iata ?? flight.from?.icao ?? '—';
const airportCodeTo = (flight: Flight) =>
  flight.to?.iata ?? flight.to?.icao ?? '—';

function FlightRow({ flight, onPress }: { flight: Flight; onPress: () => void }) {
  const label = `${flight.flightNumber ?? 'Flight'} · ${flight.date}`;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowHeader}>
        <Text style={styles.flightNumber} numberOfLines={1}>
          {label}
        </Text>
        {flight.airline ? (
          <Text style={styles.airline} numberOfLines={1}>
            {flight.airline.name}
          </Text>
        ) : null}
      </View>
      <View style={styles.route}>
        <View style={styles.endpoint}>
          <Text style={styles.code}>{airportCode(flight)}</Text>
          <Text style={styles.city} numberOfLines={1}>
            {flight.from?.municipality ?? flight.from?.name ?? 'Unknown'}
          </Text>
        </View>
        <Ionicons name="airplane" size={16} color="#999" />
        <View style={[styles.endpoint, { alignItems: 'flex-end' }]}>
          <Text style={styles.code}>{airportCodeTo(flight)}</Text>
          <Text style={styles.city} numberOfLines={1}>
            {flight.to?.municipality ?? flight.to?.name ?? 'Unknown'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function FlightsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'upcoming' | 'all'>('upcoming');
  const flights = useFlights('mine');
  const upcoming = useUpcomingFlights('mine');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([flights.refetch(), upcoming.refetch()]);
    setRefreshing(false);
  }, [flights, upcoming]);

  const allFlights = useMemo(() => flights.data ?? [], [flights.data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allFlights;
    const q = search.toLowerCase();
    return allFlights.filter((f) =>
      [
        f.flightNumber,
        f.airline?.name,
        f.airline?.iata,
        f.from?.iata,
        f.from?.icao,
        f.from?.municipality,
        f.to?.iata,
        f.to?.icao,
        f.to?.municipality,
        f.aircraftReg,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [allFlights, search]);

  const upcomingList = useMemo(() => upcoming.data ?? [], [upcoming.data]);

  const sections = useMemo(() => {
    const showUpcoming = tab === 'upcoming';
    const list = showUpcoming ? upcomingList : filtered;
    const grouped = new Map<string, Flight[]>();
    for (const f of list) {
      const key = f.date;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(f);
    }
    const keys = [...grouped.keys()].sort((a, b) => (a < b ? 1 : -1));
    return keys.map((date) => ({
      title: date,
      data: grouped.get(date)!,
    }));
  }, [tab, upcomingList, filtered]);

  const emptyText =
    tab === 'upcoming'
      ? 'No upcoming flights yet.'
      : search.trim()
        ? 'No flights match your search.'
        : 'No flights yet. Tap + to add your first flight.';

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TabButton label="Upcoming" active={tab === 'upcoming'} onPress={() => setTab('upcoming')} />
        <TabButton label="All flights" active={tab === 'all'} onPress={() => setTab('all')} />
      </View>

      {tab === 'all' ? (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            style={styles.search}
            placeholder="Search flights…"
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <FlightRow
            flight={item}
            onPress={() => router.push(`/flight/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          flights.isLoading || upcoming.isLoading ? (
            <Text style={styles.empty}>Loading flights…</Text>
          ) : (
            <Text style={styles.empty}>{emptyText}</Text>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/flight/new')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  tabActive: { backgroundColor: '#eef4ff' },
  tabText: { fontSize: 14, color: '#666', fontWeight: '500' },
  tabTextActive: { color: '#1a73e8', fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  search: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#111' },
  listContent: { padding: 16, paddingBottom: 96, gap: 10 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  flightNumber: { fontSize: 15, fontWeight: '600', color: '#111', flex: 1 },
  airline: { fontSize: 13, color: '#888', flexShrink: 1 },
  route: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  endpoint: { flex: 1, gap: 2 },
  code: { fontSize: 22, fontWeight: '700', color: '#111' },
  city: { fontSize: 13, color: '#666' },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 4,
  },
  empty: { textAlign: 'center', color: '#888', marginTop: 48, fontSize: 15 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
