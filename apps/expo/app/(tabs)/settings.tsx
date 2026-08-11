import { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Share from 'react-native-share';

import { useAuth } from '../../lib/auth';
import {
  useCreateApiKey,
  useDeleteApiKey,
  useExportCsv,
  useExportJson,
  useListApiKeys,
  useMe,
} from '../../lib/api';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, serverUrl, signOut, clearServer } = useAuth();
  const me = useMe();
  const apiKeys = useListApiKeys();
  const createApiKey = useCreateApiKey();
  const deleteApiKey = useDeleteApiKey();
  const exportJson = useExportJson();
  const exportCsv = useExportCsv();

  const [busy, setBusy] = useState(false);
  const [keyModal, setKeyModal] = useState(false);
  const [keyName, setKeyName] = useState('');

  const current = user ?? me.data ?? null;

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Sign out of this account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleChangeServer = () => {
    Alert.alert('Change server', 'This will disconnect you from the current server.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change server', onPress: () => clearServer() },
    ]);
  };

  const handleCreateKey = async () => {
    if (!keyName.trim()) return;
    setBusy(true);
    try {
      const token = await createApiKey.mutateAsync(keyName.trim());
      if (token) {
        Alert.alert(
          'API key created',
          `Copy this key now — it won't be shown again:\n\n${token}`,
        );
      }
      setKeyModal(false);
      setKeyName('');
    } catch (e) {
      Alert.alert('Could not create key', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const data = format === 'json' ? await exportJson.refetch() : await exportCsv.refetch();
      const content = data.data ?? '';
      // Fallback to sharing the text via the system share sheet.
      try {
        await Share.open({
          message: content,
          title: `myFlightTracker export (${format.toUpperCase()})`,
        });
      } catch {
        Alert.alert(
          'Export ready',
          `Your ${format.toUpperCase()} export is ready (${content.length} chars). Share/export it from this device.`,
        );
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Account</Text>
        <Text style={styles.value}>{current?.displayName ?? current?.username ?? '…'}</Text>
        <Text style={styles.sub}>@{current?.username}</Text>
        {current?.role ? <Text style={styles.badge}>{current.role}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Preferences</Text>
        <PrefRow label="Distance unit" value={current?.distanceUnit?.toUpperCase() ?? '—'} />
        <PrefRow label="Temperature" value={current?.temperatureUnit?.toUpperCase() ?? '—'} />
        <PrefRow label="Time format" value={current?.timeFormat ?? '—'} />
        <PrefRow label="Date format" value={current?.dateFormat ?? '—'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>My data</Text>
        <NavRow icon="earth" label="Visited countries" onPress={() => router.push('/visited-countries')} />
        <NavRow icon="share-social" label="Sharing" onPress={() => router.push('/sharing')} />
        <NavRow
          icon="download"
          label="Export JSON backup"
          onPress={() => handleExport('json')}
        />
        <NavRow icon="download-outline" label="Export CSV" onPress={() => handleExport('csv')} />
        {current?.role === 'admin' || current?.role === 'owner' ? (
          <NavRow icon="people" label="Users" onPress={() => router.push('/users')} />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>API keys</Text>
        <View style={styles.apiKeyHeader}>
          <Text style={styles.apiKeyCount}>{apiKeys.data?.length ?? 0} keys</Text>
          <TouchableOpacity onPress={() => setKeyModal(true)}>
            <Text style={styles.addKey}>+ New key</Text>
          </TouchableOpacity>
        </View>
        {(apiKeys.data ?? []).map((k) => (
          <View key={k.id} style={styles.apiKeyRow}>
            <Text style={styles.apiKeyName} numberOfLines={1}>
              {k.name}
            </Text>
            <TouchableOpacity onPress={() => deleteApiKey.mutate(k.id)}>
              <Ionicons name="trash" size={18} color="#d43b3b" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Server</Text>
        <Text style={styles.value} numberOfLines={1}>
          {serverUrl}
        </Text>
        <TouchableOpacity style={styles.rowButton} onPress={handleChangeServer} disabled={busy}>
          <Ionicons name="swap-horizontal" size={18} color="#1a73e8" />
          <Text style={styles.rowButtonText}>Change server</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOut} onPress={handleSignOut} disabled={busy} activeOpacity={0.7}>
        <Ionicons name="log-out" size={18} color="#d43b3b" />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>myFlightTracker mobile · v0.1.0</Text>

      <Modal visible={keyModal} transparent animationType="fade" onRequestClose={() => setKeyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New API key</Text>
            <TextInput
              style={styles.input}
              placeholder="Key name (e.g. Home server)"
              placeholderTextColor="#999"
              value={keyName}
              onChangeText={setKeyName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setKeyModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateKey} disabled={busy}>
                <Text style={styles.saveText}>{busy ? 'Creating…' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.prefRow}>
      <Text style={styles.prefLabel}>{label}</Text>
      <Text style={styles.prefValue}>{value}</Text>
    </View>
  );
}

function NavRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.navRow} onPress={onPress}>
      <Ionicons name={icon} size={18} color="#1a73e8" />
      <Text style={styles.navRowText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#ccc" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#888' },
  value: { fontSize: 17, fontWeight: '600', color: '#111' },
  sub: { fontSize: 14, color: '#888' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef4ff',
    color: '#1a73e8',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  prefRow: { flexDirection: 'row', justifyContent: 'space-between' },
  prefLabel: { fontSize: 15, color: '#333' },
  prefValue: { fontSize: 15, color: '#888' },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  navRowText: { flex: 1, fontSize: 15, color: '#111' },
  apiKeyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  apiKeyCount: { fontSize: 14, color: '#666' },
  addKey: { color: '#1a73e8', fontSize: 14, fontWeight: '600' },
  apiKeyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  apiKeyName: { flex: 1, fontSize: 14, color: '#333', marginRight: 8 },
  rowButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  rowButtonText: { color: '#1a73e8', fontSize: 15, fontWeight: '600' },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3a3a3',
    backgroundColor: '#fff',
  },
  signOutText: { color: '#d43b3b', fontSize: 15, fontWeight: '600' },
  version: { textAlign: 'center', color: '#aaa', fontSize: 12, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#111' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { color: '#666', fontSize: 15, fontWeight: '600' },
  saveBtn: { backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
