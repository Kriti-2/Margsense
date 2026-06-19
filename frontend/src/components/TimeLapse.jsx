import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function TimeLapse({ trends = [] }) {
  const [frame, setFrame] = useState(0);
  const data = trends.length ? trends : generateFallback();

  useEffect(() => {
    if (data.length <= 1) return;
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % data.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [data.length]);

  const visibleData = data.slice(0, frame + 1);

  return (
    <div className="rounded-xl border border-command-border bg-command-panel p-6 interactive-card shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Violation Time-Lapse</h3>
      <p className="mt-1 text-sm text-command-muted">14-day violation trend animation</p>
      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visibleData}>
            <defs>
              <linearGradient id="violationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#486E5D" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#486E5D" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: '#FFFFFF', border: '1px solid #E5EEE4', borderRadius: 12, boxShadow: '0 8px 16px -4px rgba(80,114,100,0.1)' }}
              labelStyle={{ color: '#1F2925', fontWeight: 'bold' }}
            />
            <Area type="monotone" dataKey="violations" stroke="#486E5D" strokeWidth={2.5} fill="url(#violationGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-center text-xs text-gray-500">
        Showing {visibleData.length} of {data.length} days
      </p>
    </div>
  );
}

function generateFallback() {
  return Array.from({ length: 14 }, (_, i) => ({
    date: `2024-0${Math.floor(i / 7) + 1}-${String((i % 7) + 1).padStart(2, '0')}`,
    violations: 800 + Math.floor(Math.random() * 400),
  }));
}
