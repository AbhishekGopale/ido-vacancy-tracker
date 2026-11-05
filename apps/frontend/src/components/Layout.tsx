import React, { useState } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  AlertTriangle,
  Sliders,
  Settings,
  LogOut,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const Layout: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="app-container">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <Link
            to="/"
            onClick={closeMobileMenu}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              color: 'inherit',
              flex: 1,
            }}
          >
            <div className="brand-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0 }}>Recruitment OS</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Workforce Tracker</p>
            </div>
          </Link>
          <button
            className="mobile-close-btn"
            onClick={closeMobileMenu}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 12px 2px 12px' }}>
            Workspace
          </div>

          <NavLink
            to="/"
            end
            onClick={closeMobileMenu}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={17} />
            <span>Dashboard</span>
          </NavLink>

          {hasPermission('project_roles.manage') && (
            <NavLink
              to="/project-roles"
              onClick={closeMobileMenu}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Sliders size={17} />
              <span>Step 1: Role Setup</span>
            </NavLink>
          )}

          <NavLink
            to="/vacancies"
            onClick={closeMobileMenu}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Briefcase size={17} />
            <span>Step 2: Vacancies</span>
          </NavLink>

          {hasPermission('vacancies.dedup_decision') && (
            <NavLink
              to="/duplicates"
              onClick={closeMobileMenu}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <AlertTriangle size={17} />
              <span>PM Review Queue</span>
            </NavLink>
          )}

          {hasPermission('users.manage') && (
            <>
              <div style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 12px 2px 12px' }}>
                Governance
              </div>
              <NavLink
                to="/settings"
                onClick={closeMobileMenu}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Settings size={17} />
                <span>Users & Security</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* Pinned Bottom Unit: Live Sync + User Profile Card */}
        <div className="sidebar-bottom">
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              borderRadius: '8px',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1.5px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>Live Sync</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--accent-teal)' }} />
              <span style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--accent-teal)' }}>ACTIVE</span>
            </span>
          </div>

          <div className="sidebar-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800',
                  fontSize: '13px',
                  flexShrink: 0,
                }}
              >
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {user?.firstName} {user?.lastName}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {user?.roleName} {user?.zone ? `• ${user.zone}` : ''}
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Log out"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                padding: '6px',
                borderRadius: '6px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent-pink)';
                e.currentTarget.style.backgroundColor = 'rgba(255, 105, 180, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main View Area */}
      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="mobile-menu-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                color: 'inherit',
              }}
              className="mobile-brand-link"
            >
              <div className="brand-icon" style={{ width: '28px', height: '28px' }}>
                <Sparkles size={15} />
              </div>
            </Link>
            <span
              style={{
                fontSize: '12px',
                fontWeight: '700',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor:
                  user?.roleName === 'SUPER_ADMIN'
                    ? 'rgba(255, 105, 180, 0.12)'
                    : user?.roleName === 'PM'
                    ? 'rgba(6, 148, 148, 0.12)'
                    : 'rgba(0, 240, 255, 0.14)',
                color:
                  user?.roleName === 'SUPER_ADMIN'
                    ? '#be185d'
                    : user?.roleName === 'PM'
                    ? '#067a7a'
                    : '#088395',
                border: '1.5px solid var(--border-subtle)',
              }}
            >
              Role: {user?.roleName} {user?.zone ? `• Zone ${user.zone}` : ''}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Logged in as{' '}
            <a
              href={`mailto:${user?.email}`}
              style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}
              title="Send email"
            >
              {user?.email}
            </a>
          </div>
        </header>

        <main className="page-body">
          <Outlet />
        </main>

        {/* Enterprise Footer */}
        <footer
          className="app-footer"
          style={{
            marginTop: 'auto',
            padding: '16px 28px',
            borderTop: '1.5px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ fontWeight: 600 }}>
            © {new Date().getFullYear()} <strong style={{ color: 'var(--text-primary)' }}>Recruitment OS</strong>. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span>
              Admin:{' '}
              <a href="mailto:abhishek.gopale@idonneous.com" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>
                abhishek.gopale@idonneous.com
              </a>
            </span>
            <span>
              Approval Chain:{' '}
              <span style={{ color: 'var(--accent-pink)', fontWeight: '700' }}>Synchronous (1-by-1 per Upload)</span>
            </span>
            <span>
              Helpline:{' '}
              <a href="tel:+919876543210" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>
                +91 98765 43210
              </a>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};
