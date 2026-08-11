import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFlights } from '../../lib/api';
import type { Flight } from '../../lib/router';

type Stats = {
  total: number;
  distance: number;
  durationMinutes: number;
  airports: Set<string>;
  airlines: Map<string, number>;
  byMonth: Map<string, number>;
};

const haversineKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const computeStats = (flights: Flight[]): Stats => {
  const stats: Stats = {
    total: flights.length,
    distance: 0,
    durationMinutes: 0,
    airports: new Set(),
    airlines: new Map(),
    byMonth: new Map(),
  };
  for (const f of flights) {
    if (f.from) stats.airports.add(f.from.iata ?? f.from.icao);
    if (f.to) stats.airports.add(f.to.iata ?? f.to.icao);
    if (f.from && f.to) stats.distance += haversineKm(f.from, f.to);
    if (f.duration) stats.durationMinutes += Math.round(f.duration / 60);
    if (f.airline) {
      stats.airlines.set(f.airline.name, (stats.airlines.get(f.airline.name) ?? 0) + 1);
    }
    const month = f.date.slice(0, 7);
    stats.byMonth.set(month, (stats.byMonth.get(month) ?? 0) + 1);
  }
  return stats;
};

export default function StatsScreen() {
  const flights = useFlights('mine');

  if (flights.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const stats = computeStats(flights.data ?? []);
  const topAirline = [...stats.airlines.entries()].sort((a, b) => b[1] - a[1])[0];
  const months = [...stats.byMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const maxMonth = Math.max(0, ...months.map(([, n]) => n));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.grid}>
        <StatCard label="Flights" value={String(stats.total)} />
        <StatCard
          label="Distance"
          value={`${Math.round(stats.distance).toLocaleString()} km`}
        />
        <StatCard label="Duration" value={`${Math.round(stats.durationMinutes / 60)}h`} />
        <StatCard label="Airports" value={String(stats.airports.size)} />
      </View>

      {topAirline ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top airline</Text>
          <Text style={styles.cardValue}>{topAirline[0]}</Text>
          <Text style={styles.cardSub}>{topAirline[1]} flights</Text>
        </View>
      ) : null}

      {months.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Flights per month</Text>
          {months.map(([month, count]) => (
            <View key={month} style={styles.monthRow}>
              <Text style={styles.monthLabel}>{month}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(count / maxMonth) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.monthCount}>{count}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: '#111' },
  statLabel: { fontSize: 13, color: '#888' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#888' },
  cardValue: { fontSize: 20, fontWeight: '700', color: '#111' },
  cardSub: { fontSize: 14, color: '#666' },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthLabel: { width: 56, fontSize: 13, color: '#666' },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#eee' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: '#1a73e8' },
  monthCount: { width: 32, fontSize: 13, color: '#111', textAlign: 'right' },
});
