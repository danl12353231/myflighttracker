import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useAuth } from '../../lib/auth';
import { useFlights } from '../../lib/api';
import { useMemo } from 'react';

const MAP_HTML = (token: string, flightsJson: string) => `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body, #map { margin: 0; height: 100%; width: 100%; }
</style>
<script>
  (function () {
    var token = ${JSON.stringify(token)};
    var flights = ${flightsJson};
    // Load maplibre-gl from CDN
    var script = document.createElement('script');
    script.src = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js';
    script.onload = function () {
      var style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css';
      document.head.appendChild(style);
      init(flights);
    };
    document.head.appendChild(script);
    function init(flights) {
      var map = new maplibregl.Map({
        container: 'map',
        style: 'https://demotiles.maplibre.org/style.json',
        center: [0, 20],
        zoom: 1.5
      });
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.on('load', function () {
        var features = [];
        flights.forEach(function (f) {
          if (f.from && f.to) {
            features.push({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [[f.from.lon, f.from.lat], [f.to.lon, f.to.lat]]
              },
              properties: { id: f.id, code: (f.from.iata||f.from.icao) + ' → ' + (f.to.iata||f.to.icao) }
            });
          }
        });
        map.addSource('arcs', { type: 'geojson', data: { type: 'FeatureCollection', features: features } });
        map.addLayer({
          id: 'arcs',
          type: 'line',
          source: 'arcs',
          paint: { 'line-color': '#1a73e8', 'line-width': 2, 'line-opacity': 0.8 }
        });
      });
    }
  })();
</script>
</head>
<body><div id="map"></div></body>
</html>
`;

export default function MapScreen() {
  const { token } = useAuth();
  const flights = useFlights('mine');

  const html = useMemo(() => {
    if (!token) return '';
    return MAP_HTML(token, JSON.stringify(flights.data ?? []));
  }, [token, flights.data]);

  return (
    <View style={styles.container}>
      {html ? (
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.web}
          javaScriptEnabled
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  web: { flex: 1 },
});
