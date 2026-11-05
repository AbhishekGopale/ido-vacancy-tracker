import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { XCircle, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../../api/client.js';

export const RejectionWebFormPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') || '';
  const vacancyCode = searchParams.get('vacancyCode') || 'Requisition';
  const paramCheckingId = searchParams.get('checkingId') || '';

  const [submissionInfo, setSubmissionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string>(paramCheckingId);

  const [rejectionReason, setRejectionReason] = useState('SALARY_MISMATCH');
  const [comments, setComments] = useState('');

  useEffect(() => {
    document.title = 'Rejection Feedback | Recruitment OS';
    async function validateToken() {
      if (!token) {
        setError('Missing approval token. Please check your email link.');
        setLoading(false);
        return;
      }

      try {
        const res: any = await api.get(`/submissions/approve-token?token=${token}`);
        setSubmissionInfo(res);
        if (res.checkingId) {
          setCheckingId(res.checkingId);
        }
      } catch (err: any) {
        setError(err.message || 'Link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    }
    validateToken();
  }, [token]);

  const handleConfirmRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res: any = await api.post('/submissions/process-action', {
        token,
        action: 'REJECTED',
        rejectionReason,
        comments,
      });

      setSuccess(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to process rejection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top right, rgba(255, 105, 180, 0.08), transparent 45%), radial-gradient(circle at bottom left, rgba(6, 148, 148, 0.08), transparent 45%), #f8fafc',
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
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            className="brand-icon"
            style={{ width: '48px', height: '48px', margin: '0 auto 16px auto', borderRadius: '12px', background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}
          >
            <XCircle size={24} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '800' }}>Confirm Candidate Rejection</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Requisition Code: <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{vacancyCode}</strong>
          </p>
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
                marginTop: '10px',
              }}
            >
              Checking ID: {checkingId}
            </div>
          )}
        </div>

        {/* Transmission & Reviewer Metadata */}
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '12px',
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

        {error && (
          <div
            style={{
              backgroundColor: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: '8px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              color: 'var(--accent-rose)',
              fontSize: '13px',
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Rejection Action Error:</strong>
              <div style={{ marginTop: '2px' }}>{error}</div>
            </div>
          </div>
        )}

        {success ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
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
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Rejection Processed & Audit Logged
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', marginBottom: '20px' }}>
              {success}
            </p>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              🔄 Vacancy status has automatically reset back to <strong>ACTIVE</strong> on the Zone Recruiter&apos;s dashboard. An alert has been queued to source a replacement candidate.
            </div>
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
            Validating single-use approval token...
          </div>
        ) : (
          <form onSubmit={handleConfirmRejection}>
            {submissionInfo?.submission && (
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  fontSize: '13px',
                }}
              >
                <div style={{ fontWeight: '700', fontSize: '15px' }}>
                  Candidate: {submissionInfo.submission.fullName}
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Position: {submissionInfo.submission.vacancy.title} ({submissionInfo.submission.vacancy.zone} Zone)
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                  Reviewing at Level {submissionInfo.level}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Structured Rejection Reason (Mandatory)</label>
              <select
                className="form-select"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              >
                <option value="SALARY_MISMATCH">Compensation / Salary Mismatch</option>
                <option value="EXPERIENCE_LACK">Insufficient Relevant Experience</option>
                <option value="LOCATION_UNWILLING">Unwilling to Relocate to Assigned Zone/Area</option>
                <option value="SKILL_GAP">Technical / Domain Skill Gap</option>
                <option value="CULTURE_FIT">Organization / Cultural Misalignment</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Reviewer Comments (Optional)</label>
              <textarea
                rows={3}
                className="form-textarea"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Provide feedback for the Zone Recruiter to assist in sourcing a replacement candidate..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-danger"
              style={{ width: '100%', marginTop: '12px', padding: '12px' }}
            >
              {submitting ? 'Processing Rejection...' : 'Confirm Rejection & Reset Vacancy to Active'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
