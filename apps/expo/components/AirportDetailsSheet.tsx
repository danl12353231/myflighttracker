import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useMetar } from "../lib/api";
import { colors } from "../lib/theme";
import type { Flight, VisitedAirport } from "../lib/router";

const flagUrl = (country: string) =>
  `https://flagcdn.com/w80/${country.toLowerCase()}.svg`;

const formatFlightDate = (date: string) => {
  const d = new Date(date);
  return d.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export function AirportDetailsSheet({
  visible,
  airport,
  relatedFlights,
  onClose,
  onShowFlight,
}: {
  visible: boolean;
  airport: VisitedAirport | null;
  relatedFlights: Flight[];
  onClose: () => void;
  onShowFlight: (id: number) => void;
}) {
  const metar = useMetar(airport ? airport.icao : null);
  const [weatherExpanded, setWeatherExpanded] = useState(false);

  const localTime = useMemo(() => {
    if (!airport) return null;
    try {
      return new Intl.DateTimeFormat([], {
        timeZone: airport.tz,
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());
    } catch {
      return null;
    }
  }, [airport]);

  const departures = useMemo(
    () =>
      relatedFlights
        .filter((f) => f.from?.id === airport?.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [relatedFlights, airport],
  );
  const arrivals = useMemo(
    () =>
      relatedFlights
        .filter((f) => f.to?.id === airport?.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [relatedFlights, airport],
  );

  const weatherLabel = useMemo(() => {
    const m = metar.data;
    if (!m) return null;
    const worst = m.clouds.reduce<{ label: string; rank: number } | null>(
      (acc, c) => {
        const rank = { SKC: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4 }[c.coverage];
        if (!acc || rank > acc.rank) return { label: c.coverage, rank };
        return acc;
      },
      null,
    );
    if (m.cavok && m.clouds.length === 0) return "Clear";
    if (!worst) return "Clear";
    return {
      SKC: "Clear",
      FEW: "Mostly Clear",
      SCT: "Partly Cloudy",
      BKN: "Mostly Cloudy",
      OVC: "Overcast",
    }[worst.label as keyof typeof weatherLabels];
  }, [metar.data]);

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
        {airport ? (
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            {/* Header */}
            <View style={styles.header}>
              {airport.country ? (
                <Image
                  source={{ uri: flagUrl(airport.country) }}
                  style={styles.flag}
                />
              ) : null}
              <View style={styles.headerText}>
                <View style={styles.codeRow}>
                  <Text style={styles.code}>
                    {airport.iata ?? airport.icao}
                  </Text>
                  {airport.iata ? (
                    <Text style={styles.icao}>{airport.icao}</Text>
                  ) : null}
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {airport.name}
                </Text>
                <Text style={styles.location} numberOfLines={1}>
                  {airport.municipality
                    ? `${airport.municipality}, ${airport.country}`
                    : airport.country}
                </Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            {/* Stats */}
            <View style={styles.card}>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Ionicons
                    name="airplane"
                    size={18}
                    color={colors.statusPositive}
                  />
                  <Text style={styles.statValue}>{airport.departures}</Text>
                  <Text style={styles.statLabel}>Departures</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Ionicons
                    name="airplane"
                    size={18}
                    color={colors.statusNegative}
                  />
                  <Text style={styles.statValue}>{airport.arrivals}</Text>
                  <Text style={styles.statLabel}>Arrivals</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Ionicons
                    name="business"
                    size={18}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.statValue}>
                    {airport.airlines.length}
                  </Text>
                  <Text style={styles.statLabel}>Airlines</Text>
                </View>
              </View>
            </View>

            {/* Local time */}
            {localTime ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Local time</Text>
                <Text style={styles.timeValue}>{localTime}</Text>
                <Text style={styles.timeZone}>{airport.tz}</Text>
              </View>
            ) : null}

            {/* Weather */}
            <View style={styles.card}>
              <Pressable
                style={styles.weatherHeader}
                onPress={() => setWeatherExpanded((v) => !v)}
              >
                <Text style={styles.cardLabel}>Weather</Text>
                {metar.isLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.textSecondary}
                  />
                ) : weatherLabel ? (
                  <View style={styles.weatherSummary}>
                    <Text style={styles.weatherTemp}>
                      {metar.data?.tempC != null
                        ? `${Math.round(metar.data.tempC)}°`
                        : ""}
                    </Text>
                    <Text style={styles.weatherCond}>{weatherLabel}</Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.textSecondary}
                    />
                  </View>
                ) : (
                  <View style={styles.weatherSummary}>
                    <Text style={styles.weatherCond}>Unavailable</Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.textSecondary}
                    />
                  </View>
                )}
              </Pressable>
              {weatherExpanded && metar.data ? (
                <View style={styles.weatherBody}>
                  <Text style={styles.metarRaw}>{metar.data.raw}</Text>
                  <View style={styles.metarGrid}>
                    <MetarRow
                      icon="flag"
                      label="Category"
                      value={metar.data.flightCategory}
                    />
                    <MetarRow
                      icon="eye"
                      label="Visibility"
                      value={
                        metar.data.cavok
                          ? "10+ km"
                          : `${(metar.data.visibilityM / 1000).toFixed(1)} km`
                      }
                    />
                    <MetarRow
                      icon="speedometer"
                      label="Wind"
                      value={`${metar.data.wind.speedKt} kt${metar.data.wind.dirDeg != null ? ` ${metar.data.wind.dirDeg}°` : " VRB"}`}
                    />
                    {metar.data.tempC != null ? (
                      <MetarRow
                        icon="thermometer"
                        label="Temp"
                        value={`${Math.round(metar.data.tempC)}°C`}
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>

            {/* Departures / Arrivals */}
            {departures.length > 0 || arrivals.length > 0 ? (
              <View style={styles.card}>
                {departures.length > 0 ? (
                  <FlightGroup
                    label="Departures"
                    icon="airplane"
                    flights={departures}
                    onShow={onShowFlight}
                  />
                ) : null}
                {arrivals.length > 0 ? (
                  <FlightGroup
                    label="Arrivals"
                    icon="airplane"
                    flights={arrivals}
                    onShow={onShowFlight}
                  />
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const weatherLabels = {
  SKC: "Clear",
  FEW: "Mostly Clear",
  SCT: "Partly Cloudy",
  BKN: "Mostly Cloudy",
  OVC: "Overcast",
};

function MetarRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metarRow}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text style={styles.metarLabel}>{label}</Text>
      <Text style={styles.metarValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function FlightGroup({
  label,
  icon,
  flights,
  onShow,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  flights: Flight[];
  onShow: (id: number) => void;
}) {
  return (
    <View style={styles.flightGroup}>
      <Text style={styles.flightGroupHeader}>
        {label} · {flights.length}
      </Text>
      {flights.slice(0, 8).map((f) => {
        // The other endpoint relative to the airport this sheet is about.
        const other = label === "Arrivals" ? f.from : f.to;
        return (
          <Pressable
            key={f.id}
            style={styles.flightRow}
            onPress={() => onShow(f.id)}
          >
            <View style={styles.flightCode}>
              <Text style={styles.flightCodeText}>
                {f.flightNumber?.replace(/([a-zA-Z]{2})(\d+)/, "$1 $2") ??
                  "Flight"}
              </Text>
              <Text style={styles.flightMeta} numberOfLines={1}>
                {other?.iata ?? other?.icao ?? ""} · {f.airline?.name ?? ""}
              </Text>
            </View>
            <Text style={styles.flightDate}>{formatFlightDate(f.date)}</Text>
          </Pressable>
        );
      })}
      {flights.length > 8 ? (
        <Text style={styles.more}>+{flights.length - 8} more</Text>
      ) : null}
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
    maxHeight: "75%",
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
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  flag: { width: 44, height: 30, borderRadius: 6 },
  headerText: { flex: 1, gap: 2 },
  codeRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  code: { fontSize: 26, fontWeight: "700", color: colors.textPrimary },
  icao: { fontSize: 12, fontFamily: "monospace", color: colors.textSecondary },
  name: { fontSize: 15, color: colors.textPrimary, fontWeight: "500" },
  location: { fontSize: 13, color: colors.textSecondary },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  statRow: { flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  statLabel: { fontSize: 12, color: colors.textSecondary },
  statDivider: { width: 1, height: 32, backgroundColor: colors.divider },
  cardLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  timeValue: { fontSize: 34, fontWeight: "700", color: colors.textPrimary },
  timeZone: { fontSize: 13, color: colors.textSecondary },
  weatherHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weatherSummary: { flexDirection: "row", alignItems: "center", gap: 8 },
  weatherTemp: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  weatherCond: { fontSize: 13, color: colors.textSecondary },
  weatherBody: { gap: 8, marginTop: 4 },
  metarRaw: {
    fontSize: 12,
    fontFamily: "monospace",
    color: colors.textSecondary,
    backgroundColor: colors.backgroundPrimary,
    borderRadius: 8,
    padding: 10,
  },
  metarGrid: { gap: 6 },
  metarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metarLabel: { fontSize: 13, color: colors.textSecondary, width: 80 },
  metarValue: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    textAlign: "right",
  },
  flightGroup: { gap: 4 },
  flightGroupHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  flightRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  flightCode: { gap: 2 },
  flightCodeText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  flightMeta: { fontSize: 12, color: colors.textSecondary },
  flightDate: { fontSize: 12, color: colors.textSecondary },
  more: { fontSize: 12, color: colors.accent, paddingTop: 6 },
});
