import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as THREE from "three";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber/native";
import { Line, OrbitControls } from "@react-three/drei/native";

import type { Flight, VisitedAirport } from "../lib/router";

const GLOBE_R = 1;
const BORDER_URL =
  "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";

type Country = { name: string; lat: number; lon: number };
type Label = {
  key: string;
  text: string;
  lat: number;
  lon: number;
  color: string;
};

function llToVec(lat: number, lon: number, r: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function greatCircle(a: [number, number], b: [number, number], steps = 48) {
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
  const pts: [number, number][] = [];
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

function centroidOf(coords: any[]): [number, number] {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  const walk = (ring: any[]) => {
    for (const p of ring) {
      sumX += p[0];
      sumY += p[1];
      count++;
    }
  };
  if (
    coords.length &&
    Array.isArray(coords[0]) &&
    Array.isArray(coords[0][0])
  ) {
    if (Array.isArray(coords[0][0][0])) {
      coords.forEach((poly: any[]) => {
        if (poly.length) walk(poly[0]);
      });
    } else {
      walk(coords[0]);
    }
  }
  return count ? [sumX / count, sumY / count] : [0, 0];
}

// Projects 3D label positions to screen coordinates each frame (inside the
// Canvas), writing into a shared ref that the RN overlay reads from.
function LabelProjector({
  labels,
  positionsRef,
}: {
  labels: Label[];
  positionsRef: MutableRefObject<
    Record<string, { x: number; y: number; behind: boolean }>
  >;
}) {
  const { camera, size } = useThree();
  useFrame(() => {
    const next: Record<string, { x: number; y: number; behind: boolean }> = {};
    for (const l of labels) {
      const v = llToVec(l.lat, l.lon, GLOBE_R * 1.06);
      const pos = v.clone().project(camera);
      const behind = pos.z > 1;
      next[l.key] = {
        x: ((pos.x + 1) / 2) * size.width,
        y: ((1 - pos.y) / 2) * size.height,
        behind,
      };
    }
    positionsRef.current = next;
  });
  return null;
}

// Renders the projected labels as native React Native text overlays.
function LabelsOverlay({
  labels,
  positionsRef,
}: {
  labels: Label[];
  positionsRef: MutableRefObject<
    Record<string, { x: number; y: number; behind: boolean }>
  >;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {labels.map((l) => {
        const p = positionsRef.current[l.key];
        if (!p || p.behind) return null;
        return (
          <View
            key={l.key}
            style={[styles.label, { left: p.x, top: p.y }]}
            pointerEvents="none"
          >
            <Text
              style={[styles.labelText, { color: l.color }]}
              numberOfLines={1}
            >
              {l.text}
            </Text>
          </View>
        );
      })}
    </>
  );
}

// Marker spheres + tap handling (3D).
function AirportMarkers({
  airports,
  onAirportTap,
}: {
  airports: VisitedAirport[];
  onAirportTap?: (id: number) => void;
}) {
  const handle = useCallback(
    (e: ThreeEvent<PointerEvent>, id: number) => {
      e.stopPropagation();
      onAirportTap?.(id);
    },
    [onAirportTap],
  );

  return (
    <>
      {airports.map((a) => (
        <mesh
          key={a.id}
          position={llToVec(a.lat, a.lon, GLOBE_R * 1.02)}
          onPointerDown={(e) => handle(e, a.id)}
        >
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshBasicMaterial color="#1a73e8" />
        </mesh>
      ))}
    </>
  );
}

// Route arcs (3D).
function Routes({
  flights,
  selectedId,
}: {
  flights: Flight[];
  selectedId: number | null;
}) {
  const selected = flights.find((f) => f.id === selectedId);
  const routePoints = useMemo(() => {
    if (!selected?.from || !selected?.to) return [];
    return greatCircle(
      [selected.from.lon, selected.from.lat],
      [selected.to.lon, selected.to.lat],
    ).map((p) => llToVec(p[1], p[0], GLOBE_R * 1.01));
  }, [selected]);

  const secondaryLines = useMemo(
    () =>
      flights
        .filter((f) => f.id !== selectedId && f.from && f.to)
        .slice(0, 30)
        .map((f) =>
          greatCircle(
            [f.from!.lon, f.from!.lat],
            [f.to!.lon, f.to!.lat],
            24,
          ).map((p) => llToVec(p[1], p[0], GLOBE_R * 1.004)),
        ),
    [flights, selectedId],
  );

  return (
    <>
      {secondaryLines.map((line, i) => (
        <Line
          key={`s${i}`}
          points={line}
          color="rgba(255,255,255,0.25)"
          lineWidth={1}
        />
      ))}
      {routePoints.length > 1 ? (
        <>
          <Line points={routePoints} color="#0A84FF" lineWidth={2.5} />
          <mesh position={routePoints[0]}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshBasicMaterial color="#30D158" />
          </mesh>
          <mesh position={routePoints[routePoints.length - 1]}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshBasicMaterial color="#FF453A" />
          </mesh>
        </>
      ) : null}
    </>
  );
}

export function GlobeScene({
  flights,
  airports,
  selectedId,
  onAirportTap,
}: {
  flights: Flight[];
  airports: VisitedAirport[];
  selectedId: number | null;
  onAirportTap?: (id: number) => void;
}) {
  const [borderPoints, setBorderPoints] = useState<THREE.Vector3[]>([]);
  const [countryLabels, setCountryLabels] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(BORDER_URL)
      .then((r) => r.json())
      .then((world) => {
        const pts: THREE.Vector3[] = [];
        const labels: Country[] = [];
        const seen = new Set<string>();
        for (const f of world.features) {
          const g = f.geometry;
          const addRing = (ring: any[]) => {
            for (let i = 0; i < ring.length; i++) {
              pts.push(llToVec(ring[i][1], ring[i][0], GLOBE_R * 1.003));
            }
            pts.push(pts[pts.length - 1]);
          };
          const rings: any[][] = [];
          if (g.type === "Polygon") rings.push(...g.coordinates);
          else if (g.type === "MultiPolygon")
            g.coordinates.forEach((poly: any) => rings.push(...poly));
          rings.forEach(addRing);
          const name = f.properties?.name ?? f.properties?.NAME ?? null;
          if (name && !seen.has(name)) {
            seen.add(String(name));
            const [lon, lat] = centroidOf(g.coordinates);
            labels.push({ name: String(name), lat, lon });
          }
        }
        if (!cancelled) {
          setBorderPoints(pts);
          setCountryLabels(labels);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Build label list: country names (smaller) + airport names (larger).
  const labels = useMemo<Label[]>(() => {
    const out: Label[] = countryLabels.map((c) => ({
      key: `c:${c.name}`,
      text: c.name,
      lat: c.lat,
      lon: c.lon,
      color: "#7ea8cf",
    }));
    for (const a of airports) {
      out.push({
        key: `a:${a.id}`,
        text: a.iata ?? a.icao,
        lat: a.lat,
        lon: a.lon,
        color: "#ffffff",
      });
    }
    return out;
  }, [countryLabels, airports]);

  const borderArray = useMemo(
    () => new Float32Array(borderPoints.flatMap((v) => [v.x, v.y, v.z])),
    [borderPoints],
  );

  const positionsRef = useRef<
    Record<string, { x: number; y: number; behind: boolean }>
  >({});

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4a90d9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Canvas camera={{ position: [0, 0.5, 3], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 2, 4]} intensity={0.9} />
        <pointLight position={[0, 0, 0]} intensity={0.3} />

        {/* Ocean */}
        <mesh>
          <sphereGeometry args={[GLOBE_R, 64, 64]} />
          <meshPhongMaterial color="#0a2540" shininess={12} />
        </mesh>

        {/* Country borders */}
        {borderArray.length > 0 ? (
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[borderArray, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#4a90d9" transparent opacity={0.75} />
          </line>
        ) : null}

        <Routes flights={flights} selectedId={selectedId} />
        <AirportMarkers airports={airports} onAirportTap={onAirportTap} />
        <LabelProjector labels={labels} positionsRef={positionsRef} />

        <OrbitControls
          enablePan={false}
          minDistance={1.6}
          maxDistance={8}
          rotateSpeed={0.6}
          zoomSpeed={0.8}
        />
      </Canvas>

      <LabelsOverlay labels={labels} positionsRef={positionsRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05060a" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#05060a",
  },
  label: {
    position: "absolute",
    transform: [{ translateX: -40 }, { translateY: -8 }],
    width: 80,
    alignItems: "center",
  },
  labelText: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
