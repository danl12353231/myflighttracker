export const colors = {
  backgroundPrimary: "#151517",
  backgroundSecondary: "#1B1B1E",
  backgroundSelected: "#343438",
  textPrimary: "#FFFFFF",
  textSecondary: "#99999F",
  accent: "#0A84FF",
  statusPositive: "#30D158",
  statusNegative: "#FF453A",
  statusWarning: "#FF9F0A",
  borderSubtle: "rgba(255,255,255,0.12)",
  divider: "rgba(255,255,255,0.08)",
  mapOverlay: "rgba(0,0,0,0.35)",
};

export const spacing = {
  dashboardHInset: 16,
  dashboardBottom: 20,
  mapControlRight: 20,
  mapControlTop: 115,
};

export const radius = {
  dashboard: 50,
  navigation: 52,
  pill: 36,
};

export const typography = {
  screenTitle: { fontSize: 40, fontWeight: "700" as const },
  remainingHours: { fontSize: 40, fontWeight: "600" as const },
  route: { fontSize: 21, fontWeight: "600" as const },
  airportCode: { fontSize: 22, fontWeight: "600" as const },
  time: { fontSize: 20, fontWeight: "600" as const },
  status: { fontSize: 16, fontWeight: "600" as const },
  statusLabel: { fontSize: 16, fontWeight: "400" as const },
  navLabel: { fontSize: 14, fontWeight: "600" as const },
  metadata: { fontSize: 12, fontWeight: "400" as const },
  metadataBold: { fontSize: 12, fontWeight: "600" as const },
};

export type FlightStatus =
  | "scheduled"
  | "boarding"
  | "onTime"
  | "delayed"
  | "departed"
  | "inFlight"
  | "arriving"
  | "landed"
  | "cancelled";

export const statusMeta: Record<
  FlightStatus,
  { label: string; state: string; color: string }
> = {
  scheduled: {
    label: "Departs",
    state: "Scheduled",
    color: colors.textSecondary,
  },
  boarding: {
    label: "Departs",
    state: "Boarding",
    color: colors.statusWarning,
  },
  onTime: { label: "Departs", state: "On Time", color: colors.statusPositive },
  delayed: { label: "Departs", state: "Delayed", color: colors.statusWarning },
  departed: { label: "Flight", state: "Departed", color: colors.accent },
  inFlight: { label: "Flight", state: "In Flight", color: colors.accent },
  arriving: {
    label: "Flight",
    state: "Arriving",
    color: colors.statusPositive,
  },
  landed: { label: "Flight", state: "Landed", color: colors.statusPositive },
  cancelled: {
    label: "Flight",
    state: "Cancelled",
    color: colors.statusNegative,
  },
};
