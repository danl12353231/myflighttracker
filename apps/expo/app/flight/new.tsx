import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { FlightForm, emptyFormValues, type FlightFormValues } from '../../components/FlightForm';
import { useCreateFlight } from '../../lib/api';

export default function NewFlightScreen() {
  const router = useRouter();
  const createFlight = useCreateFlight();
  const [form, setForm] = useState<FlightFormValues>(emptyFormValues());
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (!form.from || !form.to) {
      Alert.alert('Missing airports', 'Choose both departure and arrival airports.');
      return;
    }
    if (!form.date) {
      Alert.alert('Missing date', 'Enter a date for the flight.');
      return;
    }
    setBusy(true);
    try {
      await createFlight.mutateAsync({
        date: form.date,
        flightNumber: form.flightNumber.trim() || null,
        aircraftReg: form.aircraftReg.trim() || null,
        note: form.note.trim() || null,
        from: { id: form.from.id },
        to: { id: form.to.id },
        aircraft: form.aircraft ? { id: form.aircraft.id } : null,
        airline: form.airline ? { id: form.airline.id } : null,
        passengers: [],
        customFields: form.customFields,
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save flight', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add flight</Text>
        <TouchableOpacity onPress={handleSave} disabled={busy} style={styles.headerBtn}>
          <Text style={styles.saveText}>{busy ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
      <FlightForm value={form} onChange={setForm} />
    </KeyboardAvoidingView>
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
  saveText: { color: '#1a73e8', fontSize: 16, fontWeight: '600' },
});
