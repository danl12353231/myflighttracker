import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MLMap,
  type CameraRef,
  type LngLat,
  type LngLatBounds,
  type MapRef,
} from "@maplibre/maplibre-react-native";

import type { Flight, VisitedAirport } from "../lib/router";

const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const DARK_TILES = "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LABEL_TILES =
  "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

type LonLat = [number, number];

export function buildRoute(a: LonLat, b: LonLat, steps = 60): LonLat[] {
  const pts: LonLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return pts;
}

const buildStyle = (satellite: boolean) => ({
  version: 8 as const,
  sources: {
    base: {
      type: "raster" as const,
      tiles: [satellite ? SATELLITE_TILES : DARK_TILES],
      tileSize: 256,
    },
    labels: {
      type: "raster" as const,
      tiles: [LABEL_TILES],
      tileSize: 256,
    },
  },
  layers: [
    { id: "base", type: "raster" as const, source: "base" },
    { id: "labels", type: "raster" as const, source: "labels" },
  ],
});

export type MapViewHandle = {
  setFlight: (flight: Flight | null) => void;
  setSatellite: (value: boolean) => void;
  setAirports: (airports: VisitedAirport[]) => void;
  recenter: () => void;
};

export const MapView = forwardRef<
  MapViewHandle,
  {
    flights: Flight[];
    airports: VisitedAirport[];
    satellite: boolean;
    onAirportTap?: (id: number) => void;
  }
>(function MapView({ flights, airports, satellite, onAirportTap }, ref) {
  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);
  const currentFlight = useRef<Flight | null>(null);
  const [routeTick, setRouteTick] = useState(0);

  const mapStyle = useMemo(() => buildStyle(satellite), [satellite]);

  const routeFlight = useMemo(
    () => currentFlight.current,
    [flights, routeTick],
  );

  const routeFeature = useMemo(() => {
    const f = routeFlight;
    if (!f?.from || !f?.to) return null;
    const line = buildRoute([f.from.lon, f.from.lat], [f.to.lon, f.to.lat]);
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: line },
        },
        {
          type: "Feature" as const,
          properties: { kind: "origin" },
          geometry: {
            type: "Point" as const,
            coordinates: [f.from.lon, f.from.lat] as LngLat,
          },
        },
        {
          type: "Feature" as const,
          properties: { kind: "dest" },
          geometry: {
            type: "Point" as const,
            coordinates: [f.to.lon, f.to.lat] as LngLat,
          },
        },
      ],
    };
  }, [routeFlight]);

  const secondaryFeatures = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: flights
        .filter((f) => f.id !== currentFlight.current?.id && f.from && f.to)
        .slice(0, 30)
        .map((f) => ({
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [f.from!.lon, f.from!.lat],
              [f.to!.lon, f.to!.lat],
            ] as LngLat[],
          },
        })),
    }),
    [flights],
  );

  const airportFeatures = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: airports.map((a) => ({
        type: "Feature" as const,
        properties: { id: a.id, code: a.iata ?? a.icao },
        geometry: {
          type: "Point" as const,
          coordinates: [a.lon, a.lat] as LngLat,
        },
      })),
    }),
    [airports],
  );

  const fitRoute = (flight: Flight) => {
    if (!flight.from || !flight.to) return;
    const bounds: LngLatBounds = [
      Math.min(flight.from.lon, flight.to.lon),
      Math.min(flight.from.lat, flight.to.lat),
      Math.max(flight.from.lon, flight.to.lon),
      Math.max(flight.from.lat, flight.to.lat),
    ];
    cameraRef.current?.fitBounds(bounds, {
      padding: { top: 80, right: 40, bottom: 300, left: 40 },
      duration: 700,
    });
  };

  useImperativeHandle(ref, () => ({
    setFlight(flight) {
      currentFlight.current = flight;
      setRouteTick((t) => t + 1);
      if (flight?.from && flight?.to) fitRoute(flight);
    },
    setSatellite() {
      // Style is reactive via the `satellite` prop.
    },
    setAirports() {
      // Source data is reactive via the `airports` prop.
    },
    recenter() {
      const f = currentFlight.current;
      if (!f?.from || !f?.to) return;
      cameraRef.current?.flyTo({
        center: [(f.from.lon + f.to.lon) / 2, (f.from.lat + f.to.lat) / 2],
        zoom: 5,
        duration: 700,
      });
    },
  }));

  const handlePress = (e: any) => {
    const features = e?.features;
    if (!features?.length) return;
    const hit = features.find(
      (x: any) =>
        x.properties?.id != null &&
        (x.layer?.id === "apt-casing" || x.layer?.id === "apt-label"),
    );
    if (hit?.properties?.id != null) onAirportTap?.(Number(hit.properties.id));
  };

  return (
    <MLMap
      ref={mapRef}
      style={styles.map}
      mapStyle={mapStyle}
      onPress={handlePress}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ center: [0, 20], zoom: 1.5 }}
        minZoom={0}
        maxZoom={22}
      />

      {secondaryFeatures.features.length > 0 ? (
        <GeoJSONSource id="secondary" data={secondaryFeatures}>
          <Layer
            id="secondary-layer"
            type="line"
            style={{ lineColor: "rgba(255,255,255,0.18)", lineWidth: 1.5 }}
          />
        </GeoJSONSource>
      ) : null}

      {routeFeature ? (
        <GeoJSONSource id="route" data={routeFeature}>
          <Layer
            id="route-casing"
            type="line"
            style={{ lineColor: "rgba(10,132,255,0.25)", lineWidth: 9 }}
          />
          <Layer
            id="route-line"
            type="line"
            style={{ lineColor: "#0A84FF", lineWidth: 5 }}
          />
          <Layer
            id="origin-pt"
            type="circle"
            style={{
              circleRadius: 7,
              circleColor: "#30D158",
              circleStrokeWidth: 2,
              circleStrokeColor: "#fff",
            }}
          />
          <Layer
            id="dest-pt"
            type="circle"
            style={{
              circleRadius: 7,
              circleColor: "#FF453A",
              circleStrokeWidth: 2,
              circleStrokeColor: "#fff",
            }}
          />
        </GeoJSONSource>
      ) : null}

      {airportFeatures.features.length > 0 ? (
        <GeoJSONSource id="apts" data={airportFeatures}>
          <Layer
            id="apt-casing"
            type="circle"
            style={{
              circleRadius: 11,
              circleColor: "#0b0b0d",
              circleOpacity: 0.55,
              circleStrokeWidth: 1,
              circleStrokeColor: "rgba(255,255,255,0.4)",
            }}
          />
          <Layer
            id="apt-label"
            type="symbol"
            style={{
              textField: ["get", "code"],
              textSize: 11,
              textAllowOverlap: true,
              textIgnorePlacement: true,
              textAnchor: "center",
              textColor: "#ffffff",
              textHaloColor: "rgba(11,11,13,0.85)",
              textHaloWidth: 1.5,
            }}
          />
        </GeoJSONSource>
      ) : null}
    </MLMap>
  );
});

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: "#0b0b0d" },
});
