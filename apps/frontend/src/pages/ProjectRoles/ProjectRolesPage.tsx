import React, { useState, useEffect } from 'react';
import { Plus, Clock, ShieldCheck, Zap } from 'lucide-react';
import { api } from '../../api/client.js';
import { Project, ProjectRole } from '../../types/index.js';
import { Modal } from '../../components/Modal.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';

export const ProjectRolesPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [projectRoles, setProjectRoles] = useState<ProjectRole[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    projectId: '',
    baseRoleId: '',
    title: '',
    salary: '',
    experience: '',
    description: '',
    targetDaysToFill: 2,
    approvalLevelsCount: 2,
    defaultL1Email: user?.email || 'divya@idonneous.com',
    defaultL2Email: 'divya@idonneous.com',
    defaultL3Email: 'divya@idonneous.com',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [prData, projectsData] = await Promise.all([
        api.get<ProjectRole[]>('/project-roles'),
        api.get<Project[]>('/projects').catch(() => []),
      ]);

      setProjectRoles(prData);
      setProjects(projectsData);
      if (projectsData.length > 0 && !form.projectId) {
        setForm((prev) => ({
          ...prev,
          projectId: projectsData[0].id,
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Project Roles & SLA | Recruitment OS';
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        projectId: form.projectId,
        title: form.title.trim(),
        salary: form.salary.trim() || undefined,
        experience: form.experience.trim() || undefined,
        description: form.description.trim() || undefined,
        targetDaysToFill: Number(form.targetDaysToFill) || 2,
        approvalLevelsCount: Number(form.approvalLevelsCount),
      };

      if (form.approvalLevelsCount === 1) {
        payload.defaultL2Email = form.defaultL2Email.trim() || 'divya@idonneous.com';
      } else if (form.approvalLevelsCount === 2) {
        payload.defaultL1Email = form.defaultL1Email.trim() || user?.email || 'divya@idonneous.com';
        payload.defaultL2Email = form.defaultL2Email.trim() || 'divya@idonneous.com';
      } else if (form.approvalLevelsCount === 3) {
        payload.defaultL1Email = form.defaultL1Email.trim() || user?.email || 'divya@idonneous.com';
        payload.defaultL2Email = form.defaultL2Email.trim() || 'divya@idonneous.com';
        payload.defaultL3Email = form.defaultL3Email.trim() || 'divya@idonneous.com';
      }

      const res: any = await api.post('/project-roles', payload);
      toast.success(res.message, 'Role Created');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project role configuration.', 'Creation Failed');
    }
  };

  const getTierLabel = (count?: number) => {
    if (count === 0) return '⚡ No Approval (Direct Hire)';
    if (count === 1) return '1 Level (Area Manager)';
    if (count === 2) return '2 Levels (PM + Area Manager)';
    if (count === 3) return '3 Levels (PM + ASM + RSM)';
    return `${count || 2} Levels`;
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Dynamic Project Roles & SLA Configuration</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            PM Step 1 Setup: Configure 100% dynamic role titles, target SLA days, and flexible approval tiers (None, 1, 2, or 3)
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          <span>+ Add Project Role</span>
        </button>
      </div>

      {/* Dynamic Project Roles Grid */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '16px' }}>Configured Project Roles</h3>

        {loading ? (
          <div style={{ color: 'var(--text-secondary)' }}>Loading project roles...</div>
        ) : projectRoles.length === 0 ? (
          <div className="glass-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No project roles configured yet. Click &quot;+ Add Project Role&quot; to create one.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
            {projectRoles.map((pr) => (
              <div
                key={pr.id}
                className="glass-card"
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: 'var(--primary)',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      {pr.project?.name || 'Project'} ({pr.project?.code})
                    </span>

                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#fbbf24',
                        backgroundColor: 'rgba(251, 191, 36, 0.15)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      <Clock size={12} />
                      <span>SLA: {pr.targetDaysToFill || 2} Days</span>
                    </span>
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)' }}>{pr.title}</h3>

                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.4' }}>
                    {pr.description || 'Standard field retail operations and customer engagement.'}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(56, 189, 248, 0.12)',
                        color: '#38bdf8',
                        fontWeight: '600',
                      }}
                    >
                      💰 {pr.salary || 'Compensation TBD'}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(168, 85, 247, 0.12)',
                        color: '#c084fc',
                        fontWeight: '600',
                      }}
                    >
                      🎓 {pr.experience || 'Entry Level'}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingTop: '12px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: pr.approvalLevelsCount === 0 ? '#34d399' : '#38bdf8' }}>
                    <ShieldCheck size={13} />
                    <strong>{getTierLabel(pr.approvalLevelsCount)}</strong>
                  </div>
                  {pr.approvalLevelsCount !== 0 && (
                    <div style={{ marginTop: '4px' }}>
                      Reviewer: {pr.defaultL2Email || pr.asmEmail || 'abhishek.gopale@idonneous.com'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create Dynamic Project Role */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Configure Dynamic Project Role">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Client Project</label>
            <select
              className="form-select"
              required
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Job Position Title (100% Free-Text)</label>
            <input
              type="text"
              required
              className="form-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Beverage Brand Promoter, In-Store F-Promoter, Merchandiser"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Standard Compensation / Salary (₹ / INR)</label>
              <input
                type="text"
                className="form-input"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                placeholder="e.g. ₹25,000 - ₹35,000 / month"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Required Experience</label>
              <input
                type="text"
                className="form-input"
                value={form.experience}
                onChange={(e) => setForm({ ...form, experience: e.target.value })}
                placeholder="e.g. 1-2 Years Field FMCG"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Target Days to Fill (SLA)</label>
              <input
                type="number"
                min={1}
                max={30}
                required
                className="form-input"
                value={form.targetDaysToFill}
                onChange={(e) => setForm({ ...form, targetDaysToFill: Number(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Approval Tiers (None, 1, 2, or 3)</label>
              <select
                className="form-select"
                value={form.approvalLevelsCount}
                onChange={(e) => setForm({ ...form, approvalLevelsCount: Number(e.target.value) })}
              >
                <option value={0}>⚡ No Approval (Direct Hire / Auto-Approved)</option>
                <option value={1}>1 Level (Area Manager / ASM)</option>
                <option value={2}>2 Levels (PM + Area Manager)</option>
                <option value={3}>3 Levels (PM + Area Manager + Regional Manager)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Job Description</label>
            <textarea
              rows={3}
              className="form-textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detailed description of ground responsibilities..."
            />
          </div>

          {/* DYNAMIC APPROVAL REVIEWERS SECTION */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', marginTop: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px', color: '#38bdf8' }}>
              Reviewer Escalation Path ({getTierLabel(form.approvalLevelsCount)})
            </div>

            {form.approvalLevelsCount === 0 && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Zap size={18} />
                <span>
                  <strong>Direct Hire Mode:</strong> Candidates submitted for this role are immediately hired and marked as <strong>FILLED</strong> with zero waiting in queue!
                </span>
              </div>
            )}

            {form.approvalLevelsCount === 1 && (
              <div className="form-group">
                <label className="form-label">Level 1 Approver Email (Area Sales Manager - ASM)</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  value={form.defaultL2Email}
                  onChange={(e) => setForm({ ...form, defaultL2Email: e.target.value })}
                  placeholder="divya@idonneous.com"
                />
              </div>
            )}

            {form.approvalLevelsCount >= 2 && (
              <>
                <div className="form-group">
                  <label className="form-label">Level 1 Reviewer Email (Project Manager - PM)</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={form.defaultL1Email}
                    onChange={(e) => setForm({ ...form, defaultL1Email: e.target.value })}
                    placeholder="divya@idonneous.com"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Level 2 Reviewer Email (Area Sales Manager - ASM)</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={form.defaultL2Email}
                    onChange={(e) => setForm({ ...form, defaultL2Email: e.target.value })}
                    placeholder="divya@idonneous.com"
                  />
                </div>
              </>
            )}

            {form.approvalLevelsCount === 3 && (
              <div className="form-group">
                <label className="form-label">Level 3 Reviewer Email (Regional Sales Manager - RSM)</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  value={form.defaultL3Email}
                  onChange={(e) => setForm({ ...form, defaultL3Email: e.target.value })}
                  placeholder="divya@idonneous.com"
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Role Template
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
