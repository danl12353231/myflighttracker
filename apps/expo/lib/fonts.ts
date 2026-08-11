import { useWindowDimensions } from "react-native";

// Design was created for a ~390pt-wide phone. Scale font sizes down on
// smaller devices and up slightly on larger ones, clamped to stay legible.
const BASE_WIDTH = 390;

export function useFontScale() {
  const { width } = useWindowDimensions();
  return Math.min(1.15, Math.max(0.82, width / BASE_WIDTH));
}

export const fs = {
  title: 40,
  remainingHours: 40,
  route: 21,
  airportCode: 22,
  airportTime: 20,
  status: 16,
  statusLabel: 15,
  navLabel: 13,
  metadata: 12,
  screenTitle: 28,
};
