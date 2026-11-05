import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

interface ProtectedRouteProps {
  requiredPermission?: string;
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredPermission, children }) => {
  const { user, token, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--primary)', fontWeight: '600' }}>Loading recruitment system...</div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="page-body">
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h2 style={{ color: 'var(--accent-rose)', marginBottom: '12px' }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 24px' }}>
            Your active role (<strong>{user.roleName}</strong>) does not have the required permission (<code>{requiredPermission}</code>) to access this view.
          </p>
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
};
