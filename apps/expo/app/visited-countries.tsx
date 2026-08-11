import { useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  useImportVisitedCountries,
  useSaveVisitedCountry,
  useVisitedCountries,
} from '../lib/api';
import type { VisitedCountry } from '../lib/router';

const STATUSES: Array<{ key: VisitedCountry['status']; label: string }> = [
  { key: 'visited', label: 'Visited' },
  { key: 'lived', label: 'Lived' },
  { key: 'layover', label: 'Layover' },
  { key: 'wishlist', label: 'Wishlist' },
];

const statusColor: Record<string, string> = {
  visited: '#1a73e8',
  lived: '#2e7d32',
  layover: '#f9a825',
  wishlist: '#8e24aa',
};

export default function VisitedCountriesScreen() {
  const router = useRouter();
  const countries = useVisitedCountries();
  const save = useSaveVisitedCountry();
  const importCountries = useImportVisitedCountries();

  const [code, setCode] = useState('');
  const [status, setStatus] = useState<VisitedCountry['status']>('visited');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!code.trim()) {
      Alert.alert('Missing country', 'Enter a country code (ISO 3166-1 alpha-2).');
      return;
    }
    setBusy(true);
    try {
      await save.mutateAsync({
        code: code.trim().toUpperCase(),
        status,
        note: note.trim() || null,
      });
      setCode('');
      setNote('');
    } catch (e) {
      Alert.alert('Could not save country', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = () => {
    Alert.alert(
      'Import from flights',
      'Generate visited countries from your flight history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            try {
              const n = await importCountries.mutateAsync();
              Alert.alert('Done', `${n} country/ies added from flights.`);
            } catch (e) {
              Alert.alert('Import failed', e instanceof Error ? e.message : 'Unknown error');
            }
          },
        },
      ],
    );
  };

  const byStatus = (countries.data ?? []).filter(
    (c: VisitedCountry) => c.status === status,
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visited countries</Text>
        <TouchableOpacity onPress={handleImport} style={styles.headerBtn}>
          <Ionicons name="download" size={20} color="#1a73e8" />
        </TouchableOpacity>
      </View>

      <View style={styles.addCard}>
        <TextInput
          style={styles.codeInput}
          placeholder="e.g. FR"
          placeholderTextColor="#999"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          maxLength={2}
        />
        <View style={styles.statusRow}>
          {STATUSES.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.statusChip, status === s.key && { backgroundColor: statusColor[s.key] }]}
              onPress={() => setStatus(s.key)}
            >
              <Text
                style={[styles.statusChipText, status === s.key && { color: '#fff' }]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.noteInput}
          placeholder="Note (optional)"
          placeholderTextColor="#999"
          value={note}
          onChangeText={setNote}
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={busy}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>{busy ? 'Adding…' : 'Add country'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summary}>
        {STATUSES.map((s) => (
          <View key={s.key} style={styles.summaryItem}>
            <View style={[styles.dot, { backgroundColor: statusColor[s.key] }]} />
            <Text style={styles.summaryText}>
              {s.label}:{' '}
              {(countries.data ?? []).filter((c: VisitedCountry) => c.status === s.key).length}
            </Text>
          </View>
        ))}
      </View>

      <FlatList
        data={byStatus}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No {status} countries yet. Add one above or import from flights.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.countryRow}>
            <Text style={styles.countryCode}>{item.code}</Text>
            <Text style={styles.countryNote} numberOfLines={1}>
              {item.note ?? '—'}
            </Text>
            <Text style={[styles.countryStatus, { color: statusColor[item.status] }]}>
              {item.status}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  headerBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  addCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 2,
  },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#eee',
  },
  statusChipText: { fontSize: 13, color: '#333', fontWeight: '600' },
  noteInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    padding: 12,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  summaryText: { fontSize: 13, color: '#555' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  countryCode: { fontSize: 16, fontWeight: '700', color: '#111', width: 40 },
  countryNote: { flex: 1, fontSize: 14, color: '#555' },
  countryStatus: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  empty: { textAlign: 'center', color: '#888', marginTop: 32, fontSize: 15 },
});
