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

        <div className="mb-6 flex rounded-lg bg-command-bg p-1">
          <button
            type="button"
            onClick={() => setMode('user')}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${
              mode === 'user' ? 'bg-command-accent text-white' : 'text-gray-400'
            }`}
          >
            Citizen / User
          </button>
          <button
            type="button"
            onClick={() => setMode('officer')}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${
              mode === 'officer' ? 'bg-command-accent text-white' : 'text-gray-400'
            }`}
          >
            Officer
          </button>
        </div>

        {mode === 'user' ? (
          <p className="mb-4 text-center text-xs text-gray-500">
            Plan your commute — see congestion and parking hotspots before you travel.
          </p>
        ) : (
          <p className="mb-4 text-center text-xs text-gray-500">
            Command center access for Bengaluru traffic enforcement.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-command-border bg-command-bg px-3 py-2.5 text-white outline-none focus:border-command-accent"
              placeholder={mode === 'officer' ? 'officer@parksense.demo' : 'you@email.com'}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-command-border bg-command-bg px-3 py-2.5 text-white outline-none focus:border-command-accent"
            />
          </div>
          {error && <p className="text-sm text-command-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-command-accent py-2.5 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
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
