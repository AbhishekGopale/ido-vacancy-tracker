import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { User } from '../../types/index.js';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    document.title = 'Sign In | Recruitment OS';
  }, []);

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDemoRole, setSelectedDemoRole] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await api.post<{
        token: string;
        refreshToken: string;
        user: User;
      }>('/auth/login', { username: userId.trim(), password });

      login(data.token, data.refreshToken, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (testUserId: string, testPass: string, roleKey: string) => {
    setUserId(testUserId);
    setPassword(testPass);
    setSelectedDemoRole(roleKey);
    setError(null);
  };

  const demoRoles = [
    {
      category: '🎯 Area Recruiters (1-to-1 Area Binding)',
      roles: [
        {
          key: 'REC_WEST_MUMBAI',
          title: 'Recruiter (West Mumbai)',
          badge: 'West Mumbai Area',
          userId: 'rec_west_mumbai',
          pass: 'Recruiter@123456',
          desc: 'Responsible for Mumbai MT/GT store requirements',
          accent: '#10b981',
        },
        {
          key: 'REC_NORTH_DELHI',
          title: 'Recruiter (North Delhi)',
          badge: 'North Delhi Area',
          userId: 'rec_north_delhi',
          pass: 'Recruiter@123456',
          desc: 'Responsible for North Delhi & NCR requirements',
          accent: '#06b6d4',
        },
        {
          key: 'REC_SOUTH_KN',
          title: 'Recruiter (South KN)',
          badge: 'Karnataka Area',
          userId: 'rec_south_kn',
          pass: 'Recruiter@123456',
          desc: 'Responsible for South KN Bengaluru requirements',
          accent: '#3b82f6',
        },
      ],
    },
    {
      category: '📋 Project Managers (PMs)',
      roles: [
        {
          key: 'PM_UNILEVER',
          title: 'PM (Unilever)',
          badge: 'UI Multi-Project',
          userId: 'pm_unilever',
          pass: 'Pm@123456',
          desc: 'Ingest review, hold control & multi-project access',
          accent: '#818cf8',
        },
        {
          key: 'PM_PG',
          title: 'PM (P&G)',
          badge: 'PG Operations',
          userId: 'pm_pg',
          pass: 'Pm@123456',
          desc: 'Project Manager for Procter & Gamble',
          accent: '#818cf8',
        },
      ],
    },
    {
      category: '👑 Executive Leadership & Admin',
      roles: [
        {
          key: 'ADMIN',
          title: 'Super Admin',
          badge: 'System Admin',
          userId: 'admin',
          pass: 'Admin@123456',
          desc: 'Master control, stores master & user allocation',
          accent: '#f43f5e',
        },
        {
          key: 'DIRECTOR',
          title: 'Higher Management',
          badge: 'Director',
          userId: 'director',
          pass: 'Director@123456',
          desc: 'Consolidated 10-Area MT/GT analytics & exports',
          accent: '#38bdf8',
        },
      ],
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(circle at top right, rgba(255, 105, 180, 0.08), transparent 45%), radial-gradient(circle at bottom left, rgba(6, 148, 148, 0.09), transparent 45%), #f8fafc',
        padding: '24px',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '36px 32px',
          borderRadius: '16px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            className="brand-icon"
            style={{ width: '48px', height: '48px', margin: '0 auto 14px auto', borderRadius: '12px' }}
          >
            <Sparkles size={24} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Recruitment OS</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '4px' }}>
            Sign in to access your recruitment pipeline
          </p>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              color: 'var(--accent-rose)',
              fontSize: '13px',
              marginBottom: '18px',
              lineHeight: '1.4',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Login Error:</strong>
              <div style={{ marginTop: '2px' }}>{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">User ID / Username</label>
            <div style={{ position: 'relative' }}>
              <UserIcon
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                required
                className="form-input"
                style={{ width: '100%', paddingLeft: '36px' }}
                placeholder="e.g. rec_west_mumbai, admin, pm_unilever"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setSelectedDemoRole('');
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="password"
                required
                className="form-input"
                style={{ width: '100%', paddingLeft: '36px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setSelectedDemoRole('');
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '12px' }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Demo Fast Login Bar with All Role Types */}
        <div style={{ marginTop: '24px', borderTop: '1.5px solid var(--border-subtle)', paddingTop: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>
              ⚡ Quick-Fill Demo Roles (User IDs):
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Click any user ID to test
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {demoRoles.map((cat) => (
              <div key={cat.category}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '6px' }}>
                  {cat.category}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '6px' }}>
                  {cat.roles.map((r) => {
                    const isSelected = selectedDemoRole === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => handleQuickFill(r.userId, r.pass, r.key)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: isSelected ? `1.5px solid ${r.accent}` : '1.5px solid var(--border-subtle)',
                          backgroundColor: isSelected ? `${r.accent}15` : 'var(--bg-surface-elevated)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                        title={`${r.desc} (User ID: ${r.userId})`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: isSelected ? r.accent : 'var(--text-primary)' }}>
                            {r.title}
                          </span>
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {r.userId}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Support & Copyright Footer */}
        <div style={{ marginTop: '22px', textAlign: 'center', fontSize: '11.5px', color: 'var(--text-muted)' }}>
          <div>© {new Date().getFullYear()} Recruitment OS. All rights reserved.</div>
          <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <a href="mailto:abhishek.gopale@idonneous.com" style={{ color: '#38bdf8', textDecoration: 'none' }}>
              Support: abhishek.gopale@idonneous.com
            </a>
            <a href="tel:+919876543210" style={{ color: '#38bdf8', textDecoration: 'none' }}>
              Helpline: +91 98765 43210
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
