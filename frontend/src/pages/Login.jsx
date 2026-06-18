import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getGoogleOAuthUrl } from '../api/client';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) {
    return <Navigate to={user.role === 'officer' ? '/' : '/congestion'} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(email, password);
      navigate(u.role === 'officer' ? '/' : '/congestion');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    if (mode === 'officer') {
      setEmail('officer@parksense.demo');
      setPassword('officer123');
    } else {
      setEmail('user@parksense.demo');
      setPassword('user123');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-command-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-command-border bg-command-panel p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-command-accent text-2xl font-bold text-white">
            P
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">ParkSense AI</h1>
          <p className="mt-1 text-sm text-command-muted">Bengaluru Traffic Intelligence</p>
        </div>

        <div className="mb-6 flex rounded-xl bg-command-bg p-1.5 border border-command-border/50 relative">
          <button
            type="button"
            onClick={() => setMode('user')}
            className={`flex-1 rounded-lg py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-300 relative z-10 cursor-pointer ${
              mode === 'user' ? 'bg-command-accent text-white shadow-sm' : 'text-gray-500 hover:text-command-accent'
            }`}
          >
            Citizen Portal
          </button>
          <button
            type="button"
            onClick={() => setMode('officer')}
            className={`flex-1 rounded-lg py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-300 relative z-10 cursor-pointer ${
              mode === 'officer' ? 'bg-command-accent text-white shadow-sm' : 'text-gray-500 hover:text-command-accent'
            }`}
          >
            Officer Command
          </button>
        </div>

        {mode === 'user' ? (
          <p className="mb-4 text-center text-xs text-gray-500 font-medium">
            Plan your commute — see congestion and parking hotspots before you travel.
          </p>
        ) : (
          <p className="mb-4 text-center text-xs text-gray-500 font-medium">
            Command center access for Bengaluru traffic enforcement.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-command-border bg-command-bg px-3.5 py-2.5 text-gray-800 outline-none focus:border-command-accent focus:ring-1 focus:ring-command-accent/20 transition-all duration-200"
              placeholder={mode === 'officer' ? 'officer@parksense.demo' : 'you@email.com'}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Password</label>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-command-border bg-command-bg px-3.5 py-2.5 pr-12 text-gray-800 outline-none focus:border-command-accent focus:ring-1 focus:ring-command-accent/20 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-command-accent cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {error && <p className="text-xs font-bold text-command-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-command-accent py-2.5 font-bold uppercase text-xs tracking-widest text-white hover:opacity-90 active:scale-[0.99] transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-md shadow-command-accent/20 mt-2"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {mode === 'user' && (
          <a
            href={getGoogleOAuthUrl()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-command-border py-2.5 text-sm font-medium text-white hover:bg-white/5"
          >
            <span>Sign in with Google</span>
            <span className="text-xs text-gray-500">(Citizen OAuth)</span>
          </a>
        )}

        <button
          type="button"
          onClick={fillDemo}
          className="mt-4 w-full text-xs text-command-accent hover:underline"
        >
          Use demo {mode} credentials
        </button>

        {mode === 'user' && (
          <p className="mt-6 text-center text-sm text-gray-500">
            New here?{' '}
            <Link to="/register" className="text-command-accent hover:underline">
              Create account
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
