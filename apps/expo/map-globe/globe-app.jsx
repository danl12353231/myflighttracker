import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei/core/Line";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { Text } from "@react-three/drei/core/Text";
import { Billboard } from "@react-three/drei/core/Billboard";
import { CITIES } from "./cities.js";

const GLOBE_R = 1;
const BORDER_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

const INIT = window.__INIT__ || { airports: [], route: [], flights: [] };
const send = (msg) => {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
};

function llToVec(lat, lon, r) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function greatCircle(a, b, steps = 48) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (d) => (d * 180) / Math.PI;
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
  const pts = [];
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

function centroidOf(coords) {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  const walk = (ring) => {
    for (const p of ring) {
      sumX += p[0];
      sumY += p[1];
      count++;
    }
  };
  if (coords.length && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    if (Array.isArray(coords[0][0][0])) {
      coords.forEach((poly) => {
        if (poly.length) walk(poly[0]);
      });
    } else {
      walk(coords[0]);
    }
  }
  return count ? [sumX / count, sumY / count] : [0, 0];
}

// Approximate great-circle distance in degrees between two lat/lon points.
function distDeg(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const la1 = toRad(lat1);
  const la2 = toRad(lat2);
  const dLat = la2 - la1;
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * (180 / Math.PI);
}

// Greedy clustering: group airports whose members are all within `threshold`
// degrees of the cluster's anchor. Returns [{ lat, lon, count, airports }].
function clusterAirports(airports, thresholdDeg) {
  const clusters = [];
  for (const a of airports) {
    let target = null;
    for (const c of clusters) {
      if (distDeg(c.lat, c.lon, a.lat, a.lon) <= thresholdDeg) {
        target = c;
        break;
      }
    }
    if (target) {
      target.count++;
      target.airports.push(a);
    } else {
      clusters.push({ lat: a.lat, lon: a.lon, count: 1, airports: [a] });
    }
  }
  return clusters;
}

function useGeoData() {
  const [data, setData] = useState({ borderRings: [], countryLabels: [] });
  useEffect(() => {
    let cancelled = false;
    fetch(BORDER_URL)
      .then((r) => r.json())
      .then((world) => {
        const rings = []; // each ring = array of THREE.Vector3 (closed)
        const labels = [];
        const seen = new Set();
        for (const f of world.features) {
          const g = f.geometry;
          const ringsOfFeature = [];
          if (g.type === "Polygon") ringsOfFeature.push(...g.coordinates);
          else if (g.type === "MultiPolygon")
            g.coordinates.forEach((poly) => ringsOfFeature.push(...poly));
          for (const ring of ringsOfFeature) {
            if (ring.length < 3) continue;
            const ringVectors = [];
            for (let i = 0; i < ring.length; i++) {
              ringVectors.push(llToVec(ring[i][1], ring[i][0], GLOBE_R * 1.003));
            }
            // Ensure the ring is closed (repeat first point at the end).
            if (ringVectors.length > 1) {
              const last = ringVectors[ringVectors.length - 1];
              const first = ringVectors[0];
              if (last.distanceToSquared(first) > 1e-8) {
                ringVectors.push(first.clone());
              }
            }
            rings.push(ringVectors);
          }
          const name = f.properties?.NAME ?? f.properties?.name ?? null;
          if (name && !seen.has(name)) {
            seen.add(String(name));
            // Natural Earth provides authoritative label coordinates.
            let lon = f.properties?.LABEL_X;
            let lat = f.properties?.LABEL_Y;
            if (lon == null || lat == null) {
              const [cLon, cLat] = centroidOf(g.coordinates);
              lon = cLon;
              lat = cLat;
            }
            // Approximate country size from its bounding box span (degrees).
            let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
            const walk = (ring) => {
              for (const p of ring) {
                if (p[1] < minLat) minLat = p[1];
                if (p[1] > maxLat) maxLat = p[1];
                if (p[0] < minLon) minLon = p[0];
                if (p[0] > maxLon) maxLon = p[0];
              }
            };
            const ringsAll = [];
            if (g.type === "Polygon") ringsAll.push(...g.coordinates);
            else if (g.type === "MultiPolygon")
              g.coordinates.forEach((poly) => ringsAll.push(...poly));
            ringsAll.forEach(walk);
            const span =
              Math.max(0, maxLat - minLat) + Math.max(0, maxLon - minLon);
            labels.push({ name: String(name), lat, lon, span });
          }
        }
        if (!cancelled)
          setData({ borderRings: rings, countryLabels: labels });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}

function Ocean() {
  return (
    <mesh>
      <sphereGeometry args={[GLOBE_R, 64, 64]} />
      <meshPhongMaterial color="#0a2540" shininess={12} />
    </mesh>
  );
}

// Country borders. Each ring (closed country outline) is rendered as its own
// fat line so borders are complete, crisp and continuous with no connecting
// artifacts between polygons. worldUnits=false keeps the line width constant
// in screen pixels, so borders stay clear at any zoom level. A subtle dark
// halo underneath keeps the bright border legible against the ocean.
function Borders({ rings }) {
  if (!rings || !rings.length) return null;
  return (
    <>
      {rings.map((ring, i) => (
        <Line
          key={`r${i}`}
          points={ring}
          color="#13406f"
          lineWidth={6}
          worldUnits={false}
          transparent
          opacity={0.95}
        />
      ))}
      {rings.map((ring, i) => (
        <Line
          key={`b${i}`}
          points={ring}
          color="#bde8ff"
          lineWidth={2.5}
          worldUnits={false}
          transparent
          opacity={0.95}
        />
      ))}
    </>
  );
}

const ORIGIN = new THREE.Vector3(0, 0, 0);

// Shared live zoom state (camera distance to orbit target). Updated every
// frame by ZoomTracker; read by AdaptiveText/AdaptiveDot to keep labels a
// constant on-screen size regardless of zoom.
const zoomState = { dist: 5 };
const LABEL_R = 1.06; // radius where labels float above the surface
const REF_DIST = 5.0; // distance at which the shrink factor is neutral

// Renders troika Text whose world fontSize is adjusted every frame so the
// text keeps a roughly constant (slightly shrinking when close) size on
// screen as the camera zooms and the FOV flattens. baseSize is in screen
// pixels: world size = basePx * (worldUnitsPerPixel at the label depth).
function AdaptiveText({ baseSize, children, ...props }) {
  const { camera, size } = useThree();
  const textRef = useRef(null);
  useFrame(() => {
    const mesh = textRef.current;
    if (!mesh) return;
    const d = Math.max(0.3, zoomState.dist);
    const camToLabel = d - LABEL_R;
    const fov = camera.fov;
    // World units spanning one screen pixel at the label's depth.
    const worldPerPx =
      (2 * camToLabel * Math.tan((fov * Math.PI) / 360)) / size.height;
    // Slight shrink when zoomed in so labels never dominate the view.
    const shrink = Math.min(1, Math.max(0.75, d / REF_DIST));
    const next = baseSize * worldPerPx * shrink;
    if (Math.abs(mesh.fontSize - next) > 0.00005) mesh.fontSize = next;
  });
  return (
    <Text ref={textRef} {...props}>
      {children}
    </Text>
  );
}

// Same adaptive scaling for small marker dots (baseRadius in screen px).
function AdaptiveDot({ baseRadius, color = "#9cc3e8", opacity = 0.9 }) {
  const { camera, size } = useThree();
  const meshRef = useRef(null);
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const d = Math.max(0.3, zoomState.dist);
    const camToLabel = d - LABEL_R;
    const fov = camera.fov;
    const worldPerPx =
      (2 * camToLabel * Math.tan((fov * Math.PI) / 360)) / size.height;
    const shrink = Math.min(1, Math.max(0.7, d / REF_DIST));
    const next = baseRadius * worldPerPx * shrink;
    if (Math.abs(mesh.scale.x - next) > 0.00005) mesh.scale.setScalar(next);
  });
  return (
    <mesh ref={meshRef} scale={0.1}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

// Per-zoom-level rendering config. Level is derived from the camera's
// distance to the orbit target (0 = far, 4 = very near).
// Font/dot sizes are SCREEN-PIXEL targets that AdaptiveText/AdaptiveDot
// convert to world units per frame, so they stay constant on screen at any
// zoom. Per-level values act as relative weights (bigger at far zoom).
const LEVEL_CFG = [
  {
    threshold: 1.9,
    dot: 4,
    clusterDot: 6,
    font: 16,
    showCodes: false,
    minCountrySpan: 55,
    minPop: 8,
    cityFont: 15,
    cityDot: 3.5,
    maxCities: 40,
    minSepDeg: 22,
    countryFont: 17,
    fov: 45,
  },
  {
    threshold: 1.3,
    dot: 4,
    clusterDot: 5.5,
    font: 15,
    showCodes: false,
    minCountrySpan: 35,
    minPop: 4,
    cityFont: 14,
    cityDot: 3.5,
    maxCities: 70,
    minSepDeg: 12,
    countryFont: 16,
    fov: 42,
  },
  {
    threshold: 0.8,
    dot: 4,
    clusterDot: 5.5,
    font: 15,
    showCodes: true,
    minCountrySpan: 18,
    minPop: 1.5,
    cityFont: 14,
    cityDot: 3.5,
    maxCities: 120,
    minSepDeg: 7,
    countryFont: 15,
    fov: 38,
  },
  {
    threshold: 0.45,
    dot: 4,
    clusterDot: 5.5,
    font: 15,
    showCodes: true,
    minCountrySpan: 0,
    minPop: 0.8,
    cityFont: 14,
    cityDot: 3.5,
    maxCities: 200,
    minSepDeg: 3,
    countryFont: 0,
    fov: 32,
  },
  {
    threshold: 0.18,
    dot: 4,
    clusterDot: 5.5,
    font: 15,
    showCodes: true,
    minCountrySpan: 0,
    minPop: 0.3,
    cityFont: 12,
    cityDot: 3.5,
    maxCities: 300,
    minSepDeg: 1.8,
    countryFont: 0,
    fov: 24,
  },
];

// Drives zoom-dependent rendering. Updates the camera FOV smoothly every
// frame (flat zoom), tracks the live camera distance for adaptive label
// sizing, and reports the current zoom level (0..4) only when it crosses a
// boundary so label re-renders are cheap.
function ZoomTracker({ onLevel, controlsRef }) {
  const { camera } = useThree();
  const levelRef = useRef(-1);
  const fovRef = useRef(null);
  useFrame(() => {
    const controls = controlsRef.current;
    const target = controls?.target ?? ORIGIN;
    const d = camera.position.distanceTo(target);
    zoomState.dist = d;
    let level;
    if (d <= 2.4) level = 4;
    else if (d <= 3.1) level = 3;
    else if (d <= 3.9) level = 2;
    else if (d <= 5.2) level = 1;
    else level = 0;
    if (level !== levelRef.current) {
      levelRef.current = level;
      onLevel(level);
      if (window.__DEBUG__) window.__DEBUG__.level = level;
    }
    if (window.__DEBUG__) {
      window.__DEBUG__.dist = d;
      window.__DEBUG__.fov = camera.fov;
    }
    // Smoothly flatten the projection as we approach the surface.
    const targetFov = LEVEL_CFG[level].fov;
    if (fovRef.current === null) fovRef.current = camera.fov;
    const nextFov = fovRef.current + (targetFov - fovRef.current) * 0.1;
    if (Math.abs(nextFov - camera.fov) > 0.05) {
      fovRef.current = nextFov;
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

// Unified label declutter. Countries and cities are merged into one
// candidate list sorted by priority (bigger countries and bigger cities
// first), then labels are kept greedily if their anchor is at least
// `minSepDeg` away from every already-kept label. Combined with adaptive
// on-screen text sizing, this keeps labels readable and non-overlapping at
// every zoom level without culling everything when zoomed in.
function LabelLayer({ countries, level }) {
  const cfg = LEVEL_CFG[level];

  const shown = useMemo(() => {
    const out = [];
    if (cfg.countryFont > 0 && level < 3) {
      for (const c of countries) {
        if (c.span < cfg.minCountrySpan) continue;
        out.push({
          key: `c:${c.name}`,
          kind: "country",
          name: c.name,
          lat: c.lat,
          lon: c.lon,
          priority: c.span,
          size: cfg.countryFont,
          color: "#7ea8cf",
        });
      }
    }
    const eligible = CITIES.filter(([, , , pop]) => pop >= cfg.minPop)
      .slice()
      .sort((a, b) => b[3] - a[3]);
    for (let i = 0; i < Math.min(cfg.maxCities, eligible.length); i++) {
      const [name, lat, lon, pop] = eligible[i];
      out.push({
        key: `city:${name}`,
        kind: "city",
        name,
        lat,
        lon,
        priority: 100 + pop,
        size: cfg.cityFont,
        color: "#e8f1ff",
      });
    }
    out.sort((a, b) => b.priority - a.priority);
    const kept = [];
    for (const c of out) {
      let tooClose = false;
      for (const k of kept) {
        if (distDeg(k.lat, k.lon, c.lat, c.lon) < cfg.minSepDeg) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) kept.push(c);
    }
    return kept;
  }, [countries, level, cfg.minCountrySpan, cfg.minPop, cfg.maxCities, cfg.minSepDeg, cfg.countryFont, cfg.cityFont]);

  return (
    <>
      {shown.map((l) => (
        <group key={l.key} position={llToVec(l.lat, l.lon, GLOBE_R * 1.02)}>
          <Billboard position={llToVec(l.lat, l.lon, GLOBE_R * 1.09)}>
            <AdaptiveText
              baseSize={l.size}
              color={l.color}
              anchorX="center"
              anchorY={l.kind === "city" ? "bottom" : "middle"}
              maxWidth={0.5}
            >
              {l.name}
            </AdaptiveText>
          </Billboard>
        </group>
      ))}
    </>
  );
}

function Airports({ airports, level, controlsRef }) {
  const handle = (e, id) => {
    e.stopPropagation();
    send({ type: "airport", id });
  };
  const focus = (e, lat, lon) => {
    e.stopPropagation();
    const controls = controlsRef.current;
    if (!controls) return;
    const dir = llToVec(lat, lon, 1).normalize();
    controls.target.copy(dir.clone().multiplyScalar(GLOBE_R));
    controls.object.position.copy(dir.clone().multiplyScalar(GLOBE_R + 3.4));
    controls.object.lookAt(controls.target);
    controls.update();
  };
  const cfg = LEVEL_CFG[level];
  const clusters = useMemo(
    () => clusterAirports(airports, cfg.threshold),
    [airports, cfg.threshold],
  );

  return (
    <>
      {clusters.map((c) => {
        const pos = llToVec(c.lat, c.lon, GLOBE_R * 1.02);
        const multi = c.count > 1;
        return (
          <group key={c.airports[0].id}>
            <group
              position={pos}
              onClick={(e) => {
                if (multi) focus(e, c.lat, c.lon);
                else handle(e, c.airports[0].id);
              }}
              onPointerDown={(e) => {
                if (multi) focus(e, c.lat, c.lon);
                else handle(e, c.airports[0].id);
              }}
            >
              <AdaptiveDot
                baseRadius={multi ? cfg.clusterDot : cfg.dot}
                color={multi ? "#f59e0b" : "#1a73e8"}
                opacity={1}
              />
            </group>
            {multi ? (
              <Billboard position={pos}>
                <AdaptiveText
                  baseSize={cfg.font * 0.9}
                  color="#ffd166"
                  anchorX="center"
                  anchorY="middle"
                >
                  {c.count}
                </AdaptiveText>
              </Billboard>
            ) : cfg.showCodes ? (
              <Billboard position={llToVec(c.lat, c.lon, GLOBE_R * 1.06)}>
                <AdaptiveText
                  baseSize={cfg.font}
                  color="#ffffff"
                  anchorX="center"
                  anchorY="middle"
                  maxWidth={0.4}
                >
                  {c.airports[0].code}
                </AdaptiveText>
              </Billboard>
            ) : null}
          </group>
        );
      })}
    </>
  );
}

function Routes({ route, flights }) {
  const selectedRoute = useMemo(
    () =>
      route.length > 1
        ? route.map((p) => llToVec(p[1], p[0], GLOBE_R * 1.01))
        : [],
    [route],
  );
  const secondary = useMemo(
    () =>
      flights
        .filter((f) => f.from && f.to)
        .slice(0, 30)
        .map((f) =>
          greatCircle([f.from.lon, f.from.lat], [f.to.lon, f.to.lat], 24).map(
            (p) => llToVec(p[1], p[0], GLOBE_R * 1.004),
          ),
        ),
    [flights],
  );
  return (
    <>
      {secondary.map((line, i) => (
        <Line
          key={`s${i}`}
          points={line}
          color="rgba(255,255,255,0.25)"
          lineWidth={1}
        />
      ))}
      {selectedRoute.length > 1 && (
        <>
          <Line points={selectedRoute} color="#0A84FF" lineWidth={2.5} />
          <mesh position={selectedRoute[0]}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshBasicMaterial color="#30D158" />
          </mesh>
          <mesh position={selectedRoute[selectedRoute.length - 1]}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshBasicMaterial color="#FF453A" />
          </mesh>
        </>
      )}
    </>
  );
}

function CameraRig({ onRef }) {
  const { camera } = useThree();
  useEffect(() => {
    onRef(camera);
  }, [camera, onRef]);
  return null;
}

function App() {
  const { borderRings, countryLabels } = useGeoData();
  const [route, setRoute] = useState(INIT.route || []);
  const [airports, setAirports] = useState(INIT.airports || []);
  const [flights, setFlights] = useState(INIT.flights || []);
  const [level, setLevel] = useState(0);
  const controlsRef = useRef(null);

  useEffect(() => {
    send({ type: "ready" });
  }, []);

  useEffect(() => {
    const onMsg = (e) => {
      let d = null;
      try {
        d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (!d || typeof d !== "object") return;
      if (d.type === "route") setRoute(d.route || []);
      else if (d.type === "airports") setAirports(d.airports || []);
      else if (d.type === "flights") setFlights(d.flights || []);
      else if (d.type === "recenter") {
        controlsRef.current?.reset();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const labels = useMemo(() => countryLabels, [countryLabels]);

  return (
    <>
      <Canvas
        camera={{ position: [0, 0.5, 5], fov: 45 }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 2, 4]} intensity={0.9} />
        <pointLight position={[0, 0, 0]} intensity={0.3} />
        <Ocean />
        <Borders rings={borderRings} />
        <LabelLayer countries={labels} level={level} />
        <Airports airports={airports} level={level} controlsRef={controlsRef} />
        <Routes route={route} flights={flights} />
        <ZoomTracker onLevel={setLevel} controlsRef={controlsRef} />
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minDistance={1.6}
          maxDistance={9}
          rotateSpeed={0.6}
          zoomSpeed={0.9}
        />
      </Canvas>
      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 5,
          color: "rgba(255,255,255,0.35)",
          font: "11px -apple-system, sans-serif",
          pointerEvents: "none",
        }}
      >
        drag to rotate · pinch to zoom · tap a dot
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
window.__DEBUG__ = { level: -1, dist: -1, fov: -1 };
