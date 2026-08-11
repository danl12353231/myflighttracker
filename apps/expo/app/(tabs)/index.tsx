import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MapView, type MapViewHandle } from "../../components/MapView";
import { useFlights } from "../../lib/api";
import {
  colors,
  spacing,
  statusMeta,
  type FlightStatus,
} from "../../lib/theme";
import type { Flight } from "../../lib/router";

const formatTime = (iso: string | null | undefined) => {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const codeOf = (f: Flight, end: "from" | "to") => {
  const a = end === "from" ? f.from : f.to;
  return a?.iata ?? a?.icao ?? "---";
};

const airlineOf = (f: Flight) => f.airline?.name ?? "";

const deriveStatus = (f: Flight): FlightStatus => {
  if (f.landingActual) return "landed";
  if (f.takeoffActual) return "inFlight";
  if (f.departure) return "departed";
  return "scheduled";
};

export default function MapHomeScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const router = useRouter();
  const mapRef = useRef<MapViewHandle>(null);

  const flights = useFlights("mine");
  const upcoming = useFlights("mine");
  const upcomingFriends = useFlights("all");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [tab, setTab] = useState<"mine" | "friends" | "passport">("mine");
  const [expanded, setExpanded] = useState(false);

  const all = useMemo(() => flights.data ?? [], [flights.data]);
  const friends = useMemo(
    () => upcomingFriends.data ?? [],
    [upcomingFriends.data],
  );
  const list = useMemo(() => {
    if (tab === "friends") return friends;
    if (tab === "passport") return all;
    return upcoming.data ?? [];
  }, [tab, friends, all, upcoming.data]);

  const selected = useMemo(
    () => all.find((f) => f.id === selectedId) ?? null,
    [all, selectedId],
  );

  // Auto-select the first list flight so the dashboard/map aren't empty.
  const effectiveSelected = useMemo(
    () => selected ?? list[0] ?? null,
    [selected, list],
  );

  const pick = useCallback((f: Flight) => {
    setSelectedId(f.id);
    setTimeout(() => mapRef.current?.setFlight(f), 50);
  }, []);

  // Keep the map/chip highlight in sync with the auto-selected flight.
  useEffect(() => {
    if (effectiveSelected && selectedId !== effectiveSelected.id) {
      setSelectedId(effectiveSelected.id);
    }
  }, [effectiveSelected, selectedId]);

  const status = effectiveSelected
    ? deriveStatus(effectiveSelected)
    : ("scheduled" as FlightStatus);
  const statusInfo = statusMeta[status];

  const remainingLabel = useMemo(() => {
    const s = effectiveSelected;
    if (!s) return { hours: "--", minutes: "MINUTES" };
    const target = s.arrivalScheduled ?? s.arrival;
    if (!target) return { hours: "--", minutes: "MINUTES" };
    const ms = new Date(target).getTime() - Date.now();
    if (ms <= 0) return { hours: "0", minutes: "MINUTES" };
    const mins = Math.floor(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return {
      hours: h > 0 ? String(h) : String(m),
      minutes: h > 0 ? `${m} MINUTES` : "MINUTES",
    };
  }, [effectiveSelected]);

  const dashboardH = expanded
    ? Math.round(height * 0.62)
    : Math.round(height * 0.4);
  const navBottom = insets.bottom + 12;

  return (
    <View style={styles.root}>
      {/* Map layer fills the screen */}
      <View style={StyleSheet.absoluteFill}>
        <MapView
          ref={mapRef}
          flights={all}
          selectedId={effectiveSelected ? effectiveSelected.id : null}
        />
      </View>

      {/* Map controls (upper right) */}
      <View
        style={[styles.controls, { top: insets.top + spacing.mapControlTop }]}
      >
        <View style={styles.controlPill}>
          <Pressable
            style={styles.controlBtn}
            onPress={() => {
              const next = !satellite;
              setSatellite(next);
              mapRef.current?.setSatellite(next);
            }}
          >
            <Ionicons
              name={satellite ? "layers" : "layers-outline"}
              size={22}
              color={colors.textPrimary}
            />
          </Pressable>
          <View style={styles.pillDivider} />
          <Pressable style={styles.controlBtn}>
            <Ionicons
              name="cloud-outline"
              size={22}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>
        <Pressable
          style={styles.recenterBtn}
          onPress={() => mapRef.current?.recenter()}
        >
          <Ionicons name="airplane" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Floating dark dashboard */}
      <View
        style={[
          styles.dashboard,
          { height: dashboardH, paddingBottom: navBottom },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Flights</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.iconBtn}
              onPress={() => router.push("/sharing")}
            >
              <Ionicons
                name="share-outline"
                size={20}
                color={colors.textPrimary}
              />
            </Pressable>
            <Pressable
              style={styles.avatarBtn}
              onPress={() => router.push("/(tabs)/settings")}
            >
              <Ionicons name="person" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        {/* Flight summary (scrollable list + active flight info) */}
        <View style={styles.listWrap}>
          <View style={styles.summaryRow}>
            {/* Remaining time */}
            <View style={styles.remaining}>
              <Text style={styles.remainingH}>{remainingLabel.hours}</Text>
              <Text style={styles.remainingM}>{remainingLabel.minutes}</Text>
            </View>

            {/* Route identity */}
            <View style={styles.routeInfo}>
              <Text style={styles.airlineMeta}>
                {effectiveSelected
                  ? `${airlineOf(effectiveSelected)} ${effectiveSelected.flightNumber ?? ""}`.trim()
                  : "No flight"}
              </Text>
              <Text style={styles.routeTitle} numberOfLines={1}>
                {effectiveSelected
                  ? `${effectiveSelected.from?.municipality ?? "?"} to ${effectiveSelected.to?.municipality ?? "?"}`
                  : "Select a flight"}
              </Text>
              <View style={styles.airportRow}>
                <Text
                  style={[styles.airportCode, { color: colors.statusPositive }]}
                >
                  {effectiveSelected
                    ? codeOf(effectiveSelected, "from")
                    : "---"}
                </Text>
                <Text
                  style={[styles.airportTime, { color: colors.statusPositive }]}
                >
                  {effectiveSelected
                    ? formatTime(
                        effectiveSelected.departureScheduled ??
                          effectiveSelected.departure,
                      )
                    : "--:--"}
                </Text>
                <Ionicons
                  name="airplane"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.airportCode, { color: colors.statusNegative }]}
                >
                  {effectiveSelected ? codeOf(effectiveSelected, "to") : "---"}
                </Text>
                <Text
                  style={[styles.airportTime, { color: colors.statusNegative }]}
                >
                  {effectiveSelected
                    ? formatTime(
                        effectiveSelected.arrivalScheduled ??
                          effectiveSelected.arrival,
                      )
                    : "--:--"}
                </Text>
              </View>
            </View>

            {/* Status */}
            <View style={styles.statusWrap}>
              <Text style={styles.statusLabel}>{statusInfo.label}</Text>
              <Text style={[styles.statusState, { color: statusInfo.color }]}>
                {statusInfo.state}
              </Text>
            </View>
          </View>

          {/* Swipeable flight list */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.flightListScroll}
          >
            <View style={styles.flightList}>
              {(list.length ? list : all.slice(0, 6)).map((f) => (
                <Pressable
                  key={f.id}
                  style={[
                    styles.flightChip,
                    selectedId === f.id && styles.flightChipActive,
                  ]}
                  onPress={() => pick(f)}
                >
                  <Text style={styles.flightChipMain}>
                    {codeOf(f, "from")} → {codeOf(f, "to")}
                  </Text>
                  <Text style={styles.flightChipSub}>
                    {f.flightNumber ?? (airlineOf(f) || "Flight")} · {f.date}
                  </Text>
                </Pressable>
              ))}
              {list.length === 0 && all.length === 0 ? (
                <Text style={styles.empty}>No flights yet.</Text>
              ) : null}
            </View>
          </ScrollView>
        </View>

        {/* Bottom navigation */}
        <View style={styles.navRow}>
          <View style={styles.navCapsule}>
            <NavTab
              icon="airplane"
              label="My Flights"
              active={tab === "mine"}
              onPress={() => setTab("mine")}
            />
            <NavTab
              icon="people"
              label="Friends"
              active={tab === "friends"}
              onPress={() => setTab("friends")}
            />
            <NavTab
              icon="book"
              label="Passport"
              active={tab === "passport"}
              onPress={() => setTab("passport")}
            />
          </View>
          <Pressable
            style={styles.searchBtn}
            onPress={() => router.push("/flight/new")}
          >
            <Ionicons name="search" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function NavTab({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.navTab, active && styles.navTabActive]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={22}
        color={active ? colors.accent : colors.textPrimary}
      />
      <Text style={[styles.navTabLabel, active && { color: colors.accent }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0b0d" },

  controls: {
    position: "absolute",
    right: spacing.mapControlRight,
    gap: 12,
    zIndex: 10,
  },
  controlPill: {
    width: 76,
    borderRadius: 38,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 8,
    alignItems: "center",
    gap: 4,
  },
  controlBtn: { padding: 10, alignItems: "center" },
  pillDivider: { width: 40, height: 1, backgroundColor: colors.divider },
  recenterBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },

  dashboard: {
    position: "absolute",
    left: spacing.dashboardHInset,
    right: spacing.dashboardHInset,
    bottom: spacing.dashboardBottom,
    borderRadius: 50,
    backgroundColor: colors.backgroundPrimary,
    paddingHorizontal: 30,
    paddingTop: 26,
    overflow: "hidden",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 40, fontWeight: "700", color: colors.textPrimary },
  headerActions: { flexDirection: "row", gap: 12 },
  iconBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.backgroundSelected,
    alignItems: "center",
    justifyContent: "center",
  },

  listWrap: { flex: 1, justifyContent: "center" },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginVertical: 20,
  },
  remaining: { minWidth: 64 },
  remainingH: {
    fontSize: 40,
    fontWeight: "600",
    color: colors.textPrimary,
    lineHeight: 44,
  },
  remainingM: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  routeInfo: { flex: 1, gap: 4 },
  airlineMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  routeTitle: { fontSize: 21, fontWeight: "600", color: colors.textPrimary },
  airportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  airportCode: { fontSize: 22, fontWeight: "600" },
  airportTime: { fontSize: 18, fontWeight: "600" },
  statusWrap: { alignItems: "flex-end", gap: 2 },
  statusLabel: { fontSize: 14, color: colors.textSecondary },
  statusState: { fontSize: 16, fontWeight: "600" },

  flightListScroll: { marginHorizontal: -8 },
  flightList: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  flightChip: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    minWidth: 120,
  },
  flightChipActive: { borderColor: colors.accent },
  flightChipMain: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  flightChipSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  empty: { color: colors.textSecondary, fontSize: 14, paddingVertical: 12 },

  navRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
  navCapsule: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 52,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 6,
    gap: 4,
  },
  navTab: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    paddingVertical: 12,
    borderRadius: 44,
  },
  navTabActive: { backgroundColor: colors.backgroundSelected },
  navTabLabel: { fontSize: 12, fontWeight: "600", color: colors.textPrimary },
  searchBtn: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.backgroundSelected,
    alignItems: "center",
    justifyContent: "center",
  },
});
