import { useState } from 'react';

const VIOLATION_TYPES = [
  { id: 'double', label: '🚗 Double Parking', multiplier: 1.5, baseLoss: 12500, baseDelay: 15, co2PerUnit: 3.2 },
  { id: 'noparking', label: '🚫 No Parking Zone', multiplier: 1.0, baseLoss: 6200, baseDelay: 8, co2PerUnit: 1.6 },
  { id: 'sidewalk', label: '🚶 Sidewalk Obstruction', multiplier: 1.2, baseLoss: 8800, baseDelay: 10, co2PerUnit: 2.1 },
];

const ZONES = [
  { name: 'Silk Board Junction', weight: 1.6, description: 'Heavy arterial bottleneck' },
  { name: 'Indiranagar 100ft Rd', weight: 1.3, description: 'Dense commercial corridor' },
  { name: 'Koramangala 80ft Rd', weight: 1.15, description: 'Tech hub & residential mix' },
  { name: 'MG Road Metro Stn', weight: 1.4, description: 'Central business district' },
];

export default function About() {
  // Simulator States
  const [violationType, setViolationType] = useState('double');
  const [vehicleCount, setVehicleCount] = useState(3);
  const [selectedZone, setSelectedZone] = useState('Silk Board Junction');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResults, setSimResults] = useState(null);

  const handleSimulate = (e) => {
    e.preventDefault();
    setIsSimulating(true);
    setSimResults(null);

    // Simulate AI model calculation lag
    setTimeout(() => {
      const typeConfig = VIOLATION_TYPES.find((v) => v.id === violationType);
      const zoneConfig = ZONES.find((z) => z.name === selectedZone);
      
      const economicLoss = Math.round(
        vehicleCount * typeConfig.baseLoss * zoneConfig.weight
      );
      const avgDelayMins = Math.round(
        vehicleCount * typeConfig.baseDelay * zoneConfig.weight
      );
      const co2Kg = parseFloat(
        (vehicleCount * typeConfig.co2PerUnit * zoneConfig.weight).toFixed(1)
      );
      const riskScore = Math.min(
        100,
        Math.round(vehicleCount * 18 * typeConfig.multiplier * zoneConfig.weight)
      );

      // Determine recommended dispatch action
      let dispatchAction = 'Issue auto-spot penalty loops';
      if (riskScore >= 75) {
        dispatchAction = 'Dispatch 2 Towing Escort Units + Clamping Patrol';
      } else if (riskScore >= 45) {
        dispatchAction = 'Assign 1 Patrol Officer for obstruction clearance';
      }

      setSimResults({
        economicLoss,
        avgDelayMins,
        co2Kg,
        riskScore,
        dispatchAction,
      });
      setIsSimulating(false);
    }, 1000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-3 border-b border-gray-150 dark:border-white/10 pb-6 text-left">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#F9EDED] dark:bg-[#BA5A5A]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#BA5A5A]">
            Platform Overview
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">v2.4 Live</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white leading-tight">
          About <span className="bg-gradient-to-r from-[#BA5A5A] to-[#A04848] bg-clip-text text-transparent">ParkSense AI</span>
        </h2>

        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
          The next-generation, AI-driven parking congestion intelligence platform for Bengaluru. 
          Enabling traffic command centers and citizens to predict congestion, detect violations, and optimize mobility in real-time.
        </p>
      </div>

      {/* Main Mission & Structure Panel */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-950 p-6 md:p-8 shadow-md space-y-6">
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🎯</span> Our Mission
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            Bengaluru loses crores daily to traffic congestion caused by illegal, double, or wrong-side parking. 
            <strong> ParkSense AI</strong> was designed to transition city parking enforcement from reactive complaint-handling 
            to proactive intelligence-led operations. We analyze historical data, live sensor streams, and CCTV feeds 
            to calculate where violations will occur next, their exact economic costs, and where to deploy enforcement officers.
          </p>
        </section>

        <hr className="border-gray-150 dark:border-white/10" />

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>🚗</span> For Citizens
            </h3>
            <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-2.5 list-disc list-inside leading-relaxed">
              <li><strong>Trip Planner:</strong> Check live zone speeds, delay indexes, and predicted parking congestion scores before leaving.</li>
              <li><strong>Live Violation Reporter:</strong> Submit parking violation reports with vehicle photos and locations. Connected via WebSockets for real-time dispatch.</li>
              <li><strong>Green Corridors:</strong> Safe zones and priority alerts keeping emergency lanes clear for ambulances.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>👮</span> For Officers & Administration
            </h3>
            <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-2.5 list-disc list-inside leading-relaxed">
              <li><strong>ParkPredict Engine:</strong> 24-hour Prophet-based forecast modeling congestion trends.</li>
              <li><strong>Patrol Shift Planner:</strong> AI-driven optimal officer assignment schedules targeting high-probability violation hotspots.</li>
              <li><strong>CCTV Monitor:</strong> Real-time automated street surveillance detecting double-parking and sidewalk violations instantly.</li>
              <li><strong>Economic Impact Ledger:</strong> Quantifies fuel burned, emissions produced, and wage value lost per sector.</li>
            </ul>
          </div>
        </section>

        <hr className="border-gray-150 dark:border-white/10" />

        <section className="space-y-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>⚙️</span> Technology Stack
          </h3>
          <div className="flex flex-wrap gap-2">
            {['FastAPI', 'React 19', 'Vite', 'Tailwind CSS', 'Prophet (Meta)', 'Pandas & NumPy', 'Leaflet Engine', 'WebSockets'].map((tech) => (
              <span key={tech} className="rounded-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                {tech}
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* ── Interactive Playground Section ── */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-950 p-6 md:p-8 shadow-md space-y-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🎮</span> Congestion Impact Sandbox
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Simulate the cascading civic and economic impact of parking violations in real-time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Controls form (5 columns) */}
          <form onSubmit={handleSimulate} className="lg:col-span-5 space-y-4 flex flex-col justify-between text-left">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">
                  Violation Location
                </label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#BA5A5A]"
                >
                  {ZONES.map((z) => (
                    <option key={z.name} value={z.name}>
                      {z.name} ({z.weight}x scale)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">
                  Violation Category
                </label>
                <div className="space-y-1.5">
                  {VIOLATION_TYPES.map((v) => (
                    <label
                      key={v.id}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${
                        violationType === v.id
                          ? 'border-[#BA5A5A] bg-[#F9EDED] dark:bg-[#BA5A5A]/10 text-[#BA5A5A]'
                          : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="font-semibold">{v.label}</span>
                      <input
                        type="radio"
                        name="violationType"
                        value={v.id}
                        checked={violationType === v.id}
                        onChange={() => setViolationType(v.id)}
                        className="hidden"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Number of Vehicles
                  </label>
                  <span className="text-xs font-black text-[#BA5A5A]">{vehicleCount} Vehicles</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={vehicleCount}
                  onChange={(e) => setVehicleCount(parseInt(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-100 dark:bg-gray-800 accent-[#BA5A5A]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSimulating}
              className="w-full mt-4 rounded-xl bg-[#BA5A5A] text-white py-2.5 text-xs font-semibold hover:bg-[#A04848] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-[#BA5A5A]/10 cursor-pointer"
            >
              {isSimulating ? 'Processing Models...' : 'Calculate Simulated Impact'}
            </button>
          </form>

          {/* Results Display Panel (7 columns) */}
          <div className="lg:col-span-7 rounded-xl border border-gray-150 dark:border-white/10 bg-gray-50/50 dark:bg-gray-900/20 p-5 flex flex-col justify-center items-center relative overflow-hidden min-h-[300px]">
            {isSimulating ? (
              <div className="text-center space-y-3">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#BA5A5A] border-t-transparent" />
                <p className="text-xs text-gray-400 animate-pulse font-medium">Running Prophet congestion weights...</p>
              </div>
            ) : simResults ? (
              <div className="w-full space-y-4 animate-fadeIn text-left">
                {/* Result header */}
                <div className="flex justify-between items-center border-b border-gray-200 dark:border-white/10 pb-3">
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Simulation Results</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Risk Score</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      simResults.riskScore >= 75
                        ? 'bg-red-100 dark:bg-red-500/10 text-red-500'
                        : simResults.riskScore >= 45
                        ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-500'
                        : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {simResults.riskScore}%
                    </span>
                  </div>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-3 rounded-lg text-center shadow-sm">
                    <span className="block text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">Est. Loss</span>
                    <span className="block text-sm sm:text-base font-extrabold text-[#BA5A5A] mt-1">
                      ₹{simResults.economicLoss.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-3 rounded-lg text-center shadow-sm">
                    <span className="block text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">Avg Delay</span>
                    <span className="block text-sm sm:text-base font-extrabold text-[#BA5A5A] mt-1">
                      {simResults.avgDelayMins}m
                    </span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-3 rounded-lg text-center shadow-sm">
                    <span className="block text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">CO₂ Waste</span>
                    <span className="block text-sm sm:text-base font-extrabold text-[#BA5A5A] mt-1">
                      {simResults.co2Kg}kg
                    </span>
                  </div>
                </div>

                {/* Risk Progress Bar */}
                <div className="space-y-1 pt-1.5">
                  <div className="flex justify-between text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                    <span>Congestion Risk Level</span>
                    <span>{simResults.riskScore >= 75 ? 'Critical Avoidance' : simResults.riskScore >= 45 ? 'Elevated Caution' : 'Clear / Flowing'}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        simResults.riskScore >= 75
                          ? 'bg-red-500'
                          : simResults.riskScore >= 45
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${simResults.riskScore}%` }}
                    />
                  </div>
                </div>

                {/* Dispatch recommendation */}
                <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-3.5 mt-2 shadow-sm text-left">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#BA5A5A] uppercase tracking-wider mb-1">
                    <span>💡</span> Recommended Dispatch Action
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-semibold">
                    {simResults.dispatchAction}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center max-w-xs space-y-2">
                <span className="text-3xl">🎛️</span>
                <h4 className="text-sm font-extrabold text-gray-700 dark:text-gray-300">Sandbox Awaiting Config</h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Configure location, violation category, and vehicle count on the left, then click Simulate to run model calculations.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
