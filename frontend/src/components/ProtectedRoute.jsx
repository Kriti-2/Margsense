import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ officerOnly = false, userOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-command-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-command-accent border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (officerOnly && user.role !== 'officer') {
    return <Navigate to="/congestion" replace />;
  }

  if (userOnly && user.role === 'officer') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
