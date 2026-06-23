import { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const BENGALURU_CENTER = [77.5946, 12.9716]; // [lng, lat] for MapLibre

// Deterministic hash helper to generate consistent building metrics based on location
const getDeterministicHash = (lng, lat) => {
  const str = `${lng.toFixed(5)},${lat.toFixed(5)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

// Generates building intelligence details deterministically
const generateBuildingDetails = (lng, lat, height = 15) => {
  const hash = getDeterministicHash(lng, lat);
  
  // Landmark matching based on proximity
  const landmarks = [
    { name: 'UB City Tower', type: 'Commercial Complex', coords: [77.5982, 12.9721] },
    { name: 'The Forum Mall', type: 'Shopping Mall', coords: [77.6180, 12.9348] },
    { name: 'Manyata Tech Park - Block G', type: 'Office/Tech Park', coords: [77.6225, 13.0450] },
    { name: 'RMZ Ecospace - Building 3A', type: 'Office/Tech Park', coords: [77.6762, 12.9264] },
    { name: 'Garuda Mall', type: 'Shopping Mall', coords: [77.6090, 12.9702] },
    { name: 'Commercial Plaza Block A', type: 'Commercial Complex', coords: [77.6245, 12.9352] }, // near Koramangala
    { name: 'HSR Business Center', type: 'Office Tower', coords: [77.6473, 12.9116] }, // near HSR
    { name: 'Indiranagar Metro Arcade', type: 'Commercial/Transit', coords: [77.6408, 12.9784] }, // near Indiranagar
    { name: 'MG Road Plaza', type: 'Shopping & Retail', coords: [77.6063, 12.9750] } // near MG Road
  ];

  // Find nearest landmark if distance < ~300 meters (0.003 degrees approx)
  const nearest = landmarks.find(l => {
    const dLng = Math.abs(l.coords[0] - lng);
    const dLat = Math.abs(l.coords[1] - lat);
    return dLng < 0.003 && dLat < 0.003;
  });

  const prefixes = ['Commercial Center', 'Tech Corporate Plaza', 'Vibrant Square Suite', 'Silicon Heights', 'Apex Office Tower', 'Emerald Mall & Suites', 'Prestige Business Hub', 'Century Trade Tower'];
  const classifications = ['Commercial Complex', 'Office / Tech Tower', 'Retail & Shopping Hub', 'Business Park Block', 'Mixed-use Highrise', 'Administrative Block'];
  
  const rawHeight = height || (12 + (hash % 38));
  const estimatedFloors = Math.max(1, Math.round(rawHeight / 3.5));
  
  const name = nearest ? nearest.name : `${prefixes[hash % prefixes.length]} ${String.fromCharCode(65 + (hash % 6))}`;
  const classification = nearest ? nearest.type : classifications[hash % classifications.length];
  
  const congestionIndex = 15 + (hash % 81); // 15% to 95%
  const parkingCapacity = 80 + (hash % 19) * 40; // 80 to 800 slots
  const weeklyCitations = Math.round((congestionIndex / 100) * (hash % 45) + 2);
  
  let priority = 'LOW';
  if (congestionIndex >= 75) priority = 'CRITICAL';
  else if (congestionIndex >= 50) priority = 'HIGH';
  else if (congestionIndex >= 25) priority = 'MEDIUM';

  return {
    name,
    type: classification,
    height: Math.round(rawHeight),
    floors: estimatedFloors,
    congestionIndex,
    parkingCapacity,
    weeklyCitations,
    priority,
    lng,
    lat
  };
};

// Helper to map bright neon colors to professional muted dark-mode palette
const muteColor = (color) => {
  const mapping = {
    '#FF3B30': '#BE123C', // Neon Red -> Soft Rose Red
    '#FF9500': '#EA580C', // Neon Orange -> Soft Orange
    '#FFCC00': '#D97706', // Neon Gold -> Soft Amber
    '#10B981': '#059669', // Neon Green -> Soft Emerald
  };
  return mapping[color] || color;
};


// Helper to generate a 6-sided hexagon polygon around a point for 3D extrusion
function getHexagonPolygon(lng, lat, radius = 0.0016) {
  const coordinates = [];
  const sides = 6;
  for (let i = 0; i <= sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    const dx = radius * Math.cos(angle);
    // Adjust latitude offset slightly to maintain a regular hexagon on spherical projection
    const dy = radius * Math.sin(angle) * 1.15;
    coordinates.push([lng + dx, lat + dy]);
  }
  return [coordinates];
}

// Interpolate point along a line path at a given progress (0 to 1)
function interpolateRoute(coords, progress) {
  if (!coords || coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];
  if (progress <= 0) return coords[0];
  if (progress >= 1) return coords[coords.length - 1];

  const totalSegments = coords.length - 1;
  const targetSegment = progress * totalSegments;
  const index = Math.floor(targetSegment);
  const segmentProgress = targetSegment - index;

  if (index >= totalSegments) return coords[coords.length - 1];

  const start = coords[index];
  const end = coords[index + 1];

  const lng = start[0] + (end[0] - start[0]) * segmentProgress;
  const lat = start[1] + (end[1] - start[1]) * segmentProgress;

  return [lng, lat];
}

export default function DigitalTwinMap({ 
  zoneIntensity = {}, 
  trafficData = null, 
  violationsData = [], 
  className = 'h-[500px] md:h-[600px] w-full' 
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [flyoverActive, setFlyoverActive] = useState(true);
  const flyoverAnimRef = useRef(null);

  // Layer toggles
  const [showPillars, setShowPillars] = useState(true);
  const [showTraffic, setShowTraffic] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [cyberTheme, setCyberTheme] = useState('night'); // 'night', 'sunset', or 'matrix'
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [selectedBuildingDetails, setSelectedBuildingDetails] = useState(null);

  // Optimizations & visual categorization controls
  const [trafficMode, setTrafficMode] = useState('particles'); // 'particles', 'trails', or 'static'
  const [legendTab, setLegendTab] = useState('congestion'); // 'congestion' or 'violations'
  const vehiclesRef = useRef([]);

  // Weather data fetching
  const [weatherData, setWeatherData] = useState(null);
  const [hudExpanded, setHudExpanded] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchWeather() {
      try {
        const response = await fetch('/api/weather');
        if (response.ok && active) {
          const data = await response.json();
          setWeatherData(data);
        }
      } catch (err) {
        console.error('Failed to fetch real-time Bengaluru weather:', err);
      }
    }
    fetchWeather();
    // Poll weather every 5 minutes to keep it updated
    const interval = setInterval(fetchWeather, 300000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Initialize MapLibre Map
  useEffect(() => {
    if (mapRef.current) return;

    // Create shared popup instance for tooltips
    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'twin-tooltip-popup'
    });

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: BENGALURU_CENTER,
      zoom: 13.9,
      pitch: 62,
      bearing: -25,
      maxZoom: 18,
      minZoom: 10
    });

    mapRef.current = map;

    map.on('load', () => {
      setIsLoaded(true);

      // Add 3D buildings layer
      map.addLayer({
        'id': '3d-buildings',
        'source': 'openmaptiles',
        'source-layer': 'building',
        'type': 'fill-extrusion',
        'minzoom': 11,
        'paint': {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['get', 'render_height'],
            0, '#2b2b35',
            50, '#3a3a4c',
            100, '#4e4e66'
          ],
          'fill-extrusion-height': ['get', 'render_height'],
          'fill-extrusion-base': ['get', 'render_min_height'],
          'fill-extrusion-opacity': 0.75
        }
      });

      // Add 3D buildings highlight layer
      map.addLayer({
        'id': '3d-buildings-highlight',
        'source': 'openmaptiles',
        'source-layer': 'building',
        'type': 'fill-extrusion',
        'minzoom': 11,
        'filter': ['==', ['id'], ''], // default to none
        'paint': {
          'fill-extrusion-color': '#06B6D4', // cyan-500
          'fill-extrusion-height': ['get', 'render_height'],
          'fill-extrusion-base': ['get', 'render_min_height'],
          'fill-extrusion-opacity': 0.95
        }
      });

      // Initialize dynamic sources/layers
      // 0. Ground Radars under Hotspots
      map.addSource('hotspot-radar', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'hotspot-radar-layer',
        source: 'hotspot-radar',
        type: 'circle',
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': ['get', 'color'],
          'circle-opacity': ['get', 'opacity'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': ['get', 'stroke_opacity'],
          'circle-pitch-alignment': 'map',
          'circle-pitch-scale': 'map'
        }
      });

      // 1. 3D Hotspot Pillars
      map.addSource('hotspot-pillars', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'hotspot-pillars-layer',
        source: 'hotspot-pillars',
        type: 'fill-extrusion',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85
        }
      });

      // 2. Traffic Flow Lines
      map.addSource('traffic-flows', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Neon bottom glow layer (disabled for a clean, non-neon style)
      map.addLayer({
        id: 'traffic-flows-glow',
        source: 'traffic-flows',
        type: 'line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 10,
          'line-opacity': 0.0,
          'line-blur': 0.0
        }
      });

      // Sharp central core layer (thinner and clean)
      map.addLayer({
        id: 'traffic-flows-core',
        source: 'traffic-flows',
        type: 'line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2.0,
          'line-opacity': 0.85
        }
      });

      // 3. Individual Incident Points
      map.addSource('incident-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'incident-points-layer',
        source: 'incident-points',
        type: 'circle',
        paint: {
          'circle-radius': 2.0,
          'circle-color': ['get', 'incident_color'],
          'circle-stroke-width': 1.0,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity': 0.85,
          'circle-stroke-opacity': 0.95
        }
      });

      // 4. Moving Traffic Vehicles (small, elegant status dots)
      map.addSource('traffic-vehicles', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'traffic-vehicles-layer',
        source: 'traffic-vehicles',
        type: 'circle',
        paint: {
          'circle-radius': 2.2,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 0.8,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity': 0.85,
          'circle-blur': 0.0
        }
      });

      // Interactivity: Hover Tooltips for 3D Pillars
      map.on('mouseenter', 'hotspot-pillars-layer', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        
        const properties = e.features[0].properties;
        const coordinates = e.lngLat;
        const zone = properties.zone;
        const score = properties.congestion_score;
        
        let level = 'CLEAR';
        if (score >= 75) level = 'CRITICAL';
        else if (score >= 50) level = 'HEAVY';
        else if (score >= 25) level = 'MODERATE';

        const colorClass = score >= 75 ? 'text-red-400' : score >= 50 ? 'text-orange-400' : 'text-emerald-400';

        const html = `
          <div style="padding: 10px; background-color: #111827; color: #ffffff; border-radius: 8px; border: 1px solid #374151; font-size: 11px; font-family: sans-serif; line-height: 1.4; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <strong style="font-size: 12px; display: block; border-bottom: 1px solid #374151; padding-bottom: 4px; margin-bottom: 6px; color: #BA5A5A;">${zone} Zone</strong>
            <div>Congestion: <span style="font-weight: bold; color: #f97316;">${score}%</span></div>
            <div>Risk Level: <span style="font-weight: bold;" class="${colorClass}">${level}</span></div>
          </div>
        `;

        popupRef.current
          .setLngLat(coordinates)
          .setHTML(html)
          .addTo(map);
      });

      map.on('mouseleave', 'hotspot-pillars-layer', () => {
        map.getCanvas().style.cursor = '';
        popupRef.current.remove();
      });

      // Interactivity: Hover Tooltips for Incident Points
      map.on('mouseenter', 'incident-points-layer', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        
        const properties = e.features[0].properties;
        const coordinates = e.features[0].geometry.coordinates.slice();
        
        const vehicle = properties.vehicle_type || 'VEHICLE';
        let violations = properties.violation_types || properties.violation_type || 'NO PARKING';
        if (Array.isArray(violations)) {
          violations = violations.join(', ');
        } else if (typeof violations === 'string' && (violations.startsWith('[') || violations.startsWith('{'))) {
          try {
            violations = JSON.parse(violations).join(', ');
          } catch {
            // Keep original string if parsing fails
          }
        }
        const zone = properties.zone || 'Bengaluru';

        const html = `
          <div style="padding: 10px; background-color: #111827; color: #ffffff; border-radius: 8px; border: 1px solid #374151; font-size: 11px; font-family: sans-serif; line-height: 1.4; max-width: 200px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <strong style="font-size: 9px; text-transform: uppercase; color: #F39C12; display: block; margin-bottom: 2px;">${vehicle} Violation</strong>
            <div style="font-weight: bold; margin-bottom: 4px; color: #ffffff;">${violations}</div>
            <div style="font-size: 9px; color: #9CA3AF;">Zone: ${zone}</div>
          </div>
        `;

        // Adjust coordinates for popup overlap
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        popupRef.current
          .setLngLat(coordinates)
          .setHTML(html)
          .addTo(map);
      });

      map.on('mouseleave', 'incident-points-layer', () => {
        map.getCanvas().style.cursor = '';
        popupRef.current.remove();
      });

      // Interactivity: 3D Buildings Hover
      map.on('mouseenter', '3d-buildings', (e) => {
        if (map.getLayoutProperty('3d-buildings', 'visibility') === 'none') return;
        map.getCanvas().style.cursor = 'pointer';

        const feature = e.features[0];
        const height = feature.properties?.render_height || 12;
        const floors = Math.max(1, Math.round(height / 3.5));

        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="padding: 6px 10px; background-color: #0b0f19; color: #ffffff; border-radius: 8px; border: 1px solid #1e293b; font-size: 10px; font-family: sans-serif; font-weight: 500; opacity: 0.95; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
              <span style="font-weight: bold; color: #06b6d4; display: block; margin-bottom: 2px;">3D Building</span>
              <span>Height: ${Math.round(height)}m (~${floors} Floors)</span>
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseleave', '3d-buildings', () => {
        map.getCanvas().style.cursor = '';
        popupRef.current.remove();
      });

      // Interactivity: 3D Buildings Click
      map.on('click', '3d-buildings', (e) => {
        if (map.getLayoutProperty('3d-buildings', 'visibility') === 'none') return;
        if (e.features.length === 0) return;

        const feature = e.features[0];
        const featureId = feature.id || `${e.lngLat.lng.toFixed(5)},${e.lngLat.lat.toFixed(5)}`;
        
        setSelectedBuildingId(featureId);
        
        // Update layer filter to highlight selected building
        if (map.getLayer('3d-buildings-highlight')) {
          map.setFilter('3d-buildings-highlight', ['==', ['id'], feature.id || '']);
        }

        const lat = e.lngLat.lat;
        const lng = e.lngLat.lng;
        const height = feature.properties?.render_height || 15;
        const details = generateBuildingDetails(lng, lat, height);
        setSelectedBuildingDetails(details);
      });

      // Map Click: Clear building selection when clicking outside
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['3d-buildings', 'hotspot-pillars-layer', 'incident-points-layer']
        });

        if (features.length === 0) {
          setSelectedBuildingId(null);
          setSelectedBuildingDetails(null);
          if (map.getLayer('3d-buildings-highlight')) {
            map.setFilter('3d-buildings-highlight', ['==', ['id'], '']);
          }
        }
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Layer Visibility on toggle change
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    const visibility = showPillars ? 'visible' : 'none';
    if (mapRef.current.getLayer('hotspot-pillars-layer')) {
      mapRef.current.setLayoutProperty('hotspot-pillars-layer', 'visibility', visibility);
    }
    if (mapRef.current.getLayer('hotspot-radar-layer')) {
      mapRef.current.setLayoutProperty('hotspot-radar-layer', 'visibility', visibility);
    }
  }, [showPillars, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    const visibility = showTraffic ? 'visible' : 'none';
    if (mapRef.current.getLayer('traffic-flows-glow')) {
      mapRef.current.setLayoutProperty('traffic-flows-glow', 'visibility', visibility);
    }
    if (mapRef.current.getLayer('traffic-flows-core')) {
      mapRef.current.setLayoutProperty('traffic-flows-core', 'visibility', visibility);
    }
  }, [showTraffic, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (mapRef.current.getLayer('incident-points-layer')) {
      mapRef.current.setLayoutProperty('incident-points-layer', 'visibility', showIncidents ? 'visible' : 'none');
    }
  }, [showIncidents, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (mapRef.current.getLayer('3d-buildings')) {
      mapRef.current.setLayoutProperty('3d-buildings', 'visibility', showBuildings ? 'visible' : 'none');
    }
    if (mapRef.current.getLayer('3d-buildings-highlight')) {
      mapRef.current.setLayoutProperty('3d-buildings-highlight', 'visibility', showBuildings ? 'visible' : 'none');
    }
    if (!showBuildings) {
      setSelectedBuildingId(null);
      setSelectedBuildingDetails(null);
      if (mapRef.current.getLayer('3d-buildings-highlight')) {
        mapRef.current.setFilter('3d-buildings-highlight', ['==', ['id'], '']);
      }
    }
  }, [showBuildings, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (mapRef.current.getLayer('traffic-vehicles-layer')) {
      const visible = showTraffic && trafficMode === 'particles';
      mapRef.current.setLayoutProperty('traffic-vehicles-layer', 'visibility', visible ? 'visible' : 'none');
    }
  }, [showTraffic, trafficMode, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (mapRef.current.getLayer('traffic-flows-core')) {
      if (trafficMode === 'static') {
        mapRef.current.setPaintProperty('traffic-flows-core', 'line-dasharray', [4, 4]);
        mapRef.current.setPaintProperty('traffic-flows-glow', 'line-dasharray', [4, 4]);
      } else if (trafficMode === 'particles') {
        mapRef.current.setPaintProperty('traffic-flows-core', 'line-dasharray', [1, 0]);
        mapRef.current.setPaintProperty('traffic-flows-glow', 'line-dasharray', [1, 0]);
      } else if (trafficMode === 'trails') {
        mapRef.current.setPaintProperty('traffic-flows-glow', 'line-dasharray', [1, 0]);
      }
    }
  }, [trafficMode, isLoaded]);

  // Update Traffic Flow Lines
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (trafficData) {
      const features = trafficData.features
        ? trafficData.features.map(f => ({
            ...f,
            properties: {
              ...f.properties,
              color: muteColor(f.properties.color || '#10B981')
            }
          }))
        : [];
      mapRef.current.getSource('traffic-flows').setData({
        ...trafficData,
        features
      });
    }
  }, [trafficData, isLoaded]);

  // Initialize vehicle particle positions when traffic data changes
  useEffect(() => {
    if (!trafficData || !trafficData.features) return;
    
    const initialVehicles = [];
    trafficData.features.forEach((route, routeIdx) => {
      const coords = route.geometry.coordinates;
      if (!coords || coords.length < 2) return;
      
      const speed = route.properties.current_speed_kmh || 20;
      const color = muteColor(route.properties.color || '#10B981');
      
      // Spawn 3 vehicles per route staggered at different starting offsets
      const numVehicles = 3;
      for (let i = 0; i < numVehicles; i++) {
        initialVehicles.push({
          routeIdx,
          coords,
          progress: i / numVehicles,
          speedFactor: (speed / 60) * 0.0008 + 0.0003,
          color: color
        });
      }
    });
    
    vehiclesRef.current = initialVehicles;
  }, [trafficData]);

  // Animate traffic line dash offset (scroll/movement effect) - Throttled for performance
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (trafficMode !== 'trails') return;

    let animFrame;
    let step = 0;
    let lastTime = performance.now();

    const animate = (time) => {
      if (!mapRef.current) return;
      
      const elapsed = time - lastTime;
      // Target ~30 FPS (33ms) to reduce CPU utilization
      if (elapsed >= 33) {
        lastTime = time;
        const deltaMultiplier = elapsed / 16.67;
        step = (step + 0.35 * deltaMultiplier) % 12;
        
        if (mapRef.current.getLayer('traffic-flows-core') && showTraffic) {
          mapRef.current.setPaintProperty('traffic-flows-core', 'line-dasharray', [
            Math.max(0.1, 4 - step),
            step,
            Math.max(0.1, step),
            12 - step
          ]);
        }
      }
      
      animFrame = requestAnimationFrame(animate);
    };

    animFrame = requestAnimationFrame(animate);

    return () => {
      if (animFrame) {
        cancelAnimationFrame(animFrame);
      }
    };
  }, [isLoaded, showTraffic, trafficMode]);

  // Animate vehicle particles along the roads (Throttled to ~30 FPS for performance)
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (trafficMode !== 'particles' || !showTraffic) return;

    let animFrame;
    let lastTime = performance.now();

    const animate = (time) => {
      if (!mapRef.current) return;
      
      const elapsed = time - lastTime;
      // Target ~30 FPS (33ms) to reduce CPU utilization
      if (elapsed >= 33) {
        lastTime = time;

        if (!vehiclesRef.current || vehiclesRef.current.length === 0) {
          animFrame = requestAnimationFrame(animate);
          return;
        }

        // Normalize animation speed by delta time relative to 60 FPS (16.67ms per frame)
        const deltaMultiplier = elapsed / 16.67;

        // 1. Move vehicles along their paths and interpolate coordinates
        const features = vehiclesRef.current.map((v, idx) => {
          v.progress = (v.progress + v.speedFactor * deltaMultiplier) % 1.0;
          const currentCoords = interpolateRoute(v.coords, v.progress);

          return {
            type: 'Feature',
            id: idx,
            geometry: {
              type: 'Point',
              coordinates: currentCoords
            },
            properties: {
              color: v.color,
              routeIdx: v.routeIdx
            }
          };
        });

        // 2. Set the data on the map source
        const source = mapRef.current.getSource('traffic-vehicles');
        if (source) {
          source.setData({
            type: 'FeatureCollection',
            features
          });
        }
      }

      animFrame = requestAnimationFrame(animate);
    };

    animFrame = requestAnimationFrame(animate);

    return () => {
      if (animFrame) {
        cancelAnimationFrame(animFrame);
      }
    };
  }, [isLoaded, trafficMode, showTraffic]);

  // Update Map Theme Aesthetics (Lighting & Building Colors)
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    
    const themeConfigs = {
      night: {
        lightColor: '#a855f7',
        lightIntensity: 0.35,
        lightPos: [1.15, 210, 30],
        buildingColors: [
          'interpolate',
          ['linear'],
          ['get', 'render_height'],
          0, '#161622',
          30, '#282a36',
          70, '#3f51b5',
          120, '#00e5ff'
        ]
      },
      sunset: {
        lightColor: '#fdba74',
        lightIntensity: 0.45,
        lightPos: [1.5, 90, 80],
        buildingColors: [
          'interpolate',
          ['linear'],
          ['get', 'render_height'],
          0, '#1a0f0f',
          30, '#3a221d',
          70, '#d97706',
          120, '#f43f5e'
        ]
      },
      matrix: {
        lightColor: '#6ee7b7',
        lightIntensity: 0.40,
        lightPos: [1.3, 140, 45],
        buildingColors: [
          'interpolate',
          ['linear'],
          ['get', 'render_height'],
          0, '#0d1b15',
          30, '#1b2e24',
          70, '#059669',
          120, '#10b981'
        ]
      }
    };
    
    const config = themeConfigs[cyberTheme] || themeConfigs.night;
    
    // Update light properties
    mapRef.current.setLight({
      anchor: 'viewport',
      color: config.lightColor,
      intensity: config.lightIntensity,
      position: config.lightPos
    });
    
    // Update building fill-extrusion-color property
    if (mapRef.current.getLayer('3d-buildings')) {
      mapRef.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', config.buildingColors);
      mapRef.current.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', 0.82);
    }
  }, [cyberTheme, isLoaded]);

  // Update 3D Hotspot Pillars (Static data update - only when zone intensity changes, not every frame)
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const pillarSource = mapRef.current.getSource('hotspot-pillars');
    if (!pillarSource) return;

    if (!showPillars) {
      pillarSource.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const fallbackCenters = {
      'Koramangala': [77.6245, 12.9352],
      'HSR Layout': [77.6473, 12.9116],
      'Indiranagar': [77.6408, 12.9784],
      'MG Road': [77.6063, 12.9750],
      'Silk Board': [77.6225, 12.9177],
      'Whitefield': [77.7500, 12.9698],
      'Majestic': [77.5712, 12.9766],
      'Hebbal': [77.5978, 13.0358],
      'Electronic City': [77.6602, 12.8452],
      'Jayanagar': [77.5824, 12.9284],
      'Yelahanka': [77.5862, 13.0978],
      'Marathahalli': [77.6974, 12.9592],
      'Malleshwaram': [77.5720, 12.9984],
      'Banashankari': [77.5736, 12.9156],
      'BTM Layout': [77.6083, 12.9166],
      'Rajajinagar': [77.5562, 12.9892]
    };

    const pillarFeatures = [];

    Object.entries(zoneIntensity).forEach(([zone, meta]) => {
      let lng = BENGALURU_CENTER[0];
      let lat = BENGALURU_CENTER[1];

      if (fallbackCenters[zone]) {
        lng = fallbackCenters[zone][0];
        lat = fallbackCenters[zone][1];
      }

      const score = meta.congestion_score || 0;
      let color = '#10B981'; // Vibrant Neon Emerald Green
      if (score >= 75) color = '#FF3B30'; // Vibrant Neon Red
      else if (score >= 50) color = '#FF9500'; // Vibrant Neon Orange
      else if (score >= 25) color = '#FFCC00'; // Vibrant Neon Gold
      color = muteColor(color);

      const baseHeight = Math.max(100, score * 15);

      // 3D Hexagon Column
      pillarFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: getHexagonPolygon(lng, lat, 0.0016)
        },
        properties: {
          zone: zone,
          height: baseHeight,
          color: color,
          congestion_score: score
        }
      });
    });

    pillarSource.setData({
      type: 'FeatureCollection',
      features: pillarFeatures
    });
  }, [zoneIntensity, isLoaded, showPillars]);

  // Animate flat ground radar ripples (Throttled to ~30 FPS for performance)
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    let animFrame;
    const radarSource = mapRef.current.getSource('hotspot-radar');
    if (!radarSource) return;

    if (!showPillars) {
      radarSource.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const fallbackCenters = {
      'Koramangala': [77.6245, 12.9352],
      'HSR Layout': [77.6473, 12.9116],
      'Indiranagar': [77.6408, 12.9784],
      'MG Road': [77.6063, 12.9750],
      'Silk Board': [77.6225, 12.9177],
      'Whitefield': [77.7500, 12.9698],
      'Majestic': [77.5712, 12.9766],
      'Hebbal': [77.5978, 13.0358],
      'Electronic City': [77.6602, 12.8452],
      'Jayanagar': [77.5824, 12.9284],
      'Yelahanka': [77.5862, 13.0978],
      'Marathahalli': [77.6974, 12.9592],
      'Malleshwaram': [77.5720, 12.9984],
      'Banashankari': [77.5736, 12.9156],
      'BTM Layout': [77.6083, 12.9166],
      'Rajajinagar': [77.5562, 12.9892]
    };

    const startTime = performance.now();
    let lastTime = startTime;

    const animateRipples = (time) => {
      if (!mapRef.current) return;

      const elapsed = time - lastTime;
      // Throttle update to ~30 FPS (~33ms) to avoid CPU lag
      if (elapsed >= 33) {
        lastTime = time;

        const elapsedSeconds = (time - startTime) / 1000;
        // Calculate double ripple progresses
        const pulse1 = (elapsedSeconds * 0.85) % 1.0;
        const pulse2 = (pulse1 + 0.5) % 1.0;

        const radarFeatures = [];

        Object.entries(zoneIntensity).forEach(([zone, meta]) => {
          let lng = BENGALURU_CENTER[0];
          let lat = BENGALURU_CENTER[1];

          if (fallbackCenters[zone]) {
            lng = fallbackCenters[zone][0];
            lat = fallbackCenters[zone][1];
          }

          const score = meta.congestion_score || 0;
          let color = '#10B981'; // Vibrant Neon Emerald Green
          if (score >= 75) color = '#FF3B30'; // Vibrant Neon Red
          else if (score >= 50) color = '#FF9500'; // Vibrant Neon Orange
          else if (score >= 25) color = '#FFCC00'; // Vibrant Neon Gold
          color = muteColor(color);

          // Staggered ground ripple 1
          radarFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            properties: {
              color: color,
              radius: 8 + pulse1 * 32, // expands from 8px to 40px
              opacity: (1.0 - pulse1) * 0.22,
              stroke_opacity: (1.0 - pulse1) * 0.70
            }
          });

          // Staggered ground ripple 2
          radarFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            properties: {
              color: color,
              radius: 8 + pulse2 * 32,
              opacity: (1.0 - pulse2) * 0.22,
              stroke_opacity: (1.0 - pulse2) * 0.70
            }
          });
        });

        const source = mapRef.current.getSource('hotspot-radar');
        if (source) {
          source.setData({
            type: 'FeatureCollection',
            features: radarFeatures
          });
        }
      }

      animFrame = requestAnimationFrame(animateRipples);
    };

    animFrame = requestAnimationFrame(animateRipples);

    return () => {
      if (animFrame) {
        cancelAnimationFrame(animFrame);
      }
    };
  }, [zoneIntensity, isLoaded, showPillars]);

  // Update Individual Incident Points with Multi-Color Coding by Violation Type
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const colorMap = {
      'NO PARKING': '#D97706',         // Muted Gold/Amber
      'DOUBLE PARKING': '#EA580C',     // Muted Orange
      'WRONG SIDE PARKING': '#BE123C', // Muted Rose Red
      'OBSTRUCTING TRAFFIC': '#BE123C',// Muted Rose Red
      'PARKING ON FOOTPATH': '#0284C7',// Muted Ocean Blue
    };

    const enrichedFeatures = violationsData.map(feature => {
      let primaryViolation = 'NO PARKING';
      let violations = feature.properties?.violation_types || feature.properties?.violation_type || 'NO PARKING';

      if (Array.isArray(violations) && violations.length > 0) {
        primaryViolation = violations[0];
      } else if (typeof violations === 'string') {
        if (violations.startsWith('[') || violations.startsWith('{')) {
          try {
            const parsed = JSON.parse(violations);
            if (Array.isArray(parsed) && parsed.length > 0) {
              primaryViolation = parsed[0];
            }
          } catch {
            primaryViolation = violations;
          }
        } else {
          primaryViolation = violations;
        }
      }

      primaryViolation = String(primaryViolation).toUpperCase().trim();
      const color = colorMap[primaryViolation] || '#EF4444'; // fallback red

      return {
        ...feature,
        properties: {
          ...feature.properties,
          primary_violation: primaryViolation,
          incident_color: color
        }
      };
    });

    mapRef.current.getSource('incident-points').setData({
      type: 'FeatureCollection',
      features: enrichedFeatures
    });
  }, [violationsData, isLoaded]);

  // Flyover Animation Loop
  useEffect(() => {
    if (!mapRef.current) return;

    if (flyoverActive) {
      let lastTime = performance.now();
      const rotateCamera = (time) => {
        if (!mapRef.current) return;
        const delta = time - lastTime;
        lastTime = time;

        const currentBearing = mapRef.current.getBearing();
        const newBearing = (currentBearing + (0.75 * delta) / 1000) % 360;
        mapRef.current.setBearing(newBearing);

        flyoverAnimRef.current = requestAnimationFrame(rotateCamera);
      };
      flyoverAnimRef.current = requestAnimationFrame(rotateCamera);
    } else {
      if (flyoverAnimRef.current) {
        cancelAnimationFrame(flyoverAnimRef.current);
        flyoverAnimRef.current = null;
      }
    }

    return () => {
      if (flyoverAnimRef.current) {
        cancelAnimationFrame(flyoverAnimRef.current);
      }
    };
  }, [flyoverActive]);

  // Smooth Fly to Selected Zone
  const handleZoneFly = (coords) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: coords,
        zoom: 14.5,
        pitch: 62,
        bearing: 45,
        duration: 2500
      });
    }
  };

  // Telemetry Calculations
  const activeHotspotsCount = useMemo(() => {
    return Object.values(zoneIntensity).filter(meta => (meta.congestion_score || 0) >= 50).length;
  }, [zoneIntensity]);

  const avgCongestionScore = useMemo(() => {
    const scores = Object.values(zoneIntensity).map(meta => meta.congestion_score || 0);
    return scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0.0';
  }, [zoneIntensity]);

  const citationBreakdown = useMemo(() => {
    const counts = {};
    violationsData.forEach(v => {
      let type = v.properties?.violation_types || v.properties?.violation_type || 'NO PARKING';
      if (Array.isArray(type)) {
        type = type[0];
      }
      type = String(type).trim().toUpperCase();
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [violationsData]);

  const handleClearSelection = () => {
    setSelectedBuildingId(null);
    setSelectedBuildingDetails(null);
    if (mapRef.current && mapRef.current.getLayer('3d-buildings-highlight')) {
      mapRef.current.setFilter('3d-buildings-highlight', ['==', ['id'], '']);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl border border-command-border">
      <div ref={mapContainerRef} className={className} />
      
      {/* Controls Overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2.5 items-start">
        {/* Main Sleek Floating Bar */}
        <div className="flex items-center gap-1.5 rounded-xl bg-[#090D16]/80 p-1.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] border border-slate-800/80 backdrop-blur-lg">
          {/* Drone Button */}
          <button
            onClick={() => setFlyoverActive(!flyoverActive)}
            title={flyoverActive ? 'Stop Drone Orbit' : 'Start Drone Orbit'}
            className={`flex h-7.5 items-center justify-center gap-1.5 rounded-lg px-2 text-[9px] font-bold transition-all cursor-pointer border ${
              flyoverActive 
                ? 'bg-slate-800 text-white border-slate-650' 
                : 'bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800/80'
            }`}
          >
            <svg className={`h-4 w-4 ${flyoverActive ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10a2 2 0 100 4 2 2 0 000-4z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 10.5L7 7M13.5 10.5L17 7M10.5 13.5L7 17M13.5 13.5L17 17" />
              <circle cx="6" cy="6" r="1.5" className="fill-current/30" />
              <circle cx="18" cy="6" r="1.5" className="fill-current/30" />
              <circle cx="6" cy="18" r="1.5" className="fill-current/30" />
              <circle cx="18" cy="18" r="1.5" className="fill-current/30" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14.5l-1 2h6l-1-2" />
            </svg>
            <span>Drone</span>
          </button>

          {/* Reset Camera Button */}
          <button
            onClick={() => {
              if (mapRef.current) {
                mapRef.current.flyTo({
                  center: BENGALURU_CENTER,
                  zoom: 13.9,
                  pitch: 62,
                  bearing: -25,
                  duration: 2000
                });
              }
            }}
            title="Reset Camera View"
            className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 transition-colors cursor-pointer"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>

          {/* Zoom In Button */}
          <button
            onClick={() => {
              if (mapRef.current) {
                const currentZoom = mapRef.current.getZoom();
                mapRef.current.easeTo({
                  zoom: Math.min(currentZoom + 0.8, 18),
                  duration: 800
                });
              }
            }}
            title="Zoom In"
            className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 transition-colors cursor-pointer"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>

          {/* Zoom Out Button */}
          <button
            onClick={() => {
              if (mapRef.current) {
                const currentZoom = mapRef.current.getZoom();
                mapRef.current.easeTo({
                  zoom: Math.max(currentZoom - 0.8, 10),
                  duration: 800
                });
              }
            }}
            title="Zoom Out"
            className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 transition-colors cursor-pointer"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
            </svg>
          </button>

          {/* Divider */}
          <div className="h-5 w-[1px] bg-slate-800 mx-0.5" />

          {/* Settings Expand Button */}
          <button
            onClick={() => setSettingsExpanded(!settingsExpanded)}
            title="Toggle Settings"
            className={`flex h-7.5 w-7.5 items-center justify-center rounded-lg transition-colors cursor-pointer border ${
              settingsExpanded 
                ? 'bg-slate-800 text-white border-slate-650' 
                : 'bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800/80'
            }`}
          >
            <svg className={`h-4 w-4 transition-transform duration-300 ${settingsExpanded ? 'rotate-90 text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Collapsible Dropdown Panel */}
        {settingsExpanded && (
          <div className="w-[190px] rounded-xl bg-[#090D16]/85 p-3 shadow-[0_12px_40px_0_rgba(0,0,0,0.6)] border border-slate-800/80 backdrop-blur-lg flex flex-col gap-2.5 animate-fadeIn text-slate-200">
            {/* Fly to Zone dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Fly to Zone
              </label>
              <div className="relative">
                <select 
                  onChange={(e) => {
                    if (e.target.value) {
                      const coords = JSON.parse(e.target.value);
                      handleZoneFly(coords);
                    }
                  }}
                  className="w-full appearance-none bg-slate-950/70 border border-slate-800/80 text-white text-[9px] rounded-lg pl-2.5 pr-6 py-1 outline-none cursor-pointer focus:border-cyan-500/60 transition-colors font-semibold"
                  defaultValue=""
                >
                  <option value="" disabled className="bg-slate-950 text-slate-400">Select zone...</option>
                  <option value="[77.6245, 12.9352]" className="bg-slate-950 text-white">Koramangala</option>
                  <option value="[77.6408, 12.9784]" className="bg-slate-950 text-white">Indiranagar</option>
                  <option value="[77.6473, 12.9116]" className="bg-slate-950 text-white">HSR Layout</option>
                  <option value="[77.6063, 12.9750]" className="bg-slate-950 text-white">MG Road</option>
                  <option value="[77.6225, 12.9177]" className="bg-slate-950 text-white">Silk Board</option>
                  <option value="[77.7500, 12.9698]" className="bg-slate-950 text-white">Whitefield</option>
                  <option value="[77.5712, 12.9766]" className="bg-slate-950 text-white">Majestic</option>
                  <option value="[77.5978, 13.0358]" className="bg-slate-950 text-white">Hebbal</option>
                  <option value="[77.6602, 12.8452]" className="bg-slate-950 text-white">Electronic City</option>
                  <option value="[77.5824, 12.9284]" className="bg-slate-950 text-white">Jayanagar</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Cyber Theme Selector */}
            <div className="flex flex-col gap-1 border-t border-slate-800/50 pt-2">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                Cyber Theme
              </label>
              <div className="grid grid-cols-3 bg-slate-950/65 rounded-lg p-0.5 border border-slate-800/80">
                <button
                  onClick={() => setCyberTheme('night')}
                  className={`text-[8px] font-extrabold py-0.5 rounded transition-all cursor-pointer ${cyberTheme === 'night' ? 'bg-cyan-600 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)] font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  Night
                </button>
                <button
                  onClick={() => setCyberTheme('sunset')}
                  className={`text-[8px] font-extrabold py-0.5 rounded transition-all cursor-pointer ${cyberTheme === 'sunset' ? 'bg-amber-600 text-white shadow-[0_0_8px_rgba(245,158,11,0.4)] font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  Sunset
                </button>
                <button
                  onClick={() => setCyberTheme('matrix')}
                  className={`text-[8px] font-extrabold py-0.5 rounded transition-all cursor-pointer ${cyberTheme === 'matrix' ? 'bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.4)] font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  Matrix
                </button>
              </div>
            </div>

            {/* Traffic View Mode */}
            <div className="flex flex-col gap-1 border-t border-slate-800/50 pt-2">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Traffic Mode
              </label>
              <div className="grid grid-cols-3 bg-slate-950/65 rounded-lg p-0.5 border border-slate-800/80">
                <button
                  onClick={() => setTrafficMode('particles')}
                  className={`text-[8px] font-extrabold py-0.5 rounded transition-all cursor-pointer ${trafficMode === 'particles' ? 'bg-slate-800 text-white shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  Vehicles
                </button>
                <button
                  onClick={() => setTrafficMode('trails')}
                  className={`text-[8px] font-extrabold py-0.5 rounded transition-all cursor-pointer ${trafficMode === 'trails' ? 'bg-slate-800 text-white shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  Trails
                </button>
                <button
                  onClick={() => setTrafficMode('static')}
                  className={`text-[8px] font-extrabold py-0.5 rounded transition-all cursor-pointer ${trafficMode === 'static' ? 'bg-slate-800 text-white shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  Static
                </button>
              </div>
            </div>

            {/* Toggle Layers */}
            <div className="flex flex-col gap-1 border-t border-slate-800/50 pt-2">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Map Layers
              </label>
              
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-0.5">
                <label className="flex items-center justify-between text-[8px] text-slate-300 cursor-pointer select-none font-semibold hover:text-white transition-colors">
                  <span>3D Pillars</span>
                  <input 
                    type="checkbox" 
                    checked={showPillars} 
                    onChange={(e) => setShowPillars(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500/40 cursor-pointer"
                  />
                </label>
                
                <label className="flex items-center justify-between text-[8px] text-slate-300 cursor-pointer select-none font-semibold hover:text-white transition-colors">
                  <span>Traffic</span>
                  <input 
                    type="checkbox" 
                    checked={showTraffic} 
                    onChange={(e) => setShowTraffic(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500/40 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-[8px] text-slate-300 cursor-pointer select-none font-semibold hover:text-white transition-colors">
                  <span>Incidents</span>
                  <input 
                    type="checkbox" 
                    checked={showIncidents} 
                    onChange={(e) => setShowIncidents(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500/40 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-[8px] text-slate-300 cursor-pointer select-none font-semibold hover:text-white transition-colors">
                  <span>Buildings</span>
                  <input 
                    type="checkbox" 
                    checked={showBuildings} 
                    onChange={(e) => setShowBuildings(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500/40 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
 
      {/* Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-3 rounded-xl bg-[#090D16]/80 p-3.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] border border-slate-800/80 backdrop-blur-lg text-[10px] text-slate-300 w-[200px]">
        <div className="flex bg-slate-950/60 p-0.5 rounded-lg border border-slate-800/80 gap-1 justify-between">
          <button 
            onClick={() => setLegendTab('congestion')}
            className={`flex-1 text-center font-extrabold text-[9px] py-1 rounded transition-all cursor-pointer outline-none ${legendTab === 'congestion' ? 'bg-slate-800 text-white shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
          >
            Congestion
          </button>
          <button 
            onClick={() => setLegendTab('violations')}
            className={`flex-1 text-center font-extrabold text-[9px] py-1 rounded transition-all cursor-pointer outline-none ${legendTab === 'violations' ? 'bg-slate-800 text-white shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
          >
            Violations
          </button>
        </div>

        {legendTab === 'congestion' ? (
          <div className="space-y-2.5 pt-0.5">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#BE123C] opacity-35"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#BE123C] shadow-[0_0_8px_#BE123C]"></span>
              </div>
              <span className="font-medium text-white/90">Critical / Avoid (&gt;= 75%)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#EA580C] shadow-[0_0_6px_#EA580C]"></span>
              </div>
              <span className="font-medium text-white/80">Heavy Delay (&gt;= 50%)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#D97706] shadow-[0_0_6px_#D97706]"></span>
              </div>
              <span className="font-medium text-white/80">Moderate Delay (&gt;= 25%)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#059669] shadow-[0_0_6px_#059669]"></span>
              </div>
              <span className="font-medium text-white/80">Clear / Low Flow (&lt; 25%)</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 pt-0.5">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#D97706] shadow-[0_0_6px_#D97706]"></span>
              </div>
              <span className="font-medium text-white/80">No Parking</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#EA580C] shadow-[0_0_6px_#EA580C]"></span>
              </div>
              <span className="font-medium text-white/80">Double Parking</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#BE123C] shadow-[0_0_6px_#BE123C]"></span>
              </div>
              <span className="font-medium text-white/80">Wrong Side Parking</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#BE123C] opacity-35"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#BE123C] shadow-[0_0_8px_#BE123C]"></span>
              </div>
              <span className="font-medium text-white/90">Obstructing Traffic</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#0284C7] shadow-[0_0_6px_#0284C7]"></span>
              </div>
              <span className="font-medium text-white/80">Footpath Parking</span>
            </div>
          </div>
        )}
      </div>

      {/* Live Weather Widget */}
      {weatherData && (
        <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1.5 rounded-xl bg-[#090D16]/80 p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] border border-slate-800/80 backdrop-blur-lg text-[10px] text-slate-300 w-[170px]">
          <div className="flex items-center justify-between border-b border-slate-800/50 pb-1.5 mb-1.5">
            <span className="font-bold text-white uppercase tracking-wider text-[8px] flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Bengaluru
            </span>
            {weatherData.alert_level && weatherData.alert_level !== 'NONE' && (
              <span className="px-1 py-0.5 rounded text-[7px] font-extrabold bg-red-950 text-red-400 border border-red-800/50">
                {weatherData.alert_level} RISK
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {weatherData.icon_url && (
              <img src={weatherData.icon_url} alt="weather" className="h-8 w-8 object-contain shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="text-[13px] font-black text-white">{weatherData.temperature_c}°C</span>
              <span className="text-[8px] text-slate-400 capitalize font-medium">{weatherData.description}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-1 pt-1.5 border-t border-slate-800/30 text-[8px] text-slate-400">
            <div className="flex flex-col">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[6px]">Wind</span>
              <span className="text-slate-300 font-semibold">{weatherData.wind_speed_kmh} km/h</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[6px]">Humidity</span>
              <span className="text-slate-300 font-semibold">{weatherData.humidity_pct}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Civic Command HUD Panel */}
      <div className={`absolute top-4 right-4 z-10 flex flex-col rounded-xl bg-[#090D16]/80 p-3.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] border border-slate-800/80 backdrop-blur-lg text-[10px] text-slate-300 transition-all duration-300 ${hudExpanded ? 'w-[230px]' : 'w-[40px] h-[36px] overflow-hidden items-center justify-center p-0.5'}`}>
        {!hudExpanded ? (
          <button 
            onClick={() => setHudExpanded(true)}
            title="Expand HUD"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-800/80"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        ) : (
          <div className="flex flex-col gap-2.5 w-full">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
              <span className="font-bold text-white uppercase tracking-wider text-[8px] flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Civic Telemetry HUD
              </span>
              <button 
                onClick={() => setHudExpanded(false)}
                title="Collapse HUD"
                className="flex h-5 w-5 items-center justify-center rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/40">
                <span className="text-[6px] text-slate-500 font-bold uppercase tracking-wider block">Avg Congestion</span>
                <span className="text-[12px] font-black text-cyan-400 mt-0.5 block">{avgCongestionScore}%</span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/40">
                <span className="text-[6px] text-slate-500 font-bold uppercase tracking-wider block">Active Hotspots</span>
                <span className="text-[12px] font-black text-amber-500 mt-0.5 block">{activeHotspotsCount} Zones</span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/40">
                <span className="text-[6px] text-slate-500 font-bold uppercase tracking-wider block">Total Citations</span>
                <span className="text-[12px] font-black text-rose-500 mt-0.5 block">{violationsData.length}</span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/40">
                <span className="text-[6px] text-slate-500 font-bold uppercase tracking-wider block">Flow Segments</span>
                <span className="text-[12px] font-black text-emerald-500 mt-0.5 block">{trafficData?.features?.length || 0} Lines</span>
              </div>
            </div>

            {/* Citations Breakdown */}
            {citationBreakdown.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-slate-800/40 pt-2">
                <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Citations Breakdown</span>
                <div className="flex flex-col gap-1 max-h-[60px] overflow-y-auto pr-1">
                  {citationBreakdown.slice(0, 3).map(([type, count]) => {
                    const cleanType = type.replace('_', ' ').toLowerCase();
                    return (
                      <div key={type} className="flex justify-between items-center text-[7.5px] text-slate-400 font-semibold bg-slate-950/30 px-1.5 py-0.5 rounded border border-slate-900/30">
                        <span className="capitalize">{cleanType}</span>
                        <span className="text-slate-200 font-extrabold">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Building Intelligence Panel */}
      {selectedBuildingDetails && (
        <div className="absolute bottom-4 right-[224px] z-10 flex flex-col gap-2 rounded-xl bg-[#090D16]/85 p-3.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] border border-slate-800/80 backdrop-blur-lg text-[10px] text-slate-300 w-[230px] animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
            <span className="font-bold text-white uppercase tracking-wider text-[8px] flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Building Intel
            </span>
            <button 
              onClick={handleClearSelection}
              title="Close Panel"
              className="flex h-5 w-5 items-center justify-center rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-850"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-1.5">
            <div>
              <span className="text-[11px] font-black text-white block truncate" title={selectedBuildingDetails.name}>
                {selectedBuildingDetails.name}
              </span>
              <span className="text-[8px] text-slate-450 block font-bold mt-0.5">
                {selectedBuildingDetails.type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 border-t border-slate-800/40 pt-1.5">
              <div className="bg-slate-950/40 p-1.5 rounded border border-slate-900/30">
                <span className="text-[6px] text-slate-500 font-bold uppercase tracking-wider block">Height</span>
                <span className="text-[10px] font-extrabold text-slate-200 block mt-0.5">{selectedBuildingDetails.height}m</span>
              </div>
              <div className="bg-slate-950/40 p-1.5 rounded border border-slate-900/30">
                <span className="text-[6px] text-slate-500 font-bold uppercase tracking-wider block">Est. Floors</span>
                <span className="text-[10px] font-extrabold text-slate-200 block mt-0.5">{selectedBuildingDetails.floors}</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="flex flex-col gap-1.5 border-t border-slate-800/40 pt-1.5">
              {/* Congestion Index */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[7px] font-bold uppercase tracking-wider">
                  <span className="text-slate-400">Congestion Index</span>
                  <span className={selectedBuildingDetails.congestionIndex >= 75 ? 'text-rose-500' : selectedBuildingDetails.congestionIndex >= 50 ? 'text-amber-500' : 'text-emerald-500'}>
                    {selectedBuildingDetails.congestionIndex}%
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-900">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      selectedBuildingDetails.congestionIndex >= 75 
                        ? 'bg-rose-600' 
                        : selectedBuildingDetails.congestionIndex >= 50 
                        ? 'bg-amber-600' 
                        : 'bg-emerald-600'
                    }`} 
                    style={{ width: `${selectedBuildingDetails.congestionIndex}%` }}
                  />
                </div>
              </div>

              {/* Parking slots & citations */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex flex-col bg-slate-950/45 p-1.5 rounded border border-slate-800/30">
                  <span className="text-[6px] text-slate-500 font-bold uppercase tracking-wider block">Parking Slots</span>
                  <span className="text-[10px] font-black text-cyan-400 block mt-0.5">{selectedBuildingDetails.parkingCapacity}</span>
                </div>
                <div className="flex flex-col bg-slate-950/45 p-1.5 rounded border border-slate-800/30">
                  <span className="text-[6px] text-slate-500 font-bold uppercase tracking-wider block">Weekly Citations</span>
                  <span className="text-[10px] font-black text-rose-500 block mt-0.5">{selectedBuildingDetails.weeklyCitations}</span>
                </div>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between bg-slate-950/40 p-1.5 rounded border border-slate-850">
                <span className="text-[6.5px] text-slate-400 font-bold uppercase tracking-wider">Enforcement Priority</span>
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${
                  selectedBuildingDetails.priority === 'CRITICAL'
                    ? 'bg-rose-950/40 text-rose-400 border-rose-900/60 shadow-[0_0_6px_rgba(225,29,72,0.15)]'
                    : selectedBuildingDetails.priority === 'HIGH'
                    ? 'bg-amber-950/40 text-amber-500 border-amber-900/60'
                    : selectedBuildingDetails.priority === 'MEDIUM'
                    ? 'bg-emerald-950/40 text-emerald-500 border-emerald-900/60'
                    : 'bg-slate-900 text-slate-350 border-slate-850'
                }`}>
                  {selectedBuildingDetails.priority}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
