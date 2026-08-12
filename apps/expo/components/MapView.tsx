import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

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

const STYLE_FN = `function styleFor(sat) {
  return {
    version: 8,
    sources: {
      base: { type: 'raster', tiles: [ sat
        ? ${JSON.stringify(SATELLITE_TILES)}
        : ${JSON.stringify(DARK_TILES)} ], tileSize: 256 },
      labels: { type: 'raster', tiles: [${JSON.stringify(LABEL_TILES)}], tileSize: 256 }
    },
    layers: [
      { id: 'base', type: 'raster', source: 'base' },
      { id: 'labels', type: 'raster', source: 'labels' }
    ]
  };
}`;

// maplibre-gl@4 always ships setProjection. Skip the pre-load check that crashes.
const CHECK_PROJ = "";

const SCRIPT_SRC = "https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js";
const STYLE_CSS = "https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css";

const buildHtml = (init: {
  route: LonLat[];
  secondary: LonLat[][];
  airports: { id: number; code: string; lon: number; lat: number }[];
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
${CHECK_PROJ}
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
    minZoom: -2,
    maxZoom: 22,
    attributionControl: false
  });
  var FT = {
    map: map,
    route: [],
    satellite: false,
    globe: true,
    forceProj: false,
    airports: window.__INIT__.airports || []
  };
  window.FT = FT;

  function setProjection(globe, force) {
    if (typeof force !== "undefined") FT.forceProj = force;
    FT.globe = globe;
    try { map.setProjection({ type: FT.globe ? 'globe' : 'mercator' }); } catch (e) {}
    if (FT.globe) {
      map.easeTo({ bearing: 0, pitch: 0, duration: 300 });
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
    } else {
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
    }
    if (FT.route.length > 1) {
      var mid = FT.route[Math.floor(FT.route.length / 2)];
      map.flyTo({ center: mid, zoom: Math.max(map.getZoom(), globe ? 2 : 4), duration: 700 });
    }
  }

  function drawSecondary(feats) {
    var fc = { type: 'FeatureCollection', features: feats };
    if (!map.getSource('secondary')) {
      map.addSource('secondary', { type: 'geojson', data: fc });
      map.addLayer({ id: 'secondary', type: 'line', source: 'secondary',
        paint: { 'line-color': 'rgba(255,255,255,0.18)', 'line-width': 1.5 } });
    } else {
      map.getSource('secondary').setData(fc);
    }
  }

  function drawAirports() {
    if (!map.getSource('apts')) {
      map.addSource('apts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'apt-casing', type: 'circle', source: 'apts',
        paint: { 'circle-radius': 11, 'circle-color': '#0b0b0d', 'circle-opacity': 0.55,
          'circle-stroke-width': 1, 'circle-stroke-color': 'rgba(255,255,255,0.4)' }
      });
      map.addLayer({
        id: 'apt-label', type: 'symbol', source: 'apts',
        layout: {
          'text-field': ['get', 'code'], 'text-size': 11,
          'text-allow-overlap': true, 'text-ignore-placement': true,
          'text-anchor': 'center'
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(11,11,13,0.85)', 'text-halo-width': 1.5 }
      });
    }
    var feats = FT.airports.map(function (a) {
      return {
        type: 'Feature', geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
        properties: { id: a.id, code: a.code }
      };
    });
    map.getSource('apts').setData({ type: 'FeatureCollection', features: feats });
  }

  function drawRoute() {
    var r = FT.route;
    if (r.length < 2) {
      if (map.getSource('route-line')) {
        map.getSource('route-line').setData({ type:'FeatureCollection', features:[] });
      }
      return;
    }
    if (!map.getSource('route-line')) {
      map.addSource('route-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route-line',
        paint: { 'line-color': 'rgba(10,132,255,0.25)', 'line-width': 9 } });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route-line',
        paint: { 'line-color': '#0A84FF', 'line-width': 5 } });
      map.addSource('origin-pt', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'origin-pt', type: 'circle', source: 'origin-pt',
        paint: { 'circle-radius': 7, 'circle-color': '#30D158', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
      map.addSource('dest-pt', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'dest-pt', type: 'circle', source: 'dest-pt',
        paint: { 'circle-radius': 7, 'circle-color': '#FF453A', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
    }
    map.getSource('route-line').setData({ type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: r }, properties: {} }] });
    map.getSource('origin-pt').setData({ type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: r[0] }, properties: {} }] });
    map.getSource('dest-pt').setData({ type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: r[r.length-1] }, properties: {} }] });
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

  function reDrawAll() {
    var secondary = window.__INIT__.secondary || [];
    drawSecondary(secondary.map(function (pair) {
      return { type: 'Feature', geometry: { type: 'LineString', coordinates: pair }, properties: {} };
    }));
    drawAirports();
    drawRoute();
    try { map.setProjection({ type: 'globe' }); } catch (e) {}
  }

  map.on('load', function () {
    reDrawAll();
    applyRoute(window.__INIT__.route);
  });

  // Tap detection for airport markers.
  map.on('click', function (e) {
    var feats = map.queryRenderedFeatures(e.point, { layers: ['apt-casing', 'apt-label'] });
    if (feats.length && feats[0].properties && feats[0].properties.id != null) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'airport', id: Number(feats[0].properties.id) })
      );
      return;
    }
    // Fallback: a slightly larger query window in case the marker is small.
    var nearby = map.queryRenderedFeatures(
      [[e.point.x - 12, e.point.y - 12], [e.point.x + 12, e.point.y + 12]],
      { layers: ['apt-casing', 'apt-label'] }
    );
    if (nearby.length && nearby[0].properties && nearby[0].properties.id != null) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'airport', id: Number(nearby[0].properties.id) })
      );
    }
  });

  window.addEventListener('message', function (e) {
    var d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    if (d.type === 'route') {
      applyRoute(d.route || []);
    } else if (d.type === 'satellite') {
      FT.satellite = d.value;
      map.setStyle(styleFor(d.value));
      map.once('styledata', reDrawAll);
    } else if (d.type === 'airports') {
      FT.airports = d.airports || [];
      drawAirports();
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
  setAirports: (airports: VisitedAirport[]) => void;
  recenter: () => void;
};

export const MapView = forwardRef<
  MapViewHandle,
  {
    flights: Flight[];
    airports: VisitedAirport[];
    onAirportTap?: (id: number) => void;
  }
>(function MapView({ flights, airports, onAirportTap }, ref) {
  const webRef = useRef<any>(null);

  // Only rebuild the WebView when flight/airport data truly changes (first load).
  // Route updates use the imperative setFlight postMessage exclusively.
  const html = useMemo(() => {
    const secondary = flights
      .filter((f) => f.from && f.to)
      .slice(0, 30)
      .map(
        (f) =>
          [
            [f.from!.lon, f.from!.lat],
            [f.to!.lon, f.to!.lat],
          ] as LonLat[],
      );
    const markers = airports.map((a) => ({
      id: a.id,
      code: a.iata ?? a.icao,
      lon: a.lon,
      lat: a.lat,
    }));
    return buildHtml({ route: [], secondary, airports: markers });
  }, [flights, airports]);

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
    setAirports(list) {
      webRef.current?.postMessage(
        JSON.stringify({
          type: "airports",
          airports: list.map((a) => ({
            id: a.id,
            code: a.iata ?? a.icao,
            lon: a.lon,
            lat: a.lat,
          })),
        }),
      );
    },
    recenter() {
      webRef.current?.postMessage(JSON.stringify({ type: "recenter" }));
    },
  }));

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d.type === "airport" && typeof d.id === "number" && onAirportTap) {
        onAirportTap(d.id);
      }
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
