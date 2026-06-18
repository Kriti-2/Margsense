import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';

const BENGALURU_CENTER = [12.9716, 77.5946];
const ADVISORY_COLORS = { red: '#C27A7A', orange: '#D29C42', green: '#486E5D' };

const LOCATIONS = [
  { name: 'Silk Board Junction', coords: [12.9177, 77.6225] },
  { name: 'Koramangala 80ft Rd', coords: [12.9352, 77.6245] },
  { name: 'MG Road Metro Stn', coords: [12.9750, 77.6063] },
  { name: 'Indiranagar 100ft Rd', coords: [12.9784, 77.6408] },
];

function FitRouteBounds({ route }) {
  const map = useMap();
  useEffect(() => {
    if (!route || !route.length) return;
    map.fitBounds(route, { padding: [50, 50] });
  }, [route, map]);
  return null;
}

export default function UserCongestion() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Routing state
  const [origin, setOrigin] = useState('Silk Board Junction');
  const [destination, setDestination] = useState('MG Road Metro Stn');
  const [calculatedRoutes, setCalculatedRoutes] = useState(null);
  const [routeDetails, setRouteDetails] = useState(null);

  const handleLiveTick = (payload) => {
    if (payload.type === 'live_tick' && payload.zone_intensity) {
      loadPreview();
    }
  };

  useLiveFeed(handleLiveTick);

  function loadPreview() {
    api.getCongestionPreview().then((res) => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => {
    loadPreview();
    const interval = setInterval(loadPreview, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCalculateRoute = () => {
    const originLoc = LOCATIONS.find(l => l.name === origin);
    const destLoc = LOCATIONS.find(l => l.name === destination);
    if (!originLoc || !destLoc) return;

    const start = originLoc.coords;
    const end = destLoc.coords;

    // Create paths standard vs eco
    const midLat = start[0] + (end[0] - start[0]) * 0.5;
    const midLng = start[1] + (end[1] - start[1]) * 0.5;

    // Standard congested path (swings closer to busy junction)
    const stdMid = [midLat - 0.008, midLng - 0.004];
    // Eco-smart bypass (swings around congestion)
    const ecoMid = [midLat + 0.008, midLng + 0.006];

    setCalculatedRoutes({
      standard: [start, stdMid, end],
      eco: [start, ecoMid, end]
    });

    // Mock stats
    const stdDist = (Math.hypot(start[0]-end[0], start[1]-end[1]) * 100).toFixed(1);
    const ecoDist = (parseFloat(stdDist) * 1.15).toFixed(1); // Eco route slightly longer

    const stdTime = Math.round(parseFloat(stdDist) * 4.5); // lots of idling
    const ecoTime = Math.round(parseFloat(ecoDist) * 2.2); // free flowing

    const stdFuel = (parseFloat(stdDist) * 0.13).toFixed(2);
    const ecoFuel = (parseFloat(ecoDist) * 0.065).toFixed(2);

    const stdCo2 = (parseFloat(stdFuel) * 2.3).toFixed(2);
    const ecoCo2 = (parseFloat(ecoFuel) * 2.3).toFixed(2);

    const timeSaved = stdTime - ecoTime;
    const timePct = Math.round((timeSaved / stdTime) * 100);

    const co2Saved = (parseFloat(stdCo2) - parseFloat(ecoCo2)).toFixed(2);
    const co2Pct = Math.round((co2Saved / stdCo2) * 100);

    const fuelSaved = (parseFloat(stdFuel) - parseFloat(ecoFuel)).toFixed(2);
    const fuelPct = Math.round((fuelSaved / stdFuel) * 100);

    setRouteDetails({
      stdDist,
      ecoDist,
      stdTime,
      ecoTime,
      stdFuel,
      ecoFuel,
      stdCo2,
      ecoCo2,
      timeSaved,
      timePct,
      co2Saved,
      co2Pct,
      fuelSaved,
      fuelPct
    });
  };

  if (loading) {
    return <div className="text-center text-gray-500 py-12">Loading congestion data...</div>;
  }

  const zones = data?.zones || [];
  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-command-danger/30 bg-command-danger/5 p-4 text-center interactive-card shadow-sm">
          <p className="text-2xl font-bold text-command-danger">{summary.avoid_zones || 0}</p>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider text-command-muted">Avoid</p>
        </div>
        <div className="rounded-xl border border-command-warning/30 bg-command-warning/5 p-4 text-center interactive-card shadow-sm">
          <p className="text-2xl font-bold text-command-warning">{summary.caution_zones || 0}</p>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider text-command-muted">Caution</p>
        </div>
        <div className="rounded-xl border border-command-success/30 bg-command-success/5 p-4 text-center interactive-card shadow-sm">
          <p className="text-2xl font-bold text-command-success">{summary.clear_zones || 0}</p>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider text-command-muted">Clear</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Column (lg:col-span-2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="h-96 overflow-hidden rounded-xl border border-command-border interactive-card shadow-sm relative text-left">
            <MapContainer center={BENGALURU_CENTER} zoom={11} style={{ height: '100%' }}>
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Google Streets">
                  <TileLayer
                    attribution="&copy; Google Maps"
                    url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Google Satellite">
                  <TileLayer
                    attribution="&copy; Google Maps"
                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Dark Mode">
                  <TileLayer
                    attribution="&copy; CartoDB"
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                </LayersControl.BaseLayer>
              </LayersControl>

              {zones.map((zone) => (
                <CircleMarker
                  key={zone.zone}
                  center={[zone.latitude, zone.longitude]}
                  radius={14}
                  pathOptions={{
                    color: ADVISORY_COLORS[zone.color] || '#486E5D',
                    fillColor: ADVISORY_COLORS[zone.color] || '#486E5D',
                    fillOpacity: 0.5,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <strong>{zone.zone}</strong>
                    <br />
                    {zone.advisory} — {zone.speed_drop_pct}% slower
                    <br />
                    {zone.tip}
                  </Popup>
                </CircleMarker>
              ))}

              {/* Draw polyline routes if calculated */}
              {calculatedRoutes && (
                <>
                  <Polyline 
                    positions={calculatedRoutes.standard} 
                    pathOptions={{ color: '#C27A7A', weight: 5, opacity: 0.8 }}
                  >
                    <Popup>Standard Route (More delay)</Popup>
                  </Polyline>
                  <Polyline 
                    positions={calculatedRoutes.eco} 
                    pathOptions={{ color: '#486E5D', weight: 6, opacity: 0.95, dashArray: '10, 10' }}
                  >
                    <Popup>Eco-Smart Route (Fluid & fuel-efficient)</Popup>
                  </Polyline>
                  <FitRouteBounds route={calculatedRoutes.eco} />
                </>
              )}
            </MapContainer>
            
            {calculatedRoutes && (
              <div className="absolute bottom-4 left-4 z-[400] bg-white/95 border border-command-border/50 p-2.5 rounded-lg shadow-md flex gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-800">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-6 inline-block bg-[#C27A7A] rounded" />
                  <span>Standard</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-6 inline-block bg-[#486E5D] border-dashed border border-white rounded" />
                  <span>Eco-Smart</span>
                </div>
              </div>
            )}
          </div>

          {/* Trip Planner Control Card */}
          <div className="rounded-xl border border-command-border bg-command-panel p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧭</span>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Eco-Smart Trip Planner</h3>
                <p className="text-[10px] text-command-muted font-medium">Bypass congested gridlock and reduce CO2 emissions automatically</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-command-muted uppercase tracking-wider block mb-1">Start Hub</label>
                <select 
                  value={origin} 
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full bg-command-bg border border-command-border rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none"
                >
                  {LOCATIONS.map(l => (
                    <option key={l.name} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-command-muted uppercase tracking-wider block mb-1">End Destination</label>
                <select 
                  value={destination} 
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full bg-command-bg border border-command-border rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none"
                >
                  {LOCATIONS.filter(l => l.name !== origin).map(l => (
                    <option key={l.name} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleCalculateRoute}
              className="w-full rounded-xl bg-command-accent text-white py-2.5 text-xs font-semibold hover:opacity-95 active:scale-95 transition-all shadow-md shadow-command-accent/20 cursor-pointer"
            >
              Calculate Route Options
            </button>
          </div>
        </div>

        {/* Impact Stats + Advisories Column */}
        <div className="space-y-6">
          {routeDetails && (
            <div className="rounded-xl border border-command-success/30 bg-command-success/5 p-5 shadow-sm space-y-4 animate-slideIn">
              <div className="flex items-center justify-between border-b border-command-success/20 pb-3">
                <h3 className="text-xs font-bold text-command-success uppercase tracking-wider">🌱 Eco-Smart Impact</h3>
                <span className="text-[9px] bg-command-success text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider">Optimal</span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white border border-command-border/40 p-2 rounded-lg">
                  <p className="text-[9px] font-bold text-command-muted uppercase tracking-wider">Time Saved</p>
                  <p className="text-base font-extrabold text-command-success mt-0.5">{routeDetails.timeSaved}m</p>
                  <p className="text-[8px] text-gray-400 font-bold">-{routeDetails.timePct}%</p>
                </div>
                <div className="bg-white border border-command-border/40 p-2 rounded-lg">
                  <p className="text-[9px] font-bold text-command-muted uppercase tracking-wider">CO2 Saved</p>
                  <p className="text-base font-extrabold text-command-success mt-0.5">{routeDetails.co2Saved}kg</p>
                  <p className="text-[8px] text-gray-400 font-bold">-{routeDetails.co2Pct}%</p>
                </div>
                <div className="bg-white border border-command-border/40 p-2 rounded-lg">
                  <p className="text-[9px] font-bold text-command-muted uppercase tracking-wider">Fuel Saved</p>
                  <p className="text-base font-extrabold text-command-success mt-0.5">{routeDetails.fuelSaved}L</p>
                  <p className="text-[8px] text-gray-400 font-bold">-{routeDetails.fuelPct}%</p>
                </div>
              </div>
              
              <div className="text-xs space-y-2 text-gray-700 bg-white/50 p-3 rounded-lg border border-command-border/20">
                <div className="flex justify-between">
                  <span className="text-command-muted font-medium">Eco Route:</span>
                  <span className="font-semibold text-gray-800">{routeDetails.ecoDist} km · {routeDetails.ecoTime}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-command-muted font-medium">Standard Route:</span>
                  <span className="font-semibold text-gray-800">{routeDetails.stdDist} km · {routeDetails.stdTime}m</span>
                </div>
                <p className="text-[9px] text-command-accent bg-command-accent/5 p-2 rounded border border-command-accent/15 mt-2 font-medium leading-relaxed text-left">
                  💡 **Bypass Notice:** Standard path triggers extra start-stop idling. The eco route bypasses the main intersection, conserving fuel.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Zone Advisories</h2>
            {zones.map((zone) => (
              <div
                key={zone.zone}
                className="flex items-start justify-between rounded-xl border border-command-border bg-command-panel p-4 interactive-card shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: `${ADVISORY_COLORS[zone.color]}15`,
                        color: ADVISORY_COLORS[zone.color],
                      }}
                    >
                      {zone.advisory}
                    </span>
                    <span className="font-semibold text-gray-800 text-sm">{zone.zone}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-600 leading-relaxed">{zone.tip}</p>
                  <p className="mt-1 text-[10px] text-gray-500">
                    Speed: {zone.current_speed_kmh} km/h (normally {zone.baseline_speed_kmh}) ·{' '}
                    {zone.parking_violations_24h} violations (24h)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
