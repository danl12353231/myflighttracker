import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useFlights } from "../lib/api";
import { colors } from "../lib/theme";
import type { Flight } from "../lib/router";

const codeOf = (f: Flight, end: "from" | "to") => {
  const a = end === "from" ? f.from : f.to;
  return a?.iata ?? a?.icao ?? "---";
};

export function SearchSheet({
  visible,
  onClose,
  onSelectFlight,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectFlight: (f: Flight) => void;
}) {
  const router = useRouter();
  const all = useFlights("mine");
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const flights = all.data ?? [];
    if (!q.trim()) return flights;
    const needle = q.toLowerCase();
    return flights.filter((f) =>
      [
        f.flightNumber,
        f.airline?.name,
        f.airline?.iata,
        f.airline?.icao,
        f.from?.iata,
        f.from?.icao,
        f.from?.municipality,
        f.from?.name,
        f.to?.iata,
        f.to?.icao,
        f.to?.municipality,
        f.to?.name,
        f.date,
        f.aircraftReg,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [all.data, q]);

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
        <View style={styles.header}>
          <Text style={styles.title}>Search flights</Text>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Flight number, airline, airport, date…"
            placeholderTextColor={colors.textSecondary}
            value={q}
            onChangeText={setQ}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
          />
          {q ? (
            <Pressable onPress={() => setQ("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        >
          {all.isLoading ? (
            <Text style={styles.empty}>Loading flights…</Text>
          ) : results.length === 0 ? (
            <Text style={styles.empty}>No flights match your search.</Text>
          ) : (
            results.map((f) => (
              <Pressable
                key={f.id}
                style={styles.row}
                onPress={() => {
                  onSelectFlight(f);
                  setQ("");
                }}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowRoute}>
                    {codeOf(f, "from")} → {codeOf(f, "to")}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {f.flightNumber ?? ""}{" "}
                    {f.airline ? `· ${f.airline.name}` : ""} · {f.date}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            ))
          )}
          <Pressable
            style={styles.addRow}
            onPress={() => {
              onClose();
              setQ("");
              router.push("/flight/new");
            }}
          >
            <View style={styles.addIcon}>
              <Ionicons name="add" size={20} color={colors.textPrimary} />
            </View>
            <Text style={styles.addText}>Add a new flight</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "70%",
    backgroundColor: colors.backgroundPrimary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderSubtle,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  list: { gap: 2, paddingTop: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowMain: { gap: 2, flex: 1 },
  rowRoute: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textSecondary },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  addIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: { fontSize: 15, fontWeight: "600", color: colors.accent },
  empty: {
    textAlign: "center",
    color: colors.textSecondary,
    paddingVertical: 24,
    fontSize: 14,
  },
});
