import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei/core/Line";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { Text } from "@react-three/drei/core/Text";

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
  const dLon = toRad(b[0] - a[0]);
  const la1s = Math.sin(la1);
  const la2s = Math.sin(la2);
  const la1c = Math.cos(la1);
  const la2c = Math.cos(la2);
  const d = Math.acos(Math.min(1, la1s * la2s + la1c * la2c * Math.cos(dLon)));
  const pts = [];
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

function CountryLabels({ labels }) {
  return (
    <>
      {labels.map((c) => (
        <Text
          key={`c:${c.name}`}
          position={llToVec(c.lat, c.lon, GLOBE_R * 1.06)}
          fontSize={0.022}
          color="#7ea8cf"
          anchorX="center"
          anchorY="middle"
          maxWidth={0.5}
        >
          {c.name}
        </Text>
      ))}
    </>
  );
}

function Airports({ airports }) {
  const handle = (e, id) => {
    e.stopPropagation();
    send({ type: "airport", id });
  };
  return (
    <>
      {airports.map((a) => (
        <group key={a.id}>
          <mesh
            position={llToVec(a.lat, a.lon, GLOBE_R * 1.02)}
            onClick={(e) => handle(e, a.id)}
            onPointerDown={(e) => handle(e, a.id)}
          >
            <sphereGeometry args={[0.014, 12, 12]} />
            <meshBasicMaterial color="#1a73e8" />
          </mesh>
          <Text
            position={llToVec(a.lat, a.lon, GLOBE_R * 1.06)}
            fontSize={0.02}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.4}
          >
            {a.code}
          </Text>
        </group>
      ))}
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
        <CountryLabels labels={labels} />
        <Airports airports={airports} />
        <Routes route={route} flights={flights} />
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
