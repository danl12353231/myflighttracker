import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  useAircraftSearch,
  useAirlineSearch,
  useAirportSearch,
  useCustomFieldDefinitions,
} from "../lib/api";
import { colors } from "../lib/theme";
import type {
  Aircraft,
  Airline,
  Airport,
  CustomFieldDefinition,
} from "../lib/router";

export type FlightFormValues = {
  date: string;
  flightNumber: string;
  aircraftReg: string;
  note: string;
  from: Airport | null;
  to: Airport | null;
  airline: Airline | null;
  aircraft: Aircraft | null;
  customFields: Record<string, unknown>;
};

export const emptyFormValues = (): FlightFormValues => ({
  date: new Date().toISOString().slice(0, 10),
  flightNumber: "",
  aircraftReg: "",
  note: "",
  from: null,
  to: null,
  airline: null,
  aircraft: null,
  customFields: {},
});

export function FlightForm({
  value,
  onChange,
}: {
  value: FlightFormValues;
  onChange: (next: FlightFormValues) => void;
}) {
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [airlineQuery, setAirlineQuery] = useState("");
  const [aircraftQuery, setAircraftQuery] = useState("");

  const fromSearch = useAirportSearch(fromQuery, !value.from);
  const toSearch = useAirportSearch(toQuery, !value.to);
  const airlineSearch = useAirlineSearch(airlineQuery, !value.airline);
  const aircraftSearch = useAircraftSearch(aircraftQuery, !value.aircraft);
  const flightDefs = useCustomFieldDefinitions("flight");

  const set = (patch: Partial<FlightFormValues>) =>
    onChange({ ...value, ...patch });

  const setCustomField = (key: string, v: unknown) => {
    set({ customFields: { ...value.customFields, [key]: v } });
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <View style={styles.card}>
        <Text style={styles.label}>From</Text>
        <AirportPicker
          selected={value.from}
          query={fromQuery}
          onQueryChange={setFromQuery}
          results={fromSearch.data ?? []}
          onSelect={(a) => set({ from: a })}
          onClear={() => set({ from: null })}
        />

        <Text style={styles.label}>To</Text>
        <AirportPicker
          selected={value.to}
          query={toQuery}
          onQueryChange={setToQuery}
          results={toSearch.data ?? []}
          onSelect={(a) => set({ to: a })}
          onClear={() => set({ to: null })}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={value.date}
          onChangeText={(date) => set({ date })}
          placeholder="YYYY-MM-DD"
        />
        <Text style={styles.label}>Flight number</Text>
        <TextInput
          style={styles.input}
          value={value.flightNumber}
          onChangeText={(flightNumber) => set({ flightNumber })}
          autoCapitalize="characters"
        />
        <Text style={styles.label}>Aircraft registration</Text>
        <TextInput
          style={styles.input}
          value={value.aircraftReg}
          onChangeText={(aircraftReg) => set({ aircraftReg })}
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Airline</Text>
        <EntityPicker
          labelKey="name"
          selected={value.airline?.name ?? null}
          query={airlineQuery}
          onQueryChange={setAirlineQuery}
          results={airlineSearch.data ?? []}
          onSelect={(a) => set({ airline: a })}
          onClear={() => set({ airline: null })}
        />

        <Text style={styles.label}>Aircraft type</Text>
        <EntityPicker
          labelKey="name"
          selected={
            value.aircraft
              ? `${value.aircraft.name}${value.aircraft.icao ? ` (${value.aircraft.icao})` : ""}`
              : null
          }
          query={aircraftQuery}
          onQueryChange={setAircraftQuery}
          results={aircraftSearch.data ?? []}
          onSelect={(a) => set({ aircraft: a })}
          onClear={() => set({ aircraft: null })}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Note</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          value={value.note}
          onChangeText={(note) => set({ note })}
          multiline
        />
      </View>

      {(flightDefs.data ?? []).length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Custom fields</Text>
          {(flightDefs.data ?? []).map((def) => (
            <CustomFieldInput
              key={def.key}
              def={def}
              value={value.customFields[def.key]}
              onChange={(v) => setCustomField(def.key, v)}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function CustomFieldInput({
  def,
  value,
  onChange,
}: {
  def: CustomFieldDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const options = (def.options as string[] | null) ?? [];

  if (def.fieldType === "boolean") {
    return (
      <View style={styles.toggleRow}>
        <Text style={styles.fieldLabel}>{def.label}</Text>
        <Switch value={Boolean(value)} onValueChange={onChange} />
      </View>
    );
  }

  if (def.fieldType === "select" && options.length > 0) {
    return (
      <View style={styles.selectWrap}>
        <Text style={styles.fieldLabel}>{def.label}</Text>
        <View style={styles.chipRow}>
          {options.map((opt) => {
            const active = value === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onChange(active ? null : opt)}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  const keyboardType =
    def.fieldType === "number"
      ? "numeric"
      : def.fieldType === "date"
        ? "numbers-and-punctuation"
        : "default";
  const current = value == null ? "" : String(value);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {def.label}
        {def.required ? " *" : ""}
      </Text>
      <TextInput
        style={[styles.input, def.fieldType === "textarea" && styles.noteInput]}
        value={current}
        onChangeText={(text) => onChange(text || null)}
        placeholder={def.description ?? ""}
        placeholderTextColor="#aaa"
        keyboardType={keyboardType}
        multiline={def.fieldType === "textarea"}
        editable={
          def.fieldType !== "airport" &&
          def.fieldType !== "airline" &&
          def.fieldType !== "aircraft"
        }
      />
      {def.fieldType === "airport" ||
      def.fieldType === "airline" ||
      def.fieldType === "aircraft" ? (
        <Text style={styles.fieldHint}>
          This field type requires the web app to set.
        </Text>
      ) : null}
    </View>
  );
}

function AirportPicker({
  selected,
  query,
  onQueryChange,
  results,
  onSelect,
  onClear,
}: {
  selected: Airport | null;
  query: string;
  onQueryChange: (q: string) => void;
  results: Airport[];
  onSelect: (a: Airport) => void;
  onClear: () => void;
}) {
  if (selected) {
    return (
      <View style={styles.selected}>
        <Text style={styles.selectedText}>
          {selected.iata ?? selected.icao} · {selected.name}
        </Text>
        <TouchableOpacity onPress={onClear}>
          <Ionicons name="close-circle" size={20} color="#999" />
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <>
      <TextInput
        style={styles.input}
        placeholder="Search airports…"
        value={query}
        onChangeText={onQueryChange}
      />
      <ResultList
        results={results.slice(0, 6)}
        renderLabel={(a: Airport) => `${a.iata ?? a.icao} · ${a.name}`}
        onSelect={onSelect}
      />
    </>
  );
}

function EntityPicker<T extends { id: number; name: string }>({
  labelKey,
  selected,
  query,
  onQueryChange,
  results,
  onSelect,
  onClear,
}: {
  labelKey: keyof T;
  selected: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  results: T[];
  onSelect: (item: T) => void;
  onClear: () => void;
}) {
  if (selected) {
    return (
      <View style={styles.selected}>
        <Text style={styles.selectedText}>{selected}</Text>
        <TouchableOpacity onPress={onClear}>
          <Ionicons name="close-circle" size={20} color="#999" />
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <>
      <TextInput
        style={styles.input}
        placeholder="Search…"
        value={query}
        onChangeText={onQueryChange}
      />
      <ResultList
        results={results.slice(0, 6)}
        renderLabel={(item: T) => String(item[labelKey])}
        onSelect={onSelect}
      />
    </>
  );
}

function ResultList<T>({
  results,
  renderLabel,
  onSelect,
}: {
  results: T[];
  renderLabel: (item: T) => string;
  onSelect: (item: T) => void;
}) {
  if (results.length === 0) return null;
  return (
    <View style={styles.results}>
      {results.map((item, idx) => (
        <TouchableOpacity
          key={idx}
          style={styles.resultRow}
          onPress={() => onSelect(item)}
        >
          <Text style={styles.resultName} numberOfLines={1}>
            {renderLabel(item)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundPrimary,
  },
  noteInput: { minHeight: 80, textAlignVertical: "top" },
  selected: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.backgroundSelected,
  },
  selectedText: { fontSize: 15, color: colors.textPrimary, flex: 1 },
  results: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    backgroundColor: colors.backgroundPrimary,
    overflow: "hidden",
  },
  resultRow: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  resultName: { fontSize: 14, color: colors.textPrimary },
  field: { gap: 6, marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  fieldHint: { fontSize: 12, color: colors.textSecondary },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  selectWrap: { gap: 6, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.backgroundSelected,
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontSize: 13, color: colors.textPrimary, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
});
