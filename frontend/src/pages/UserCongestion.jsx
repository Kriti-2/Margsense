import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';

const BENGALURU_CENTER = [12.9716, 77.5946];
const ADVISORY_COLORS = { red: '#ef4444', orange: '#f59e0b', green: '#10b981' };

export default function UserCongestion() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="text-center text-gray-400 py-12">Loading congestion data...</div>;
  }

  const zones = data?.zones || [];
  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-command-danger/30 bg-command-danger/10 p-4 text-center">
          <p className="text-2xl font-bold text-command-danger">{summary.avoid_zones || 0}</p>
          <p className="text-xs text-gray-400">Avoid</p>
        </div>
        <div className="rounded-xl border border-command-warning/30 bg-command-warning/10 p-4 text-center">
          <p className="text-2xl font-bold text-command-warning">{summary.caution_zones || 0}</p>
          <p className="text-xs text-gray-400">Caution</p>
        </div>
        <div className="rounded-xl border border-command-success/30 bg-command-success/10 p-4 text-center">
          <p className="text-2xl font-bold text-command-success">{summary.clear_zones || 0}</p>
          <p className="text-xs text-gray-400">Clear</p>
        </div>
      </div>

      <div className="h-96 overflow-hidden rounded-xl border border-command-border">
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
                color: ADVISORY_COLORS[zone.color] || '#3b82f6',
                fillColor: ADVISORY_COLORS[zone.color] || '#3b82f6',
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
        </MapContainer>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Zone advisories</h2>
        {zones.map((zone) => (
          <div
            key={zone.zone}
            className="flex items-start justify-between rounded-xl border border-command-border bg-command-panel p-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{
                    backgroundColor: `${ADVISORY_COLORS[zone.color]}22`,
                    color: ADVISORY_COLORS[zone.color],
                  }}
                >
                  {zone.advisory}
                </span>
                <span className="font-medium text-white">{zone.zone}</span>
              </div>
              <p className="mt-2 text-sm text-gray-400">{zone.tip}</p>
              <p className="mt-1 text-xs text-gray-500">
                Speed: {zone.current_speed_kmh} km/h (normally {zone.baseline_speed_kmh}) ·{' '}
                {zone.parking_violations_24h} violations (24h)
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
