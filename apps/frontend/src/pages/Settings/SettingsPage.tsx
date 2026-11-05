import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, UserPlus, Link2 } from 'lucide-react';
import { api } from '../../api/client.js';
import { User, Role } from '../../types/index.js';
import { Modal } from '../../components/Modal.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';

export const SettingsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // User Creation Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    roleId: '',
    zone: 'North',
  });

  // Assign Projects Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPmUser, setSelectedPmUser] = useState<User | null>(null);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData, healthData, vacData] = await Promise.all([
        api.get<User[]>('/users'),
        api.get<Role[]>('/users/roles').catch(() => []),
        api.get<any>('/health').catch(() => null),
        api.get<any[]>('/vacancies').catch(() => []),
      ]);

      setUsers(usersData);
      setRoles(rolesData);
      setHealth(healthData);

      // Extract unique projects
      const pMap = new Map<string, any>();
      vacData.forEach((v) => {
        if (v.project) pMap.set(v.project.id, v.project);
      });
      usersData.forEach((u) => {
        u.projectAssignments?.forEach((pa) => {
          if (pa.project) pMap.set(pa.project.id, pa.project);
        });
      });
      setAvailableProjects(Array.from(pMap.values()));

      if (rolesData.length > 0 && !createForm.roleId) {
        setCreateForm((prev) => ({ ...prev, roleId: rolesData[0].id }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Governance & Users | Recruitment OS';
    loadData();
  }, []);

  const handleToggleStatus = async (userId: string, currentActive: boolean) => {
    try {
      await api.patch(`/users/${userId}/status`, { isActive: !currentActive });
      toast.success(`User successfully ${currentActive ? 'deactivated' : 'activated'}.`, 'Status Updated');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user status', 'Update Failed');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', createForm);
      toast.success('User created successfully!', 'User Created');
      setIsCreateModalOpen(false);
      setCreateForm({ firstName: '', lastName: '', email: '', password: '', roleId: roles[0]?.id || '', zone: 'North' });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user', 'Creation Failed');
    }
  };

  const openAssignProjects = (u: User) => {
    setSelectedPmUser(u);
    const existing = u.projectAssignments?.map((pa) => pa.projectId) || [];
    setSelectedProjectIds(existing);
    setIsAssignModalOpen(true);
  };

  const handleSaveProjectAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPmUser) return;
    try {
      await api.post('/users/assign-projects', {
        userId: selectedPmUser.id,
        projectIds: selectedProjectIds,
      });
      toast.success('Project assignments saved successfully!', 'Assignments Saved');
      setIsAssignModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save project assignments', 'Save Failed');
    }
  };

  const toggleProjectSelection = (pId: string) => {
    if (selectedProjectIds.includes(pId)) {
      setSelectedProjectIds(selectedProjectIds.filter((id) => id !== pId));
    } else {
      setSelectedProjectIds([...selectedProjectIds, pId]);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Enterprise Hierarchy & System Governance</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Manage Users across tiers (Owner, Super Manager, PM, Recruiter) & configure Many-to-Many Project assignments
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
          <UserPlus size={16} />
          <span>+ Add User</span>
        </button>
      </div>

      {/* Infrastructure Health Status */}
      {health && (
        <div className="glass-card" style={{ marginBottom: '28px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={20} color="#34d399" />
            <div>
              <strong style={{ color: '#34d399', fontSize: '14px' }}>System Status: Healthy</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '10px' }}>
                Uptime: {health.uptimeSeconds}s • Database: SQLite Connected • Redis Worker: Fallback Ready
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Enterprise Users Table */}
      <div className="glass-card">
        <h3 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '16px' }}>Enterprise Directory ({users.length} Users)</h3>

        {loading ? (
          <div style={{ color: 'var(--text-secondary)' }}>Loading directory...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User & Contact</th>
                  <th>System Role</th>
                  <th>Zone / Territory</th>
                  <th>Many-to-Many Mappings</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const roleName = u.role?.name || 'USER';
                  const isPM = roleName === 'PM';
                  const isSuperManager = roleName === 'SUPER_MANAGER';

                  return (
                    <tr key={u.id}>
                      <td>
                        <strong style={{ fontSize: '14px' }}>
                          {u.firstName} {u.lastName}
                        </strong>
                        <div>
                          <a href={`mailto:${u.email}`} style={{ fontSize: '12px', color: '#38bdf8', textDecoration: 'none' }}>
                            {u.email}
                          </a>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor:
                              roleName === 'ADMIN'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : roleName === 'OWNER'
                                ? 'rgba(245, 158, 11, 0.15)'
                                : roleName === 'SUPER_MANAGER'
                                ? 'rgba(168, 85, 247, 0.15)'
                                : roleName === 'PM'
                                ? 'rgba(56, 189, 248, 0.15)'
                                : 'rgba(16, 185, 129, 0.15)',
                            color:
                              roleName === 'ADMIN'
                                ? '#f87171'
                                : roleName === 'OWNER'
                                ? '#fbbf24'
                                : roleName === 'SUPER_MANAGER'
                                ? '#c084fc'
                                : roleName === 'PM'
                                ? '#38bdf8'
                                : '#34d399',
                          }}
                        >
                          {roleName}
                        </span>
                      </td>

                      <td>{u.zone ? `📍 ${u.zone} Zone` : <span style={{ color: 'var(--text-muted)' }}>Global</span>}</td>

                      <td>
                        {isPM && (
                          <div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                              {u.projectAssignments && u.projectAssignments.length > 0 ? (
                                u.projectAssignments.map((pa) => (
                                  <span
                                    key={pa.projectId}
                                    style={{
                                      fontSize: '10px',
                                      backgroundColor: 'rgba(255,255,255,0.06)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      color: '#38bdf8',
                                    }}
                                  >
                                    {pa.project?.name || 'Project'}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No projects assigned</span>
                              )}
                            </div>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '10px', padding: '2px 6px' }}
                              onClick={() => openAssignProjects(u)}
                            >
                              <Link2 size={10} />
                              <span>Map Projects</span>
                            </button>
                          </div>
                        )}

                        {isSuperManager && (
                          <div style={{ fontSize: '12px', color: '#c084fc' }}>
                            Supervising {u.supervisingPMs?.length || 0} Project Managers
                          </div>
                        )}

                        {!isPM && !isSuperManager && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td>
                        {u.isActive ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-emerald)', fontSize: '12px' }}>
                            <CheckCircle size={14} />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-rose)', fontSize: '12px' }}>
                            <XCircle size={14} />
                            <span>Disabled</span>
                          </span>
                        )}
                      </td>

                      <td>
                        {currentUser?.id !== u.id && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleToggleStatus(u.id, !!u.isActive)}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Create User */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Provision New Enterprise Account">
        <form onSubmit={handleCreateUser}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input
                type="text"
                required
                className="form-input"
                value={createForm.firstName}
                onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input
                type="text"
                required
                className="form-input"
                value={createForm.lastName}
                onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address (User ID)</label>
            <input
              type="email"
              required
              className="form-input"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="user@recruitment.local"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              required
              minLength={8}
              className="form-input"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="Min 8 characters"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">System Role</label>
              <select
                className="form-select"
                value={createForm.roleId}
                onChange={(e) => setCreateForm({ ...createForm, roleId: e.target.value })}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Zone Territory (For Recruiters)</label>
              <select
                className="form-select"
                value={createForm.zone}
                onChange={(e) => setCreateForm({ ...createForm, zone: e.target.value })}
              >
                <option value="North">North Zone</option>
                <option value="South">South Zone</option>
                <option value="East">East Zone</option>
                <option value="West">West Zone</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Many-to-Many Assign Projects to PM */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Map Projects for ${selectedPmUser?.firstName} ${selectedPmUser?.lastName}`}
      >
        <form onSubmit={handleSaveProjectAssignments}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Select the client projects managed by this Project Manager (Many-to-Many):
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {availableProjects.map((p) => {
              const isChecked = selectedProjectIds.includes(p.id);
              return (
                <label
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: isChecked ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.02)',
                    border: isChecked ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleProjectSelection(p.id)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <div>
                    <strong style={{ fontSize: '14px', color: isChecked ? '#38bdf8' : 'var(--text-primary)' }}>
                      {p.name} ({p.code})
                    </strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Default ASM: {p.asmEmail}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Assignments
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
