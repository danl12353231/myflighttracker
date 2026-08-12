import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import * as THREE from "three";
import { Canvas, type ThreeEvent } from "@react-three/fiber/native";
import { Billboard, Line, OrbitControls, Text } from "@react-three/drei/native";

import type { Flight, VisitedAirport } from "../lib/router";

const GLOBE_R = 1;
const BORDER_URL =
  "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";
// A minimal Latin font for labels (WOFF served by jsDelivr).
const FONT_URL =
  "https://cdn.jsdelivr.net/npm/three-globe/example/fonts/helvetiker_regular.typeface.json";

type Country = { name: string; lat: number; lon: number };

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

// Estimate a label anchor for a country from its polygon coordinates.
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
  const walkPoly = (poly: any[]) => {
    // Use the outer ring (first) for the centroid.
    if (poly.length) walk(poly[0]);
  };
  if (
    coords.length &&
    Array.isArray(coords[0]) &&
    Array.isArray(coords[0][0])
  ) {
    if (Array.isArray(coords[0][0][0])) {
      coords.forEach(walkPoly);
    } else {
      walk(coords[0]);
    }
  }
  return count ? [sumX / count, sumY / count] : [0, 0];
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
  const [countries, setCountries] = useState<{
    borderPoints: THREE.Vector3[];
    labels: Country[];
  }>({ borderPoints: [], labels: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(BORDER_URL)
      .then((r) => r.json())
      .then((world) => {
        const borderPoints: THREE.Vector3[] = [];
        const labels: Country[] = [];
        const seen = new Set<string>();
        for (const f of world.features) {
          const g = f.geometry;
          const addRing = (ring: any[]) => {
            for (let i = 0; i < ring.length; i++) {
              borderPoints.push(
                llToVec(ring[i][1], ring[i][0], GLOBE_R * 1.003),
              );
            }
            borderPoints.push(borderPoints[borderPoints.length - 1]);
          };
          const rings: any[][] = [];
          if (g.type === "Polygon") rings.push(...g.coordinates);
          else if (g.type === "MultiPolygon")
            g.coordinates.forEach((poly: any) => rings.push(...poly));
          rings.forEach(addRing);
          const name = f.properties?.name ?? f.properties?.NAME ?? null;
          if (name && !seen.has(name)) {
            seen.add(name);
            const [lon, lat] = centroidOf(g.coordinates);
            labels.push({ name: String(name), lat, lon });
          }
        }
        if (!cancelled) {
          setCountries({ borderPoints, labels });
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

  const routePoints = useMemo(() => {
    const sel = flights.find((f) => f.id === selectedId);
    if (!sel?.from || !sel?.to) return [];
    const pts = greatCircle(
      [sel.from.lon, sel.from.lat],
      [sel.to.lon, sel.to.lat],
    );
    return pts.map((p) => llToVec(p[1], p[0], GLOBE_R * 1.01));
  }, [flights, selectedId]);

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

  const handleAirportPress = useCallback(
    (e: ThreeEvent<PointerEvent>, id: number) => {
      e.stopPropagation();
      onAirportTap?.(id);
    },
    [onAirportTap],
  );

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
        {countries.borderPoints.length > 2 ? (
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array(
                    countries.borderPoints.flatMap((v) => [v.x, v.y, v.z]),
                  ),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#4a90d9" transparent opacity={0.7} />
          </line>
        ) : null}

        {/* Country names */}
        {countries.labels.map((c) => (
          <Billboard
            key={c.name}
            position={llToVec(c.lat, c.lon, GLOBE_R * 1.06)}
          >
            <Text
              fontSize={0.02}
              color="#a8c8e8"
              outlineWidth={0.004}
              outlineColor="#05060a"
              anchorX="center"
              anchorY="middle"
            >
              {c.name}
            </Text>
          </Billboard>
        ))}

        {/* Secondary routes */}
        {secondaryLines.map((line, i) => (
          <Line
            key={i}
            points={line}
            color="rgba(255,255,255,0.25)"
            lineWidth={1}
          />
        ))}

        {/* Selected route */}
        {routePoints.length > 1 ? (
          <>
            <Line points={routePoints} color="#0A84FF" lineWidth={2.5} />
            <mesh position={routePoints[0]}>
              <sphereGeometry args={[0.025, 12, 12]} />
              <meshBasicMaterial color="#30D158" />
            </mesh>
            <mesh position={routePoints[routePoints.length - 1]}>
              <sphereGeometry args={[0.025, 12, 12]} />
              <meshBasicMaterial color="#FF453A" />
            </mesh>
          </>
        ) : null}

        {/* Airport markers + labels */}
        {airports.map((a) => (
          <group key={a.id}>
            <mesh
              position={llToVec(a.lat, a.lon, GLOBE_R * 1.02)}
              onPointerDown={(e) => handleAirportPress(e, a.id)}
            >
              <sphereGeometry args={[0.016, 12, 12]} />
              <meshBasicMaterial color="#1a73e8" />
            </mesh>
            <Billboard position={llToVec(a.lat, a.lon, GLOBE_R * 1.05)}>
              <Text
                fontSize={0.02}
                color="#ffffff"
                outlineWidth={0.005}
                outlineColor="#05060a"
                anchorX="center"
                anchorY="bottom"
              >
                {a.iata ?? a.icao}
              </Text>
            </Billboard>
          </group>
        ))}

        <OrbitControls
          enablePan={false}
          minDistance={1.6}
          maxDistance={8}
          rotateSpeed={0.6}
          zoomSpeed={0.8}
        />
      </Canvas>
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
});
