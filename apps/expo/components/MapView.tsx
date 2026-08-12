import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import type { Flight, VisitedAirport } from "../lib/router";

type LonLat = [number, number];

export function buildRoute(a: LonLat, b: LonLat, steps = 48): LonLat[] {
  // Great-circle interpolation.
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (d: number) => (d * 180) / Math.PI;
  const la1 = toRad(a[1]);
  const la2 = toRad(b[1]);
  const dLon = toRad(b[0] - a[0]);
  const la1s = Math.sin(la1);
  const la2s = Math.sin(la2);
  const la1c = Math.cos(la1);
  const la2c = Math.cos(la2);
  const d = Math.acos(Math.min(1, la1s * la2s + la1c * la2c * Math.cos(dLon)));
  const pts: LonLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (d < 1e-9) {
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      continue;
    }
    const sd = Math.sin(d);
    const x = la1c * la2c * Math.sin(dLon);
    const y = la1c * la2s - la1s * la2c * Math.cos(dLon);
    const z = la1s * la2s + la1c * la2c * Math.cos(dLon);
    const sina = Math.sin((1 - t) * d) / sd;
    const sinb = Math.sin(t * d) / sd;
    const la = la1s * sina + la2s * sinb;
    const lo = Math.atan2(x * sina + y * sinb, z);
    pts.push([toDeg(lo), toDeg(Math.asin(la))]);
  }
  return pts;
}

// Three.js globe in a WebView. Self-contained: three.js from CDN, Natural
// Earth country borders, great-circle route arcs, airport markers, custom
// orbit controls, and tap-to-select via raycasting.
const buildHtml = (init: {
  airports: {
    id: number;
    code: string;
    name: string;
    lon: number;
    lat: number;
  }[];
}) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin:0; height:100%; width:100%; overflow:hidden; background:#05060a; }
  #c { position:fixed; inset:0; }
</style>
</head>
<body>
<div id="c"></div>
<script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
<script>
(function () {
  var WIN = window;
  var INIT_APT = ${JSON.stringify(init.airports)};

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);
  var camera = new THREE.PerspectiveCamera(45, WIN.innerWidth / WIN.innerHeight, 0.1, 1000);
  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(WIN.innerWidth, WIN.innerHeight);
  renderer.setPixelRatio(Math.min(WIN.devicePixelRatio || 1, 2));
  document.getElementById('c').appendChild(renderer.domElement);

  var GLOBE_R = 1;
  var group = new THREE.Group();
  scene.add(group);

  // Camera: perspective looking at the globe.
  camera.position.set(0, 0.5, 3);
  camera.lookAt(0, 0, 0);

  // Lights.
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  var dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(3, 2, 4);
  scene.add(dir);

  function llToVec(lat, lon, r) {
    var phi = (90 - lat) * Math.PI / 180;
    var theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  // --- Ocean sphere (dark blue) ---
  var ocean = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R, 64, 64),
    new THREE.MeshPhongMaterial({ color: 0x0a2540, shininess: 10 })
  );
  group.add(ocean);

  // --- Country borders ---
  var borderGeo = new THREE.BufferGeometry();
  var borderPts = [];
  fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
    .then(function (r) { return r.json(); })
    .then(function (world) {
      var linePts = [];
      function addRing(ring) {
        for (var i = 0; i < ring.length; i++) {
          var lon = ring[i][0];
          var lat = ring[i][1];
          linePts.push(llToVec(lat, lon, GLOBE_R * 1.002));
        }
        linePts.push(linePts[linePts.length - 1]);
      }
      world.features.forEach(function (f) {
        var g = f.geometry;
        if (g.type === 'Polygon') {
          g.coordinates.forEach(addRing);
        } else if (g.type === 'MultiPolygon') {
          g.coordinates.forEach(function (poly) { poly.forEach(addRing); });
        }
      });
      borderGeo.setFromPoints(linePts);
      var borders = new THREE.LineSegments(
        borderGeo,
        new THREE.LineBasicMaterial({ color: 0x4a90d9, transparent: true, opacity: 0.55 })
      );
      group.add(borders);
    });

  // --- Airport markers ---
  var airportGroup = new THREE.Group();
  group.add(airportGroup);
  var airports = INIT_APT.map(function (a) {
    var pt = llToVec(a.lat, a.lon, GLOBE_R * 1.02);
    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x1a73e8 })
    );
    mesh.position.copy(pt);
    mesh.userData = { id: a.id };
    airportGroup.add(mesh);
    return { a: a, mesh: mesh };
  });

  // --- Routes (great-circle arcs) ---
  var routeGroup = new THREE.Group();
  group.add(routeGroup);
  var currentRoute = [];

  function drawRoute(pts) {
    while (routeGroup.children.length) routeGroup.remove(routeGroup.children[0]);
    currentRoute = pts || [];
    if (!pts || pts.length < 2) return;
    var vecs = pts.map(function (p) { return llToVec(p[1], p[0], GLOBE_R * 1.01); });
    var geo = new THREE.BufferGeometry().setFromPoints(vecs);
    routeGroup.add(new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0x0A84FF, linewidth: 2 })
    ));
    // Endpoint dots.
    [0, vecs.length - 1].forEach(function (idx) {
      var dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 10, 10),
        new THREE.MeshBasicMaterial({ color: idx === 0 ? 0x30D158 : 0xFF453A })
      );
      dot.position.copy(vecs[idx]);
      routeGroup.add(dot);
    });
  }

  // --- Controls: drag rotate, wheel/pinch zoom ---
  var isDown = false;
  var prevX = 0;
  var prevY = 0;
  var rotX = 0;
  var rotY = 0;
  var dist = 3;
  var MIN_DIST = 1.6;
  var MAX_DIST = 8;

  renderer.domElement.addEventListener('pointerdown', function (e) {
    isDown = true;
    prevX = e.clientX;
    prevY = e.clientY;
  });
  WIN.addEventListener('pointerup', function (e) {
    if (isDown && Math.abs(e.clientX - prevX) < 5 && Math.abs(e.clientY - prevY) < 5) {
      pick(e.clientX, e.clientY);
    }
    isDown = false;
  });
  WIN.addEventListener('pointermove', function (e) {
    if (!isDown) return;
    var dx = e.clientX - prevX;
    var dy = e.clientY - prevY;
    rotY += dx * 0.005;
    rotX += dy * 0.005;
    rotX = Math.max(-1.2, Math.min(1.2, rotX));
    prevX = e.clientX;
    prevY = e.clientY;
  });
  renderer.domElement.addEventListener('wheel', function (e) {
    e.preventDefault();
    dist += e.deltaY * 0.002;
    dist = Math.max(MIN_DIST, Math.min(MAX_DIST, dist));
  }, { passive: false });
  // Pinch zoom.
  var pinchDist = 0;
  renderer.domElement.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });
  renderer.domElement.addEventListener('touchmove', function (e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      dist += (pinchDist - d) * 0.01;
      dist = Math.max(MIN_DIST, Math.min(MAX_DIST, dist));
      pinchDist = d;
    }
  }, { passive: false });

  // Tap picking via raycaster.
  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();
  function pick(cx, cy) {
    mouse.x = (cx / WIN.innerWidth) * 2 - 1;
    mouse.y = -(cy / WIN.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var hits = raycaster.intersectObjects(airportGroup.children, false);
    if (hits.length && hits[0].object.userData.id != null && WIN.ReactNativeWebView) {
      WIN.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'airport', id: hits[0].object.userData.id })
      );
    }
  }

  // --- Resize ---
  WIN.addEventListener('resize', function () {
    camera.aspect = WIN.innerWidth / WIN.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(WIN.innerWidth, WIN.innerHeight);
  });

  // --- RN message commands ---
  WIN.addEventListener('message', function (e) {
    var d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    if (d.type === 'route') {
      drawRoute(d.route || []);
    } else if (d.type === 'airports') {
      // Update airport marker positions.
      (d.airports || []).forEach(function (a) {
        var existing = airports.find(function (x) { return x.a.id === a.id; });
        if (existing) {
          var pt = llToVec(a.lat, a.lon, GLOBE_R * 1.02);
          existing.mesh.position.copy(pt);
        }
      });
    } else if (d.type === 'recenter') {
      dist = 3;
      rotX = 0;
      rotY = 0;
    }
  });

  // --- Render loop ---
  function animate() {
    requestAnimationFrame(animate);
    group.rotation.y = rotY;
    group.rotation.x = rotX;
    camera.position.set(0, 0.5, dist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  animate();
})();
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
  const currentFlight = useRef<Flight | null>(null);

  // Rebuild only when airport set changes (initial load).
  const html = useMemo(() => {
    const markers = airports.map((a) => ({
      id: a.id,
      code: a.iata ?? a.icao,
      name: a.name,
      lon: a.lon,
      lat: a.lat,
    }));
    return buildHtml({ airports: markers });
  }, [airports]);

  useImperativeHandle(ref, () => ({
    setFlight(flight) {
      currentFlight.current = flight;
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
    setSatellite() {
      // No-op: globe has no satellite raster toggle in this implementation.
    },
    setAirports(list) {
      webRef.current?.postMessage(
        JSON.stringify({
          type: "airports",
          airports: list.map((a) => ({
            id: a.id,
            code: a.iata ?? a.icao,
            name: a.name,
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
  web: { flex: 1, backgroundColor: "#05060a" },
});
