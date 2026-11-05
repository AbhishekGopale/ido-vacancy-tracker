import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, LayoutDashboard, Sparkles } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = '404: Page Not Found | Recruitment OS';
  }, []);

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        textAlign: 'center',
      }}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: '48px 36px',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(6, 182, 212, 0.2))',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8',
            marginBottom: '24px',
          }}
        >
          <Compass size={36} />
        </div>

        <div
          style={{
            fontSize: '13px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent-cyan)',
            marginBottom: '8px',
          }}
        >
          Error 404
        </div>

        <h1
          style={{
            fontSize: '28px',
            fontWeight: '800',
            marginBottom: '12px',
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          Requisition Page Not Found
        </h1>

        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '14.5px',
            lineHeight: '1.6',
            marginBottom: '32px',
          }}
        >
          The page or tracking URL you are looking for has either been moved, cancelled by a project manager, or does not exist.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </button>

          <Link
            to="/"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
          >
            <LayoutDashboard size={16} />
            <span>Operations Dashboard</span>
          </Link>
        </div>

        <div
          style={{
            marginTop: '36px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Sparkles size={14} color="#818cf8" />
          <span>Recruitment OS Enterprise Workforce Tracker</span>
        </div>
      </div>
    </div>
  );
};
