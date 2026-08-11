import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import type { Flight } from "../lib/router";

const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const DARK_TILES = "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

type LonLat = [number, number];

// Linear interpolation of lon/lat is visually smooth for short hops; good enough
// for a geodesic-looking arc on the world map.
export function buildRoute(a: LonLat, b: LonLat, steps = 60): LonLat[] {
  const pts: LonLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return pts;
}

const STYLE_FN = `function styleFor(sat) {
  return {
    version: 8,
    sources: {
      base: { type: 'raster', tiles: [ sat
        ? ${JSON.stringify(SATELLITE_TILES)}
        : ${JSON.stringify(DARK_TILES)} ], tileSize: 256 }
    },
    layers: [ { id: 'base', type: 'raster', source: 'base' } ]
  };
}`;

const SCRIPT_SRC = "https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js";
const STYLE_CSS = "https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css";

// The embedded map page. It reads an initial payload from window.__INIT__ and
// listens for postMessage commands.
const buildHtml = (init: {
  satellite: boolean;
  route: LonLat[];
  secondary: LonLat[][];
}) =>
  `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html, body, #map { margin:0; height:100%; width:100%; background:#0b0b0d; }</style>
</head>
<body><div id="map"></div>
<script>
window.__INIT__ = ${JSON.stringify(init)};
${STYLE_FN}
var script = document.createElement('script');
script.src = ${JSON.stringify(SCRIPT_SRC)};
script.onload = function () {
  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = ${JSON.stringify(STYLE_CSS)};
  document.head.appendChild(css);
  var map = new maplibregl.Map({
    container: 'map',
    style: styleFor(false),
    center: [0, 20],
    zoom: 1.5,
    attributionControl: false
  });
  var FT = { map: map, route: [], satellite: false, globe: false };
  window.FT = FT;

  function setProjection(globe) {
    FT.globe = globe;
    if (typeof map.setProjection === 'function') {
      map.setProjection({ type: globe ? 'globe' : 'mercator' });
    }
    // Globe doesn't support rotation/bearing; keep the camera square.
    if (globe) {
      map.easeTo({ bearing: 0, pitch: 0, duration: 400 });
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
    } else {
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
    }
    if (FT.route.length > 1) {
      var mid = FT.route[Math.floor(FT.route.length / 2)];
      map.flyTo({ center: mid, zoom: Math.max(map.getZoom(), globe ? 2 : 4), duration: 700 });
    }
  }

  function drawSecondary() {
    var feats = (window.__INIT__.secondary || []).map(function (pair) {
      return { type: 'Feature', geometry: { type: 'LineString', coordinates: pair }, properties: {} };
    });
    if (!map.getSource('secondary')) {
      map.addSource('secondary', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'secondary', type: 'line', source: 'secondary', paint: { 'line-color': 'rgba(255,255,255,0.18)', 'line-width': 1.5 } });
    }
    map.getSource('secondary').setData({ type: 'FeatureCollection', features: feats });
  }

  function drawRoute() {
    var r = FT.route;
    if (r.length < 2) return;
    if (!map.getSource('route-line')) {
      map.addSource('route-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route-line', paint: { 'line-color': 'rgba(10,132,255,0.25)', 'line-width': 9 } });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route-line', paint: { 'line-color': '#0A84FF', 'line-width': 5 } });
      map.addSource('origin-pt', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'origin-pt', type: 'circle', source: 'origin-pt', paint: { 'circle-radius': 7, 'circle-color': '#30D158', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
      map.addSource('dest-pt', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'dest-pt', type: 'circle', source: 'dest-pt', paint: { 'circle-radius': 7, 'circle-color': '#FF453A', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
    }
    map.getSource('route-line').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: r }, properties: {} }] });
    map.getSource('origin-pt').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: r[0] }, properties: {} }] });
    map.getSource('dest-pt').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: r[r.length-1] }, properties: {} }] });
  }

  function fit() {
    var r = FT.route;
    if (r.length < 2) return;
    var bounds = new maplibregl.LngLatBounds();
    r.forEach(function (p) { bounds.extend(p); });
    map.fitBounds(bounds, { padding: { top: 60, right: 40, bottom: 300, left: 40 }, duration: 900 });
  }

  function applyRoute(route) {
    FT.route = route;
    drawRoute();
    fit();
  }

  map.on('load', function () {
    drawSecondary();
    applyRoute(window.__INIT__.route);
  });

  window.addEventListener('message', function (e) {
    var d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    if (d.type === 'route') {
      applyRoute(d.route || []);
    } else if (d.type === 'satellite') {
      FT.satellite = d.value;
      map.setStyle(styleFor(d.value));
      map.once('styledata', function () { drawSecondary(); drawRoute(); });
    } else if (d.type === 'projection') {
      setProjection(!!d.value);
    } else if (d.type === 'recenter' && FT.route.length > 1) {
      var mid = FT.route[Math.floor(FT.route.length / 2)];
      map.flyTo({ center: mid, zoom: Math.max(map.getZoom(), 5), duration: 900 });
    }
  });
};
document.head.appendChild(script);
</script>
</body></html>`;

export type MapViewHandle = {
  setFlight: (flight: Flight | null) => void;
  setSatellite: (value: boolean) => void;
  setProjection: (globe: boolean) => void;
  recenter: () => void;
};

export const MapView = forwardRef<
  MapViewHandle,
  {
    flights: Flight[];
    selectedId: number | null;
    onAirportTap?: (iata: string) => void;
  }
>(function MapView({ flights, selectedId, onAirportTap }, ref) {
  const webRef = useRef<any>(null);

  const html = useMemo(() => {
    const selected = flights.find((f) => f.id === selectedId) ?? null;
    const route =
      selected?.from && selected?.to
        ? buildRoute(
            [selected.from.lon, selected.from.lat],
            [selected.to.lon, selected.to.lat],
          )
        : [];
    const secondary = flights
      .filter((f) => f.id !== selectedId && f.from && f.to)
      .slice(0, 12)
      .map(
        (f) =>
          [
            [f.from!.lon, f.from!.lat],
            [f.to!.lon, f.to!.lat],
          ] as LonLat[],
      );
    return buildHtml({ satellite: false, route, secondary });
  }, [flights, selectedId]);

  useImperativeHandle(ref, () => ({
    setFlight(flight) {
      if (!flight?.from || !flight?.to) {
        webRef.current?.postMessage(
          JSON.stringify({ type: "route", route: [] }),
        );
        return;
      }
      webRef.current?.postMessage(
        JSON.stringify({
          type: "route",
          route: buildRoute(
            [flight.from.lon, flight.from.lat],
            [flight.to.lon, flight.to.lat],
          ),
        }),
      );
    },
    setSatellite(value) {
      webRef.current?.postMessage(JSON.stringify({ type: "satellite", value }));
    },
    setProjection(globe) {
      webRef.current?.postMessage(
        JSON.stringify({ type: "projection", value: globe }),
      );
    },
    recenter() {
      webRef.current?.postMessage(JSON.stringify({ type: "recenter" }));
    },
  }));

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d.type === "airport" && onAirportTap) onAirportTap(d.iata);
    } catch {
      /* ignore */
    }
  };

  return (
    <WebView
      ref={webRef}
      originWhitelist={["*"]}
      source={{ html }}
      style={styles.web}
      javaScriptEnabled
      onMessage={handleMessage}
    />
  );
});

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "#0b0b0d" },
});
