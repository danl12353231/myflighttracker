import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useDeleteFlight, useFlights } from "../lib/api";
import { colors } from "../lib/theme";
import type { Flight } from "../lib/router";

const formatTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const airportCode = (a: Flight["from"]) => a?.iata ?? a?.icao ?? "—";

export function FlightDetailsSheet({
  visible,
  flightId,
  onClose,
  onEdit,
}: {
  visible: boolean;
  flightId: number | null;
  onClose: () => void;
  onEdit?: (id: number) => void;
}) {
  const flights = useFlights("mine");
  const deleteFlight = useDeleteFlight();
  const router = useRouter();
  const all = flights.data ?? [];
  const flight = all.find((f: Flight) => f.id === flightId) ?? null;

  const handleDelete = () => {
    if (!flight) return;
    Alert.alert("Delete flight", "Delete this flight?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteFlight.mutateAsync(flight.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {flights.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : !flight ? (
          <View style={styles.center}>
            <Text style={styles.empty}>Flight not found.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {flight.flightNumber ?? "Flight"}
              </Text>
              <Pressable
                onPress={() => onEdit?.(flight.id)}
                style={styles.closeBtn}
              >
                <Ionicons
                  name="create-outline"
                  size={22}
                  color={colors.accent}
                />
              </Pressable>
            </View>

            {/* Route */}
            <View style={styles.card}>
              <Text style={styles.flightNumberLg}>
                {flight.flightNumber ?? "Flight"}
              </Text>
              <Text style={styles.dateLabel}>
                {new Date(flight.date).toLocaleDateString([], {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
              {flight.airline ? (
                <Text style={styles.airline}>{flight.airline.name}</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <View style={styles.route}>
                <View style={styles.endpoint}>
                  <Text style={styles.code}>{airportCode(flight.from)}</Text>
                  <Text style={styles.city} numberOfLines={1}>
                    {flight.from?.municipality ?? flight.from?.name ?? "—"}
                  </Text>
                  <Text style={styles.time}>
                    {formatTime(flight.departure ?? flight.departureScheduled)}
                  </Text>
                </View>
                <Ionicons name="airplane" size={18} color={colors.accent} />
                <View style={[styles.endpoint, { alignItems: "flex-end" }]}>
                  <Text style={styles.code}>{airportCode(flight.to)}</Text>
                  <Text style={styles.city} numberOfLines={1}>
                    {flight.to?.municipality ?? flight.to?.name ?? "—"}
                  </Text>
                  <Text style={styles.time}>
                    {formatTime(flight.arrival ?? flight.arrivalScheduled)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Details */}
            <View style={styles.card}>
              <DetailRow
                label="Duration"
                value={
                  flight.duration
                    ? `${Math.round(flight.duration / 60)} min`
                    : "—"
                }
              />
              <DetailRow
                label="Aircraft"
                value={
                  flight.aircraft
                    ? `${flight.aircraft.name}${flight.aircraftReg ? ` (${flight.aircraftReg})` : ""}`
                    : "—"
                }
              />
              <DetailRow
                label="Departure terminal/gate"
                value={
                  [flight.departureTerminal, flight.departureGate]
                    .filter(Boolean)
                    .join(" · ") || "—"
                }
              />
              <DetailRow
                label="Arrival terminal/gate"
                value={
                  [flight.arrivalTerminal, flight.arrivalGate]
                    .filter(Boolean)
                    .join(" · ") || "—"
                }
              />
              {flight.note ? (
                <DetailRow label="Note" value={flight.note} />
              ) : null}
            </View>

            {/* Passengers */}
            {flight.passengers.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Passengers</Text>
                {flight.passengers.map((p) => (
                  <View key={p.id} style={styles.passenger}>
                    <Text style={styles.passengerName}>
                      {p.user?.displayName ?? p.guestName ?? "Unknown"}
                    </Text>
                    <Text style={styles.passengerSeat}>
                      {p.seatClass ? p.seatClass.toUpperCase() : ""}
                      {p.seatNumber ? ` · ${p.seatNumber}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Delete */}
            <Pressable style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash" size={18} color={colors.statusNegative} />
              <Text style={styles.deleteText}>Delete flight</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "80%",
    backgroundColor: colors.backgroundPrimary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderSubtle,
    marginBottom: 8,
  },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  center: { padding: 40, alignItems: "center" },
  empty: { color: colors.textSecondary, fontSize: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  flightNumberLg: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  dateLabel: { fontSize: 14, color: colors.textSecondary },
  airline: { fontSize: 13, color: colors.textSecondary },
  route: { flexDirection: "row", alignItems: "center", gap: 10 },
  endpoint: { flex: 1, gap: 2 },
  code: { fontSize: 26, fontWeight: "700", color: colors.textPrimary },
  city: { fontSize: 14, color: colors.textSecondary },
  time: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: "600",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  detailLabel: { fontSize: 13, color: colors.textSecondary },
  detailValue: {
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
    textAlign: "right",
  },
  passenger: { flexDirection: "row", justifyContent: "space-between" },
  passengerName: { fontSize: 14, color: colors.textPrimary },
  passengerSeat: { fontSize: 13, color: colors.textSecondary },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.statusNegative,
    backgroundColor: colors.backgroundSecondary,
  },
  deleteText: { color: colors.statusNegative, fontSize: 14, fontWeight: "600" },
});
