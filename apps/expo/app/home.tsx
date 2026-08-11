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

import { MapView, type MapViewHandle } from "../components/MapView";
import { AirportDetailsSheet } from "../components/AirportDetailsSheet";
import { StatsContent } from "../components/StatsContent";
import { SearchSheet } from "../components/SearchSheet";
import { useAuth } from "../lib/auth";
import { useFlights, useUpcomingFlights } from "../lib/api";
import { prepareVisitedAirports } from "../lib/visited-airports";
import { useFontScale, fs } from "../lib/fonts";
import type { Flight, VisitedAirport } from "../lib/router";
import { colors, spacing, statusMeta, type FlightStatus } from "../lib/theme";

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

type HomeTab = "mine" | "friends" | "passport";

export default function MapHomeScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const scale = useFontScale();
  const router = useRouter();
  const { status: authStatus } = useAuth();
  const mapRef = useRef<MapViewHandle>(null);

  // Safety net: bounce back to auth screens if the session is gone.
  useEffect(() => {
    if (authStatus === "unconfigured") router.replace("/server-link");
    else if (authStatus === "unauthenticated") router.replace("/login");
  }, [authStatus, router]);

  const allFlights = useFlights("mine");
  const upcoming = useUpcomingFlights("mine");
  const friends = useUpcomingFlights("friends");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [globe, setGlobe] = useState(false);
  const [tab, setTab] = useState<HomeTab>("mine");
  const [expanded, setExpanded] = useState(false);
  const [airportDetailsId, setAirportDetailsId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const all = useMemo(() => allFlights.data ?? [], [allFlights.data]);
  const upcomingList = useMemo(() => upcoming.data ?? [], [upcoming.data]);
  const friendsList = useMemo(() => friends.data ?? [], [friends.data]);

  // The flights shown in the dashboard depend on the active tab.
  const list = useMemo(() => {
    if (tab === "friends") return friendsList;
    if (tab === "passport") return all;
    return upcomingList;
  }, [tab, friendsList, all, upcomingList]);

  const title =
    tab === "mine" ? "My Flights" : tab === "friends" ? "Friends" : "Passport";

  const visitedAirports = useMemo(() => prepareVisitedAirports(all), [all]);

  const airportDetails = useMemo(
    () => visitedAirports.find((a) => a.id === airportDetailsId) ?? null,
    [visitedAirports, airportDetailsId],
  );
  const airportFlights = useMemo(
    () =>
      all.filter(
        (f) => f.from?.id === airportDetailsId || f.to?.id === airportDetailsId,
      ),
    [all, airportDetailsId],
  );

  const selected = useMemo(
    () => all.find((f) => f.id === selectedId) ?? null,
    [all, selectedId],
  );

  // For "mine"/"friends", auto-select the first upcoming flight so the
  // dashboard and map show a real, current flight.
  const effectiveSelected = useMemo(
    () => (tab === "passport" ? null : (selected ?? list[0] ?? null)),
    [tab, selected, list],
  );

  const pick = useCallback((f: Flight) => {
    setSelectedId(f.id);
    setTimeout(() => mapRef.current?.setFlight(f), 50);
  }, []);

  useEffect(() => {
    if (effectiveSelected && selectedId !== effectiveSelected.id) {
      setSelectedId(effectiveSelected.id);
    }
  }, [effectiveSelected, selectedId]);

  useEffect(() => {
    if (tab === "passport") setExpanded(true);
  }, [tab]);

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
    ? Math.round(height * 0.66)
    : Math.round(height * 0.42);
  const navBottom = insets.bottom + 12;

  const s = (v: number) => Math.round(v * scale);

  return (
    <View style={styles.root}>
      {/* Map layer fills the screen */}
      <View style={StyleSheet.absoluteFill}>
        <MapView
          ref={mapRef}
          flights={all}
          airports={visitedAirports}
          selectedId={effectiveSelected ? effectiveSelected.id : null}
          onAirportTap={(id) => setAirportDetailsId(id)}
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
          <Pressable
            style={styles.controlBtn}
            onPress={() => {
              const next = !globe;
              setGlobe(next);
              mapRef.current?.setProjection(next);
            }}
          >
            <Ionicons
              name={globe ? "earth" : "earth-outline"}
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
          <Pressable onPress={() => setExpanded((v) => !v)}>
            <Text style={[styles.title, { fontSize: s(fs.title) }]}>
              {title}
            </Text>
          </Pressable>
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
              onPress={() => router.push("/profile")}
            >
              <Ionicons name="person" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        {tab === "passport" ? (
          <View style={styles.passportWrap}>
            <StatsContent flights={all} />
          </View>
        ) : (
          <View style={styles.listWrap}>
            <View style={styles.summaryRow}>
              {/* Remaining time */}
              <View style={styles.remaining}>
                <Text
                  style={[
                    styles.remainingH,
                    { fontSize: s(fs.remainingHours) },
                  ]}
                >
                  {remainingLabel.hours}
                </Text>
                <Text style={[styles.remainingM, { fontSize: s(13) }]}>
                  {remainingLabel.minutes}
                </Text>
              </View>

              {/* Route identity */}
              <View style={styles.routeInfo}>
                <Text
                  style={[styles.airlineMeta, { fontSize: s(fs.metadata) }]}
                >
                  {effectiveSelected
                    ? `${airlineOf(effectiveSelected)} ${effectiveSelected.flightNumber ?? ""}`.trim()
                    : "No flight"}
                </Text>
                <Text
                  style={[styles.routeTitle, { fontSize: s(fs.route) }]}
                  numberOfLines={1}
                >
                  {effectiveSelected
                    ? `${effectiveSelected.from?.municipality ?? "?"} to ${effectiveSelected.to?.municipality ?? "?"}`
                    : "Select a flight"}
                </Text>
                <View style={styles.airportRow}>
                  <Text
                    style={[
                      styles.airportCode,
                      {
                        fontSize: s(fs.airportCode),
                        color: colors.statusPositive,
                      },
                    ]}
                  >
                    {effectiveSelected
                      ? codeOf(effectiveSelected, "from")
                      : "---"}
                  </Text>
                  <Text
                    style={[
                      styles.airportTime,
                      {
                        fontSize: s(fs.airportTime),
                        color: colors.statusPositive,
                      },
                    ]}
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
                    style={[
                      styles.airportCode,
                      {
                        fontSize: s(fs.airportCode),
                        color: colors.statusNegative,
                      },
                    ]}
                  >
                    {effectiveSelected
                      ? codeOf(effectiveSelected, "to")
                      : "---"}
                  </Text>
                  <Text
                    style={[
                      styles.airportTime,
                      {
                        fontSize: s(fs.airportTime),
                        color: colors.statusNegative,
                      },
                    ]}
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
                <Text
                  style={[styles.statusLabel, { fontSize: s(fs.statusLabel) }]}
                >
                  {statusInfo.label}
                </Text>
                <Text
                  style={[
                    styles.statusState,
                    { fontSize: s(fs.status), color: statusInfo.color },
                  ]}
                >
                  {statusInfo.state}
                </Text>
              </View>
            </View>

            {/* Flight list */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.flightListScroll}
            >
              <View style={styles.flightList}>
                {list.map((f) => (
                  <Pressable
                    key={f.id}
                    style={[
                      styles.flightChip,
                      selectedId === f.id && styles.flightChipActive,
                    ]}
                    onPress={() => pick(f)}
                  >
                    <Text style={[styles.flightChipMain, { fontSize: s(14) }]}>
                      {codeOf(f, "from")} → {codeOf(f, "to")}
                    </Text>
                    <Text style={[styles.flightChipSub, { fontSize: s(11) }]}>
                      {f.flightNumber ?? (airlineOf(f) || "Flight")} · {f.date}
                    </Text>
                  </Pressable>
                ))}
                {list.length === 0 ? (
                  <Text style={[styles.empty, { fontSize: s(14) }]}>
                    {allFlights.isLoading
                      ? "Loading flights…"
                      : "No upcoming flights yet."}
                  </Text>
                ) : null}
              </View>
            </ScrollView>
          </View>
        )}

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
            onPress={() => setSearchOpen(true)}
          >
            <Ionicons name="search" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <AirportDetailsSheet
        visible={!!airportDetails}
        airport={airportDetails}
        relatedFlights={airportFlights}
        onClose={() => setAirportDetailsId(null)}
        onShowFlight={(id) => {
          setAirportDetailsId(null);
          const f = all.find((x) => x.id === id);
          if (f) pick(f);
        }}
      />

      <SearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectFlight={(f) => {
          setSearchOpen(false);
          pick(f);
        }}
      />
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
    gap: 10,
    zIndex: 10,
  },
  controlPill: {
    width: 72,
    borderRadius: 36,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 6,
    alignItems: "center",
    gap: 2,
  },
  controlBtn: { padding: 8, alignItems: "center" },
  pillDivider: { width: 36, height: 1, backgroundColor: colors.divider },
  recenterBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
    borderRadius: 44,
    backgroundColor: colors.backgroundPrimary,
    paddingHorizontal: 22,
    paddingTop: 20,
    overflow: "hidden",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    flexShrink: 1,
  },
  headerActions: { flexDirection: "row", gap: 10 },
  iconBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.backgroundSelected,
    alignItems: "center",
    justifyContent: "center",
  },

  listWrap: { flex: 1, justifyContent: "center" },
  passportWrap: { flex: 1, marginTop: 12, overflow: "hidden" },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 14,
  },
  remaining: { minWidth: 56, alignItems: "center" },
  remainingH: {
    fontSize: 34,
    fontWeight: "600",
    color: colors.textPrimary,
    lineHeight: 38,
  },
  remainingM: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  routeInfo: { flex: 1, gap: 2, minWidth: 0 },
  airlineMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  routeTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  airportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
    flexWrap: "wrap",
  },
  airportCode: { fontSize: 18, fontWeight: "600" },
  airportTime: { fontSize: 14, fontWeight: "600" },
  statusWrap: { alignItems: "flex-end", gap: 1, flexShrink: 0 },
  statusLabel: { fontSize: 12, color: colors.textSecondary },
  statusState: { fontSize: 14, fontWeight: "600" },

  flightListScroll: { marginHorizontal: -6 },
  flightList: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  flightChip: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  flightChipActive: { borderColor: colors.accent },
  flightChipMain: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  flightChipSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  empty: { color: colors.textSecondary, fontSize: 13, paddingVertical: 10 },

  navRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  navCapsule: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 44,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 4,
    gap: 2,
  },
  navTab: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    paddingVertical: 10,
    borderRadius: 40,
  },
  navTabActive: { backgroundColor: colors.backgroundSelected },
  navTabLabel: { fontSize: 11, fontWeight: "600", color: colors.textPrimary },
  searchBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.backgroundSelected,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
