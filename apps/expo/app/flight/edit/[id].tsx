import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  FlightForm,
  type FlightFormValues,
} from "../../../components/FlightForm";
import { useFlights, useUpdateFlight } from "../../../lib/api";
import { colors } from "../../../lib/theme";
import type { Flight } from "../../../lib/router";

export default function EditFlightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const flightId = Number(id);
  const flights = useFlights("mine");
  const updateFlight = useUpdateFlight();
  const [form, setForm] = useState<FlightFormValues | null>(null);
  const [busy, setBusy] = useState(false);

  const flight = (flights.data ?? []).find((f: Flight) => f.id === flightId);

  useEffect(() => {
    if (!flight || form) return;
    setForm({
      date: flight.date,
      flightNumber: flight.flightNumber ?? "",
      aircraftReg: flight.aircraftReg ?? "",
      note: flight.note ?? "",
      from: flight.from,
      to: flight.to,
      airline: flight.airline,
      aircraft: flight.aircraft,
      customFields: {},
    });
  }, [flight, form]);

  if (flights.isLoading || !form) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const handleSave = async () => {
    if (!form.from || !form.to) {
      Alert.alert(
        "Missing airports",
        "Choose both departure and arrival airports.",
      );
      return;
    }
    if (!form.date) {
      Alert.alert("Missing date", "Enter a date for the flight.");
      return;
    }
    setBusy(true);
    try {
      await updateFlight.mutateAsync({
        id: flightId,
        flight: {
          date: form.date,
          flightNumber: form.flightNumber.trim() || null,
          aircraftReg: form.aircraftReg.trim() || null,
          note: form.note.trim() || null,
          from: { id: form.from.id },
          to: { id: form.to.id },
          aircraft: form.aircraft ? { id: form.aircraft.id } : null,
          airline: form.airline ? { id: form.airline.id } : null,
          passengers: (flight?.passengers ?? []).map((p) => ({
            id: p.id,
            userId: p.userId,
            guestName: p.guestName,
            seat: p.seat,
            seatNumber: p.seatNumber,
            seatClass: p.seatClass,
            flightReason: p.flightReason,
          })),
        },
        customFields: form.customFields,
      });
      router.back();
    } catch (e) {
      Alert.alert(
        "Could not update flight",
        e instanceof Error ? e.message : "Unknown error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit flight</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={busy}
          style={styles.headerBtn}
        >
          <Text style={styles.saveText}>{busy ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
      </View>
      <FlightForm value={form} onChange={setForm} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundPrimary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: colors.backgroundPrimary,
  },
  headerBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "600", color: colors.textPrimary },
  saveText: { color: colors.accent, fontSize: 16, fontWeight: "600" },
});
