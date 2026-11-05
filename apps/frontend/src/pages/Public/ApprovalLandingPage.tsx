import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../../api/client.js';

export const ApprovalLandingPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') || '';
  const paramCheckingId = searchParams.get('checkingId') || '';

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string>(paramCheckingId);

  useEffect(() => {
    document.title = 'Approval Verification | Recruitment OS';
    async function processApproval() {
      if (!token) {
        setError('Missing approval token. Please check your email link.');
        setLoading(false);
        return;
      }

      try {
        const res: any = await api.post('/submissions/process-action', {
          token,
          action: 'APPROVED',
        });
        setResult(res.message);
        if (res.checkingId) {
          setCheckingId(res.checkingId);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to process 1-click approval.');
      } finally {
        setLoading(false);
      }
    }
    processApproval();
  }, [token]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.08), transparent 45%), radial-gradient(circle at bottom left, rgba(6, 148, 148, 0.08), transparent 45%), #f8fafc',
        padding: '24px',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '500px',
          padding: '36px 32px',
          borderRadius: '16px',
          textAlign: 'center',
        }}
      >
        <div
          className="brand-icon"
          style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 16px auto',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
          }}
        >
          <Sparkles size={24} />
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px' }}>
          Recruitment OS — Mobile Review
        </h1>

        {checkingId && (
          <div
            style={{
              display: 'inline-block',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              fontWeight: '700',
              marginBottom: '16px',
              wordBreak: 'break-all',
            }}
          >
            Checking ID: {checkingId}
          </div>
        )}

        {/* Transmission & Protocol Details */}
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '12px',
            textAlign: 'left',
            marginBottom: '20px',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Sender: </span>
            <strong style={{ color: 'var(--text-primary)' }}>Abhishek Gopale</strong>{' '}
            <span style={{ color: 'var(--primary)' }}>(abhishek.gopale@idonneous.com)</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Approver: </span>
            <strong style={{ color: 'var(--text-primary)' }}>Divya</strong>{' '}
            <span style={{ color: '#38bdf8' }}>(divya@idonneous.com)</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Protocol: </span>
            <span style={{ color: '#34d399' }}>SMTP / Direct Mail Transmit</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '24px 0', color: 'var(--text-secondary)' }}>
            Processing single-use approval token...
          </div>
        ) : error ? (
          <div>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                color: 'var(--accent-rose)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <AlertCircle size={24} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-rose)', marginBottom: '8px' }}>
              Approval Token Invalid or Expired
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
              {error}
            </p>
          </div>
        ) : (
          <div>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-emerald)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <CheckCircle size={24} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-emerald)', marginBottom: '8px' }}>
              Approval Action Recorded!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '16px' }}>
              {result}
            </p>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Audit trail logged with timestamp. Single-use token invalidated.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
