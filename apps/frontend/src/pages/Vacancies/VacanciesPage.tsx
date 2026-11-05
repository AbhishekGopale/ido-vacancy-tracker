import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  UserPlus,
  CheckCircle,
  Ban,
  Trash2,
  MapPin,
  Download,
  FileSpreadsheet,
  Clock,
  AlertTriangle,
  Flame,
  User,
  Search,
  Mail,
  Phone,
  Send,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  Layers,
  ShieldCheck,
  ExternalLink,
  Info,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { Project, ProjectRole, Vacancy, RecruiterCockpitData } from '../../types/index.js';
import { Badge } from '../../components/Badge.js';
import { Modal } from '../../components/Modal.js';
import { useAuth } from '../../context/AuthContext.js';
import { RecruiterProfileModal } from '../../components/RecruiterProfileModal.js';
import { useToast } from '../../context/ToastContext.js';

const OFFICIAL_10_ZONES = [
  'West Mumbai',
  'West ROM',
  'West Gujarat',
  'South AP',
  'South KN',
  'South TG',
  'South TN',
  'East',
  'North Delhi',
  'North Punjab',
];

export const VacanciesPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    document.title = 'Vacancies & Sourcing | Recruitment OS';
  }, []);

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectRoles, setProjectRoles] = useState<ProjectRole[]>([]);
  const [cockpitData, setCockpitData] = useState<RecruiterCockpitData | null>(null);
  const [selectedFilterGroup, setSelectedFilterGroup] = useState<{
    label: string;
    vacancyIds: string[];
    color: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Expanded Vacancy Accordion IDs & Detail Modal State
  const [expandedVacancyIds, setExpandedVacancyIds] = useState<Set<string>>(new Set());
  const [detailVacancyModal, setDetailVacancyModal] = useState<Vacancy | null>(null);

  const toggleExpandVacancy = (id: string) => {
    setExpandedVacancyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Tabs: NEED_ATTENTION | IN_PROCESS | COMPLETED | ALL (synced with URL ?tab=...)
  const tabFromUrl = searchParams.get('tab') as 'NEED_ATTENTION' | 'IN_PROCESS' | 'COMPLETED' | 'ALL' | null;
  const [activeTab, setActiveTab] = useState<'NEED_ATTENTION' | 'IN_PROCESS' | 'COMPLETED' | 'ALL'>(
    tabFromUrl && ['NEED_ATTENTION', 'IN_PROCESS', 'COMPLETED', 'ALL'].includes(tabFromUrl)
      ? tabFromUrl
      : 'NEED_ATTENTION'
  );

  useEffect(() => {
    const t = searchParams.get('tab') as any;
    if (t && ['NEED_ATTENTION', 'IN_PROCESS', 'COMPLETED', 'ALL'].includes(t)) {
      setActiveTab(t);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'NEED_ATTENTION' | 'IN_PROCESS' | 'COMPLETED' | 'ALL') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Filters
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('due_soonest');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isBulkCsvModalOpen, setIsBulkCsvModalOpen] = useState(false);
  const [isSubmitCandidateModalOpen, setIsSubmitCandidateModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);

  // Ingest Single Vacancy Form
  const [ingestForm, setIngestForm] = useState({
    projectId: '',
    projectRoleId: '',
    title: '',
    zone: user?.zone || 'West Mumbai',
    area: '',
    salary: '',
    experience: '',
    targetDaysToFill: 2,
    approverL1Email: '',
    approverL2Email: '',
    approverL3Email: '',
  });
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');

  // Bulk CSV Upload State
  const [csvText, setCsvText] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvUploading, setCsvUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<Array<{
    rowNumber: number;
    projectCode?: string;
    zone?: string;
    city?: string;
    area?: string;
    locationName?: string;
    storeType?: string;
    jobTitle?: string;
    errorReason: string;
    raw?: any;
  }> | null>(null);
  const [uploadStats, setUploadStats] = useState<{
    total: number;
    success: number;
    duplicate: number;
    error: number;
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [showRawCsvText, setShowRawCsvText] = useState(false);

  // Vacancy Feed Pagination State
  const [vacCurrentPage, setVacCurrentPage] = useState<number>(1);
  const [vacPageSize, setVacPageSize] = useState<number>(12);

  // Candidate Submission Form (Single-Candidate Constraint)
  const [candidateForm, setCandidateForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    resumeId: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (zoneFilter !== 'ALL') query.set('zone', zoneFilter);
      if (urgencyFilter !== 'ALL') query.set('urgency', urgencyFilter);
      if (projectFilter !== 'ALL') query.set('projectId', projectFilter);
      if (sortOrder) query.set('sort', sortOrder);

      const [vacData, prData, projectsData, cockpitRes] = await Promise.all([
        api.get<Vacancy[]>(`/vacancies?${query.toString()}`),
        api.get<ProjectRole[]>('/project-roles').catch(() => []),
        api.get<Project[]>('/projects').catch(() => []),
        api.get<RecruiterCockpitData>('/reports/recruiter-cockpit').catch(() => null),
      ]);

      setVacancies(vacData);
      setProjectRoles(prData);
      setProjects(projectsData);
      if (cockpitRes) setCockpitData(cockpitRes);

      if (projectsData.length > 0 && !ingestForm.projectId) {
        setIngestForm((prev) => ({ ...prev, projectId: projectsData[0].id }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [zoneFilter, urgencyFilter, sortOrder, projectFilter]);

  const urlVacancyId = searchParams.get('vacancyId');

  useEffect(() => {
    const targetId = searchParams.get('vacancyId');
    if (targetId) {
      setActiveTab('ALL');
      setExpandedVacancyIds((prev) => new Set([...prev, targetId]));
    }
  }, [searchParams]);

  // Tab Counts
  const countNeedAttention = vacancies.filter((v) => v.status === 'ACTIVE').length;
  const countInProcess = vacancies.filter((v) => v.status === 'PENDING_APPROVAL').length;
  const countCompleted = vacancies.filter((v) => v.status === 'FILLED').length;

  // Filtered Vacancies according to Tab, Drill-Down & Search
  const displayVacancies = vacancies.filter((vac) => {
    // 1. Direct Target Vacancy from URL (Matrix Drill-Down)
    if (urlVacancyId && vac.id !== urlVacancyId) return false;

    // 2. Interactive Recruiter Metric Drill-Down Filter
    if (selectedFilterGroup && !selectedFilterGroup.vacancyIds.includes(vac.id)) return false;

    // 3. Tab Status Filtering (Skipped if drilled down on specific metric or ID)
    if (!urlVacancyId && !selectedFilterGroup) {
      if (activeTab === 'NEED_ATTENTION' && vac.status !== 'ACTIVE') return false;
      if (activeTab === 'IN_PROCESS' && vac.status !== 'PENDING_APPROVAL') return false;
      if (activeTab === 'COMPLETED' && vac.status !== 'FILLED') return false;
    }
    if (projectFilter !== 'ALL' && vac.projectId !== projectFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = vac.title.toLowerCase().includes(q);
      const matchArea = vac.area.toLowerCase().includes(q);
      const matchCode = (vac.vacancyCode || '').toLowerCase().includes(q);
      const matchProject = (vac.project?.name || '').toLowerCase().includes(q);
      return matchTitle || matchArea || matchCode || matchProject;
    }
    return true;
  });

  // Pagination calculation for vacancies
  const vacTotalPages = Math.max(1, Math.ceil(displayVacancies.length / vacPageSize));
  const pagedVacancies = displayVacancies.slice(
    (vacCurrentPage - 1) * vacPageSize,
    vacCurrentPage * vacPageSize
  );

  useEffect(() => {
    setVacCurrentPage(1);
  }, [activeTab, projectFilter, zoneFilter, urgencyFilter, searchQuery]);

  // Ingest Single Vacancy Handler
  const handleIngestSingleVacancy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        ...ingestForm,
        approverL1Email: ingestForm.approverL1Email.trim() || undefined,
        approverL2Email: ingestForm.approverL2Email.trim() || undefined,
        approverL3Email: ingestForm.approverL3Email.trim() || undefined,
        projectRoleId: ingestForm.projectRoleId || undefined,
        salary: ingestForm.salary.trim() || undefined,
        experience: ingestForm.experience.trim() || undefined,
      };
      const res: any = await api.post('/vacancies/single', payload);
      toast.success(res.message, 'Vacancy Ingested');
      setIsIngestModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to ingest vacancy', 'Ingest Failed');
    }
  };

  // Handle File Selected for Bulk CSV
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvFileName(file.name);
    setUploadErrors(null);
    setUploadStats(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content || '');
    };
    reader.readAsText(file);
  };

  // Helper to parse CSV line handling quotes
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Bulk CSV Upload Handler
  const handleBulkCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) {
      toast.error('Please select a CSV file or paste CSV rows.', 'Missing CSV Data');
      return;
    }

    try {
      setCsvUploading(true);
      setUploadErrors(null);
      setUploadStats(null);

      const lines = csvText.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        toast.error('The CSV must contain a header row and at least one data row.', 'Empty CSV');
        setCsvUploading(false);
        return;
      }

      const headerCols = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
      const isNewFormat = headerCols.some((h) => h.includes('location') || h.includes('store_type') || (headerCols.length >= 2 && headerCols[1].includes('zone')));

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

        if (isNewFormat || cols.length >= 6) {
          // Canonical 17-column format:
          rows.push({
            projectCode: cols[0] || '',
            zone: cols[1] || '',
            city: cols[2] || '',
            area: cols[3] || '',
            locationName: cols[4] || '',
            storeType: cols[5] || '',
            vacancyType: cols[6] || 'REGULAR',
            positionsCount: cols[7] ? Number(cols[7]) : 1,
            jobTitle: cols[8] || 'Brand Promoter',
            storeCode: cols[9] || undefined,
            storeChain: cols[10] || undefined,
            salary: cols[11] || '',
            experience: cols[12] || '',
            targetDaysToFill: cols[13] ? Number(cols[13]) : 2,
            approverL1Email: cols[14] || undefined,
            approverL2Email: cols[15] || undefined,
            approverL3Email: cols[16] || undefined,
          });
        } else {
          // Legacy format fallback:
          rows.push({
            projectCode: cols[0],
            jobTitle: cols[1],
            zone: cols[2],
            city: '',
            area: cols[3],
            locationName: cols[3],
            storeType: 'MT',
            vacancyType: 'REGULAR',
            positionsCount: 1,
            salary: cols[4] || '',
            experience: cols[5] || '',
            targetDaysToFill: cols[6] ? Number(cols[6]) : 2,
            approverL1Email: cols[7] || undefined,
            approverL2Email: cols[8] || undefined,
            approverL3Email: cols[9] || undefined,
          });
        }
      }

      const res: any = await api.post('/vacancies/bulk-csv', { rows });

      const totalCount = (res.count || 0) + (res.duplicateCount || 0) + (res.errorCount || 0);
      setUploadStats({
        total: totalCount,
        success: res.count || 0,
        duplicate: res.duplicateCount || 0,
        error: res.errorCount || 0,
      });

      if (res.errorRows && res.errorRows.length > 0) {
        setUploadErrors(res.errorRows);
        toast.error(`Processed with ${res.errorCount} error(s). Please review errors or download the Error Sheet.`, 'Upload Incomplete');
      } else {
        toast.success(res.message || `Successfully uploaded ${res.count} vacancies!`, 'CSV Upload Complete');
        setIsBulkCsvModalOpen(false);
        setCsvText('');
        setCsvFile(null);
        setCsvFileName('');
      }

      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Bulk CSV upload failed', 'Upload Failed');
    } finally {
      setCsvUploading(false);
    }
  };

  // Download Error Sheet with error reasons
  const handleDownloadErrorSheet = () => {
    if (!uploadErrors || uploadErrors.length === 0) return;
    const headers = [
      'Row_Number',
      'Project_Code',
      'Zone',
      'City',
      'Area',
      'Location_Name',
      'Store_Type',
      'Job_Title',
      'Error_Reason',
    ];
    const csvLines = [headers.join(',')];
    for (const err of uploadErrors) {
      csvLines.push([
        err.rowNumber,
        `"${(err.projectCode || '').replace(/"/g, '""')}"`,
        `"${(err.zone || '').replace(/"/g, '""')}"`,
        `"${(err.city || '').replace(/"/g, '""')}"`,
        `"${(err.area || '').replace(/"/g, '""')}"`,
        `"${(err.locationName || '').replace(/"/g, '""')}"`,
        `"${(err.storeType || '').replace(/"/g, '""')}"`,
        `"${(err.jobTitle || '').replace(/"/g, '""')}"`,
        `"${(err.errorReason || '').replace(/"/g, '""')}"`,
      ].join(','));
    }
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `upload_errors_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Sample CSV Template
  const handleDownloadSampleCsv = () => {
    window.open('/api/v1/vacancies/csv-template', '_blank');
  };

  // Single-Candidate Upload Handler (At least one contact method required: email or phone)
  const handleSubmitCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVacancy) return;

    const fullName = candidateForm.fullName.trim();
    const cleanEmail = candidateForm.email.trim();
    const cleanPhone = candidateForm.phone.trim();

    if (!fullName) {
      toast.error('Candidate Full Name is required.', 'Missing Name');
      return;
    }

    if (!cleanEmail && !cleanPhone) {
      toast.error('At least one contact method is required: Please provide either an Email Address OR a Phone Number.', 'Missing Contact Method');
      return;
    }

    try {
      const res: any = await api.post('/submissions', {
        vacancyId: selectedVacancy.id,
        fullName,
        email: cleanEmail || undefined,
        phone: cleanPhone || undefined,
        resumeId: candidateForm.resumeId.trim() || null,
      });

      toast.success(res.message, 'Candidate Submitted');
      setIsSubmitCandidateModalOpen(false);
      setCandidateForm({ fullName: '', email: '', phone: '', resumeId: '' });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Submission blocked', 'Submission Blocked');
    }
  };

  // Master PM Overrides
  const handleOverrideCancel = async (vacancyId: string) => {
    if (!window.confirm('Master Override: Cancel this requisition?')) return;
    try {
      await api.post('/overrides/cancel', { vacancyId });
      toast.success('Requisition cancelled successfully.', 'Override Applied');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Override failed', 'Action Failed');
    }
  };

  const handleOverrideForceFill = async (vacancyId: string) => {
    if (!window.confirm('Master Override: Force Mark Filled for this requisition?')) return;
    try {
      await api.post('/overrides/force-fill', { vacancyId });
      toast.success('Requisition marked as filled.', 'Override Applied');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Override failed', 'Action Failed');
    }
  };

  const handleOverrideDelete = async (vacancyId: string) => {
    if (!window.confirm('Master Override: Permanently DELETE this requisition?')) return;
    try {
      await api.delete(`/overrides/${vacancyId}`);
      toast.success('Requisition permanently deleted.', 'Override Applied');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Override failed', 'Action Failed');
    }
  };

  // Calculate Urgency Countdown Status
  const getUrgencyBadge = (targetDueDate?: string | null) => {
    if (!targetDueDate) return null;
    const now = new Date().getTime();
    const due = new Date(targetDueDate).getTime();
    const diffHours = Math.round((due - now) / (1000 * 60 * 60));

    if (diffHours < 0) {
      const daysOverdue = Math.abs(Math.round(diffHours / 24)) || 1;
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'rgba(255, 105, 180, 0.14)',
            color: '#be185d',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            border: '1px solid rgba(255, 105, 180, 0.35)',
          }}
        >
          <AlertTriangle size={12} color="#be185d" />
          <span>SLA Overdue by {daysOverdue}d</span>
        </span>
      );
    } else if (diffHours <= 48) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'rgba(245, 158, 11, 0.14)',
            color: '#b45309',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            border: '1px solid rgba(245, 158, 11, 0.35)',
          }}
        >
          <Flame size={12} color="#b45309" />
          <span>Due Soon ({diffHours}h left)</span>
        </span>
      );
    } else {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'rgba(16, 185, 129, 0.14)',
            color: '#047857',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            border: '1px solid rgba(16, 185, 129, 0.35)',
          }}
        >
          <Clock size={12} color="#047857" />
          <span>{Math.round(diffHours / 24)}d remaining</span>
        </span>
      );
    }
  };

  const getApproverInfo = (vac: Vacancy, level: number) => {
    if (level === 1) {
      const email = vac.approverL1Email || vac.projectRole?.defaultL1Email || vac.project?.pmUser?.email || 'pm@recruitment.local';
      return { role: 'Project Manager (PM)', email, isOverride: !!vac.approverL1Email };
    }
    if (level === 2) {
      const email = vac.approverL2Email || vac.projectRole?.defaultL2Email || vac.projectRole?.asmEmail || vac.project?.asmEmail || 'asm@recruitment.local';
      return { role: 'Area Sales Manager (ASM)', email, isOverride: !!vac.approverL2Email };
    }
    if (level === 3) {
      const email = vac.approverL3Email || vac.projectRole?.defaultL3Email || vac.projectRole?.rsmEmail || vac.project?.rsmEmail || 'rsm@recruitment.local';
      return { role: 'Regional Sales Manager (RSM)', email, isOverride: !!vac.approverL3Email };
    }
    return { role: `Level ${level} Reviewer`, email: 'approver@recruitment.local', isOverride: false };
  };

  const getVacancyApprovalTiers = (vac: Vacancy) => {
    const tierCount = vac.projectRole?.approvalLevelsCount ?? 2;
    const tiers: { level: number; roleName: string; email: string; isOverride: boolean }[] = [];

    if (tierCount >= 1) {
      const info = getApproverInfo(vac, 1);
      tiers.push({ level: 1, roleName: info.role, email: info.email, isOverride: info.isOverride });
    }
    if (tierCount >= 2) {
      const info = getApproverInfo(vac, 2);
      tiers.push({ level: 2, roleName: info.role, email: info.email, isOverride: info.isOverride });
    }
    if (tierCount >= 3) {
      const info = getApproverInfo(vac, 3);
      tiers.push({ level: 3, roleName: info.role, email: info.email, isOverride: info.isOverride });
    }

    return { tierCount, tiers };
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getRelativeTime = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours < 1) {
        const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
        return `${diffMins}m ago`;
      }
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div>
      {/* Top Header & Action Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Recruiter Social Sourcing Feed</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '2px' }}>
            Instagram-style card feed • Strict 1-candidate constraint per slot • Live SLA countdown
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Recruiter Profile Trigger */}
          <button
            className="btn btn-secondary"
            onClick={() => setIsProfileModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <User size={15} />
            <span>My Profile</span>
          </button>

          {hasPermission('vacancies.create') && (
            <>
              <button className="btn btn-secondary" onClick={handleDownloadSampleCsv} title="Sample CSV Template">
                <Download size={15} />
                <span>Template</span>
              </button>
              <button className="btn btn-secondary" onClick={() => setIsBulkCsvModalOpen(true)}>
                <FileSpreadsheet size={15} />
                <span>Bulk CSV</span>
              </button>
              <button className="btn btn-primary" onClick={() => setIsIngestModalOpen(true)}>
                <Plus size={16} />
                <span>+ Ingest Slot</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 1-Click Target Vacancy Isolation Banner */}
      {urlVacancyId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            border: '1.5px solid #2563eb',
            borderRadius: '12px',
            marginBottom: '20px',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#2563eb', fontWeight: 700, fontSize: '13.5px' }}>
            <Info size={18} />
            <span>Targeting specific requisition selected from Store × Project Matrix</span>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('vacancyId');
              setSearchParams(next);
            }}
            style={{ padding: '6px 14px', fontSize: '12.5px', fontWeight: 700 }}
          >
            Show All Requisitions
          </button>
        </div>
      )}

      {/* Recruiter Live Operational Cockpit & 1-Click Drill-Down Slicers */}
      {cockpitData && (
        <div
          className="glass-card"
          style={{
            padding: '16px 20px',
            borderRadius: '14px',
            marginBottom: '20px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={16} color="var(--primary-color)" />
              <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>
                {cockpitData.assignedArea ? `📍 ${cockpitData.assignedArea} Area Operations (${cockpitData.assignedZone} Zone)` : 'National Operations'}
              </span>
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                • Dedicated Recruiter: <strong style={{ color: 'var(--text-primary)' }}>{cockpitData.recruiterName}</strong>
              </span>
            </div>

            {selectedFilterGroup && (
              <button
                onClick={() => setSelectedFilterGroup(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <span>Filtering: {selectedFilterGroup.label} ({selectedFilterGroup.vacancyIds.length})</span>
                <span>× Clear</span>
              </button>
            )}
          </div>

          {/* Clickable Quick-Filter Chips */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Click to Filter:
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedFilterGroup(null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: !selectedFilterGroup ? '1.5px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                backgroundColor: !selectedFilterGroup ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span>All Requisitions</span>
              <span style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                {cockpitData.metrics.totalAssignedPositions}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedFilterGroup?.label === 'Pending Sourcing') {
                  setSelectedFilterGroup(null);
                } else {
                  setSelectedFilterGroup({
                    label: 'Pending Sourcing',
                    vacancyIds: cockpitData.metrics.pendingSourcing.vacancyIds,
                    color: '#d97706',
                  });
                  setActiveTab('ALL');
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: selectedFilterGroup?.label === 'Pending Sourcing' ? '1.5px solid #d97706' : '1px solid var(--border-subtle)',
                backgroundColor: selectedFilterGroup?.label === 'Pending Sourcing' ? 'rgba(217, 119, 6, 0.15)' : 'var(--bg-surface)',
                color: '#d97706',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span>🔍 Sourcing Pending</span>
              <span style={{ backgroundColor: 'rgba(217, 119, 6, 0.2)', padding: '1px 6px', borderRadius: '4px' }}>
                {cockpitData.metrics.pendingSourcing.count}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedFilterGroup?.label === 'Interviews Pending') {
                  setSelectedFilterGroup(null);
                } else {
                  setSelectedFilterGroup({
                    label: 'Interviews Pending',
                    vacancyIds: cockpitData.metrics.interviewsPending.vacancyIds,
                    color: '#2563eb',
                  });
                  setActiveTab('ALL');
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: selectedFilterGroup?.label === 'Interviews Pending' ? '1.5px solid #2563eb' : '1px solid var(--border-subtle)',
                backgroundColor: selectedFilterGroup?.label === 'Interviews Pending' ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-surface)',
                color: '#2563eb',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span>📞 Interviews Pending</span>
              <span style={{ backgroundColor: 'rgba(37, 99, 235, 0.2)', padding: '1px 6px', borderRadius: '4px' }}>
                {cockpitData.metrics.interviewsPending.count}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedFilterGroup?.label === 'Approvals Pending') {
                  setSelectedFilterGroup(null);
                } else {
                  setSelectedFilterGroup({
                    label: 'Approvals Pending',
                    vacancyIds: cockpitData.metrics.approvalsPending.vacancyIds,
                    color: '#9333ea',
                  });
                  setActiveTab('ALL');
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: selectedFilterGroup?.label === 'Approvals Pending' ? '1.5px solid #9333ea' : '1px solid var(--border-subtle)',
                backgroundColor: selectedFilterGroup?.label === 'Approvals Pending' ? 'rgba(147, 51, 234, 0.15)' : 'var(--bg-surface)',
                color: '#9333ea',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span>⏳ Approvals In Flight</span>
              <span style={{ backgroundColor: 'rgba(147, 51, 234, 0.2)', padding: '1px 6px', borderRadius: '4px' }}>
                {cockpitData.metrics.approvalsPending.count}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedFilterGroup?.label === 'Joined This Month') {
                  setSelectedFilterGroup(null);
                } else {
                  setSelectedFilterGroup({
                    label: 'Joined This Month',
                    vacancyIds: cockpitData.metrics.joinedThisMonth.vacancyIds,
                    color: '#059669',
                  });
                  setActiveTab('ALL');
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: selectedFilterGroup?.label === 'Joined This Month' ? '1.5px solid #059669' : '1px solid var(--border-subtle)',
                backgroundColor: selectedFilterGroup?.label === 'Joined This Month' ? 'rgba(5, 150, 105, 0.15)' : 'var(--bg-surface)',
                color: '#059669',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span>✅ Joined</span>
              <span style={{ backgroundColor: 'rgba(5, 150, 105, 0.2)', padding: '1px 6px', borderRadius: '4px' }}>
                {cockpitData.metrics.joinedThisMonth.count}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedFilterGroup?.label === 'On Hold') {
                  setSelectedFilterGroup(null);
                } else {
                  setSelectedFilterGroup({
                    label: 'On Hold',
                    vacancyIds: cockpitData.metrics.onHold.vacancyIds,
                    color: '#e11d48',
                  });
                  setActiveTab('ALL');
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: selectedFilterGroup?.label === 'On Hold' ? '1.5px solid #e11d48' : '1px solid var(--border-subtle)',
                backgroundColor: selectedFilterGroup?.label === 'On Hold' ? 'rgba(225, 29, 72, 0.15)' : 'var(--bg-surface)',
                color: '#e11d48',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span>⏸️ On Hold</span>
              <span style={{ backgroundColor: 'rgba(225, 29, 72, 0.2)', padding: '1px 6px', borderRadius: '4px' }}>
                {cockpitData.metrics.onHold.count}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 3 Core Instagram-Style Feed Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '12px',
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => handleTabChange('NEED_ATTENTION')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '12px',
            border: activeTab === 'NEED_ATTENTION' ? '1px solid #38bdf8' : '1px solid transparent',
            backgroundColor: activeTab === 'NEED_ATTENTION' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            color: activeTab === 'NEED_ATTENTION' ? '#38bdf8' : '#94a3b8',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          <span>🚨 Need Attention</span>
          <span
            style={{
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
            }}
          >
            {countNeedAttention}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('IN_PROCESS')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '12px',
            border: activeTab === 'IN_PROCESS' ? '1px solid #fbbf24' : '1px solid transparent',
            backgroundColor: activeTab === 'IN_PROCESS' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            color: activeTab === 'IN_PROCESS' ? '#fbbf24' : '#94a3b8',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          <span>⏳ In Process</span>
          <span
            style={{
              backgroundColor: '#fbbf24',
              color: '#0f172a',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
            }}
          >
            {countInProcess}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('COMPLETED')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '12px',
            border: activeTab === 'COMPLETED' ? '1px solid #34d399' : '1px solid transparent',
            backgroundColor: activeTab === 'COMPLETED' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            color: activeTab === 'COMPLETED' ? '#34d399' : '#94a3b8',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          <span>✅ Completed (Hired)</span>
          <span
            style={{
              backgroundColor: '#34d399',
              color: '#0f172a',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
            }}
          >
            {countCompleted}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('ALL')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '12px',
            border: activeTab === 'ALL' ? '1px solid #a855f7' : '1px solid transparent',
            backgroundColor: activeTab === 'ALL' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            color: activeTab === 'ALL' ? '#c084fc' : '#94a3b8',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          <span>📁 All Vacancies</span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>({vacancies.length})</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div
        className="glass-card"
        style={{
          padding: '14px 18px',
          marginBottom: '24px',
          display: 'flex',
          gap: '14px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
          <div style={{ position: 'relative', minWidth: '200px', flex: '1 1 200px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '34px' }}
              placeholder="Search title, area, ID, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <select
              className="form-select"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              aria-label="Filter by project"
              style={{ minWidth: '160px' }}
            >
              <option value="ALL">All Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select className="form-select" value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} aria-label="Filter by zone">
              <option value="ALL">🌐 All 10 Zones</option>
              {OFFICIAL_10_ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select className="form-select" value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)} aria-label="Filter by urgency">
              <option value="ALL">All SLA Urgencies</option>
              <option value="DUE_SOON">🔥 Due Soon (within 48h)</option>
              <option value="OVERDUE">⚠️ Overdue / SLA Breached</option>
            </select>
          </div>

          <div>
            <select className="form-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} aria-label="Sort vacancies">
              <option value="due_soonest">Sort: Due Soonest</option>
              <option value="newest">Sort: Newest Uploads</option>
              <option value="oldest">Sort: Oldest Open</option>
            </select>
          </div>

          {(projectFilter !== 'ALL' || zoneFilter !== 'ALL' || urgencyFilter !== 'ALL' || searchQuery.trim() !== '') && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setProjectFilter('ALL');
                setZoneFilter('ALL');
                setUrgencyFilter('ALL');
                setSearchQuery('');
              }}
              style={{ padding: '7px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
              title="Reset all filters"
            >
              ✕ Reset
            </button>
          )}
        </div>
      </div>

      {/* Instagram-Style Post Cards Feed */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>Loading recruiter feed...</div>
      ) : displayVacancies.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <CheckCircle size={36} color="#34d399" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>No Vacancies in this Feed</h3>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            {activeTab === 'NEED_ATTENTION'
              ? 'Great work! You have no open vacancies requiring candidate sourcing right now.'
              : 'No requisitions matching current filters.'}
          </p>
        </div>
      ) : (
        <>
          <div
            className="vacancy-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: '20px',
          }}
        >
          {pagedVacancies.map((vac) => {
            const activeSub = vac.submissions?.[0];
            const isSingleCandidateBlocked = !!activeSub && (activeSub.status === 'PENDING' || activeSub.status === 'APPROVED');
            const lastRejection = vac.submissions?.find((s) => s.status === 'REJECTED');
            const isExpanded = expandedVacancyIds.has(vac.id);
            const tierInfo = getVacancyApprovalTiers(vac);

            return (
              <div
                key={vac.id}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderRadius: '16px',
                  padding: '20px',
                  border:
                    vac.status === 'ACTIVE'
                      ? '1.5px solid var(--accent-teal)'
                      : vac.status === 'PENDING_APPROVAL'
                      ? '1.5px solid var(--accent-amber)'
                      : '1.5px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface)',
                  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03)',
                }}
              >
                <div>
                  {/* Card Header: Project & Location */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '14px',
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}
                      onClick={() => toggleExpandVacancy(vac.id)}
                      title="Click to view all essential records"
                    >
                      {/* Project Logo Avatar */}
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, var(--primary), var(--accent-pink))',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '800',
                          fontSize: '13px',
                          flexShrink: 0,
                        }}
                      >
                        {vac.project?.code || 'P'}
                      </div>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>{vac.project?.name || 'Client Project'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Code: <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{vac.vacancyCode || 'STAGING'}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {/* Channel Pill (MT vs GT) */}
                      <span
                        style={{
                          fontSize: '10.5px',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          fontWeight: '800',
                          backgroundColor: (vac.store?.tradeType || vac.tradeType) === 'MT' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(234, 88, 12, 0.12)',
                          color: (vac.store?.tradeType || vac.tradeType) === 'MT' ? '#2563eb' : '#ea580c',
                          border: `1px solid ${(vac.store?.tradeType || vac.tradeType) === 'MT' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(234, 88, 12, 0.25)'}`,
                        }}
                      >
                        {vac.store?.tradeType || vac.tradeType || 'MT'}
                      </span>

                      {/* Vacancy Type Pill (Regular vs Tact) */}
                      <span
                        style={{
                          fontSize: '10.5px',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          fontWeight: '800',
                          backgroundColor: vac.manpowerType === 'TACT' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: vac.manpowerType === 'TACT' ? '#7c3aed' : '#059669',
                          border: `1px solid ${vac.manpowerType === 'TACT' ? 'rgba(139, 92, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                        }}
                      >
                        {vac.manpowerType === 'TACT' ? 'Tact' : 'Regular'}
                      </span>

                      <Badge status={vac.status} level={activeSub?.currentLevel || 1} />

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpandVacancy(vac.id);
                        }}
                        style={{
                          background: isExpanded ? 'rgba(6, 148, 148, 0.12)' : 'var(--bg-surface-elevated)',
                          border: isExpanded ? '1.5px solid var(--accent-teal)' : '1.5px solid var(--border-medium)',
                          color: isExpanded ? 'var(--accent-teal)' : 'var(--text-secondary)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          transition: 'all 0.15s ease',
                        }}
                        title={isExpanded ? 'Collapse records' : 'Expand records'}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span>{isExpanded ? 'Hide' : 'Records'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Location & Store Hierarchy Box: Zone ➔ City ➔ Area ➔ Outlet */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      marginBottom: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ fontSize: '13px' }}>🏬</span>
                        <strong style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {vac.store?.name || vac.area}
                        </strong>
                      </div>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {vac.store?.code || vac.store?.chain ? `${vac.store?.code || ''} ${vac.store?.chain ? `(${vac.store.chain})` : ''}` : 'General'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '700', color: '#0f766e' }}>📍 {vac.zone}</span>
                      <span>➔</span>
                      <span>{vac.store?.city || 'City'}</span>
                      <span>➔</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{vac.area}</strong>
                    </div>
                  </div>

                  {/* Job Title */}
                  <h3
                    onClick={() => toggleExpandVacancy(vac.id)}
                    style={{
                      fontSize: '17px',
                      fontWeight: '800',
                      marginBottom: '8px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'color 0.15s',
                    }}
                    title="Click to toggle essential records"
                  >
                    {vac.title}
                  </h3>

                  {/* Headcount Requirement & Dedicated Recruiter info */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                      fontSize: '11.5px',
                      color: 'var(--text-secondary)',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span>👥 Headcount:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {vac.filledPositions || (vac.status === 'FILLED' ? (vac.requiredPositions || 1) : 0)} of {vac.requiredPositions || 1} Filled
                      </strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span>👤 Recruiter:</span>
                      <strong style={{ color: '#0f766e' }}>
                        {vac.assignedRecruiter?.username || vac.assignedRecruiter?.firstName || 'Zone Assigned'}
                      </strong>
                    </div>
                  </div>

                  {/* Highlights Pills */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(6, 148, 148, 0.1)',
                        color: '#067a7a',
                        border: '1px solid rgba(6, 148, 148, 0.25)',
                        fontSize: '12px',
                        fontWeight: '700',
                      }}
                    >
                      💰 {vac.salary || 'Compensation TBD'}
                    </span>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 105, 180, 0.12)',
                        color: '#be185d',
                        border: '1px solid rgba(255, 105, 180, 0.25)',
                        fontSize: '12px',
                        fontWeight: '700',
                      }}
                    >
                      🎓 {vac.experience || 'Experience TBD'}
                    </span>
                  </div>

                  {/* SLA & Target Countdown Badge */}
                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--border-subtle)',
                      marginBottom: '14px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>PM Target SLA:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>Fill within {vac.targetDaysToFill || 2} Days</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Urgency Status:</span>
                      {getUrgencyBadge(vac.targetDueDate)}
                    </div>
                  </div>

                  {/* Interactive Toggle Bar */}
                  <div
                    onClick={() => toggleExpandVacancy(vac.id)}
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: isExpanded ? 'rgba(6, 148, 148, 0.1)' : 'var(--bg-surface-elevated)',
                      border: isExpanded ? '1.5px solid var(--accent-teal)' : '1.5px solid var(--border-subtle)',
                      marginBottom: '14px',
                      transition: 'all 0.15s ease',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <Layers size={14} color={isExpanded ? 'var(--primary)' : 'var(--text-muted)'} />
                      <span style={{ fontSize: '12px', fontWeight: '700', color: isExpanded ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isExpanded ? 'Hide Essential Records' : 'Essential Records & Flow'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', color: isExpanded ? 'var(--primary)' : 'var(--text-muted)', fontWeight: '700', whiteSpace: 'nowrap' }}>
                        {isExpanded ? '▲ Close' : '▼ Details'}
                      </span>
                    </div>
                  </div>

                  {/* Dropdown Essential Records Accordion */}
                  {isExpanded && (
                    <div
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1.5px solid var(--border-subtle)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {/* 1. Genesis & Creation Record */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: '8px' }}>
                          <Calendar size={13} />
                          <span>Creation & Requisition Record</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '12px' }}>
                          <div style={{ backgroundColor: 'var(--bg-surface)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>Created On</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{formatDateTime(vac.createdAt)}</strong>
                            <span style={{ display: 'block', color: 'var(--primary)', fontSize: '10.5px', fontWeight: '600' }}>({getRelativeTime(vac.createdAt)})</span>
                          </div>
                          <div style={{ backgroundColor: 'var(--bg-surface)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>Requisition Code</span>
                            <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{vac.vacancyCode || 'STAGING'}</strong>
                          </div>
                          <div style={{ backgroundColor: 'var(--bg-surface)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>Project / Client</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{vac.project?.name || 'Project'}</strong>
                            <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '10.5px' }}>Code: {vac.project?.code}</span>
                          </div>
                          <div style={{ backgroundColor: 'var(--bg-surface)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>Created By / PM</span>
                            <strong style={{ color: 'var(--text-primary)' }}>
                              {vac.createdBy ? `${vac.createdBy.firstName} ${vac.createdBy.lastName}` : vac.project?.pmUser ? `${vac.project.pmUser.firstName} ${vac.project.pmUser.lastName}` : 'Project Manager'}
                            </strong>
                            <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '10.5px' }}>
                              {vac.createdBy?.email || vac.project?.pmUser?.email || 'pm@recruitment.local'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Synchronous Sequential Approval Chain */}
                      <div style={{ borderTop: '1.5px solid var(--border-subtle)', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#b45309' }}>
                            <ShieldCheck size={14} color="#b45309" />
                            <span>Sequential Approval Chain ({tierInfo.tierCount === 0 ? 'Direct Hire' : `${tierInfo.tierCount} Tiers Synchronous`})</span>
                          </div>
                          <span style={{ fontSize: '10.5px', color: 'var(--primary)', backgroundColor: 'rgba(6, 148, 148, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(6, 148, 148, 0.25)', fontWeight: '600' }}>
                            Sync (1-by-1 Order)
                          </span>
                        </div>

                        {tierInfo.tierCount === 0 ? (
                          <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.25)', fontSize: '12px' }}>
                            ⚡ <strong>Direct Hire:</strong> No approval tiers required for this role. Candidates submitted are immediately hired.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {tierInfo.tiers.map((t) => {
                              const isCompleted = activeSub && activeSub.audits?.some((a) => a.level === t.level && a.action === 'APPROVED');
                              const isCurrentActive = activeSub && activeSub.status === 'PENDING' && activeSub.currentLevel === t.level;

                              return (
                                <div
                                  key={t.level}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 10px',
                                    borderRadius: '8px',
                                    backgroundColor: isCurrentActive
                                      ? 'rgba(217, 119, 6, 0.08)'
                                      : isCompleted
                                      ? 'rgba(5, 150, 105, 0.08)'
                                      : 'var(--bg-surface)',
                                    border: isCurrentActive
                                      ? '1px solid rgba(217, 119, 6, 0.35)'
                                      : isCompleted
                                      ? '1px solid rgba(5, 150, 105, 0.3)'
                                      : '1px solid var(--border-subtle)',
                                    fontSize: '12px',
                                    flexWrap: 'wrap',
                                    gap: '6px',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span
                                      style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        backgroundColor: isCompleted
                                          ? '#059669'
                                          : isCurrentActive
                                          ? '#d97706'
                                          : '#94a3b8',
                                        color: '#fff',
                                      }}
                                    >
                                      {isCompleted ? '✓' : t.level}
                                    </span>
                                    <div>
                                      <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{t.roleName}</strong>
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        Respected Approver:{' '}
                                        <a href={`mailto:${t.email}`} style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
                                          {t.email}
                                        </a>
                                        {t.isOverride && (
                                          <span style={{ color: '#d97706', marginLeft: '6px', fontSize: '10px', fontWeight: '700' }}>
                                            (Upload Override)
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <div>
                                    {isCompleted ? (
                                      <span style={{ color: '#059669', fontWeight: '700', fontSize: '11px' }}>
                                        ✓ Approved
                                      </span>
                                    ) : isCurrentActive ? (
                                      <span style={{ color: '#d97706', fontWeight: '700', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} />
                                        In Review (Dispatched)
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                        {t.level === 1 ? 'Waiting for Candidate' : `Sync: Pending Tier ${t.level - 1}`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                              ⚡ Synchronous Chain: Dispatched strictly one-after-one. Next respected person receives email only after previous tier approves.
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 3. Candidate & Sourcing Details */}
                      <div style={{ borderTop: '1.5px solid var(--border-subtle)', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#7c3aed', marginBottom: '8px' }}>
                          <User size={13} />
                          <span>Candidate & Sourcing Record</span>
                        </div>

                        {!activeSub ? (
                          <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(6, 148, 148, 0.08)', border: '1px solid rgba(6, 148, 148, 0.2)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            🎯 <strong>Slot is Active & Ready:</strong> Exactly 1 candidate position open. Click "Submit Candidate" below to initiate Level 1 review.
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-surface)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                              <span>Candidate: <strong style={{ color: 'var(--text-primary)' }}>{activeSub.fullName}</strong></span>
                              <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '700' }}>
                                {`APPR-${vac.vacancyCode || 'REQ'}-${activeSub.id.slice(0, 8).toUpperCase()}`}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', color: 'var(--text-secondary)' }}>
                              {activeSub.phone && (
                                <span>Phone: <a href={`tel:${activeSub.phone}`} style={{ color: 'var(--primary)', fontWeight: '600' }}>{activeSub.phone}</a></span>
                              )}
                              {activeSub.email && (
                                <span>Email: <a href={`mailto:${activeSub.email}`} style={{ color: 'var(--primary)', fontWeight: '600' }}>{activeSub.email}</a></span>
                              )}
                              {activeSub.resumeId && (
                                <span>Ref: <strong>{activeSub.resumeId}</strong></span>
                              )}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                              Sent: {formatDateTime(activeSub.createdAt)} ({getRelativeTime(activeSub.createdAt)}) by Abhishek Gopale (abhishek.gopale@idonneous.com)
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Modal Trigger Action */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailVacancyModal(vac);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}
                        >
                          <ExternalLink size={13} />
                          <span>Open Full Dossier Modal</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Last Rejection Feedback Notice (Context for Recruiter) */}
                  {lastRejection && vac.status === 'ACTIVE' && (
                    <div
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        marginBottom: '14px',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ color: '#dc2626', fontWeight: '700', marginBottom: '2px' }}>
                        ⚠️ Manager Feedback from Last Attempt:
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        Reason: <strong style={{ color: 'var(--text-primary)' }}>{lastRejection.rejectionReason}</strong>
                        {lastRejection.rejectionComments ? ` • "${lastRejection.rejectionComments}"` : ''}
                      </div>
                    </div>
                  )}

                  {/* Comprehensive In-Process Review & Transmission Details */}
                  {activeSub && (
                    <div
                      style={{
                        backgroundColor: 'rgba(217, 119, 6, 0.06)',
                        border: '1.5px solid rgba(217, 119, 6, 0.25)',
                        padding: '14px',
                        borderRadius: '12px',
                        marginBottom: '16px',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ color: '#b45309', fontWeight: '800', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={15} />
                          Candidate Under Review: <strong style={{ color: 'var(--text-primary)' }}>{activeSub.fullName}</strong>
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(217, 119, 6, 0.15)',
                            color: '#b45309',
                            border: '1px solid rgba(217, 119, 6, 0.3)',
                          }}
                        >
                          Level {activeSub.currentLevel} Approval Pending
                        </span>
                      </div>

                      {/* Candidate Contact Methods */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '10px', color: 'var(--text-secondary)' }}>
                        {activeSub.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={12} color="var(--primary)" />
                            <a href={`tel:${activeSub.phone}`} style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
                              {activeSub.phone}
                            </a>
                          </div>
                        )}
                        {activeSub.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={12} color="var(--primary)" />
                            <a href={`mailto:${activeSub.email}`} style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
                              {activeSub.email}
                            </a>
                          </div>
                        )}
                        {activeSub.resumeId && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                            <span>📄 Ref: <strong style={{ color: 'var(--text-primary)' }}>{activeSub.resumeId}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Transmission Details: WHEN IT WAS SENT & TO WHOM */}
                      <div
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        {/* Approval Checking ID */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Checking ID:</span>
                          <strong
                            style={{
                              color: 'var(--primary)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11.5px',
                              backgroundColor: 'rgba(6, 148, 148, 0.1)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid rgba(6, 148, 148, 0.25)',
                            }}
                          >
                            {`APPR-${vac.vacancyCode || 'REQ'}-${activeSub.id.slice(0, 8).toUpperCase()}`}
                          </strong>
                        </div>

                        {/* Sent Timestamp */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <Calendar size={13} color="var(--text-muted)" />
                          <span style={{ color: 'var(--text-muted)' }}>Sent on:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {formatDateTime(activeSub.createdAt)}
                          </strong>
                          <span style={{ color: 'var(--primary)', fontSize: '11px', fontWeight: '600' }}>
                            ({getRelativeTime(activeSub.createdAt)})
                          </span>
                        </div>

                        {/* Mail Transmit Sender */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Sent from:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>Abhishek Gopale</strong>
                          <a href="mailto:abhishek.gopale@idonneous.com" style={{ color: 'var(--primary)', fontSize: '11.5px', fontWeight: '600', textDecoration: 'none' }}>
                            (abhishek.gopale@idonneous.com)
                          </a>
                        </div>

                        {/* Approver Recipient */}
                        {(() => {
                          const approver = getApproverInfo(vac, activeSub.currentLevel);
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <Send size={13} color="#b45309" />
                              <span style={{ color: 'var(--text-muted)' }}>Sent to:</span>
                              <strong style={{ color: 'var(--text-primary)' }}>
                                {approver.role}
                              </strong>
                              <a href={`mailto:${approver.email}`} style={{ color: '#b45309', fontSize: '11.5px', fontWeight: '600', textDecoration: 'underline' }}>
                                {approver.email}
                              </a>
                            </div>
                          );
                        })()}

                        {/* Protocol */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>Protocol:</span>
                          <span style={{ color: '#059669', fontWeight: '600' }}>SMTP / Direct Mail Transmit</span>
                        </div>

                        {/* 48-Hour Timer & Escalation Status */}
                        {(() => {
                          const elapsedHours = Math.floor(
                            (Date.now() - new Date(activeSub.createdAt).getTime()) / (1000 * 60 * 60)
                          );
                          const remainingToReminder = Math.max(0, 48 - elapsedHours);
                          const isOver48 = elapsedHours >= 48;

                          return (
                            <div
                              style={{
                                marginTop: '4px',
                                paddingTop: '6px',
                                borderTop: '1px solid var(--border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                color: isOver48 ? '#dc2626' : '#059669',
                                fontWeight: '600',
                              }}
                            >
                              <Clock size={12} />
                              <span>
                                {isOver48
                                  ? `⚠️ In review for ${elapsedHours}h (>48h SLA). Automated reminder dispatched / Escalation alert active.`
                                  : `⏳ Pending review for ${elapsedHours}h (${remainingToReminder}h until automated 48h reminder).`}
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Completed Audit Steps (if any) */}
                      {activeSub.audits && activeSub.audits.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span style={{ fontWeight: '700', color: '#059669' }}>✓ Completed Approvals: </span>
                          {activeSub.audits.map((a, idx) => (
                            <span key={a.id || idx}>
                              Level {a.level} approved by {a.reviewerEmail} ({formatDateTime(a.createdAt)})
                              {idx < activeSub.audits!.length - 1 ? '; ' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Action Bar */}
                <div
                  style={{
                    borderTop: '1.5px solid var(--border-subtle)',
                    paddingTop: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  {vac.status === 'ACTIVE' ? (
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={isSingleCandidateBlocked}
                      onClick={() => {
                        setSelectedVacancy(vac);
                        setIsSubmitCandidateModalOpen(true);
                      }}
                      style={{ width: hasPermission('vacancies.override') ? 'auto' : '100%' }}
                    >
                      <UserPlus size={14} />
                      <span>{isSingleCandidateBlocked ? 'Slot Occupied' : 'Submit Candidate'}</span>
                    </button>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                      {vac.status === 'PENDING_APPROVAL' ? '⏳ Review In Progress' : '🎉 Hired & Filled'}
                    </span>
                  )}

                  {/* Master PM Overrides */}
                  {hasPermission('vacancies.override') && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleOverrideForceFill(vac.id)} title="Force Fill">
                        <CheckCircle size={13} color="var(--accent-emerald)" />
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleOverrideCancel(vac.id)} title="Cancel">
                        <Ban size={13} color="var(--accent-amber)" />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleOverrideDelete(vac.id)} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Vacancy Feed Pagination Controls */}
        {displayVacancies.length > 0 && (
          <div
            className="glass-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              marginTop: '20px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span>Showing</span>
              <strong>{(vacCurrentPage - 1) * vacPageSize + 1}</strong>
              <span>to</span>
              <strong>{Math.min(vacCurrentPage * vacPageSize, displayVacancies.length)}</strong>
              <span>of</span>
              <strong>{displayVacancies.length}</strong>
              <span>requisitions</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cards per page:</span>
                <select
                  value={vacPageSize}
                  onChange={(e) => {
                    setVacPageSize(Number(e.target.value));
                    setVacCurrentPage(1);
                  }}
                  className="form-input"
                  style={{ padding: '4px 8px', fontSize: '12px', width: 'auto' }}
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setVacCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={vacCurrentPage <= 1}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 8px', opacity: vacCurrentPage <= 1 ? 0.5 : 1, cursor: vacCurrentPage <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '0 4px' }}>
                  Page {vacCurrentPage} of {vacTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setVacCurrentPage((p) => Math.min(vacTotalPages, p + 1))}
                  disabled={vacCurrentPage >= vacTotalPages}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 8px', opacity: vacCurrentPage >= vacTotalPages ? 0.5 : 1, cursor: vacCurrentPage >= vacTotalPages ? 'not-allowed' : 'pointer' }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </>
      )}

      {/* Modal 1: Ingest Single Vacancy (Step 2 Upload with Dynamic Role & Area Overrides) */}
      <Modal isOpen={isIngestModalOpen} onClose={() => setIsIngestModalOpen(false)} title="Ingest Single Vacancy Slot (Step 2 Upload)">
        <form onSubmit={handleIngestSingleVacancy}>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Project</label>
              {user?.roleName === 'PM' && (
                <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '700', backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                  🔒 PM Assigned Project
                </span>
              )}
            </div>
            <select
              className="form-select"
              required
              value={ingestForm.projectId}
              onChange={(e) => setIngestForm({ ...ingestForm, projectId: e.target.value })}
              disabled={user?.roleName === 'PM' && projects.length === 1}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Code: {p.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Pre-Configured Project Role (Optional)</label>
            <select
              className="form-select"
              value={ingestForm.projectRoleId}
              onChange={(e) => {
                const pr = projectRoles.find((p) => p.id === e.target.value);
                setIngestForm({
                  ...ingestForm,
                  projectRoleId: e.target.value,
                  title: pr ? pr.title : ingestForm.title,
                  salary: pr?.salary || ingestForm.salary,
                  experience: pr?.experience || ingestForm.experience,
                  targetDaysToFill: pr?.targetDaysToFill || ingestForm.targetDaysToFill,
                  approverL1Email: pr?.defaultL1Email || ingestForm.approverL1Email,
                  approverL2Email: pr?.defaultL2Email || pr?.asmEmail || ingestForm.approverL2Email,
                  approverL3Email: pr?.defaultL3Email || pr?.rsmEmail || ingestForm.approverL3Email,
                });
              }}
            >
              <option value="">-- Type Custom Role Title or Select Template --</option>
              {projectRoles.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.title} ({pr.project?.name}) — {pr.salary} (SLA: {pr.targetDaysToFill}d)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Job Position Title (Free-Text)</label>
            <input
              type="text"
              required
              className="form-input"
              value={ingestForm.title}
              onChange={(e) => setIngestForm({ ...ingestForm, title: e.target.value })}
              placeholder="e.g. Beverage Brand Promoter, F-Promoter"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Zone</label>
              <select className="form-select" value={ingestForm.zone} onChange={(e) => setIngestForm({ ...ingestForm, zone: e.target.value })}>
                {OFFICIAL_10_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Area / Location</label>
              <input
                type="text"
                required
                className="form-input"
                value={ingestForm.area}
                onChange={(e) => setIngestForm({ ...ingestForm, area: e.target.value })}
                placeholder="e.g. Chicago Metro"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Expected Salary Range (in Rupees ₹)</span>
              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '700' }}>Rupees (₹ / INR)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8', fontWeight: '700' }}>₹</span>
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '28px' }}
                  placeholder="Min (e.g. 25,000)"
                  value={salaryMin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setSalaryMin(val);
                    const formatted = val && salaryMax ? `₹${Number(val).toLocaleString('en-IN')} - ₹${Number(salaryMax).toLocaleString('en-IN')} / month` : val ? `₹${Number(val).toLocaleString('en-IN')} / month` : '';
                    setIngestForm({ ...ingestForm, salary: formatted });
                  }}
                />
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8', fontWeight: '700' }}>₹</span>
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '28px' }}
                  placeholder="Max (e.g. 35,000)"
                  value={salaryMax}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setSalaryMax(val);
                    const formatted = salaryMin && val ? `₹${Number(salaryMin).toLocaleString('en-IN')} - ₹${Number(val).toLocaleString('en-IN')} / month` : val ? `₹${Number(val).toLocaleString('en-IN')} / month` : '';
                    setIngestForm({ ...ingestForm, salary: formatted });
                  }}
                />
              </div>
            </div>
            {ingestForm.salary && (
              <div style={{ fontSize: '11.5px', color: '#34d399', marginTop: '4px' }}>
                Formatted Range: <strong>{ingestForm.salary}</strong>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Target Days to Fill (SLA)</label>
            <input
              type="number"
              min={1}
              max={30}
              required
              className="form-input"
              value={ingestForm.targetDaysToFill}
              onChange={(e) => setIngestForm({ ...ingestForm, targetDaysToFill: Number(e.target.value) })}
            />
          </div>

          {/* Dynamic Approver Overrides based on selected role approvalLevelsCount */}
          {(() => {
            const selectedRole = projectRoles.find((pr) => pr.id === ingestForm.projectRoleId);
            const tierCount = selectedRole?.approvalLevelsCount ?? 2;

            if (tierCount === 0) {
              return (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: '12px' }}>
                  <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(52, 211, 153, 0.1)', color: '#34d399', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={16} />
                    <span><strong>Direct Hire Role:</strong> Zero approval tiers required. Candidates can be directly hired.</span>
                  </div>
                </div>
              );
            }

            return (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', color: '#38bdf8' }}>
                  Approval Tier Overrides ({tierCount} Level{tierCount > 1 ? 's' : ''} Configured — leave blank to use defaults)
                </div>

                {tierCount === 1 && (
                  <div className="form-group">
                    <label className="form-label">Level 1 Approver Email Override (Area Manager)</label>
                    <input
                      type="email"
                      className="form-input"
                      value={ingestForm.approverL2Email}
                      onChange={(e) => setIngestForm({ ...ingestForm, approverL2Email: e.target.value })}
                      placeholder="e.g. area.manager@company.com"
                    />
                  </div>
                )}

                {tierCount === 2 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Level 1: Project Manager (Override)</label>
                      <input
                        type="email"
                        className="form-input"
                        value={ingestForm.approverL1Email}
                        onChange={(e) => setIngestForm({ ...ingestForm, approverL1Email: e.target.value })}
                        placeholder="pm@company.com"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Level 2: Area Sales Manager (Override)</label>
                      <input
                        type="email"
                        className="form-input"
                        value={ingestForm.approverL2Email}
                        onChange={(e) => setIngestForm({ ...ingestForm, approverL2Email: e.target.value })}
                        placeholder="chicago.asm@company.com"
                      />
                    </div>
                  </div>
                )}

                {tierCount === 3 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Level 1: PM (Override)</label>
                      <input
                        type="email"
                        className="form-input"
                        value={ingestForm.approverL1Email}
                        onChange={(e) => setIngestForm({ ...ingestForm, approverL1Email: e.target.value })}
                        placeholder="pm@company.com"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Level 2: ASM (Override)</label>
                      <input
                        type="email"
                        className="form-input"
                        value={ingestForm.approverL2Email}
                        onChange={(e) => setIngestForm({ ...ingestForm, approverL2Email: e.target.value })}
                        placeholder="asm@company.com"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Level 3: RSM (Override)</label>
                      <input
                        type="email"
                        className="form-input"
                        value={ingestForm.approverL3Email}
                        onChange={(e) => setIngestForm({ ...ingestForm, approverL3Email: e.target.value })}
                        placeholder="rsm@company.com"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            * Vacancy will enter <code>PENDING_INGEST_REVIEW</code> in the PM Queue. Upon PM authorization, an immutable code (e.g. UI003) will be generated.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsIngestModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Submit to PM Ingest Queue
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Bulk CSV Upload with File Picker & Error Sheet Export */}
      <Modal isOpen={isBulkCsvModalOpen} onClose={() => setIsBulkCsvModalOpen(false)} title="Bulk CSV Vacancy Requisition Upload" maxWidth="680px">
        <form onSubmit={handleBulkCsvSubmit}>
          {user?.roleName === 'PM' && (
            <div
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '14px',
                fontSize: '12.5px',
                color: '#e2e8f0',
              }}
            >
              🔒 <strong>Project Manager Restriction:</strong> You can only upload vacancies for your assigned project(s):{' '}
              <strong style={{ color: '#38bdf8' }}>
                {projects.map((p) => `${p.name} (${p.code})`).join(', ') || 'Your Assigned Project'}
              </strong>.
            </div>
          )}

          {/* Quick Guidance & Template Download */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div><strong>Hierarchy:</strong> Zone (1 of 10) ➔ City ➔ Area ➔ Location (Store Name)</div>
              <div style={{ marginTop: '2px', fontSize: '11px', color: 'var(--text-muted)' }}>
                • <strong>Store_Type (MT/GT)</strong>: Compulsory • <strong>Store_Code</strong>: Optional (auto-generated)
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '700' }}
            >
              <Download size={13} />
              <span>Download Official Template</span>
            </button>
          </div>

          {/* Native File Selection Box & Drag-and-Drop Dropzone */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: csvFileName ? '2px solid #069494' : '2px dashed var(--border-medium)',
              borderRadius: '12px',
              padding: '24px 16px',
              textAlign: 'center',
              backgroundColor: csvFileName ? 'rgba(6, 148, 148, 0.05)' : 'var(--bg-surface-elevated)',
              cursor: 'pointer',
              marginBottom: '14px',
              transition: 'all 0.15s ease',
            }}
          >
            <UploadCloud size={34} color={csvFileName ? '#069494' : 'var(--text-muted)'} style={{ margin: '0 auto 8px auto' }} />
            {csvFileName ? (
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#067a7a' }}>
                  ✓ Selected: {csvFileName} {csvFile ? `(${(csvFile.size / 1024).toFixed(1)} KB)` : ''}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {csvText ? `${csvText.trim().split(/\r?\n/).length - 1} rows detected ready for validation` : 'File loaded'}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'underline', marginTop: '6px', display: 'inline-block' }}>
                  Click to select a different file
                </span>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  📁 Click to Select CSV File or Drag & Drop Here
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Select official 17-column CSV template exported from Excel
                </div>
              </div>
            )}
          </div>

          {/* Error Banner & Error Sheet Download Button */}
          {uploadErrors && uploadErrors.length > 0 && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1.5px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: '800', fontSize: '13px' }}>
                  <AlertTriangle size={16} />
                  <span>
                    {uploadErrors.length} Row(s) Failed Validation
                    {uploadStats && ` (${uploadStats.success} Created, ${uploadStats.duplicate} Duplicates, ${uploadStats.error} Errors)`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadErrorSheet}
                  className="btn btn-secondary btn-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    fontWeight: '700',
                    padding: '6px 12px',
                    fontSize: '12px',
                  }}
                >
                  <Download size={14} />
                  <span>📥 Download Error Sheet (.CSV)</span>
                </button>
              </div>
              <p style={{ fontSize: '12px', color: '#fca5a5', margin: '0 0 10px 0' }}>
                Rows with invalid Zone or missing Store Type (MT/GT) were rejected. Download the error sheet to see the exact issue on each row, correct the data, and re-upload.
              </p>
              <div style={{ maxHeight: '130px', overflowY: 'auto', fontSize: '11.5px', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', padding: '6px 10px', backgroundColor: 'var(--bg-surface)' }}>
                {uploadErrors.slice(0, 8).map((err, idx) => (
                  <div key={idx} style={{ padding: '3px 0', borderBottom: idx < Math.min(8, uploadErrors.length) - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <strong style={{ color: '#ef4444' }}>Row {err.rowNumber}:</strong> {err.errorReason}
                    {err.locationName ? ` (${err.locationName})` : ''}
                  </div>
                ))}
                {uploadErrors.length > 8 && (
                  <div style={{ color: 'var(--text-muted)', paddingTop: '4px' }}>
                    ...and {uploadErrors.length - 8} more rows. Download the Error Sheet to inspect all rows.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Toggle for Manual CSV Text Preview */}
          <div style={{ marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => setShowRawCsvText(!showRawCsvText)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                padding: '4px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{showRawCsvText ? '▼ Hide Raw CSV Text' : '► Or View / Paste Raw CSV Text'}</span>
            </button>
            {showRawCsvText && (
              <div className="form-group" style={{ marginTop: '8px' }}>
                <textarea
                  className="form-textarea"
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Project_Code,Zone,City,Area,Location_Name,Store_Type,Vacancy_Type,Positions_Count,Job_Title..."
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
            <div>
              {uploadErrors && uploadErrors.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadErrorSheet}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={13} />
                  <span>Export Error Sheet (.CSV)</span>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsBulkCsvModalOpen(false);
                  setUploadErrors(null);
                  setUploadStats(null);
                }}
              >
                Cancel
              </button>
              <button type="submit" disabled={csvUploading || !csvText.trim()} className="btn btn-primary">
                {csvUploading ? 'Processing Rows...' : 'Upload & Deduplicate'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Submit Candidate (Strict Single-Candidate Constraint) */}
      <Modal
        isOpen={isSubmitCandidateModalOpen}
        onClose={() => setIsSubmitCandidateModalOpen(false)}
        title={`Submit Candidate for ${selectedVacancy?.vacancyCode || 'Requisition'}`}
      >
        <form onSubmit={handleSubmitCandidate}>
          <div
            style={{
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            <strong>Position:</strong> {selectedVacancy?.title} ({selectedVacancy?.zone} — {selectedVacancy?.area})<br />
            <strong>Rule:</strong> Exactly 1 candidate allowed per slot. Sourcing will lock until review completes.
          </div>

          <div className="form-group">
            <label className="form-label">Candidate Full Name</label>
            <input
              type="text"
              required
              className="form-input"
              value={candidateForm.fullName}
              onChange={(e) => setCandidateForm({ ...candidateForm, fullName: e.target.value })}
              placeholder="e.g. John Doe"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Email Address</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '400' }}>(Email or Phone)</span>
              </label>
              <input
                type="email"
                className="form-input"
                value={candidateForm.email}
                onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
                placeholder="john.doe@example.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Phone Number</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '400' }}>(Email or Phone)</span>
              </label>
              <input
                type="tel"
                className="form-input"
                value={candidateForm.phone}
                onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
                placeholder="+91-9876543210"
              />
            </div>
          </div>
          <div
            style={{
              fontSize: '11.5px',
              color: '#38bdf8',
              marginTop: '-4px',
              marginBottom: '14px',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(56, 189, 248, 0.2)',
            }}
          >
            ℹ️ <strong>Contact Requirement:</strong> At least one contact method (Email Address or Phone Number) is compulsory. You may provide both if available.
          </div>

          <div className="form-group">
            <label className="form-label">Resume / Portfolio Reference</label>
            <input
              type="text"
              className="form-input"
              value={candidateForm.resumeId}
              onChange={(e) => setCandidateForm({ ...candidateForm, resumeId: e.target.value })}
              placeholder="e.g. RES-2026-0901 or Google Drive link"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsSubmitCandidateModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Submit & Enqueue 1-Click Review
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 4: Instagram-Style Recruiter Profile */}
      <RecruiterProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onSelectTab={(tab) => handleTabChange(tab)}
      />

      {/* Modal 5: Comprehensive Essential Records & Synchronous Approval Flow Dossier */}
      {detailVacancyModal && (
        <Modal
          isOpen={!!detailVacancyModal}
          onClose={() => setDetailVacancyModal(null)}
          title={`Requisition Dossier: ${detailVacancyModal.vacancyCode || detailVacancyModal.title}`}
          maxWidth="700px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDetailVacancyModal(null)}
              >
                Close Dossier
              </button>
              {detailVacancyModal.status === 'ACTIVE' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const vac = detailVacancyModal;
                    setSelectedVacancy(vac);
                    setCandidateForm({ fullName: '', email: '', phone: '', resumeId: '' });
                    setDetailVacancyModal(null);
                    setIsSubmitCandidateModalOpen(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <User size={15} />
                  <span>Submit Candidate to this Slot</span>
                </button>
              )}
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* 1. Header Overview & Status */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                      }}
                    >
                      {detailVacancyModal.vacancyCode || 'VAC-REQ'}
                    </span>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                      {detailVacancyModal.project?.name || 'Project Role'}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                    {detailVacancyModal.title}
                  </h2>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '12px', color: '#94a3b8', flexWrap: 'wrap' }}>
                    <span>📍 {detailVacancyModal.area}, Zone {detailVacancyModal.zone}</span>
                    <span>💰 {detailVacancyModal.salary || 'Market Rate'}</span>
                    <span>🎯 {detailVacancyModal.experience || 'Experience: Standard'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <Badge status={detailVacancyModal.status} level={detailVacancyModal.submissions?.[0]?.currentLevel || 1} />
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Target SLA: <strong>{detailVacancyModal.targetDaysToFill || 2} Days</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Creation & Creator Metadata */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                padding: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#38bdf8', marginBottom: '8px' }}>
                <Calendar size={14} />
                <span>Requisition Origin & Creation Record</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '12.5px' }}>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: '11px' }}>Created On:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                    {formatDateTime(detailVacancyModal.createdAt)}
                  </span>
                  <span style={{ color: '#38bdf8', fontSize: '11px', marginLeft: '6px' }}>
                    ({getRelativeTime(detailVacancyModal.createdAt)})
                  </span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: '11px' }}>Created By (PM in Charge):</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                    {detailVacancyModal.createdBy
                      ? `${detailVacancyModal.createdBy.firstName} ${detailVacancyModal.createdBy.lastName}`
                      : detailVacancyModal.project?.pmUser
                      ? `${detailVacancyModal.project.pmUser.firstName} ${detailVacancyModal.project.pmUser.lastName}`
                      : 'System / Admin Upload'}
                  </span>
                  {(detailVacancyModal.createdBy?.email || detailVacancyModal.project?.pmUser?.email) && (
                    <a
                      href={`mailto:${detailVacancyModal.createdBy?.email || detailVacancyModal.project?.pmUser?.email}`}
                      style={{ color: '#38bdf8', fontSize: '11px', display: 'block', textDecoration: 'none' }}
                    >
                      {detailVacancyModal.createdBy?.email || detailVacancyModal.project?.pmUser?.email}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Synchronous Sequential Approval Process */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                padding: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#10b981' }}>
                  <ShieldCheck size={14} />
                  <span>Synchronous Approval Hierarchy (1-by-1 Sequential Chain)</span>
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Strict 1-after-1 Transmit
                </span>
              </div>

              {(() => {
                const { tiers } = getVacancyApprovalTiers(detailVacancyModal);
                const activeSub = detailVacancyModal.submissions?.[0];
                const currentSubLevel = activeSub ? activeSub.currentLevel : 1;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tiers.map((t) => {
                      const isCompleted = activeSub && (currentSubLevel > t.level || activeSub.status === 'APPROVED');
                      const isCurrentActive = activeSub && activeSub.status === 'PENDING' && currentSubLevel === t.level;

                      return (
                        <div
                          key={t.level}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            backgroundColor: isCurrentActive
                              ? 'rgba(251, 191, 36, 0.08)'
                              : isCompleted
                              ? 'rgba(16, 185, 129, 0.08)'
                              : 'rgba(255, 255, 255, 0.02)',
                            border: isCurrentActive
                              ? '1px solid rgba(251, 191, 36, 0.3)'
                              : isCompleted
                              ? '1px solid rgba(16, 185, 129, 0.3)'
                              : '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: '800',
                                backgroundColor: isCompleted
                                  ? '#10b981'
                                  : isCurrentActive
                                  ? '#f59e0b'
                                  : '#334155',
                                color: '#fff',
                              }}
                            >
                              {isCompleted ? '✓' : t.level}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>Tier {t.level}: {t.roleName}</strong>
                                {t.isOverride && (
                                  <span style={{ fontSize: '10px', color: '#fbbf24', backgroundColor: 'rgba(251, 191, 36, 0.1)', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                    Upload Override
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                                Respected Approver:{' '}
                                <a href={`mailto:${t.email}`} style={{ color: '#38bdf8', textDecoration: 'none' }}>
                                  {t.email}
                                </a>
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            {isCompleted ? (
                              <span style={{ color: '#34d399', fontWeight: '700', fontSize: '12px' }}>
                                ✓ Approved
                              </span>
                            ) : isCurrentActive ? (
                              <span style={{ color: '#fbbf24', fontWeight: '700', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={13} />
                                In Review (Dispatched)
                              </span>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '11.5px' }}>
                                {t.level === 1 ? 'Waiting for Candidate' : `Sync: Pending Tier ${t.level - 1}`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11.5px',
                        color: '#94a3b8',
                        backgroundColor: 'rgba(56, 189, 248, 0.05)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        marginTop: '4px',
                      }}
                    >
                      <Info size={14} color="#38bdf8" />
                      <span>
                        <strong>Synchronous Sequential Logic:</strong> Approvals proceed strictly one after one. Approver Tier 2 is notified only after Tier 1 signs off. Tier 3 only after Tier 2 signs off.
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 4. Active Candidate & Sourcing Dossier */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                padding: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#a855f7', marginBottom: '8px' }}>
                <User size={14} />
                <span>Candidate Sourcing Record (1-Candidate Slot Constraint)</span>
              </div>

              {detailVacancyModal.submissions && detailVacancyModal.submissions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {detailVacancyModal.submissions.map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor:
                          sub.status === 'PENDING'
                            ? 'rgba(251, 191, 36, 0.06)'
                            : sub.status === 'APPROVED'
                            ? 'rgba(16, 185, 129, 0.06)'
                            : 'rgba(239, 68, 68, 0.06)',
                        border:
                          sub.status === 'PENDING'
                            ? '1px solid rgba(251, 191, 36, 0.2)'
                            : sub.status === 'APPROVED'
                            ? '1px solid rgba(16, 185, 129, 0.2)'
                            : '1px solid rgba(239, 68, 68, 0.2)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                        <div>
                          <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{sub.fullName}</strong>
                          <span
                            style={{
                              marginLeft: '8px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: '#38bdf8',
                              backgroundColor: 'rgba(56, 189, 248, 0.1)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {`APPR-${detailVacancyModal.vacancyCode || 'REQ'}-${sub.id.slice(0, 8).toUpperCase()}`}
                          </span>
                        </div>
                        <Badge status={sub.status} level={sub.currentLevel} />
                      </div>

                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>
                        {sub.phone && (
                          <span>
                            📞 Phone: <a href={`tel:${sub.phone}`} style={{ color: '#38bdf8' }}>{sub.phone}</a>
                          </span>
                        )}
                        {sub.email && (
                          <span>
                            ✉️ Email: <a href={`mailto:${sub.email}`} style={{ color: '#38bdf8' }}>{sub.email}</a>
                          </span>
                        )}
                        {sub.resumeId && (
                          <span>
                            📄 Ref: <strong style={{ color: 'var(--text-primary)' }}>{sub.resumeId}</strong>
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        Transmitted: {formatDateTime(sub.createdAt)} ({getRelativeTime(sub.createdAt)}) by Abhishek Gopale (abhishek.gopale@idonneous.com)
                      </div>

                      {sub.status === 'REJECTED' && (
                        <div style={{ marginTop: '8px', padding: '8px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', fontSize: '11.5px' }}>
                          Rejection Reason: <strong>{sub.rejectionReason}</strong> {sub.rejectionComments ? `• "${sub.rejectionComments}"` : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.15)', fontSize: '12.5px', color: '#cbd5e1' }}>
                  🎯 <strong>Vacant Slot Active:</strong> No candidate currently uploaded. The position is ready for single-candidate sourcing.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
