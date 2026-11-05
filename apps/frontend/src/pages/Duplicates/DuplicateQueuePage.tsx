import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, X, Clock } from 'lucide-react';
import { api } from '../../api/client.js';
import { Vacancy } from '../../types/index.js';
import { Badge } from '../../components/Badge.js';
import { useToast } from '../../context/ToastContext.js';

export const DuplicateQueuePage: React.FC = () => {
  const toast = useToast();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const [pendingIngest, flaggedDupes] = await Promise.all([
        api.get<Vacancy[]>('/vacancies?status=PENDING_INGEST_REVIEW').catch(() => []),
        api.get<Vacancy[]>('/vacancies?status=DRAFT_DUPLICATE_FLAG').catch(() => []),
      ]);
      setVacancies([...pendingIngest, ...flaggedDupes]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'PM Ingest Review Queue | Recruitment OS';
    loadQueue();
  }, []);

  const handleIngestDecision = async (vacancyId: string, decision: 'SAME' | 'DIFFERENT_APPROVE') => {
    try {
      const res: any = await api.post('/vacancies/ingest-decision', { vacancyId, decision });
      toast.success(res.message, decision === 'SAME' ? 'Duplicate Removed' : 'Vacancy Activated');
      loadQueue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process PM ingest decision', 'Ingest Review Error');
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Unified PM Ingest Approval & Deduplication Queue</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          Review ingested requisitions, evaluate composite duplicate flags <code>[Project + Title + Zone + Area]</code>, and authorize Auto-ID assignment
        </p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Loading PM ingest queue...</div>
      ) : vacancies.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
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
            <Check size={24} />
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: '700' }}>PM Ingest Queue Clear</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            No pending vacancies or duplicate flags requiring PM authorization.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {vacancies.map((vac) => {
            const isDuplicateFlagged = vac.status === 'DRAFT_DUPLICATE_FLAG';

            return (
              <div
                key={vac.id}
                className="glass-card"
                style={{
                  border: isDuplicateFlagged ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid var(--border-subtle)',
                  backgroundColor: isDuplicateFlagged ? 'rgba(17, 24, 39, 0.85)' : 'var(--bg-surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isDuplicateFlagged ? (
                      <AlertTriangle size={18} color="#c084fc" />
                    ) : (
                      <Clock size={18} color="#818cf8" />
                    )}
                    <span style={{ fontSize: '13px', fontWeight: '700', color: isDuplicateFlagged ? '#c084fc' : '#818cf8' }}>
                      {isDuplicateFlagged ? 'Composite Key Duplicate Flagged' : 'Pending PM Ingest Approval'}
                    </span>
                  </div>
                  <Badge status={vac.status} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Project</div>
                    <strong style={{ fontSize: '15px' }}>{vac.project?.name || 'Project'} ({vac.project?.code})</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Job Title & Details</div>
                    <strong style={{ fontSize: '15px' }}>{vac.title}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {vac.salary || 'Compensation TBD'} • {vac.experience || 'Experience TBD'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Zone & Area Location</div>
                    <strong style={{ fontSize: '15px' }}>{vac.zone} Zone — {vac.area}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    PM Action Required: Validate requisition and authorize Auto Vacancy ID generation.
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleIngestDecision(vac.id, 'SAME')}
                      title="Delete upload without consuming Auto Vacancy ID"
                    >
                      <X size={14} />
                      <span>SAME (Delete Duplicate)</span>
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleIngestDecision(vac.id, 'DIFFERENT_APPROVE')}
                      title="Generate Auto Vacancy ID (UI001), flip status to ACTIVE, and route to Zone Recruiter"
                    >
                      <Check size={14} />
                      <span>DIFFERENT & APPROVE (Activate)</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
