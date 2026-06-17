import { useState, useCallback } from 'react';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
import LiveStatusBar from '../components/LiveStatusBar';

const BENGALURU_ZONES = [
  { name: 'Koramangala', center: [12.9352, 77.6245] },
  { name: 'HSR Layout', center: [12.9116, 77.6473] },
  { name: 'Indiranagar', center: [12.9784, 77.6408] },
  { name: 'MG Road', center: [12.9750, 77.6063] },
  { name: 'Silk Board', center: [12.9177, 77.6225] },
  { name: 'Whitefield', center: [12.9698, 77.7500] },
];

const VEHICLE_OPTIONS = ['SCOOTER', 'BIKE', 'CAR', 'AUTO', 'BUS', 'TRUCK'];

const VIOLATION_OPTIONS = [
  'NO PARKING',
  'DOUBLE PARKING',
  'WRONG SIDE PARKING',
  'OBSTRUCTING TRAFFIC',
  'PARKING ON FOOTPATH',
];

export default function LiveViolationReporter() {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [vehicleType, setVehicleType] = useState('CAR');
  const [selectedViolations, setSelectedViolations] = useState(['NO PARKING']);
  const [nearIntersection, setNearIntersection] = useState(false);

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [lastTick, setLastTick] = useState(null);

  const handleLiveTick = useCallback((payload) => {
    if (payload.type === 'live_tick') {
      setLastTick(payload);
    }
  }, []);

  const { connected, status } = useLiveFeed(handleLiveTick);

  // Toggle multi-select violation
  function handleViolationChange(type) {
    if (selectedViolations.includes(type)) {
      if (selectedViolations.length > 1) {
        setSelectedViolations(selectedViolations.filter((v) => v !== type));
      }
    } else {
      setSelectedViolations([...selectedViolations, type]);
    }
  }

  // Generate random Bengaluru violation coordinates & fields
  function handleGenerateRandom() {
    const randomZone = BENGALURU_ZONES[Math.floor(Math.random() * BENGALURU_ZONES.length)];
    const latOffset = (Math.random() - 0.5) * 0.015;
    const lngOffset = (Math.random() - 0.5) * 0.015;

    setLat((randomZone.center[0] + latOffset).toFixed(6));
    setLng((randomZone.center[1] + lngOffset).toFixed(6));

    const randVehicle = VEHICLE_OPTIONS[Math.floor(Math.random() * VEHICLE_OPTIONS.length)];
    setVehicleType(randVehicle);

    // Pick 1-2 random violations
    const shuffled = [...VIOLATION_OPTIONS].sort(() => 0.5 - Math.random());
    setSelectedViolations(shuffled.slice(0, Math.floor(Math.random() * 2) + 1));

    setNearIntersection(Math.random() > 0.6);
    showToast('info', `Random data generated for ${randomZone.name}!`);
  }

  function showToast(type, text) {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  }

  // Submit handler
  async function handleSubmit(e) {
    if (e) e.preventDefault();

    if (!lat || !lng) {
      showToast('error', 'Please enter valid Latitude and Longitude');
      return;
    }

    const payload = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      vehicle_type: vehicleType,
      violation_types: selectedViolations,
      near_intersection: nearIntersection,
    };

    setLoading(true);
    try {
      const response = await api.ingestViolation(payload);
      showToast('success', 'Violation ingested successfully! Dashboard updated.');

      // Add to session list
      const ingestedData = response.data.ingested || payload;
      setRecentReports((prev) => [
        {
          id: ingestedData.id || `ING-${Date.now()}`,
          time: new Date().toLocaleTimeString(),
          ...payload,
        },
        ...prev,
      ]);

      // Reset Form fields
      setLat('');
      setLng('');
      setVehicleType('CAR');
      setSelectedViolations(['NO PARKING']);
      setNearIntersection(false);
    } catch (err) {
      console.error(err);
      showToast('error', err.response?.data?.detail || 'Failed to ingest violation');
    } finally {
      setLoading(false);
    }
  }

  // Send Direct Demo Violation for quick check
  async function handleSendDemo() {
    const randomZone = BENGALURU_ZONES[Math.floor(Math.random() * BENGALURU_ZONES.length)];
    const latOffset = (Math.random() - 0.5) * 0.005;
    const lngOffset = (Math.random() - 0.5) * 0.005;

    const payload = {
      latitude: parseFloat((randomZone.center[0] + latOffset).toFixed(6)),
      longitude: parseFloat((randomZone.center[1] + lngOffset).toFixed(6)),
      vehicle_type: 'CAR',
      violation_types: ['OBSTRUCTING TRAFFIC', 'NO PARKING'],
      near_intersection: true,
    };

    setLoading(true);
    try {
      const response = await api.ingestViolation(payload);
      showToast('success', `⚡ Demo Violation ingested successfully in ${randomZone.name}!`);

      const ingestedData = response.data.ingested || payload;
      setRecentReports((prev) => [
        {
          id: ingestedData.id || `DEMO-${Date.now()}`,
          time: new Date().toLocaleTimeString(),
          ...payload,
        },
        ...prev,
      ]);
    } catch (err) {
      console.error(err);
      showToast('error', err.response?.data?.detail || 'Failed to ingest demo violation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header and Live Status Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Live Violation Reporter</h2>
          <p className="mt-1 text-sm text-command-muted">
            Hackathon control console to inject real-time violation events
          </p>
        </div>
        <LiveStatusBar connected={connected} status={status} lastTick={lastTick} />
      </div>

      {/* Toast Alert Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-all duration-300 ${
            notification.type === 'success'
              ? 'border-command-success/30 bg-command-success/10 text-command-success'
              : notification.type === 'error'
              ? 'border-command-danger/30 bg-command-danger/10 text-command-danger'
              : 'border-command-accent/30 bg-command-accent/10 text-command-accent'
          }`}
        >
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="font-bold opacity-70 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Ingestion Form Card */}
        <div className="lg:col-span-2 rounded-xl border border-command-border bg-command-panel p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Ingest New Violation Event</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-400">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="e.g. 12.935245"
                  className="mt-1 w-full rounded-lg border border-command-border bg-command-bg px-3 py-2 text-white outline-none focus:border-command-accent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="e.g. 77.624512"
                  className="mt-1 w-full rounded-lg border border-command-border bg-command-bg px-3 py-2 text-white outline-none focus:border-command-accent"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-400">Vehicle Type</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-command-border bg-command-bg px-3 py-2 text-white outline-none focus:border-command-accent"
                >
                  {VEHICLE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={nearIntersection}
                    onChange={(e) => setNearIntersection(e.target.checked)}
                    className="h-4 w-4 rounded border-command-border bg-command-bg text-command-accent accent-command-accent focus:ring-0"
                  />
                  <span className="text-xs font-medium text-gray-400">Near Traffic Intersection</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Violation Types (select at least one)</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {VIOLATION_OPTIONS.map((opt) => {
                  const isChecked = selectedViolations.includes(opt);
                  return (
                    <label
                      key={opt}
                      onClick={() => handleViolationChange(opt)}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-medium cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-command-accent/50 bg-command-accent/10 text-white'
                          : 'border-command-border bg-command-bg text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="h-3.5 w-3.5 rounded border-command-border bg-command-bg text-command-accent accent-command-accent"
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-command-accent py-2.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Submitting Violation...' : 'Ingest Custom Violation'}
              </button>
            </div>
          </form>
        </div>

        {/* Quick Demo Controls Panel */}
        <div className="rounded-xl border border-command-border bg-command-panel p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Judge Demo Actions</h3>
            <p className="text-xs text-command-muted mb-4">
              Use these shortcuts to showcase instant live updates during the hackathon.
            </p>

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGenerateRandom}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-command-border bg-command-bg py-3 text-sm font-medium text-white hover:bg-white/5 transition-colors"
              >
                <span className="text-command-warning text-lg">⚙</span>
                Generate Random Bengaluru Data
              </button>

              <button
                type="button"
                onClick={handleSendDemo}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-command-success py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <span className="text-lg">⚡</span>
                Send Live Demo Violation
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-command-border pt-4">
            <h4 className="text-xs font-semibold text-gray-400 mb-2">Real-time Connection Status</h4>
            <div className="rounded-lg bg-command-bg p-3 border border-command-border space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-command-muted">WebSocket:</span>
                <span className={connected ? 'text-command-success font-semibold' : 'text-command-danger font-semibold'}>
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-command-muted">Live Mode:</span>
                <span className="text-white font-medium">{status?.live_mode ? 'ENABLED' : 'DISABLED'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-command-muted">Auto Replay:</span>
                <span className="text-white font-medium">
                  {status?.live_replay_enabled ? `ON (${status?.refresh_interval_seconds}s)` : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session Ingested Violations list */}
      <div className="rounded-xl border border-command-border bg-command-panel p-6">
        <h3 className="mb-4 text-lg font-semibold text-white flex items-center gap-2">
          <span>Recent Live Reports (This Session)</span>
          {recentReports.length > 0 && (
            <span className="rounded-full bg-command-accent/20 px-2.5 py-0.5 text-xs text-command-accent">
              {recentReports.length}
            </span>
          )}
        </h3>

        {recentReports.length === 0 ? (
          <p className="text-sm text-command-muted text-center py-6">
            No live events ingested in this session yet. Submit the form above to see live updates.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="border-b border-command-border text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Coordinates</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Violations</th>
                  <th className="py-3 px-4">Intersection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-command-border">
                {recentReports.map((report) => (
                  <tr key={report.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 text-white font-medium">{report.time}</td>
                    <td className="py-3 px-4 text-xs font-mono text-command-muted">{report.id}</td>
                    <td className="py-3 px-4 text-xs">
                      {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-gray-300 font-medium">
                        {report.vehicle_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {report.violation_types.map((type) => (
                          <span
                            key={type}
                            className="rounded bg-command-accent/15 px-2 py-0.5 text-xs text-command-accent font-medium"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {report.near_intersection ? (
                        <span className="text-command-warning">⚠️ Yes</span>
                      ) : (
                        <span className="text-gray-600">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
