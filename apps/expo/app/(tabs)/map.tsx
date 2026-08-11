import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { MapView, type MapViewHandle } from "../../components/MapView";
import { useFlights } from "../../lib/api";
import { colors, spacing } from "../../lib/theme";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapViewHandle>(null);
  const flights = useFlights("mine");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [satellite, setSatellite] = useState(false);

  const pick = (id: number | null) => {
    setSelectedId(id);
    const f = (flights.data ?? []).find((x) => x.id === id) ?? null;
    setTimeout(() => mapRef.current?.setFlight(f), 50);
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <MapView
          ref={mapRef}
          flights={flights.data ?? []}
          selectedId={selectedId}
        />
      </View>

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
