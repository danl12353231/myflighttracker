import { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  useCreateShare,
  useDeleteShare,
  useShares,
  useUpdateShare,
} from '../lib/api';
import type { PublicShare, ShareCreateInput } from '../lib/router';

const emptyShare = (): ShareCreateInput => ({
  showMap: true,
  showStats: false,
  showFlightList: false,
  showFlightNumbers: true,
  showAirlines: true,
  showAircraft: false,
  showTimes: false,
  showTracks: false,
  showDates: true,
  showSeat: false,
});

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

export default function SharingScreen() {
  const router = useRouter();
  const shares = useShares();
  const createShare = useCreateShare();
  const updateShare = useUpdateShare();
  const deleteShare = useDeleteShare();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PublicShare | null>(null);
  const [form, setForm] = useState<ShareCreateInput>(emptyShare());
  const [busy, setBusy] = useState(false);

  const openNew = () => {
    setEditing(null);
    setForm(emptyShare());
    setOpen(true);
  };

  const openEdit = (s: PublicShare) => {
    setEditing(s);
    setForm({
      showMap: s.showMap,
      showStats: s.showStats,
      showFlightList: s.showFlightList,
      dateFrom: s.dateFrom ?? undefined,
      dateTo: s.dateTo ?? undefined,
      showFlightNumbers: s.showFlightNumbers,
      showAirlines: s.showAirlines,
      showAircraft: s.showAircraft,
      showTimes: s.showTimes,
      showTracks: s.showTracks,
      showDates: s.showDates,
      showSeat: s.showSeat,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      if (editing) {
        await updateShare.mutateAsync({ ...form, id: editing.id });
      } else {
        await createShare.mutateAsync(form);
      }
      setOpen(false);
    } catch (e) {
      Alert.alert('Could not save share', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (s: PublicShare) => {
    Alert.alert('Delete share', `Delete share "${s.slug}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteShare.mutate(s.slug),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sharing</Text>
        <TouchableOpacity onPress={openNew} style={styles.headerBtn}>
          <Ionicons name="add" size={24} color="#1a73e8" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={shares.data ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No public shares yet. Tap + to create a share link.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.shareRow}>
            <View style={styles.shareInfo}>
              <Text style={styles.shareSlug}>{item.slug}</Text>
              <Text style={styles.shareMeta}>
                Map {item.showMap ? '✓' : '✗'} · Stats {item.showStats ? '✓' : '✗'} · List{' '}
                {item.showFlightList ? '✓' : '✗'}
              </Text>
              {item.expiresAt ? (
                <Text style={styles.shareExpires}>
                  Expires {new Date(item.expiresAt).toLocaleDateString()}
                </Text>
              ) : null}
            </View>
            <View style={styles.shareActions}>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
                <Ionicons name="create-outline" size={20} color="#1a73e8" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                <Ionicons name="trash" size={20} color="#d43b3b" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editing ? 'Edit share' : 'New share'}
            </Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Ionicons name="close" size={24} color="#111" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <ToggleRow label="Show map" value={form.showMap} onChange={(v) => setForm({ ...form, showMap: v })} />
            <ToggleRow label="Show statistics" value={form.showStats} onChange={(v) => setForm({ ...form, showStats: v })} />
            <ToggleRow label="Show flight list" value={form.showFlightList} onChange={(v) => setForm({ ...form, showFlightList: v })} />
            <View style={styles.divider} />
            <ToggleRow label="Flight numbers" value={form.showFlightNumbers} onChange={(v) => setForm({ ...form, showFlightNumbers: v })} />
            <ToggleRow label="Airlines" value={form.showAirlines} onChange={(v) => setForm({ ...form, showAirlines: v })} />
            <ToggleRow label="Aircraft" value={form.showAircraft} onChange={(v) => setForm({ ...form, showAircraft: v })} />
            <ToggleRow label="Times" value={form.showTimes} onChange={(v) => setForm({ ...form, showTimes: v })} />
            <ToggleRow label="Tracks" value={form.showTracks} onChange={(v) => setForm({ ...form, showTracks: v })} />
            <ToggleRow label="Dates" value={form.showDates} onChange={(v) => setForm({ ...form, showDates: v })} />
            <ToggleRow label="Seat details" value={form.showSeat} onChange={(v) => setForm({ ...form, showSeat: v })} />
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={busy}
            >
              <Text style={styles.saveBtnText}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Create share'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
  listContent: { padding: 16, paddingBottom: 40, gap: 10 },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  shareInfo: { flex: 1, gap: 4 },
  shareSlug: { fontSize: 16, fontWeight: '600', color: '#111' },
  shareMeta: { fontSize: 13, color: '#666' },
  shareExpires: { fontSize: 12, color: '#999' },
  shareActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { padding: 6 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15 },
  modalContainer: { flex: 1, backgroundColor: '#f5f5f7' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
  },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalBody: { padding: 16, gap: 4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  toggleLabel: { fontSize: 15, color: '#333' },
  divider: { height: 8 },
  saveBtn: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
