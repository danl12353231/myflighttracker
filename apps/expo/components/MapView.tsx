import { forwardRef, useImperativeHandle, useMemo } from "react";
import { GlobeScene } from "./GlobeScene";

import type { Flight, VisitedAirport } from "../lib/router";

export type MapViewHandle = {
  setFlight: (flight: Flight | null) => void;
  setSatellite: (value: boolean) => void;
  setAirports: (airports: VisitedAirport[]) => void;
  recenter: () => void;
};

// The map is now a native React-Three-Fiber globe. Selection and airport
// updates are reactive through props, so the imperative handle is a thin
// compatibility shim for the existing home-screen usage.
export const MapView = forwardRef<
  MapViewHandle,
  {
    flights: Flight[];
    airports: VisitedAirport[];
    selectedId: number | null;
    onAirportTap?: (id: number) => void;
  }
>(function MapView({ flights, airports, selectedId, onAirportTap }, ref) {
  const handle = useMemo(
    () => ({
      setFlight() {},
      setSatellite() {},
      setAirports() {},
      recenter() {},
    }),
    [],
  );

  useImperativeHandle(ref, () => handle);

  return (
    <GlobeScene
      flights={flights}
      airports={airports}
      selectedId={selectedId}
      onAirportTap={onAirportTap}
    />
  );
});
