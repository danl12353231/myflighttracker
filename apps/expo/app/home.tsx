import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
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
import { FlightDetailsSheet } from "../components/FlightDetailsSheet";
import { StatsContent } from "../components/StatsContent";
import { SearchSheet } from "../components/SearchSheet";
import { useAuth } from "../lib/auth";
import { useFlights, useUpcomingFlights } from "../lib/api";
import { prepareVisitedAirports } from "../lib/visited-airports";
import { fs } from "../lib/fonts";
import type { Airport, Flight, VisitedAirport } from "../lib/router";
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

  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<HomeTab>("mine");
  const [satellite, setSatellite] = useState(false);
  const [airportDetailsId, setAirportDetailsId] = useState<number | null>(null);
  const [searchedAirport, setSearchedAirport] = useState<Airport | null>(null);
  const [flightDetailsId, setFlightDetailsId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const MIN_H = Math.round(height * 0.34);
  const COLLAPSED_H = Math.round(height * 0.42);
  const MID_H = Math.round(height * 0.66);
  const MAX_H = Math.round(height * 0.9);
  const animHeight = useRef(new Animated.Value(COLLAPSED_H)).current;
  const [isTall, setIsTall] = useState(false);

  const dragStart = useRef({ y: 0, h: COLLAPSED_H });
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        animHeight.stopAnimation((h) => {
          dragStart.current = { y: 0, h };
        });
      },
      onPanResponderMove: (_, g) => {
        const h = Math.max(MIN_H, Math.min(MAX_H, dragStart.current.h - g.dy));
        animHeight.setValue(h);
      },
      onPanResponderRelease: () => {
        animHeight.stopAnimation((h) => {
          // Snap to nearest of COLLAPSED / MID / MAX.
          const targets = [COLLAPSED_H, MID_H, MAX_H];
          let best = COLLAPSED_H;
          let bestDist = Infinity;
          for (const t of targets) {
            const d = Math.abs(h - t);
            if (d < bestDist) {
              bestDist = d;
              best = t;
            }
          }
          Animated.timing(animHeight, {
            toValue: best,
            duration: 200,
            useNativeDriver: false,
          }).start();
        });
      },
    }),
  ).current;

  // Track whether the sheet is tall enough to show the flight list.
  useEffect(() => {
    const id = animHeight.addListener(({ value }) => {
      setIsTall(value >= (COLLAPSED_H + MID_H) / 2);
    });
    return () => animHeight.removeListener(id);
  }, [animHeight, COLLAPSED_H, MID_H]);

  const all = useMemo(() => allFlights.data ?? [], [allFlights.data]);
  const upcomingList = useMemo(() => upcoming.data ?? [], [upcoming.data]);
  const friendsList = useMemo(() => friends.data ?? [], [friends.data]);
  const list = useMemo(() => {
    if (tab === "friends") return friendsList;
    if (tab === "passport") return all;
    return upcomingList;
  }, [tab, friendsList, all, upcomingList]);

  const title =
    tab === "mine" ? "My Flights" : tab === "friends" ? "Friends" : "Passport";

  const visitedAirports = useMemo(() => prepareVisitedAirports(all), [all]);
  const airportDetails = useMemo<VisitedAirport | null>(() => {
    if (searchedAirport) {
      // Build a visited-airport shape from a searched airport (no flight stats).
      return {
        ...searchedAirport,
        departures: 0,
        arrivals: 0,
        airlines: [],
        frequency: 1,
      };
    }
    return visitedAirports.find((a) => a.id === airportDetailsId) ?? null;
  }, [visitedAirports, airportDetailsId, searchedAirport]);
  const airportFlights = useMemo(
    () =>
      all.filter(
        (f) => f.from?.id === airportDetailsId || f.to?.id === airportDetailsId,
      ),
    [all, airportDetailsId],
  );

  // Auto-select the first upcoming flight for the dashboard and map.
  const effectiveSelected = useMemo(
    () => (tab === "passport" ? null : (list[0] ?? null)),
    [tab, list],
  );

  // Tell the map to draw the selected route. Retry until the WebView is ready.
  useEffect(() => {
    if (!effectiveSelected) return;
    let tries = 0;
    const maxTries = 20;
    const trySet = () => {
      if (tries >= maxTries) return;
      tries++;
      mapRef.current?.setFlight(effectiveSelected);
      setTimeout(trySet, 250);
    };
    const id = setTimeout(trySet, 200);
    return () => clearTimeout(id);
  }, [effectiveSelected]);

  // Resize the dashboard when switching tabs.
  const targetH = tab === "passport" ? MID_H : COLLAPSED_H;
  useEffect(() => {
    setExpanded(tab === "passport");
    Animated.timing(animHeight, {
      toValue: targetH,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [tab, targetH, animHeight]);

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

  const navBottom = insets.bottom + 12;

  return (
    <View style={styles.root}>
      {/* Map layer fills the screen */}
      <View style={StyleSheet.absoluteFill}>
        <MapView
          ref={mapRef}
          flights={all}
          airports={visitedAirports}
          satellite={satellite}
          onAirportTap={(id) => {
            setSearchedAirport(null);
            setAirportDetailsId(id);
          }}
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
              setSatellite(!satellite);
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
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.dashboard,
          { height: animHeight, paddingBottom: navBottom },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.dragHandle}>
          <View style={styles.dragHandleBar} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Animated.timing(animHeight, {
                toValue: expanded ? COLLAPSED_H : MID_H,
                duration: 260,
                useNativeDriver: false,
              }).start();
              setExpanded(!expanded);
            }}
          >
            <Text style={styles.title}>{title}</Text>
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
            <Pressable
              style={styles.summaryRow}
              onPress={() => {
                if (effectiveSelected) setFlightDetailsId(effectiveSelected.id);
              }}
            >
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
                <Text style={styles.routeTitle} numberOfLines={2}>
                  {effectiveSelected
                    ? `${effectiveSelected.from?.municipality ?? "?"} to ${effectiveSelected.to?.municipality ?? "?"}`
                    : "Select a flight"}
                </Text>
                <View style={styles.airportRow}>
                  <Text
                    style={[
                      styles.airportCode,
                      { color: colors.statusPositive },
                    ]}
                  >
                    {effectiveSelected
                      ? codeOf(effectiveSelected, "from")
                      : "---"}
                  </Text>
                  <Text
                    style={[
                      styles.airportTime,
                      { color: colors.statusPositive },
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
                      { color: colors.statusNegative },
                    ]}
                  >
                    {effectiveSelected
                      ? codeOf(effectiveSelected, "to")
                      : "---"}
                  </Text>
                  <Text
                    style={[
                      styles.airportTime,
                      { color: colors.statusNegative },
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
                <Text style={styles.statusLabel}>{statusInfo.label}</Text>
                <Text style={[styles.statusState, { color: statusInfo.color }]}>
                  {statusInfo.state}
                </Text>
              </View>
            </Pressable>

            {list.length === 0 && !allFlights.isLoading ? (
              <Text style={styles.empty}>No upcoming flights yet.</Text>
            ) : null}

            {isTall && list.length > 0 ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.flightListScroll}
                contentContainerStyle={styles.flightList}
              >
                {list.map((f) => (
                  <Pressable
                    key={f.id}
                    style={styles.flightRow}
                    onPress={() => {
                      mapRef.current?.setFlight(f);
                      setFlightDetailsId(f.id);
                    }}
                  >
                    <View style={styles.flightRowLeft}>
                      <Text style={styles.flightRowRoute}>
                        {codeOf(f, "from")} → {codeOf(f, "to")}
                      </Text>
                      <Text style={styles.flightRowMeta} numberOfLines={1}>
                        {f.flightNumber ?? (airlineOf(f) || "Flight")} ·{" "}
                        {f.from?.municipality ?? "?"} →{" "}
                        {f.to?.municipality ?? "?"}
                      </Text>
                    </View>
                    <Text style={styles.flightRowDate}>{f.date}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
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
      </Animated.View>

      <AirportDetailsSheet
        visible={!!airportDetails}
        airport={airportDetails}
        relatedFlights={airportFlights}
        onClose={() => {
          setAirportDetailsId(null);
          setSearchedAirport(null);
        }}
        onShowFlight={(id) => {
          setAirportDetailsId(null);
          setFlightDetailsId(id);
          const f = all.find((x) => x.id === id);
          if (f) mapRef.current?.setFlight(f);
        }}
      />

      <FlightDetailsSheet
        visible={!!flightDetailsId}
        flightId={flightDetailsId}
        onClose={() => setFlightDetailsId(null)}
        onEdit={(id) => router.push(`/flight/edit/${id}`)}
      />

      <SearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectFlight={(f) => {
          setSearchOpen(false);
          mapRef.current?.setFlight(f);
          setFlightDetailsId(f.id);
        }}
        onSelectAirport={(a) => {
          setSearchOpen(false);
          setSearchedAirport(a);
          setAirportDetailsId(a.id);
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

  listWrap: { flex: 1, justifyContent: "flex-start", minHeight: 0 },
  passportWrap: { flex: 1, marginTop: 12, overflow: "hidden" },

  dragHandle: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 6,
  },
  dragHandleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderSubtle,
  },

  flightListScroll: { flex: 1, marginTop: 8, minHeight: 0 },
  flightList: { gap: 4, paddingBottom: 12 },
  flightRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  flightRowLeft: { flex: 1, gap: 3, minWidth: 0 },
  flightRowRoute: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  flightRowMeta: { fontSize: 12, color: colors.textSecondary },
  flightRowDate: { fontSize: 12, color: colors.textSecondary },

  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    flexShrink: 1,
  },
  airportCode: { fontSize: 18, fontWeight: "600" },
  airportTime: { fontSize: 14, fontWeight: "600" },
  statusWrap: { alignItems: "flex-end", gap: 1, flexShrink: 0 },
  statusLabel: { fontSize: 12, color: colors.textSecondary },
  statusState: { fontSize: 14, fontWeight: "600" },

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
