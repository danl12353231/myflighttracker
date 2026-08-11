import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useFlightStatus } from "../lib/api";
import { colors } from "../lib/theme";

const fmt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const delayColor = (min: number | null | undefined) => {
  if (min == null || min <= 0) return colors.statusPositive;
  if (min < 30) return colors.statusWarning;
  return colors.statusNegative;
};

const statusColor = (cancelled: boolean, name: string | null) => {
  if (cancelled) return colors.statusNegative;
  const n = (name ?? "").toLowerCase();
  if (n.includes("landed") || n.includes("arrived") || n.includes("on time")) {
    return colors.statusPositive;
  }
  if (n.includes("delay") || n.includes("cancel")) return colors.statusNegative;
  return colors.accent;
};

export function FlightStatusCard({
  flightNumber,
  date,
}: {
  flightNumber: string | null;
  date?: string;
}) {
  const [open, setOpen] = useState(false);
  const status = useFlightStatus(flightNumber, date);

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen((v) => !v)}>
        <View style={styles.titleRow}>
          <Ionicons name="radio" size={16} color={colors.accent} />
          <Text style={styles.cardLabel}>Live status</Text>
        </View>
        {status.isLoading ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : status.error ? (
          <Text style={styles.error}>Unavailable</Text>
        ) : status.data ? (
          <View style={styles.titleRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: statusColor(status.data.flight.status.cancelled, status.data.flight.status.name) },
              ]}
            />
            <Text style={styles.summary}>
              {status.data.flight.status.name ?? "Live"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </View>
        ) : (
          <Text style={styles.error}>No data</Text>
        )}
      </Pressable>

      {open && status.data ? (
        <View style={styles.body}>
          <Text style={styles.statusLine}>
            {status.data.flight.status.description ??
              status.data.flight.status.name ??
              "No status description"}
          </Text>

          <Leg
            label="Departure"
            code={status.data.flight.departure.airport.iata}
            airport={status.data.flight.departure.airport.name}
            scheduled={status.data.flight.departure.time.scheduledUtc}
            bestKnown={status.data.flight.departure.time.bestKnownUtc}
            bestType={status.data.flight.departure.time.bestKnownType}
            delay={status.data.flight.departure.delayMinutes}
            terminal={status.data.flight.departure.airport.terminal}
            gate={status.data.flight.departure.airport.gate}
          />

          <Leg
            label="Arrival"
            code={status.data.flight.arrival.airport.iata}
            airport={status.data.flight.arrival.airport.name}
            scheduled={status.data.flight.arrival.time.scheduledUtc}
            bestKnown={status.data.flight.arrival.time.bestKnownUtc}
            bestType={status.data.flight.arrival.time.bestKnownType}
            delay={status.data.flight.arrival.delayMinutes}
            terminal={status.data.flight.arrival.airport.terminal}
            gate={status.data.flight.arrival.airport.gate}
          />

          {status.data.flight.aircraft.registration ||
          status.data.flight.aircraft.typeCode ? (
            <View style={styles.footerRow}>
              <Ionicons name="airplane" size={14} color={colors.textSecondary} />
              <Text style={styles.footerText}>
                {[status.data.flight.aircraft.typeCode, status.data.flight.aircraft.registration]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Leg({
  label,
  code,
  airport,
  scheduled,
  bestKnown,
  bestType,
  delay,
  terminal,
  gate,
}: {
  label: string;
  code: string | null;
  airport: string | null;
  scheduled: string | null;
  bestKnown: string | null;
  bestType: "actual" | "estimated" | null;
  delay: number | null;
  terminal: string | null;
  gate: string | null;
}) {
  return (
    <View style={styles.leg}>
      <View style={styles.legHeader}>
        <Text style={styles.legLabel}>{label}</Text>
        <Text style={styles.legCode}>{code ?? "—"}</Text>
      </View>
      <Text style={styles.legAirport} numberOfLines={1}>
        {airport ?? ""}
      </Text>
      <View style={styles.timeRow}>
        <Text style={styles.scheduled}>Scheduled {fmt(scheduled)}</Text>
        {bestKnown ? (
          <View style={styles.bestRow}>
            <Text
              style={[
                styles.best,
                { color: bestType === "actual" ? colors.statusPositive : colors.accent },
              ]}
            >
              {bestType === "actual" ? "Actual" : bestType === "estimated" ? "Est" : "New"} {fmt(bestKnown)}
            </Text>
            {delay != null && delay > 0 ? (
              <Text style={[styles.delay, { color: delayColor(delay) }]}>
                +{delay}m
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {terminal || gate ? (
        <Text style={styles.terminal}>
          {[terminal ? `Terminal ${terminal}` : "", gate ? `Gate ${gate}` : ""]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  summary: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  error: { fontSize: 13, color: colors.textSecondary },
  dot: { width: 10, height: 10, borderRadius: 5 },
  body: { gap: 12, marginTop: 10 },
  statusLine: { fontSize: 13, color: colors.textSecondary },
  leg: { gap: 2 },
  legHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  legLabel: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  legCode: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  legAirport: { fontSize: 12, color: colors.textSecondary },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  scheduled: { fontSize: 13, color: colors.textSecondary },
  bestRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  best: { fontSize: 13, fontWeight: "600" },
  delay: { fontSize: 13, fontWeight: "700" },
  terminal: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  footerText: { fontSize: 12, color: colors.textSecondary },
});
