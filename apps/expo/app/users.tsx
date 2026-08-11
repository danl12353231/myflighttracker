import { useState } from 'react';
import {
  Alert,
  FlatList,
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

import { useDeleteUser, useUpdateUser, useUsers } from '../lib/api';
import type { User } from '../lib/router';

const ROLE_OPTIONS: Array<{ key: User['role']; label: string }> = [
  { key: 'user', label: 'User' },
  { key: 'admin', label: 'Admin' },
  { key: 'owner', label: 'Owner' },
];

export default function UsersScreen() {
  const router = useRouter();
  const users = useUsers();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [editing, setEditing] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<User['role']>('user');
  const [busy, setBusy] = useState(false);

  const openEdit = (u: User) => {
    setEditing(u);
    setDisplayName(u.displayName);
    setUsername(u.username);
    setRole(u.role);
  };

  const handleSave = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await updateUser.mutateAsync({
        id: editing.id,
        username: username.trim() || undefined,
        displayName: displayName.trim() || undefined,
        role,
      });
      setEditing(null);
    } catch (e) {
      Alert.alert('Could not update user', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (u: User) => {
    Alert.alert('Delete user', `Delete user "${u.username}"? Their flights will be affected.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteUser.mutate(u.id),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Users</Text>
        <View style={styles.headerBtn} />
      </View>

      <FlatList
        data={users.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.userRow}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.displayName}</Text>
              <Text style={styles.userMeta}>@{item.username}</Text>
              <Text style={styles.userRole}>{item.role}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
                <Ionicons name="create-outline" size={20} color="#1a73e8" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                <Ionicons name="trash" size={20} color="#d43b3b" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No users.</Text>}
      />

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit user</Text>
            <TextInput
              style={styles.input}
              placeholder="Display name"
              value={displayName}
              onChangeText={setDisplayName}
            />
            <TextInput
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.roleChip, role === r.key && styles.roleChipActive]}
                  onPress={() => setRole(r.key)}
                >
                  <Text style={[styles.roleChipText, role === r.key && styles.roleChipTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={busy}>
                <Text style={styles.saveText}>{busy ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  headerBtn: { padding: 8, width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  listContent: { padding: 16, gap: 10 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 16, fontWeight: '600', color: '#111' },
  userMeta: { fontSize: 13, color: '#888' },
  userRole: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef4ff',
    color: '#1a73e8',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4,
  },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: { padding: 6 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
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
  roleRow: { flexDirection: 'row', gap: 8 },
  roleChip: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#eee', alignItems: 'center' },
  roleChipActive: { backgroundColor: '#1a73e8' },
  roleChipText: { fontSize: 13, color: '#333', fontWeight: '600' },
  roleChipTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { color: '#666', fontSize: 15, fontWeight: '600' },
  saveBtn: { backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
