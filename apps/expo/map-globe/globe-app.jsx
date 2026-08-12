import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei/core/Line";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { Text } from "@react-three/drei/core/Text";
import { Billboard } from "@react-three/drei/core/Billboard";

const GLOBE_R = 1;
const BORDER_URL =
  "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";

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
  const [data, setData] = useState({ borderPoints: [], countryLabels: [] });
  useEffect(() => {
    let cancelled = false;
    fetch(BORDER_URL)
      .then((r) => r.json())
      .then((world) => {
        const pts = [];
        const labels = [];
        const seen = new Set();
        for (const f of world.features) {
          const g = f.geometry;
          const addRing = (ring) => {
            for (let i = 0; i < ring.length; i++) {
              pts.push(llToVec(ring[i][1], ring[i][0], GLOBE_R * 1.003));
            }
            pts.push(pts[pts.length - 1]);
          };
          const rings = [];
          if (g.type === "Polygon") rings.push(...g.coordinates);
          else if (g.type === "MultiPolygon")
            g.coordinates.forEach((poly) => rings.push(...poly));
          rings.forEach(addRing);
          const name = f.properties?.name ?? f.properties?.NAME ?? null;
          if (name && !seen.has(name)) {
            seen.add(String(name));
            const [lon, lat] = centroidOf(g.coordinates);
            labels.push({ name: String(name), lat, lon });
          }
        }
        if (!cancelled) setData({ borderPoints: pts, countryLabels: labels });
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

function Borders({ points }) {
  if (!points.length) return null;
  return (
    <Line
      points={points}
      color="#4a90d9"
      lineWidth={1.5}
      transparent
      opacity={0.75}
    />
  );
}

const ORIGIN = new THREE.Vector3(0, 0, 0);

// Per-zoom-level rendering config. Level is derived from the camera's
// distance to the orbit target (0 = far, 3 = very near).
const LEVEL_CFG = [
  { threshold: 1.8, dot: 0.02, clusterDot: 0.028, font: 0.02, showCodes: false },
  { threshold: 1.0, dot: 0.017, clusterDot: 0.024, font: 0.022, showCodes: true },
  { threshold: 0.5, dot: 0.015, clusterDot: 0.021, font: 0.028, showCodes: true },
  { threshold: 0.18, dot: 0.013, clusterDot: 0.019, font: 0.036, showCodes: true },
];

// Reports a coarse zoom level (0..3) to the app only when it changes.
function ZoomTracker({ onLevel, controlsRef }) {
  const { camera } = useThree();
  const levelRef = useRef(-1);
  useFrame(() => {
    const controls = controlsRef.current;
    const target = controls?.target ?? ORIGIN;
    const d = camera.position.distanceTo(target);
    let level;
    if (d <= 2.2) level = 3;
    else if (d <= 3.2) level = 2;
    else if (d <= 4.6) level = 1;
    else level = 0;
    if (level !== levelRef.current) {
      levelRef.current = level;
      onLevel(level);
    }
  });
  return null;
}

function CountryLabels({ labels, level }) {
  if (level >= 2) return null; // hide countries when zoomed close
  const font = level === 0 ? 0.024 : 0.022;
  return (
    <>
      {labels.map((c) => (
        <Billboard key={`c:${c.name}`} position={llToVec(c.lat, c.lon, GLOBE_R * 1.06)}>
          <Text
            fontSize={font}
            color="#7ea8cf"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.5}
          >
            {c.name}
          </Text>
        </Billboard>
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
    controls.object.position.copy(dir.clone().multiplyScalar(GLOBE_R + 1.8));
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
            <mesh
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
              <sphereGeometry
                args={[multi ? cfg.clusterDot : cfg.dot, 12, 12]}
              />
              <meshBasicMaterial color={multi ? "#f59e0b" : "#1a73e8"} />
            </mesh>
            {multi ? (
              <Billboard position={pos}>
                <Text
                  fontSize={cfg.font * 0.9}
                  color="#ffd166"
                  anchorX="center"
                  anchorY="middle"
                >
                  {c.count}
                </Text>
              </Billboard>
            ) : cfg.showCodes ? (
              <Billboard position={llToVec(c.lat, c.lon, GLOBE_R * 1.06)}>
                <Text
                  fontSize={cfg.font}
                  color="#ffffff"
                  anchorX="center"
                  anchorY="middle"
                  maxWidth={0.4}
                >
                  {c.airports[0].code}
                </Text>
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
  const { borderPoints, countryLabels } = useGeoData();
  const [route, setRoute] = useState(INIT.route || []);
  const [airports, setAirports] = useState(INIT.airports || []);
  const [flights, setFlights] = useState(INIT.flights || []);
  const [level, setLevel] = useState(1);
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

  const labels = useMemo(() => {
    const out = countryLabels.map((c) => ({ name: c.name, lat: c.lat, lon: c.lon }));
    return out;
  }, [countryLabels]);

  return (
    <>
      <Canvas
        camera={{ position: [0, 0.5, 3], fov: 45 }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 2, 4]} intensity={0.9} />
        <pointLight position={[0, 0, 0]} intensity={0.3} />
        <Ocean />
        <Borders points={borderPoints} />
        <CountryLabels labels={labels} level={level} />
        <Airports airports={airports} level={level} controlsRef={controlsRef} />
        <Routes route={route} flights={flights} />
        <ZoomTracker onLevel={setLevel} controlsRef={controlsRef} />
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minDistance={1.6}
          maxDistance={8}
          rotateSpeed={0.6}
          zoomSpeed={0.8}
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
