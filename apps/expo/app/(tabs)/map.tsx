import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { MapView, type MapViewHandle } from "../../components/MapView";
import { AirportDetailsSheet } from "../../components/AirportDetailsSheet";
import { useFlights } from "../../lib/api";
import { prepareVisitedAirports } from "../../lib/visited-airports";
import { colors, spacing } from "../../lib/theme";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapViewHandle>(null);
  const flights = useFlights("mine");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [globe, setGlobe] = useState(false);
  const [airportDetailsId, setAirportDetailsId] = useState<number | null>(null);

  const all = useMemo(() => flights.data ?? [], [flights.data]);
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

  const pick = (id: number | null) => {
    setSelectedId(id);
    const f = all.find((x) => x.id === id) ?? null;
    setTimeout(() => mapRef.current?.setFlight(f), 50);
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <MapView
          ref={mapRef}
          flights={all}
          airports={visitedAirports}
          selectedId={selectedId}
          onAirportTap={(id) => setAirportDetailsId(id)}
        />
      </View>

      <AirportDetailsSheet
        visible={!!airportDetails}
        airport={airportDetails}
        relatedFlights={airportFlights}
        onClose={() => setAirportDetailsId(null)}
        onShowFlight={(id) => {
          setAirportDetailsId(null);
          pick(id);
        }}
      />

      <View style={[styles.controls, { top: insets.top + 16 }]}>
        <View style={styles.pill}>
          <Pressable
            style={styles.btn}
            onPress={() => {
              const next = !satellite;
              setSatellite(next);
              mapRef.current?.setSatellite(next);
            }}
          >
            <Ionicons
              name="layers-outline"
              size={20}
              color={colors.textPrimary}
            />
          </Pressable>
          <Pressable
            style={styles.btn}
            onPress={() => {
              const next = !globe;
              setGlobe(next);
              mapRef.current?.setProjection(next);
            }}
          >
            <Ionicons
              name={globe ? "earth" : "earth-outline"}
              size={20}
              color={colors.textPrimary}
            />
          </Pressable>
          <Pressable style={styles.btn}>
            <Ionicons
              name="cloud-outline"
              size={20}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>
        <Pressable
          style={styles.recenter}
          onPress={() => mapRef.current?.recenter()}
        >
          <Ionicons name="locate" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
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
  pill: {
    width: 60,
    borderRadius: 30,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 6,
    alignItems: "center",
  },
  btn: { padding: 9, alignItems: "center" },
  recenter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
});
