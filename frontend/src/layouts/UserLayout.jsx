import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveFeed } from '../hooks/useLiveFeed';
import { useState, useCallback } from 'react';
import LiveStatusBar from '../components/LiveStatusBar';

export default function UserLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [lastTick, setLastTick] = useState(null);

  const handleLiveTick = useCallback((payload) => {
    if (payload.type === 'live_tick') {
      setLastTick(payload);
    }
  }, []);

  const { connected, status } = useLiveFeed(handleLiveTick);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-command-bg">
      <header className="border-b border-command-border bg-command-panel px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-command-accent text-lg font-bold text-white">
              P
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">ParkSense — Citizen Portal</h1>
              <p className="text-xs text-command-muted">
                Hi {user?.full_name || 'Citizen'}, plan your commute and report parking congestion.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <nav className="flex gap-2 rounded-lg bg-command-bg p-1">
              <NavLink
                to="/congestion"
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isActive ? 'bg-command-accent text-white font-medium' : 'text-gray-400 hover:text-white'
                  }`
                }
              >
                Trip Planner
              </NavLink>
              <NavLink
                to="/reporter"
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isActive ? 'bg-command-accent text-white font-medium' : 'text-gray-400 hover:text-white'
                  }`
                }
              >
                Report Violation
              </NavLink>
            </nav>

            <LiveStatusBar connected={connected} status={status} lastTick={lastTick} />
            
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-command-border px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
