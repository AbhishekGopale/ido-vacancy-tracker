import React from 'react';

interface BadgeProps {
  status: string;
  level?: number;
}

export const Badge: React.FC<BadgeProps> = ({ status, level = 1 }) => {
  if (status === 'PENDING_INGEST_REVIEW') {
    return (
      <span className="badge badge-applied" style={{ backgroundColor: 'rgba(6, 148, 148, 0.12)', color: '#067a7a', border: '1px solid rgba(6, 148, 148, 0.35)' }}>
        ⏳ Pending Ingest Review
      </span>
    );
  }

  if (status === 'ACTIVE') {
    return (
      <span className="badge badge-open" style={{ backgroundColor: 'rgba(0, 240, 255, 0.16)', color: '#088395', border: '1px solid rgba(0, 240, 255, 0.45)' }}>
        ● Active (Sourcing Required)
      </span>
    );
  }

  if (status === 'PENDING_APPROVAL') {
    const levelLabel = level === 1 ? 'Level 1: PM' : level === 2 ? 'Level 2: ASM' : 'Level 3: RSM';
    return (
      <span className="badge badge-interview" style={{ backgroundColor: 'rgba(245, 158, 11, 0.14)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
        ⏳ Pending Approval ({levelLabel})
      </span>
    );
  }

  if (status === 'FILLED') {
    return (
      <span className="badge badge-hired" style={{ backgroundColor: 'rgba(16, 185, 129, 0.14)', color: '#047857', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
        ✓ Filled / Hired
      </span>
    );
  }

  if (status === 'DRAFT_DUPLICATE_FLAG') {
    return (
      <span className="badge badge-rejected" style={{ backgroundColor: 'rgba(255, 105, 180, 0.16)', color: '#be185d', border: '1px solid rgba(255, 105, 180, 0.4)' }}>
        ⚠️ Composite Duplicate Flagged
      </span>
    );
  }

  if (status === 'CANCELLED') {
    return (
      <span className="badge badge-closed" style={{ backgroundColor: 'rgba(100, 116, 139, 0.12)', color: '#475569', border: '1px solid rgba(100, 116, 139, 0.3)' }}>
        ✕ Cancelled
      </span>
    );
  }

  return <span className="badge badge-applied">{status}</span>;
};
