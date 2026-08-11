import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useDeleteFlight, useFlights } from "../../lib/api";
import { FlightStatusCard } from "../../components/FlightStatusCard";
import { colors } from "../../lib/theme";
import type { Flight } from "../../lib/router";

const formatTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (flight: Flight) => {
  const d = new Date(flight.date);
  return d.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function FlightDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const flightId = Number(id);
  const flights = useFlights("mine");
  const deleteFlight = useDeleteFlight();

  const flight = (flights.data ?? []).find((f: Flight) => f.id === flightId);

  if (flights.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!flight) {
    return (
      <View style={styles.center}>
        <Text>Flight not found.</Text>
      </View>
    );
  }

  const from = flight.from;
  const to = flight.to;

  const handleDelete = () => {
    Alert.alert("Delete flight", "Delete this flight?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteFlight.mutateAsync(flight.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Flight details</Text>
        <TouchableOpacity
          onPress={() => router.push(`/flight/edit/${flight.id}`)}
          style={styles.backBtn}
        >
          <Ionicons name="create-outline" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.flightNumber}>
            {flight.flightNumber ?? "Flight"}
          </Text>
          <Text style={styles.date}>{formatDate(flight)}</Text>
          {flight.airline ? (
            <Text style={styles.airline}>{flight.airline.name}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.route}>
            <View style={styles.endpoint}>
              <Text style={styles.code}>{from?.iata ?? from?.icao ?? "—"}</Text>
              <Text style={styles.city}>
                {from?.municipality ?? from?.name ?? "Unknown"}
              </Text>
              <Text style={styles.time}>
                {formatTime(flight.departure ?? flight.departureScheduled)}
              </Text>
            </View>
            <View style={styles.routeIcon}>
              <Ionicons name="airplane" size={20} color={colors.accent} />
            </View>
            <View style={[styles.endpoint, { alignItems: "flex-end" }]}>
              <Text style={styles.code}>{to?.iata ?? to?.icao ?? "—"}</Text>
              <Text style={styles.city}>
                {to?.municipality ?? to?.name ?? "Unknown"}
              </Text>
              <Text style={styles.time}>
                {formatTime(flight.arrival ?? flight.arrivalScheduled)}
              </Text>
            </View>
          </View>
        </View>

        <FlightStatusCard flightNumber={flight.flightNumber} date={flight.date} />

        <View style={styles.card}>
          <DetailRow
            label="Aircraft"
            value={
              flight.aircraft
                ? `${flight.aircraft.name}${flight.aircraftReg ? ` (${flight.aircraftReg})` : ""}`
                : "—"
            }
          />
          <DetailRow
            label="Duration"
            value={
              flight.duration ? `${Math.round(flight.duration / 60)} min` : "—"
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
          {flight.note ? <DetailRow label="Note" value={flight.note} /> : null}
        </View>

        {flight.passengers.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Passengers</Text>
            {flight.passengers.map((p: Flight["passengers"][number]) => (
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

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Ionicons name="trash" size={18} color={colors.statusNegative} />
          <Text style={styles.deleteText}>Delete flight</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
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
  container: { flex: 1, backgroundColor: colors.backgroundPrimary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: colors.backgroundPrimary,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    color: colors.textPrimary,
  },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  flightNumber: { fontSize: 24, fontWeight: "700", color: colors.textPrimary },
  date: { fontSize: 15, color: colors.textSecondary },
  airline: { fontSize: 14, color: colors.textSecondary },
  route: { flexDirection: "row", alignItems: "center", gap: 12 },
  endpoint: { flex: 1, gap: 2 },
  code: { fontSize: 26, fontWeight: "700", color: colors.textPrimary },
  city: { fontSize: 14, color: colors.textSecondary },
  time: { fontSize: 14, color: colors.accent, fontWeight: "600", marginTop: 4 },
  routeIcon: { width: 40, alignItems: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  detailLabel: { fontSize: 14, color: colors.textSecondary },
  detailValue: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
    textAlign: "right",
  },
  passenger: { flexDirection: "row", justifyContent: "space-between" },
  passengerName: { fontSize: 15, color: colors.textPrimary },
  passengerSeat: { fontSize: 14, color: colors.textSecondary },
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
  deleteText: { color: colors.statusNegative, fontSize: 15, fontWeight: "600" },
});
