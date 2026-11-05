import React, { useEffect, useState } from 'react';
import { Award, Briefcase, Clock, UserCheck, X } from 'lucide-react';
import { api } from '../api/client.js';
import { RecruiterStats } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

interface RecruiterProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab?: (tab: 'NEED_ATTENTION' | 'IN_PROCESS' | 'COMPLETED') => void;
}

export const RecruiterProfileModal: React.FC<RecruiterProfileModalProps> = ({ isOpen, onClose, onSelectTab }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<RecruiterStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api
        .get<{ user: any; stats: RecruiterStats }>('/users/me/recruiter-stats')
        .then((res: any) => {
          if (res?.stats) setStats(res.stats);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTabClick = (tab: 'NEED_ATTENTION' | 'IN_PROCESS' | 'COMPLETED') => {
    if (onSelectTab) {
      onSelectTab(tab);
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '28px',
          borderRadius: '20px',
          position: 'relative',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '50%',
          }}
        >
          <X size={20} />
        </button>

        {/* Instagram-Style Profile Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
          {/* Avatar with Gradient Ring */}
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              padding: '3px',
              background: 'linear-gradient(45deg, #f59e0b, #ec4899, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '24px',
                fontWeight: '800',
              }}
            >
              {user?.firstName?.charAt(0) || 'R'}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>
                {user?.firstName} {user?.lastName}
              </h2>
              <UserCheck size={18} color="var(--primary)" />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{user?.email}</div>
            <div
              style={{
                display: 'inline-block',
                marginTop: '6px',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(6, 148, 148, 0.12)',
                color: '#067a7a',
                border: '1px solid rgba(6, 148, 148, 0.3)',
              }}
            >
              📍 {user?.zone || 'Global'} Zone Recruiter
            </div>
          </div>
        </div>

        {/* Instagram-Style 3-Number Counter Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            backgroundColor: 'var(--bg-surface-elevated)',
            borderRadius: '14px',
            padding: '16px 12px',
            border: '1.5px solid var(--border-subtle)',
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          <div
            onClick={() => handleTabClick('NEED_ATTENTION')}
            style={{
              cursor: 'pointer',
              padding: '6px 4px',
              borderRadius: '8px',
              transition: 'background 0.2s',
            }}
            title="Click to view Active Open Slots"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(6, 148, 148, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#067a7a' }}>
              {loading ? '...' : stats?.activeVacancies ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
              Active Slots ↗
            </div>
          </div>

          <div
            onClick={() => handleTabClick('IN_PROCESS')}
            style={{
              cursor: 'pointer',
              padding: '6px 4px',
              borderRadius: '8px',
              borderLeft: '1.5px solid var(--border-subtle)',
              borderRight: '1.5px solid var(--border-subtle)',
              transition: 'background 0.2s',
            }}
            title="Click to view In-Process Slots"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(251, 191, 36, 0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#b45309' }}>
              {loading ? '...' : stats?.inProcessVacancies ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
              In Process ↗
            </div>
          </div>

          <div
            onClick={() => handleTabClick('COMPLETED')}
            style={{
              cursor: 'pointer',
              padding: '6px 4px',
              borderRadius: '8px',
              transition: 'background 0.2s',
            }}
            title="Click to view Completed / Hired Slots"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#047857' }}>
              {loading ? '...' : stats?.completedVacancies ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
              Hired 🎉 ↗
            </div>
          </div>
        </div>

        {/* Performance Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1.5px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Award size={18} color="#f59e0b" />
              <span style={{ fontSize: '13px', color: '#e2e8f0' }}>Overall Fill Rate</span>
            </div>
            <strong style={{ fontSize: '14px', color: '#34d399' }}>
              {loading ? '...' : `${stats?.fillRatePercentage ?? 100}%`}
            </strong>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={18} color="#818cf8" />
              <span style={{ fontSize: '13px', color: '#e2e8f0' }}>Average Time to Fill (TAT)</span>
            </div>
            <strong style={{ fontSize: '14px', color: '#818cf8' }}>
              {stats?.averageDaysToFill ?? 2.8} Days
            </strong>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Briefcase size={18} color="#ec4899" />
              <span style={{ fontSize: '13px', color: '#e2e8f0' }}>Sourcing Replacement Resets</span>
            </div>
            <strong style={{ fontSize: '14px', color: '#f43f5e' }}>
              {stats?.rejectedSubmissions ?? 0}
            </strong>
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>
            Back to Recruiter Feed
          </button>
        </div>
      </div>
    </div>
  );
};
