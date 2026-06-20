import { useEffect, useState } from 'react';
import { api } from '../api/client';

function WeatherIcon({ condition, className = "h-7 w-7 shrink-0" }) {
  switch (condition) {
    case 'Thunderstorm':
      return (
        <svg className={`${className} text-yellow-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.2 0-2.4.4-3.4 1.2A6.5 6.5 0 003 10.5a5.5 5.5 0 005.5 5.5H18a5 5 0 005-5 5.5 5.5 0 00-5.5-5.5c-.3 0-.6 0-.8.1A6.5 6.5 0 0012 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16l-3 4h3v3l4-5h-4v-2z" />
        </svg>
      );
    case 'Drizzle':
    case 'Rain':
      return (
        <svg className={`${className} text-blue-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.2 0-2.4.4-3.4 1.2A6.5 6.5 0 003 10.5a5.5 5.5 0 005.5 5.5H18a5 5 0 005-5 5.5 5.5 0 00-5.5-5.5c-.3 0-.6 0-.8.1A6.5 6.5 0 0012 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 18v3m4-3v3m-8-2v2" />
        </svg>
      );
    case 'Snow':
      return (
        <svg className={`${className} text-blue-200`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18m-3-6L6 18M6 6l12 12" />
        </svg>
      );
    case 'Mist':
    case 'Haze':
    case 'Fog':
    case 'Smoke':
      return (
        <svg className={`${className} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M6 12h12M4 16h16" />
        </svg>
      );
    case 'Dust':
      return (
        <svg className={`${className} text-amber-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M6 10h12M8 14h8M10 18h4" />
        </svg>
      );
    case 'Clear':
      return (
        <svg className={`${className} text-yellow-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      );
    case 'Clouds':
    default:
      return (
        <svg className={`${className} text-blue-300`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      );
  }
}

const ALERT_STYLES = {
  CRITICAL: {
    border: 'border-command-danger/50',
    bg: 'bg-gradient-to-r from-command-danger/15 via-command-danger/10 to-transparent',
    badge: 'bg-command-danger/20 text-command-danger',
    text: 'text-command-danger',
    pulse: true,
  },
  HIGH: {
    border: 'border-orange-500/50',
    bg: 'bg-gradient-to-r from-orange-500/15 via-orange-500/10 to-transparent',
    badge: 'bg-orange-500/20 text-orange-400',
    text: 'text-orange-400',
    pulse: true,
  },
  MEDIUM: {
    border: 'border-command-warning/50',
    bg: 'bg-gradient-to-r from-command-warning/15 via-command-warning/10 to-transparent',
    badge: 'bg-command-warning/20 text-command-warning',
    text: 'text-command-warning',
    pulse: false,
  },
  LOW: {
    border: 'border-command-accent/30',
    bg: 'bg-gradient-to-r from-command-accent/10 via-transparent to-transparent',
    badge: 'bg-command-accent/20 text-command-accent',
    text: 'text-command-accent',
    pulse: false,
  },
  NONE: {
    border: 'border-command-success/30',
    bg: 'bg-gradient-to-r from-command-success/8 via-transparent to-transparent',
    badge: 'bg-command-success/20 text-command-success',
    text: 'text-command-success',
    pulse: false,
  },
};

export default function WeatherBanner({ weatherData, liveWeather }) {
  const [weather, setWeather] = useState(weatherData || liveWeather || null);
  const [loading, setLoading] = useState(!weatherData && !liveWeather);

  // Fetch weather on mount if not provided
  useEffect(() => {
    if (weather) return;
    api
      .getWeather()
      .then((res) => setWeather(res.data))
      .catch(() => setWeather(null))
      .finally(() => setLoading(false));
  }, []);

  // Update from live tick
  useEffect(() => {
    if (liveWeather) {
      setWeather(liveWeather);
      setLoading(false);
    }
  }, [liveWeather]);

  if (loading || !weather) return null;

  const alertLevel = weather.alert_level || 'NONE';
  const style = ALERT_STYLES[alertLevel] || ALERT_STYLES.NONE;
  const isEscalated = weather.multiplier > 1.0;
  return (
    <div
      id="weather-banner"
      className={`weather-banner-card weather-card-${alertLevel.toLowerCase()} relative overflow-hidden rounded-xl border px-4 py-3.5 transition-all duration-500 backdrop-blur-md`}
    >
      {/* Pulse animation for rain alerts */}
      {style.pulse && (
        <div className="absolute inset-0 animate-pulse opacity-30"
          style={{
            background: alertLevel === 'CRITICAL'
              ? 'radial-gradient(ellipse at left, rgba(239,68,68,0.2), transparent 70%)'
              : 'radial-gradient(ellipse at left, rgba(249,115,22,0.2), transparent 70%)',
          }}
        />
      )}

      <div className="relative flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Weather icon + condition */}
        <div className="flex items-center gap-2">
          <WeatherIcon condition={weather.condition} />
          <div>
            <p className="weather-title text-sm font-bold">
              {weather.condition}
              <span className="weather-meta ml-2 text-xs font-normal">
                {weather.temperature_c}°C · {weather.humidity_pct}% humidity
              </span>
            </p>
            <p className="weather-desc text-xs capitalize">{weather.description}</p>
          </div>
        </div>

        {/* Escalation badge */}
        {isEscalated ? (
          <div className="weather-badge rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Risk {weather.multiplier}x · Severity +{weather.severity_boost}</span>
          </div>
        ) : (
          <div className="weather-badge rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Normal risk levels</span>
          </div>
        )}

        {/* Rain detail */}
        {weather.rain_mm_1h > 0 && (
          <span className="weather-rain-info text-xs font-semibold flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13c0 5-3.5 7-8 7s-8-2-8-7c0-4.3 3.3-7.5 7.4-8.7a1 1 0 011.2.9c.3 1.8 1.4 3.5 3 4.5 2 1.3 4.4 1.7 4.4 3.3z" />
            </svg>
            <span>{weather.rain_mm_1h} mm/h</span>
          </span>
        )}

        {/* Escalation description */}
        {isEscalated && (
          <p className="weather-escalation-desc w-full text-xs sm:w-auto sm:ml-auto">
            <span className="weather-alert-label font-bold mr-1">Rain Alert</span> — Predictions &
            severity scores auto-escalated for monsoon conditions
          </p>
        )}
      </div>
    </div>
  );
}
