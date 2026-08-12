import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { StyleSheet, Image } from "react-native";
import {
  WebView,
  type WebViewMessageEvent,
} from "react-native-webview";

import type { Flight, VisitedAirport } from "../lib/router";

type LonLat = [number, number];

export function buildRoute(a: LonLat, b: LonLat, steps = 48): LonLat[] {
  // Great-circle interpolation between two lat/lon points.
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (d: number) => (d * 180) / Math.PI;
  const la1 = toRad(a[1]);
  const la2 = toRad(b[1]);
  const lo1 = toRad(a[0]);
  const lo2 = toRad(b[0]);
  const la1s = Math.sin(la1);
  const la2s = Math.sin(la2);
  const la1c = Math.cos(la1);
  const la2c = Math.cos(la2);
  const d = Math.acos(
    Math.min(1, Math.max(-1, la1s * la2s + la1c * la2c * Math.cos(lo2 - lo1))),
  );
  const pts: LonLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (d < 1e-9) {
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      continue;
    }
    const sd = Math.sin(d);
    const sa = Math.sin((1 - t) * d) / sd;
    const sb = Math.sin(t * d) / sd;
    const x = sa * la1c * Math.cos(lo1) + sb * la2c * Math.cos(lo2);
    const y = sa * la1c * Math.sin(lo1) + sb * la2c * Math.sin(lo2);
    const z = sa * la1s + sb * la2s;
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lon = toDeg(Math.atan2(y, x));
    pts.push([lon, lat]);
  }
  return pts;
}

// React-Three-Fiber globe rendered inside a WebView. The globe app is a
// self-contained bundle (map-globe/index.html) that imports React, three,
// @react-three/fiber and @react-three/drei. RN communicates with it through
// postMessage; airport taps come back the same way. Running R3F in the
// browser engine avoids the expo-gl / new-architecture reconciler crashes
// seen with the native renderer.
export const MapView = forwardRef<
  MapViewHandle,
  {
    flights: Flight[];
    airports: VisitedAirport[];
    selectedId: number | null;
    onAirportTap?: (id: number) => void;
  }
>(function MapView({ flights, airports, selectedId, onAirportTap }, ref) {
  const webRef = useRef<any>(null);
  const readyRef = useRef(false);
  const latest = useRef({ flights, airports, selectedId });
  const globeSource = Image.resolveAssetSource(
    require("../map-globe/index.html"),
  );

  useEffect(() => {
    latest.current = { flights, airports, selectedId };
  }, [flights, airports, selectedId]);

  const post = (msg: unknown) => {
    if (!readyRef.current) return;
    webRef.current?.postMessage(JSON.stringify(msg));
  };

  useEffect(() => {
    post({
      type: "airports",
      airports: airports.map((a) => ({
        id: a.id,
        code: a.iata ?? a.icao,
        name: a.name,
        lon: a.lon,
        lat: a.lat,
      })),
    });
  }, [airports]);

  useEffect(() => {
    post({
      type: "flights",
      flights: flights.map((f) => ({
        id: f.id,
        from: f.from ? { lon: f.from.lon, lat: f.from.lat } : null,
        to: f.to ? { lon: f.to.lon, lat: f.to.lat } : null,
      })),
    });
  }, [flights]);

  useEffect(() => {
    const selected = flights.find((f) => f.id === selectedId);
    if (!selected?.from || !selected?.to) {
      post({ type: "route", route: [] });
      return;
    }
    post({
      type: "route",
      route: buildRoute(
        [selected.from.lon, selected.from.lat],
        [selected.to.lon, selected.to.lat],
      ),
    });
  }, [selectedId, flights]);

  useImperativeHandle(ref, () => ({
    setFlight(flight) {
      latest.current.selectedId = flight?.id ?? null;
      if (!flight?.from || !flight?.to) {
        post({ type: "route", route: [] });
        return;
      }
      post({
        type: "route",
        route: buildRoute(
          [flight.from.lon, flight.from.lat],
          [flight.to.lon, flight.to.lat],
        ),
      });
    },
    setSatellite(value) {
      post({ type: "satellite", on: Boolean(value) });
    },
    setAirports(list) {
      latest.current.airports = list;
      post({
        type: "airports",
        airports: list.map((a) => ({
          id: a.id,
          code: a.iata ?? a.icao,
          name: a.name,
          lon: a.lon,
          lat: a.lat,
        })),
      });
    },
    recenter() {
      post({ type: "recenter" });
    },
  }));

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d.type === "ready") {
        readyRef.current = true;
        const { flights: f, airports: a, selectedId: s } = latest.current;
        post({
          type: "airports",
          airports: a.map((x) => ({
            id: x.id,
            code: x.iata ?? x.icao,
            name: x.name,
            lon: x.lon,
            lat: x.lat,
          })),
        });
        post({
          type: "flights",
          flights: f.map((x) => ({
            id: x.id,
            from: x.from ? { lon: x.from.lon, lat: x.from.lat } : null,
            to: x.to ? { lon: x.to.lon, lat: x.to.lat } : null,
          })),
        });
        const selected = f.find((x) => x.id === s);
        if (selected?.from && selected?.to) {
          post({
            type: "route",
            route: buildRoute(
              [selected.from.lon, selected.from.lat],
              [selected.to.lon, selected.to.lat],
            ),
          });
        }
      } else if (d.type === "airport" && typeof d.id === "number") {
        onAirportTap?.(d.id);
      }
    } catch {
      /* ignore malformed messages */
    }
  };

  return (
    <WebView
      ref={webRef}
      originWhitelist={["*"]}
      source={globeSource}
      style={styles.web}
      javaScriptEnabled
      domStorageEnabled
      allowFileAccess
      allowUniversalAccessFromFileURLs
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      onMessage={handleMessage}
      onError={(s) => {
        console.warn("globe webview error", s.nativeEvent);
      }}
    />
  );
});

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "#05060a" },
});

export type MapViewHandle = {
  setFlight: (flight: Flight | null) => void;
  setSatellite: (value: boolean) => void;
  setAirports: (airports: VisitedAirport[]) => void;
  recenter: () => void;
};
