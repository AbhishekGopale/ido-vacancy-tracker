import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  AlertTriangle,
  Clock,
  CheckCircle,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  Activity,
  ShieldCheck,
  TrendingUp,
  MapPin,
  Users,
  Zap,
  Search,
  RotateCcw,
  Eye,
  AlertCircle,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { DashboardReport, ExecutiveAnalyticsData, UserLoginAudit, Vacancy, WorkforceMandaysData, AreaTrendsData } from '../../types/index.js';
import { Badge } from '../../components/Badge.js';
import { Modal } from '../../components/Modal.js';
import { AreaTrendLineChart } from '../../components/AreaTrendLineChart.js';
import { StoreProjectMatrix } from '../../components/StoreProjectMatrix.js';
import { useAuth } from '../../context/AuthContext.js';

export const DashboardPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [analytics, setAnalytics] = useState<ExecutiveAnalyticsData | null>(null);
  const [loginAudits, setLoginAudits] = useState<UserLoginAudit[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);

  // Top View Mode: Store x Project Matrix vs Power BI Workforce Analytics vs Area Activation vs Executive Intelligence
  const [viewMode, setViewMode] = useState<'STORE_MATRIX' | 'POWER_BI_WORKFORCE' | 'AREA_ACTIVATION' | 'EXECUTIVE_INTELLIGENCE'>('STORE_MATRIX');

  // Power BI Workforce Mandays State & Dynamic Slicers
  const [workforceData, setWorkforceData] = useState<WorkforceMandaysData | null>(null);
  const [workforceLoading, setWorkforceLoading] = useState(false);
  const [slicerProject, setSlicerProject] = useState('ALL');
  const [slicerArea, setSlicerArea] = useState('ALL');
  const [slicerRole, setSlicerRole] = useState('ALL');
  const [slicerTimeframe, setSlicerTimeframe] = useState<'ALL' | '7D' | '30D' | 'THIS_MONTH'>('ALL');
  const [graph1Dimension, setGraph1Dimension] = useState<'PROJECT' | 'AREA'>('PROJECT');
  const [matrixSearch, setMatrixSearch] = useState('');

  // Area Trends Multi-Line Chart State
  const [trendData, setTrendData] = useState<AreaTrendsData | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendMetric, setTrendMetric] = useState<'PERCENTAGE' | 'FILLED_COUNT' | 'OPEN_COUNT'>('PERCENTAGE');
  const [trendStartDate, setTrendStartDate] = useState('');
  const [trendEndDate, setTrendEndDate] = useState('');
  const [visibleTrendAreas, setVisibleTrendAreas] = useState<Set<string>>(new Set());

  // Executive Tab Selection
  const [activeTab, setActiveTab] = useState<'ROLES' | 'AREAS' | 'PROJECTS' | 'SLA_BOTTLENECK' | 'REJECTIONS'>('ROLES');

  // Area Activation Dashboard Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [dateRange, setDateRange] = useState<'ALL' | '7D' | '30D' | 'THIS_MONTH'>('ALL');

  // Selected Vacancy for Dossier Modal
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  useEffect(() => {
    document.title = 'Vacancy Tracker & Workforce Intelligence | Recruitment OS';
    async function loadDashboard() {
      try {
        const [repData, analyticsData, auditsData, vacData] = await Promise.all([
          api.get<DashboardReport>('/reports/overview').catch(() => null),
          api.get<ExecutiveAnalyticsData>('/reports/executive-analytics').catch(() => null),
          api.get<{ audits: UserLoginAudit[]; totalCount: number }>('/reports/login-audits').catch(() => ({ audits: [], totalCount: 0 })),
          api.get<Vacancy[]>('/vacancies').catch(() => []),
        ]);
        if (repData) setReport(repData);
        if (analyticsData) setAnalytics(analyticsData);
        if (auditsData?.audits) setLoginAudits(auditsData.audits);
        setVacancies(vacData);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const loadWorkforceMandays = async () => {
    setWorkforceLoading(true);
    try {
      const params = new URLSearchParams();
      if (slicerProject !== 'ALL') params.set('projectId', slicerProject);
      if (slicerArea !== 'ALL') params.set('area', slicerArea);
      if (slicerRole !== 'ALL') params.set('roleTitle', slicerRole);
      if (slicerTimeframe !== 'ALL') params.set('timeframe', slicerTimeframe);

      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api.get<WorkforceMandaysData>(`/reports/workforce-mandays${query}`);
      setWorkforceData(data);
    } catch (err) {
      console.error('Failed to load workforce mandays data', err);
    } finally {
      setWorkforceLoading(false);
    }
  };

  useEffect(() => {
    loadWorkforceMandays();
  }, [slicerProject, slicerArea, slicerRole, slicerTimeframe]);

  const loadAreaTrends = async () => {
    setTrendLoading(true);
    try {
      const params = new URLSearchParams();
      if (trendStartDate) params.set('startDate', trendStartDate);
      if (trendEndDate) params.set('endDate', trendEndDate);
      if (slicerProject !== 'ALL') params.set('projectId', slicerProject);
      if (slicerRole !== 'ALL') params.set('roleTitle', slicerRole);

      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api.get<AreaTrendsData>(`/reports/area-trends${query}`);
      setTrendData(data);

      if (!trendStartDate && data.summary.startDate) {
        setTrendStartDate(data.summary.startDate);
      }
      if (!trendEndDate && data.summary.endDate) {
        setTrendEndDate(data.summary.endDate);
      }

      setVisibleTrendAreas((prev) => {
        if (prev.size > 0) return prev;
        const topNames = data.areas.slice(0, 5).map((a) => a.name);
        return new Set(topNames);
      });
    } catch (err) {
      console.error('Failed to load area trends', err);
    } finally {
      setTrendLoading(false);
    }
  };

  useEffect(() => {
    loadAreaTrends();
  }, [trendStartDate, trendEndDate, slicerProject, slicerRole]);

  const handleToggleTrendArea = (areaName: string) => {
    setVisibleTrendAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaName)) {
        if (next.size > 1) next.delete(areaName);
      } else {
        next.add(areaName);
      }
      return next;
    });
  };

  const handleSelectAllTrendAreas = () => {
    if (!trendData) return;
    setVisibleTrendAreas(new Set(trendData.areas.map((a) => a.name)));
  };

  const handleClearTrendAreas = () => {
    if (!trendData || trendData.areas.length === 0) return;
    setVisibleTrendAreas(new Set([trendData.areas[0].name]));
  };

  const handleQuickPresetDays = (days: number | 'ALL') => {
    if (!trendData) return;
    const maxD = trendData.filterOptions.maxDate || new Date().toISOString().slice(0, 10);
    if (days === 'ALL') {
      setTrendStartDate(trendData.filterOptions.minDate);
      setTrendEndDate(maxD);
    } else {
      const endObj = new Date(maxD);
      const startObj = new Date(endObj.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
      setTrendStartDate(startObj.toISOString().slice(0, 10));
      setTrendEndDate(maxD);
    }
  };

  const handleDownloadWorkforceExcel = () => {
    const params = new URLSearchParams();
    if (slicerProject !== 'ALL') params.set('projectId', slicerProject);
    if (slicerArea !== 'ALL') params.set('area', slicerArea);
    if (slicerRole !== 'ALL') params.set('roleTitle', slicerRole);
    if (slicerTimeframe !== 'ALL') params.set('timeframe', slicerTimeframe);
    const query = params.toString() ? `?${params.toString()}` : '';
    const token = localStorage.getItem('token');

    fetch(`/api/v1/reports/export-workforce-excel${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `powerbi_workforce_mandays_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error('Export failed', err);
        alert('Failed to download workforce excel report.');
      });
  };

  const handleResetSlicers = () => {
    setSlicerProject('ALL');
    setSlicerArea('ALL');
    setSlicerRole('ALL');
    setSlicerTimeframe('ALL');
  };

  const hasActiveSlicers =
    slicerProject !== 'ALL' ||
    slicerArea !== 'ALL' ||
    slicerRole !== 'ALL' ||
    slicerTimeframe !== 'ALL';

  const filteredMatrixRows = useMemo(() => {
    if (!workforceData?.matrixRows) return [];
    if (!matrixSearch.trim()) return workforceData.matrixRows;
    const q = matrixSearch.toLowerCase();
    return workforceData.matrixRows.filter(
      (r) =>
        r.projectCode.toLowerCase().includes(q) ||
        r.projectName.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        r.roleTitle.toLowerCase().includes(q)
    );
  }, [workforceData?.matrixRows, matrixSearch]);

  const matrixGrandTotals = useMemo(() => {
    const rows = filteredMatrixRows;
    const totalSlots = rows.reduce((acc, r) => acc + r.totalSlots, 0);
    const filledSlots = rows.reduce((acc, r) => acc + r.filledSlots, 0);
    const openSlots = rows.reduce((acc, r) => acc + r.openSlots, 0);
    const plannedMandays = rows.reduce((acc, r) => acc + r.plannedMandays, 0);
    const deliveredMandays = rows.reduce((acc, r) => acc + r.deliveredMandays, 0);
    const lostMandays = rows.reduce((acc, r) => acc + r.lostMandays, 0);
    const lossInr = rows.reduce((acc, r) => acc + r.lossInr, 0);
    const eff = plannedMandays > 0 ? Math.round((deliveredMandays / plannedMandays) * 100) : 0;
    const fillRate = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
    return {
      totalSlots,
      filledSlots,
      openSlots,
      plannedMandays,
      deliveredMandays,
      lostMandays,
      lossInr,
      efficiencyPercent: eff,
      fillRatePercent: fillRate,
      lossDisplay: lossInr >= 100000 ? `₹${(lossInr / 100000).toFixed(2)} Lakhs` : `₹${lossInr.toLocaleString('en-IN')}`,
    };
  }, [filteredMatrixRows]);

  const handleDownloadRawData = () => {
    window.open('/api/v1/reports/export-raw-csv', '_blank');
  };

  const handleDownloadLoginAudits = () => {
    window.open('/api/v1/reports/export-logins-csv', '_blank');
  };

  const handleOpenDossier = (vac: Vacancy) => {
    setSelectedVacancy(vac);
    setIsDossierOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedArea('ALL');
    setSelectedBrand('ALL');
    setSelectedRole('ALL');
    setSelectedStatus('ALL');
    setDateRange('ALL');
  };

  // Unique dynamic filter options extracted from live vacancies
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    vacancies.forEach((v) => {
      if (v.area) set.add(v.area.trim());
    });
    return Array.from(set).sort();
  }, [vacancies]);

  const availableBrands = useMemo(() => {
    const map = new Map<string, string>();
    vacancies.forEach((v) => {
      if (v.project?.code) {
        map.set(v.project.code, v.project.name || v.project.code);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [vacancies]);

  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    vacancies.forEach((v) => {
      if (v.title) set.add(v.title.trim());
    });
    return Array.from(set).sort();
  }, [vacancies]);

  // Filtered Vacancies based on multi-parameter filter controls
  const filteredVacancies = useMemo(() => {
    return vacancies.filter((v) => {
      // 1. Text Search (Vacancy ID, Area, Brand/Project Name, Role Title, Salary)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = (v.vacancyCode || '').toLowerCase();
        const title = (v.title || '').toLowerCase();
        const area = (v.area || '').toLowerCase();
        const brand = (v.project?.name || v.project?.code || '').toLowerCase();
        const salary = (v.salary || '').toLowerCase();
        if (!code.includes(q) && !title.includes(q) && !area.includes(q) && !brand.includes(q) && !salary.includes(q)) {
          return false;
        }
      }

      // 2. Area Filter
      if (selectedArea !== 'ALL' && v.area?.toLowerCase() !== selectedArea.toLowerCase()) {
        return false;
      }

      // 3. Brand / Project Filter
      if (selectedBrand !== 'ALL' && v.project?.code !== selectedBrand && v.project?.name !== selectedBrand) {
        return false;
      }

      // 4. Role Filter
      if (selectedRole !== 'ALL' && v.title?.toLowerCase() !== selectedRole.toLowerCase()) {
        return false;
      }

      // 5. Status Filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'OPEN' && v.status !== 'ACTIVE') return false;
        if (selectedStatus === 'FILLED' && v.status !== 'FILLED') return false;
        if (selectedStatus === 'IN_REVIEW' && v.status !== 'PENDING_APPROVAL') return false;
        if (selectedStatus === 'CLOSED' && v.status !== 'CANCELLED' && v.status !== 'DRAFT_DUPLICATE_FLAG') return false;
      }

      // 6. Date Range Filter
      if (dateRange !== 'ALL' && v.createdAt) {
        const itemDate = new Date(v.createdAt).getTime();
        const now = Date.now();
        if (dateRange === '7D' && now - itemDate > 7 * 24 * 60 * 60 * 1000) return false;
        if (dateRange === '30D' && now - itemDate > 30 * 24 * 60 * 60 * 1000) return false;
        if (dateRange === 'THIS_MONTH') {
          const itemD = new Date(v.createdAt);
          const currentD = new Date();
          if (itemD.getMonth() !== currentD.getMonth() || itemD.getFullYear() !== currentD.getFullYear()) {
            return false;
          }
        }
      }

      return true;
    });
  }, [vacancies, searchQuery, selectedArea, selectedBrand, selectedRole, selectedStatus, dateRange]);

  // Top 4 KPI Metrics
  const totalFilteredCount = filteredVacancies.length;
  const openCount = useMemo(() => filteredVacancies.filter((v) => v.status === 'ACTIVE').length, [filteredVacancies]);
  const filledCount = useMemo(() => filteredVacancies.filter((v) => v.status === 'FILLED').length, [filteredVacancies]);
  const closedOrInReviewCount = useMemo(() => filteredVacancies.filter((v) => v.status !== 'ACTIVE' && v.status !== 'FILLED').length, [filteredVacancies]);

  // Area-wise Summary Table Aggregation
  const areaSummaryList = useMemo(() => {
    const map = new Map<string, { area: string; total: number; open: number; filled: number; closed: number }>();

    filteredVacancies.forEach((v) => {
      const areaKey = v.area?.trim() || 'Unassigned Area';
      if (!map.has(areaKey)) {
        map.set(areaKey, { area: areaKey, total: 0, open: 0, filled: 0, closed: 0 });
      }
      const item = map.get(areaKey)!;
      item.total += 1;
      if (v.status === 'ACTIVE') item.open += 1;
      else if (v.status === 'FILLED') item.filled += 1;
      else item.closed += 1;
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        fillRate: item.total > 0 ? Math.round((item.filled / item.total) * 100) : 0,
        openRate: item.total > 0 ? Math.round((item.open / item.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredVacancies]);

  // Grand Totals for Area Summary Table
  const grandTotal = useMemo(() => {
    const total = areaSummaryList.reduce((acc, curr) => acc + curr.total, 0);
    const open = areaSummaryList.reduce((acc, curr) => acc + curr.open, 0);
    const filled = areaSummaryList.reduce((acc, curr) => acc + curr.filled, 0);
    const closed = areaSummaryList.reduce((acc, curr) => acc + curr.closed, 0);
    const fillRate = total > 0 ? Math.round((filled / total) * 100) : 0;
    const openRate = total > 0 ? Math.round((open / total) * 100) : 0;
    return { total, open, filled, closed, fillRate, openRate };
  }, [areaSummaryList]);

  // Top Area Ranking for Visual Bars
  const topAreasRanking = useMemo(() => {
    const maxVal = Math.max(...areaSummaryList.map((a) => a.total), 1);
    return areaSummaryList.slice(0, 6).map((a) => ({
      ...a,
      percentageOfMax: Math.round((a.total / maxVal) * 100),
    }));
  }, [areaSummaryList]);

  // Status Distribution percentages
  const statusPercentages = useMemo(() => {
    if (totalFilteredCount === 0) return { openPct: 0, filledPct: 0, closedPct: 0 };
    const openPct = Math.round((openCount / totalFilteredCount) * 100);
    const filledPct = Math.round((filledCount / totalFilteredCount) * 100);
    const closedPct = 100 - openPct - filledPct;
    return { openPct, filledPct, closedPct: Math.max(0, closedPct) };
  }, [totalFilteredCount, openCount, filledCount]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedArea !== 'ALL' ||
    selectedBrand !== 'ALL' ||
    selectedRole !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    dateRange !== 'ALL';

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)', padding: '32px 0' }}>Loading vacancy analytics...</div>;
  }

  const score = analytics?.scorecard;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header & Global Export Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: '800' }}>Vacancy Tracker Operations Dashboard</h1>
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
              {user?.roleName === 'HIGHER_MANAGEMENT' ? '👑 HIGHER MANAGEMENT' : user?.roleName || 'EXECUTIVE'}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Real-time area activation tracking, vacancy status distribution, and multi-tier recruitment fulfillment.
          </p>
        </div>

        {/* Global Export Hub */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleDownloadRawData}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            title="Download full row-level raw vacancy dataset in CSV"
          >
            <FileSpreadsheet size={15} />
            <span>📥 Download Raw Data (.CSV)</span>
          </button>
          <button
            onClick={handleDownloadLoginAudits}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            title="Download user login activity and usage audit logs"
          >
            <Download size={15} />
            <span>📥 Download Login Audits (.CSV)</span>
          </button>
        </div>
      </div>

      {/* Duplicate Flags Alert Banner */}
      {(report?.summary.duplicateFlags ?? 0) > 0 && hasPermission('vacancies.dedup_decision') && (
        <div
          style={{
            backgroundColor: 'rgba(168, 85, 247, 0.12)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} color="#c084fc" />
            <div>
              <strong style={{ color: '#c084fc', fontSize: '14px' }}>
                {report?.summary.duplicateFlags} Composite Key Match(es) Flagged
              </strong>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Duplicate requisitions require PM review (SAME → delete upload vs DIFFERENT → assign auto Vacancy ID).
              </div>
            </div>
          </div>
          <Link to="/duplicates" className="btn btn-primary btn-sm">
            <span>Review Queue</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}

      {/* 2. Top View Mode Selector Switcher */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '12px',
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => setViewMode('STORE_MATRIX')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '9px',
            border: viewMode === 'STORE_MATRIX' ? '1.5px solid #2563eb' : '1.5px solid var(--border-subtle)',
            backgroundColor: viewMode === 'STORE_MATRIX' ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-surface)',
            color: viewMode === 'STORE_MATRIX' ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '13.5px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            boxShadow: viewMode === 'STORE_MATRIX' ? '0 2px 6px rgba(37, 99, 235, 0.15)' : 'none',
          }}
        >
          <FileSpreadsheet size={16} />
          <span>📋 Store × Project Matrix</span>
        </button>

        <button
          onClick={() => setViewMode('POWER_BI_WORKFORCE')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '9px',
            border: viewMode === 'POWER_BI_WORKFORCE' ? '1.5px solid var(--accent-teal)' : '1.5px solid var(--border-subtle)',
            backgroundColor: viewMode === 'POWER_BI_WORKFORCE' ? 'rgba(6, 148, 148, 0.12)' : 'var(--bg-surface)',
            color: viewMode === 'POWER_BI_WORKFORCE' ? '#067a7a' : 'var(--text-secondary)',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '13.5px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            boxShadow: viewMode === 'POWER_BI_WORKFORCE' ? '0 2px 6px rgba(6, 148, 148, 0.15)' : 'none',
          }}
        >
          <BarChart3 size={16} />
          <span>📊 Power BI Workforce & Mandays</span>
        </button>

        <button
          onClick={() => setViewMode('AREA_ACTIVATION')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '9px',
            border: viewMode === 'AREA_ACTIVATION' ? '1.5px solid var(--accent-pink)' : '1.5px solid var(--border-subtle)',
            backgroundColor: viewMode === 'AREA_ACTIVATION' ? 'rgba(255, 105, 180, 0.12)' : 'var(--bg-surface)',
            color: viewMode === 'AREA_ACTIVATION' ? '#be185d' : 'var(--text-secondary)',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '13.5px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            boxShadow: viewMode === 'AREA_ACTIVATION' ? '0 2px 6px rgba(255, 105, 180, 0.15)' : 'none',
          }}
        >
          <MapPin size={16} />
          <span>📍 Area Activation Trends</span>
        </button>

        <button
          onClick={() => setViewMode('EXECUTIVE_INTELLIGENCE')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '9px',
            border: viewMode === 'EXECUTIVE_INTELLIGENCE' ? '1.5px solid #0891b2' : '1.5px solid var(--border-subtle)',
            backgroundColor: viewMode === 'EXECUTIVE_INTELLIGENCE' ? 'rgba(0, 240, 255, 0.14)' : 'var(--bg-surface)',
            color: viewMode === 'EXECUTIVE_INTELLIGENCE' ? '#0e7490' : 'var(--text-secondary)',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '13.5px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            boxShadow: viewMode === 'EXECUTIVE_INTELLIGENCE' ? '0 2px 6px rgba(0, 240, 255, 0.15)' : 'none',
          }}
        >
          <Activity size={16} />
          <span>🛡️ Executive Bottlenecks</span>
        </button>
      </div>

      {/* VIEW: CONSOLIDATED STORE X PROJECT MATRIX */}
      {viewMode === 'STORE_MATRIX' && (
        <StoreProjectMatrix
          onNavigateToVacancy={(id) => {
            navigate(`/vacancies?vacancyId=${id}`);
          }}
        />
      )}

      {/* VIEW: POWER BI WORKFORCE & MANDAYS ANALYTICS COCKPIT */}
      {viewMode === 'POWER_BI_WORKFORCE' && (
        <>
          {/* Dynamic Interactive Slicers Bar */}
          <div
            className="glass-card"
            style={{
              padding: '18px 20px',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>
                <SlidersHorizontal size={16} color="#10b981" />
                <span>Power BI Dynamic Slicers & Cross-Filtering</span>
                {hasActiveSlicers && (
                  <span
                    style={{
                      fontSize: '11px',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: '700',
                    }}
                  >
                    Active Slicers Applied
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {hasActiveSlicers && (
                  <button
                    onClick={handleResetSlicers}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      color: '#94a3b8',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '6px',
                    }}
                    title="Reset all slicers"
                  >
                    <RotateCcw size={13} />
                    <span>Reset Slicers</span>
                  </button>
                )}
                <button
                  onClick={handleDownloadWorkforceExcel}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                  title="Download filtered dataset in Excel-compatible CSV format"
                >
                  <FileSpreadsheet size={15} />
                  <span>📥 Export to Excel / CSV</span>
                </button>
              </div>
            </div>

            {/* Slicers Dropdown Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '12px',
              }}
            >
              {/* Slicer 1: Project */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '5px' }}>
                  🏢 PROJECT / CLIENT BRAND
                </label>
                <select
                  value={slicerProject}
                  onChange={(e) => setSlicerProject(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '13px', width: '100%' }}
                >
                  <option value="ALL">All Projects ({workforceData?.slicerOptions.projects.length || 0})</option>
                  {workforceData?.slicerOptions.projects.map((p) => (
                    <option key={p.id} value={p.code}>
                      [{p.code}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Slicer 2: Area / Territory */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '5px' }}>
                  📍 GEOGRAPHIC AREA / TERRITORY
                </label>
                <select
                  value={slicerArea}
                  onChange={(e) => setSlicerArea(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '13px', width: '100%' }}
                >
                  <option value="ALL">All Territories ({workforceData?.slicerOptions.areas.length || 0})</option>
                  {workforceData?.slicerOptions.areas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              {/* Slicer 3: Position / Role */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '5px' }}>
                  💼 POSITION / JOB ROLE
                </label>
                <select
                  value={slicerRole}
                  onChange={(e) => setSlicerRole(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '13px', width: '100%' }}
                >
                  <option value="ALL">All Positions ({workforceData?.slicerOptions.roles.length || 0})</option>
                  {workforceData?.slicerOptions.roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Slicer 4: Timeframe */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '5px' }}>
                  📅 REQUISITION TIMEFRAME
                </label>
                <select
                  value={slicerTimeframe}
                  onChange={(e) => setSlicerTimeframe(e.target.value as any)}
                  className="form-input"
                  style={{ fontSize: '13px', width: '100%' }}
                >
                  <option value="ALL">All Time (Cumulative)</option>
                  <option value="7D">Last 7 Days</option>
                  <option value="30D">Last 30 Days</option>
                  <option value="THIS_MONTH">This Month</option>
                </select>
              </div>
            </div>
          </div>

          {workforceLoading && !workforceData ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              Loading Power BI Workforce & Mandays Analytics from Database...
            </div>
          ) : workforceData ? (
            <>
              {/* 4 Power BI KPI Summary Tiles */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                  gap: '16px',
                }}
              >
                {/* Tile 1: Planned Mandays */}
                <div className="glass-card" style={{ padding: '18px 20px', borderRadius: '14px', borderLeft: '4px solid #38bdf8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '800', letterSpacing: '0.05em' }}>
                      PLANNED MANDAYS (MONTHLY)
                    </span>
                    <Briefcase size={18} color="#38bdf8" />
                  </div>
                  <div style={{ fontSize: '30px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '10px' }}>
                    {workforceData.scorecard.totalPlannedMandays.toLocaleString('en-IN')}{' '}
                    <span style={{ fontSize: '15px', color: '#94a3b8', fontWeight: '600' }}>Mandays</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {workforceData.scorecard.totalPositions} positions × 26 planned mandays
                  </div>
                </div>

                {/* Tile 2: Mandays Delivered */}
                <div className="glass-card" style={{ padding: '18px 20px', borderRadius: '14px', borderLeft: '4px solid #10b981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '800', letterSpacing: '0.05em' }}>
                      MANDAYS DELIVERED (ACTIVE)
                    </span>
                    <CheckCircle size={18} color="#10b981" />
                  </div>
                  <div style={{ fontSize: '30px', fontWeight: '800', color: '#34d399', marginTop: '10px' }}>
                    {workforceData.scorecard.totalDeliveredMandays.toLocaleString('en-IN')}{' '}
                    <span style={{ fontSize: '15px', color: '#94a3b8', fontWeight: '600' }}>Mandays</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#34d399', marginTop: '4px', fontWeight: '600' }}>
                    {workforceData.scorecard.overallFulfillmentPercent}% of target operations fulfilled
                  </div>
                </div>

                {/* Tile 3: Mandays Lost & Opportunity Gap */}
                <div className="glass-card" style={{ padding: '18px 20px', borderRadius: '14px', borderLeft: '4px solid #f43f5e' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '800', letterSpacing: '0.05em' }}>
                      MANDAYS LOST (VACANCY GAP)
                    </span>
                    <AlertTriangle size={18} color="#f43f5e" />
                  </div>
                  <div style={{ fontSize: '30px', fontWeight: '800', color: '#fb7185', marginTop: '10px' }}>
                    {workforceData.scorecard.totalLostMandays.toLocaleString('en-IN')}{' '}
                    <span style={{ fontSize: '15px', color: '#94a3b8', fontWeight: '600' }}>Mandays</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: '700',
                        color: '#fb7185',
                        backgroundColor: 'rgba(244, 63, 94, 0.15)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      ⚠️ {workforceData.scorecard.totalLossDisplay} Opportunity Loss
                    </span>
                  </div>
                </div>

                {/* Tile 4: Fulfillment Efficiency % */}
                <div
                  className="glass-card"
                  style={{
                    padding: '18px 20px',
                    borderRadius: '14px',
                    borderLeft: `4px solid ${
                      workforceData.scorecard.overallFulfillmentPercent >= 75
                        ? '#10b981'
                        : workforceData.scorecard.overallFulfillmentPercent >= 50
                        ? '#fbbf24'
                        : '#f43f5e'
                    }`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '800', letterSpacing: '0.05em' }}>
                      FULFILLMENT EFFICIENCY
                    </span>
                    <TrendingUp size={18} color="#fbbf24" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '10px' }}>
                    <span style={{ fontSize: '30px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {workforceData.scorecard.overallFulfillmentPercent}%
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      Target: 90%
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {workforceData.scorecard.filledPositions} filled / {workforceData.scorecard.activeVacancies} open ({workforceData.scorecard.overallFillRatePercent}% fill rate)
                  </div>
                </div>
              </div>

              {/* 📈 Territory Recruitment & Activation Trends (Multi-Line Chart Over Time) */}
              <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={20} color="#38bdf8" />
                      <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>
                        Area Recruitment & Territory Activation Trends Over Time
                      </h3>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          padding: '2px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        {trendData?.summary.totalDays || 0} Days Tracked
                      </span>
                    </div>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Multi-line trajectory tracking each recruiter territory against calendar days. Hover cursor reveals precise date benchmarks across areas.
                    </p>
                  </div>

                  {/* Metric Switcher: Percentage (%) vs Filled Count vs Open Count */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', backgroundColor: 'var(--bg-surface-elevated)', padding: '3px', borderRadius: '8px' }}>
                      <button
                        onClick={() => setTrendMetric('PERCENTAGE')}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '700',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: trendMetric === 'PERCENTAGE' ? '#38bdf8' : 'transparent',
                          color: trendMetric === 'PERCENTAGE' ? '#0f172a' : '#94a3b8',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        📈 Fill Rate (%)
                      </button>
                      <button
                        onClick={() => setTrendMetric('FILLED_COUNT')}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '700',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: trendMetric === 'FILLED_COUNT' ? '#10b981' : 'transparent',
                          color: trendMetric === 'FILLED_COUNT' ? '#0f172a' : '#94a3b8',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        👥 Filled Hires (Count)
                      </button>
                      <button
                        onClick={() => setTrendMetric('OPEN_COUNT')}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '700',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: trendMetric === 'OPEN_COUNT' ? '#f43f5e' : 'transparent',
                          color: trendMetric === 'OPEN_COUNT' ? '#0f172a' : '#94a3b8',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        ⏳ Open Vacancies (Count)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Date Range Filter Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '12px 14px',
                    backgroundColor: 'rgba(15, 23, 42, 0.02)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#94a3b8' }}>
                      📅 Date Range Filter:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>From</span>
                      <input
                        type="date"
                        value={trendStartDate}
                        min={trendData?.filterOptions.minDate}
                        max={trendEndDate || trendData?.filterOptions.maxDate}
                        onChange={(e) => setTrendStartDate(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '12px', padding: '4px 8px', height: '32px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>To</span>
                      <input
                        type="date"
                        value={trendEndDate}
                        min={trendStartDate || trendData?.filterOptions.minDate}
                        max={trendData?.filterOptions.maxDate}
                        onChange={(e) => setTrendEndDate(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '12px', padding: '4px 8px', height: '32px' }}
                      />
                    </div>
                  </div>

                  {/* Quick Range Presets */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', marginRight: '2px' }}>Quick:</span>
                    <button
                      onClick={() => handleQuickPresetDays(7)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px', height: '28px' }}
                    >
                      7 Days
                    </button>
                    <button
                      onClick={() => handleQuickPresetDays(14)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px', height: '28px' }}
                    >
                      14 Days
                    </button>
                    <button
                      onClick={() => handleQuickPresetDays(30)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px', height: '28px' }}
                    >
                      30 Days
                    </button>
                    <button
                      onClick={() => handleQuickPresetDays('ALL')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px', height: '28px' }}
                    >
                      All Dates
                    </button>
                  </div>
                </div>

                {/* Chart Component */}
                {trendLoading && !trendData ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    Loading territory time-series trends from database...
                  </div>
                ) : trendData && trendData.areas.length > 0 ? (
                  <AreaTrendLineChart
                    data={trendData}
                    metric={trendMetric}
                    visibleAreas={visibleTrendAreas}
                    onToggleArea={handleToggleTrendArea}
                    onSelectAllAreas={handleSelectAllTrendAreas}
                    onClearAllAreas={handleClearTrendAreas}
                  />
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    No vacancy records found for the selected project, role, or date criteria.
                  </div>
                )}
              </div>

              {/* Analytics Visual Charts Section (Graph 1 & Graph 2) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
                  gap: '20px',
                }}
              >
                {/* Graph 1: Mandays Operational Volume (Delivered vs. Lost) */}
                <div className="glass-card" style={{ padding: '22px', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '15.5px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BarChart3 size={18} color="#38bdf8" />
                        <span>Graph 1: Mandays Volume (Delivered vs. Lost)</span>
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Operational mandays delivered against lost mandays from vacancy delays.
                      </p>
                    </div>

                    {/* Dimension Toggle: Project vs Area */}
                    <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-surface-elevated)', padding: '3px', borderRadius: '8px' }}>
                      <button
                        onClick={() => setGraph1Dimension('PROJECT')}
                        style={{
                          padding: '5px 10px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: graph1Dimension === 'PROJECT' ? '#38bdf8' : 'transparent',
                          color: graph1Dimension === 'PROJECT' ? '#0f172a' : '#94a3b8',
                        }}
                      >
                        🏢 Project
                      </button>
                      <button
                        onClick={() => setGraph1Dimension('AREA')}
                        style={{
                          padding: '5px 10px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: graph1Dimension === 'AREA' ? '#38bdf8' : 'transparent',
                          color: graph1Dimension === 'AREA' ? '#0f172a' : '#94a3b8',
                        }}
                      >
                        📍 Territory
                      </button>
                    </div>
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', fontSize: '12px', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#10b981' }}></div>
                      <span>Delivered Mandays</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#f43f5e' }}></div>
                      <span>Lost Mandays (Friction Gap)</span>
                    </div>
                  </div>

                  {/* Graph Bars List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '360px', overflowY: 'auto' }}>
                    {(graph1Dimension === 'PROJECT' ? workforceData.mandaysByProject : workforceData.mandaysByArea).map((item: any, idx) => {
                      const title = graph1Dimension === 'PROJECT' ? `[${item.code}] ${item.name}` : item.area;
                      const planned = item.plannedMandays || 1;
                      const delivered = item.deliveredMandays;
                      const lost = item.lostMandays;
                      const delPct = Math.round((delivered / planned) * 100);
                      const lostPct = Math.round((lost / planned) * 100);

                      return (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: 'rgba(15, 23, 42, 0.02)',
                            padding: '12px 14px',
                            borderRadius: '10px',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>{title}</span>
                            <div style={{ display: 'flex', gap: '10px', fontSize: '11.5px' }}>
                              <span style={{ color: '#34d399', fontWeight: '700' }}>✓ {delivered} Delivered ({delPct}%)</span>
                              <span style={{ color: '#fb7185', fontWeight: '700' }}>✕ {lost} Lost ({lostPct}%)</span>
                              <span style={{ color: '#94a3b8' }}>Plan: {planned}d</span>
                            </div>
                          </div>
                          {/* Stacked Progress Bar */}
                          <div style={{ height: '12px', backgroundColor: 'rgba(15, 23, 42, 0.08)', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                            <div
                              style={{
                                width: `${Math.min(100, delPct)}%`,
                                backgroundColor: '#10b981',
                                height: '100%',
                                transition: 'width 0.3s ease',
                              }}
                              title={`Delivered: ${delivered} mandays (${delPct}%)`}
                            />
                            <div
                              style={{
                                width: `${Math.min(100, lostPct)}%`,
                                backgroundColor: '#f43f5e',
                                height: '100%',
                                transition: 'width 0.3s ease',
                              }}
                              title={`Lost: ${lost} mandays (${lostPct}%)`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Graph 2: Staffing Efficiency & Fulfillment % by Position (with 90% Target) */}
                <div className="glass-card" style={{ padding: '22px', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '15.5px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={18} color="#fbbf24" />
                        <span>Graph 2: Staffing Efficiency % by Role (vs 90% Target)</span>
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Field staffing efficiency benchmarked against the standard 90% target SLA requirement.
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#fbbf24', fontWeight: '700' }}>
                      <span style={{ display: 'inline-block', width: '12px', height: '2px', backgroundColor: '#fbbf24' }}></span>
                      <span>90% Target Reference</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '360px', overflowY: 'auto' }}>
                    {workforceData.efficiencyByRole.map((role, idx) => {
                      const pct = role.fulfillmentPercent;
                      const isTargetAchieved = pct >= 90;
                      const barColor = isTargetAchieved ? '#10b981' : pct >= 65 ? '#fbbf24' : '#f43f5e';

                      return (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: 'rgba(15, 23, 42, 0.02)',
                            padding: '12px 14px',
                            borderRadius: '10px',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>{role.roleTitle}</span>
                              <span style={{ fontSize: '11.5px', color: '#94a3b8', marginLeft: '8px' }}>
                                ({role.totalPositions} pos: {role.filledPositions} filled, {role.openPositions} open)
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '800', color: barColor }}>{pct}%</span>
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: '700',
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  backgroundColor: isTargetAchieved
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : pct >= 65
                                    ? 'rgba(251, 191, 36, 0.15)'
                                    : 'rgba(244, 63, 94, 0.15)',
                                  color: barColor,
                                }}
                              >
                                {isTargetAchieved ? '✓ Target Met' : pct >= 65 ? '⚠ Moderate Gap' : '✕ Critical Gap'}
                              </span>
                            </div>
                          </div>

                          {/* Bar with 90% benchmark indicator */}
                          <div style={{ position: 'relative', height: '12px', backgroundColor: 'rgba(15, 23, 42, 0.08)', borderRadius: '6px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, pct)}%`,
                                height: '100%',
                                backgroundColor: barColor,
                                transition: 'width 0.4s ease',
                                borderRadius: '6px',
                              }}
                            />
                            {/* 90% Benchmark Line Marker */}
                            <div
                              style={{
                                position: 'absolute',
                                left: '90%',
                                top: 0,
                                bottom: 0,
                                width: '2px',
                                backgroundColor: '#ffffff',
                                boxShadow: '0 0 6px rgba(6, 148, 148, 0.5)',
                                zIndex: 2,
                              }}
                              title="90% Benchmark Target"
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <span>Delivered: {role.deliveredMandays} d | Lost: {role.lostMandays} d</span>
                            <span>Target: 90% SLA Benchmark</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Multi-Dimensional Matrix Table (Project × Area × Position) */}
              <div className="glass-card" style={{ padding: '22px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileSpreadsheet size={18} color="#10b981" />
                      <span>Multi-Dimensional Matrix Table (Project × Area × Position)</span>
                    </h3>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Dynamic hierarchy aggregated directly from database records ({filteredMatrixRows.length} active rows).
                    </p>
                  </div>

                  {/* Search within matrix rows & export button */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Search matrix rows..."
                        value={matrixSearch}
                        onChange={(e) => setMatrixSearch(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '32px', fontSize: '12.5px', width: '220px', height: '36px' }}
                      />
                    </div>
                    <button
                      onClick={handleDownloadWorkforceExcel}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', height: '36px' }}
                    >
                      <Download size={15} />
                      <span>Download Excel (.CSV)</span>
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                    <thead>
                      <tr
                        style={{
                          backgroundColor: 'var(--bg-surface-elevated)',
                          borderBottom: '1px solid var(--border-subtle)',
                          color: '#94a3b8',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        <th style={{ padding: '12px 14px' }}>Project</th>
                        <th style={{ padding: '12px 14px' }}>Territory Area</th>
                        <th style={{ padding: '12px 14px' }}>Position / Role</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Total Slots</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Filled</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Open</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Planned (d)</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Delivered (d)</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Lost (d)</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Efficiency %</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Opportunity Loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMatrixRows.map((row, idx) => {
                        const effColor = row.efficiencyPercent >= 75 ? '#34d399' : row.efficiencyPercent >= 50 ? '#fbbf24' : '#fb7185';
                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              backgroundColor: idx % 2 === 0 ? 'transparent' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '12px 14px' }}>
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: '800',
                                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                  color: '#38bdf8',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  marginRight: '6px',
                                }}
                              >
                                {row.projectCode}
                              </span>
                              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{row.projectName}</span>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#cbd5e1' }}>{row.area}</td>
                            <td style={{ padding: '12px 14px', fontWeight: '600', color: 'var(--text-primary)' }}>{row.roleTitle}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700' }}>{row.totalSlots}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center', color: '#34d399', fontWeight: '700' }}>{row.filledSlots}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center', color: row.openSlots > 0 ? '#fb7185' : '#94a3b8', fontWeight: '700' }}>
                              {row.openSlots}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: '#cbd5e1' }}>{row.plannedMandays}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: '#34d399', fontWeight: '600' }}>{row.deliveredMandays}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: '#fb7185', fontWeight: '600' }}>{row.lostMandays}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <span style={{ fontWeight: '700', color: effColor }}>{row.efficiencyPercent}%</span>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: row.lossInr > 0 ? '#fb7185' : '#94a3b8', fontWeight: '700' }}>
                              {row.lossDisplay}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Grand Total Row */}
                      <tr
                        style={{
                          backgroundColor: 'rgba(56, 189, 248, 0.08)',
                          borderTop: '2px solid rgba(56, 189, 248, 0.3)',
                          fontWeight: '800',
                          fontSize: '13px',
                        }}
                      >
                        <td colSpan={3} style={{ padding: '14px', color: '#38bdf8' }}>
                          👑 GRAND TOTAL ({filteredMatrixRows.length} Matrix Hierarchies)
                        </td>
                        <td style={{ padding: '14px', textAlign: 'center', color: 'var(--text-primary)' }}>{matrixGrandTotals.totalSlots}</td>
                        <td style={{ padding: '14px', textAlign: 'center', color: '#34d399' }}>{matrixGrandTotals.filledSlots}</td>
                        <td style={{ padding: '14px', textAlign: 'center', color: '#fb7185' }}>{matrixGrandTotals.openSlots}</td>
                        <td style={{ padding: '14px', textAlign: 'right', color: 'var(--text-primary)' }}>{matrixGrandTotals.plannedMandays}</td>
                        <td style={{ padding: '14px', textAlign: 'right', color: '#34d399' }}>{matrixGrandTotals.deliveredMandays}</td>
                        <td style={{ padding: '14px', textAlign: 'right', color: '#fb7185' }}>{matrixGrandTotals.lostMandays}</td>
                        <td style={{ padding: '14px', textAlign: 'center', color: '#38bdf8' }}>{matrixGrandTotals.efficiencyPercent}%</td>
                        <td style={{ padding: '14px', textAlign: 'right', color: '#fb7185', fontSize: '13.5px' }}>{matrixGrandTotals.lossDisplay}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {/* VIEW 1: AREA ACTIVATION & VACANCY SUMMARY DASHBOARD */}
      {viewMode === 'AREA_ACTIVATION' && (
        <>
          {/* Dynamic Filter Controls Bar */}
          <div
            className="glass-card"
            style={{
              padding: '18px 20px',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>
                <SlidersHorizontal size={16} color="#38bdf8" />
                <span>Interactive Filters & Search</span>
                {hasActiveFilters && (
                  <span
                    style={{
                      fontSize: '11px',
                      backgroundColor: 'rgba(56, 189, 248, 0.2)',
                      color: '#38bdf8',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: '700',
                    }}
                  >
                    Active
                  </span>
                )}
              </div>

              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    color: '#94a3b8',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '6px',
                  }}
                  title="Clear all filters"
                >
                  <RotateCcw size={13} />
                  <span>Reset All Filters</span>
                </button>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
              }}
            >
              {/* Search Box */}
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  placeholder="Search ID, Area, Role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '32px', fontSize: '13px' }}
                />
              </div>

              {/* Date Range Filter */}
              <div>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="form-select"
                  style={{ fontSize: '13px' }}
                >
                  <option value="ALL">📅 Date: All Time</option>
                  <option value="7D">📅 Last 7 Days</option>
                  <option value="30D">📅 Last 30 Days</option>
                  <option value="THIS_MONTH">📅 This Month</option>
                </select>
              </div>

              {/* Area Filter */}
              <div>
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="form-select"
                  style={{ fontSize: '13px' }}
                >
                  <option value="ALL">📍 Area: All Areas</option>
                  {availableAreas.map((area) => (
                    <option key={area} value={area}>
                      📍 {area}
                    </option>
                  ))}
                </select>
              </div>

              {/* Brand / Project Filter */}
              <div>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="form-select"
                  style={{ fontSize: '13px' }}
                >
                  <option value="ALL">🏢 Brand: All Brands</option>
                  {availableBrands.map(([code, name]) => (
                    <option key={code} value={code}>
                      🏢 {name} ({code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Filter */}
              <div>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="form-select"
                  style={{ fontSize: '13px' }}
                >
                  <option value="ALL">💼 Role: All Roles</option>
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      💼 {role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vacancy Status Filter */}
              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="form-select"
                  style={{ fontSize: '13px' }}
                >
                  <option value="ALL">⚡ Status: All Statuses</option>
                  <option value="OPEN">🔵 Open Vacancies</option>
                  <option value="IN_REVIEW">🟡 In Review (Tiers)</option>
                  <option value="FILLED">🟢 Filled (Completed)</option>
                  <option value="CLOSED">⚪ Closed / Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Top 4 KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '16px',
            }}
          >
            {/* KPI 1: Total Vacancies */}
            <div className="glass-card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '4px solid #818cf8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '800', letterSpacing: '0.04em' }}>
                  TOTAL VACANCIES
                </span>
                <Briefcase size={20} color="#818cf8" />
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '10px' }}>
                {totalFilteredCount}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Total positions within selected criteria
              </div>
            </div>

            {/* KPI 2: Open Vacancies */}
            <div className="glass-card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '4px solid #38bdf8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '800', letterSpacing: '0.04em' }}>
                  OPEN VACANCIES
                </span>
                <Clock size={20} color="#38bdf8" />
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#38bdf8', marginTop: '10px' }}>
                {openCount}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Actively available for candidate sourcing
              </div>
            </div>

            {/* KPI 3: Filled Vacancies */}
            <div className="glass-card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '4px solid #34d399' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#34d399', fontWeight: '800', letterSpacing: '0.04em' }}>
                  FILLED VACANCIES
                </span>
                <CheckCircle size={20} color="#34d399" />
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#34d399', marginTop: '10px' }}>
                {filledCount}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Candidates successfully hired / onboarded
              </div>
            </div>

            {/* KPI 4: Closed / In Review */}
            <div className="glass-card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '4px solid #fbbf24' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: '800', letterSpacing: '0.04em' }}>
                  IN REVIEW / CLOSED
                </span>
                <AlertCircle size={20} color="#fbbf24" />
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#fbbf24', marginTop: '10px' }}>
                {closedOrInReviewCount}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Under sequential approval or finalized
              </div>
            </div>
          </div>

          {/* Visual Distribution & Area Comparison Section */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Chart 1: Vacancies by Area (Ranked Volume Bars) */}
            <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>VACANCIES BY AREA</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Ranked by total requisition volume • Click an area to filter
                  </p>
                </div>
                <BarChart3 size={18} color="#38bdf8" />
              </div>

              {topAreasRanking.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0' }}>No area data matching filters</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {topAreasRanking.map((item) => (
                    <div
                      key={item.area}
                      onClick={() => setSelectedArea(item.area)}
                      style={{
                        cursor: 'pointer',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        backgroundColor: selectedArea === item.area ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                        transition: 'background-color 0.15s ease',
                      }}
                      title={`Filter by ${item.area}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '600', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={13} color="#38bdf8" />
                          {item.area}
                        </span>
                        <span style={{ fontWeight: '700', color: '#38bdf8' }}>
                          {item.total} <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>({item.fillRate}% filled)</span>
                        </span>
                      </div>
                      <div
                        style={{
                          height: '8px',
                          backgroundColor: 'rgba(15, 23, 42, 0.08)',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${item.percentageOfMax}%`,
                            backgroundColor: '#38bdf8',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chart 2: Vacancy Status Distribution */}
            <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>VACANCY STATUS DISTRIBUTION</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Current status breakdown across active requisitions
                  </p>
                </div>
                <Activity size={18} color="#34d399" />
              </div>

              {totalFilteredCount === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0' }}>No vacancies matching filters</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Multi-segment stacked progress bar */}
                  <div
                    style={{
                      height: '14px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      display: 'flex',
                      backgroundColor: 'rgba(15, 23, 42, 0.08)',
                    }}
                  >
                    <div style={{ width: `${statusPercentages.openPct}%`, backgroundColor: '#38bdf8' }} title={`Open: ${openCount} (${statusPercentages.openPct}%)`} />
                    <div style={{ width: `${statusPercentages.filledPct}%`, backgroundColor: '#34d399' }} title={`Filled: ${filledCount} (${statusPercentages.filledPct}%)`} />
                    <div style={{ width: `${statusPercentages.closedPct}%`, backgroundColor: '#fbbf24' }} title={`In Review / Closed: ${closedOrInReviewCount} (${statusPercentages.closedPct}%)`} />
                  </div>

                  {/* Legend Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '700' }}>OPEN</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{openCount}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{statusPercentages.openPct}%</div>
                    </div>

                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(52, 211, 153, 0.08)',
                        border: '1px solid rgba(52, 211, 153, 0.2)',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#34d399', fontWeight: '700' }}>FILLED</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{filledCount}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{statusPercentages.filledPct}%</div>
                    </div>

                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(251, 191, 36, 0.08)',
                        border: '1px solid rgba(251, 191, 36, 0.2)',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: '700' }}>IN REVIEW</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{closedOrInReviewCount}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{statusPercentages.closedPct}%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. AREA-WISE VACANCY SUMMARY TABLE */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800' }}>Area-Wise Vacancy & Activation Summary</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Regional summary matrix • Click any area row to filter the detailed list below
                </p>
              </div>
              {selectedArea !== 'ALL' && (
                <button
                  onClick={() => setSelectedArea('ALL')}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>Showing Area: {selectedArea} (Clear)</span>
                </button>
              )}
            </div>

            {areaSummaryList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>No area vacancy summary records match the filters.</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Area Territory</th>
                      <th style={{ textAlign: 'right' }}>Total Vacancies</th>
                      <th style={{ textAlign: 'right' }}>Open</th>
                      <th style={{ textAlign: 'right' }}>Filled</th>
                      <th style={{ textAlign: 'right' }}>In Review / Closed</th>
                      <th style={{ textAlign: 'right' }}>Fill Rate (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaSummaryList.map((row) => {
                      const isSelected = selectedArea === row.area;
                      return (
                        <tr
                          key={row.area}
                          onClick={() => setSelectedArea(isSelected ? 'ALL' : row.area)}
                          style={{
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.1)' : undefined,
                            transition: 'background-color 0.15s ease',
                          }}
                          title="Click to filter details table"
                        >
                          <td>
                            <strong style={{ color: isSelected ? '#38bdf8' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <MapPin size={14} color={isSelected ? '#38bdf8' : '#94a3b8'} />
                              <span>{row.area}</span>
                              {isSelected && <span style={{ fontSize: '11px', color: '#38bdf8' }}>(Active Filter)</span>}
                            </strong>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '700' }}>{row.total}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                fontWeight: '700',
                                fontSize: '12px',
                              }}
                            >
                              {row.open}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(52, 211, 153, 0.15)',
                                color: '#34d399',
                                fontWeight: '700',
                                fontSize: '12px',
                              }}
                            >
                              {row.filled}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(251, 191, 36, 0.15)',
                                color: '#fbbf24',
                                fontWeight: '700',
                                fontSize: '12px',
                              }}
                            >
                              {row.closed}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              <div
                                style={{
                                  width: '50px',
                                  height: '6px',
                                  backgroundColor: 'var(--bg-surface-elevated)',
                                  borderRadius: '3px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${row.fillRate}%`,
                                    backgroundColor: row.fillRate >= 70 ? '#34d399' : row.fillRate >= 40 ? '#fbbf24' : '#38bdf8',
                                  }}
                                />
                              </div>
                              <span style={{ fontWeight: '700', fontSize: '12.5px', color: 'var(--text-primary)' }}>{row.fillRate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Grand Total Row */}
                  <tfoot>
                    <tr
                      style={{
                        borderTop: '2px solid var(--border-medium)',
                        backgroundColor: 'var(--border-subtle)',
                        fontWeight: '800',
                      }}
                    >
                      <td>
                        <span style={{ color: '#38bdf8', letterSpacing: '0.04em' }}>GRAND TOTAL</span>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '14px', color: 'var(--text-primary)' }}>{grandTotal.total}</td>
                      <td style={{ textAlign: 'right', fontSize: '14px', color: '#38bdf8' }}>{grandTotal.open}</td>
                      <td style={{ textAlign: 'right', fontSize: '14px', color: '#34d399' }}>{grandTotal.filled}</td>
                      <td style={{ textAlign: 'right', fontSize: '14px', color: '#fbbf24' }}>{grandTotal.closed}</td>
                      <td style={{ textAlign: 'right', fontSize: '14px', color: '#34d399' }}>{grandTotal.fillRate}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* 4. DETAILED VACANCY DRILL-DOWN TABLE (CLICKABLE VACANCY IDS) */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800' }}>Vacancy Details & Requisition Records</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Click any <strong>Vacancy ID</strong> or &quot;View Details&quot; to inspect full candidate and approver records
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Showing {filteredVacancies.length} of {vacancies.length} vacancies
                </span>
                <Link to="/vacancies" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Sourcing Feed</span>
                  <ArrowUpRight size={13} />
                </Link>
              </div>
            </div>

            {filteredVacancies.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>No vacancies found matching selected filter criteria.</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vacancy ID</th>
                      <th>Area</th>
                      <th>Brand / Client</th>
                      <th>Job Role Title</th>
                      <th>Experience</th>
                      <th>Salary (₹ / Month)</th>
                      <th>Status</th>
                      <th>Created Date</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVacancies.map((vac) => {
                      const activeSub = vac.submissions?.[0];
                      const formattedDate = vac.createdAt
                        ? new Date(vac.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—';

                      return (
                        <tr key={vac.id}>
                          <td>
                            <button
                              onClick={() => handleOpenDossier(vac)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                              title="Click to view full vacancy dossier"
                            >
                              <strong
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  color: 'var(--primary)',
                                  fontSize: '13px',
                                  textDecoration: 'underline',
                                  textUnderlineOffset: '3px',
                                }}
                              >
                                {vac.vacancyCode || 'FLAGGED'}
                              </strong>
                            </button>
                          </td>
                          <td>
                            <div style={{ fontWeight: '600' }}>{vac.area}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{vac.zone} Zone</div>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                color: 'var(--primary)',
                                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                padding: '2px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              {vac.project?.name || vac.project?.code || 'Brand'}
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '13.5px' }}>{vac.title}</strong>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{vac.experience || 'Standard'}</span>
                          </td>
                          <td>
                            <strong style={{ color: '#34d399', fontSize: '12.5px' }}>
                              {vac.salary || 'Market Rate (₹)'}
                            </strong>
                          </td>
                          <td>
                            <Badge status={vac.status} level={activeSub?.currentLevel || 1} />
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {formattedDate}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleOpenDossier(vac)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Inspect full vacancy specs"
                            >
                              <Eye size={13} />
                              <span>Details</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW 2: EXECUTIVE PREDICTIVE INTELLIGENCE (DATA SCIENCE COCKPIT) */}
      {viewMode === 'EXECUTIVE_INTELLIGENCE' && (
        <>
          {/* Executive KPI Scoreboard */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '16px',
            }}
          >
            <div className="glass-card" style={{ padding: '16px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>OVERALL FILL RATE</span>
                <CheckCircle size={18} color="#34d399" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
                {score?.overallFillRate ?? 78}%
              </div>
              <div style={{ fontSize: '11.5px', color: '#34d399', marginTop: '4px' }}>
                {score?.filledVacancies ?? 0} of {score?.totalVacancies ?? 0} positions filled
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>AVG CONSUMPTION TIME</span>
                <Clock size={18} color="#38bdf8" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
                {score?.avgConsumptionDays ?? 1.8} <span style={{ fontSize: '16px', fontWeight: '600', color: '#94a3b8' }}>Days</span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#38bdf8', marginTop: '4px' }}>
                Creation to final Level 3 approval
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>SLA COMPLIANCE</span>
                <ShieldCheck size={18} color="#10b981" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
                {score?.slaComplianceRate ?? 92}%
              </div>
              <div style={{ fontSize: '11.5px', color: '#10b981', marginTop: '4px' }}>
                Filled within target SLA window
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>RUN-RATE FORECAST</span>
                <TrendingUp size={18} color="#fbbf24" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
                {score?.estimatedCompletionDays ?? 4} <span style={{ fontSize: '16px', fontWeight: '600', color: '#94a3b8' }}>Days</span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#fbbf24', marginTop: '4px' }}>
                ETA to 100% headcount at {score?.dailyVelocity ?? 1.2} hires/day
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>FIRST-TIME-RIGHT %</span>
                <Zap size={18} color="#a855f7" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
                {score?.firstTimeRightRate ?? 85}%
              </div>
              <div style={{ fontSize: '11.5px', color: '#a855f7', marginTop: '4px' }}>
                Candidate pass rate without rejection
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>TOTAL PAYROLL BUDGET</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#34d399' }}>₹</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#34d399', marginTop: '8px' }}>
                {score?.totalPayrollDisplay ?? '₹18.5 Lakhs'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                Total compensation pipeline (₹ INR)
              </div>
            </div>
          </div>

          {/* 5 Data Science Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '12px',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => setActiveTab('ROLES')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: activeTab === 'ROLES' ? '1px solid #38bdf8' : '1px solid transparent',
                backgroundColor: activeTab === 'ROLES' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeTab === 'ROLES' ? '#38bdf8' : 'var(--text-secondary)',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <Briefcase size={16} />
              <span>1. Role Intelligence & Salary Bands (₹)</span>
            </button>

            <button
              onClick={() => setActiveTab('AREAS')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: activeTab === 'AREAS' ? '1px solid #fbbf24' : '1px solid transparent',
                backgroundColor: activeTab === 'AREAS' ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
                color: activeTab === 'AREAS' ? '#fbbf24' : 'var(--text-secondary)',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <MapPin size={16} />
              <span>2. Area & Zone Friction Heatmap</span>
            </button>

            <button
              onClick={() => setActiveTab('PROJECTS')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: activeTab === 'PROJECTS' ? '1px solid #34d399' : '1px solid transparent',
                backgroundColor: activeTab === 'PROJECTS' ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
                color: activeTab === 'PROJECTS' ? '#34d399' : 'var(--text-secondary)',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <Users size={16} />
              <span>3. Project Headcount Forecasting</span>
            </button>

            <button
              onClick={() => setActiveTab('SLA_BOTTLENECK')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: activeTab === 'SLA_BOTTLENECK' ? '1px solid #a855f7' : '1px solid transparent',
                backgroundColor: activeTab === 'SLA_BOTTLENECK' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                color: activeTab === 'SLA_BOTTLENECK' ? '#c084fc' : 'var(--text-secondary)',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <Clock size={16} />
              <span>4. Cycle Latency & Bottleneck Tier</span>
            </button>

            <button
              onClick={() => setActiveTab('REJECTIONS')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: activeTab === 'REJECTIONS' ? '1px solid #f87171' : '1px solid transparent',
                backgroundColor: activeTab === 'REJECTIONS' ? 'rgba(248, 113, 113, 0.15)' : 'transparent',
                color: activeTab === 'REJECTIONS' ? '#f87171' : 'var(--text-secondary)',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <AlertCircle size={16} />
              <span>5. Sourcing & Rejection Pareto</span>
            </button>
          </div>

          {/* Module 1: Role Intelligence */}
          {activeTab === 'ROLES' && (
            <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '14px' }}>
                Role Intelligence & Compensation Bands (₹ Indian Rupees)
              </h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Role Position</th>
                      <th>Total Demand</th>
                      <th>Active Sourcing</th>
                      <th>In Review</th>
                      <th>Filled</th>
                      <th>Fill Rate %</th>
                      <th>Avg Market Salary (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.roleIntelligence.map((r) => (
                      <tr key={r.roleTitle}>
                        <td><strong>{r.roleTitle}</strong></td>
                        <td>{r.total}</td>
                        <td><span style={{ color: '#38bdf8', fontWeight: '700' }}>{r.active}</span></td>
                        <td><span style={{ color: '#fbbf24', fontWeight: '700' }}>{r.pending}</span></td>
                        <td><span style={{ color: '#34d399', fontWeight: '700' }}>{r.filled}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '40px', height: '6px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${r.fillRate}%`, backgroundColor: '#34d399' }} />
                            </div>
                            <span style={{ fontWeight: '700' }}>{r.fillRate}%</span>
                          </div>
                        </td>
                        <td><strong style={{ color: '#34d399' }}>{r.salaryDisplay}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Module 2: Area & Zone Friction */}
          {activeTab === 'AREAS' && (
            <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '14px' }}>
                Geographic Sourcing Friction & Velocity Heatmap
              </h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>Area Territory</th>
                      <th>Total Requisitions</th>
                      <th>Filled</th>
                      <th>Fill Rate %</th>
                      <th>Avg Days Consumed</th>
                      <th>Friction Score</th>
                      <th>Operational Diagnosis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.areaFrictionList.map((a) => (
                      <tr key={`${a.zone}_${a.area}`}>
                        <td><span style={{ fontWeight: '600', color: '#818cf8' }}>{a.zone}</span></td>
                        <td><strong>{a.area}</strong></td>
                        <td>{a.total}</td>
                        <td>{a.filled}</td>
                        <td><strong style={{ color: '#34d399' }}>{a.fillRate}%</strong></td>
                        <td>{a.avgDays} Days</td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: '800',
                              fontSize: '12px',
                              backgroundColor: a.frictionScore > 65 ? 'rgba(239, 68, 68, 0.15)' : a.frictionScore > 35 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                              color: a.frictionScore > 65 ? '#f87171' : a.frictionScore > 35 ? '#fbbf24' : '#34d399',
                            }}
                          >
                            {a.frictionScore} / 100
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', fontWeight: '600' }}>{a.frictionCategory}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Module 3: Project Headcount Forecasting */}
          {activeTab === 'PROJECTS' && (
            <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '14px' }}>
                Project Headcount Forecasting & Velocity Run-Rate
              </h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Project Client</th>
                      <th>Manager (PM)</th>
                      <th>Total Demand</th>
                      <th>Staffed Slots</th>
                      <th>Active Open</th>
                      <th>Progress %</th>
                      <th>Run-Rate Velocity</th>
                      <th>Projected ETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.projectForecasting.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong> <span style={{ fontSize: '11px', color: '#94a3b8' }}>({p.code})</span>
                        </td>
                        <td>{p.pmName}</td>
                        <td>{p.total}</td>
                        <td><strong style={{ color: '#34d399' }}>{p.filled}</strong></td>
                        <td><span style={{ color: '#38bdf8' }}>{p.active}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '40px', height: '6px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${p.progressPercent}%`, backgroundColor: '#38bdf8' }} />
                            </div>
                            <span>{p.progressPercent}%</span>
                          </div>
                        </td>
                        <td>{p.velocityHiresPerDay} hires/day</td>
                        <td>
                          <span style={{ fontWeight: '800', color: p.etaDays <= 3 ? '#34d399' : p.etaDays <= 7 ? '#fbbf24' : '#f87171' }}>
                            {p.etaDays === 0 ? 'Fully Staffed' : `${p.etaDays} Days`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Module 4: Latency & SLA Bottleneck */}
          {activeTab === 'SLA_BOTTLENECK' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '14px' }}>
                  Stage Latency Breakdown & Bottleneck Detection
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-surface-elevated)' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>PRIMARY BOTTLENECK</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#f87171', marginTop: '6px' }}>
                      {analytics?.slaVelocity.bottleneckTier}
                    </div>
                  </div>
                  <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-surface-elevated)' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>TIER 1 (PM) AVG LATENCY</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#38bdf8', marginTop: '6px' }}>
                      {analytics?.slaVelocity.avgTier1Hours} Hours
                    </div>
                  </div>
                  <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-surface-elevated)' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>TIER 2 (ASM) AVG LATENCY</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#fbbf24', marginTop: '6px' }}>
                      {analytics?.slaVelocity.avgTier2Hours} Hours
                    </div>
                  </div>
                  <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-surface-elevated)' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>P90 CYCLE TIME</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#a855f7', marginTop: '6px' }}>
                      {analytics?.slaVelocity.p90OverallHours} Hours
                    </div>
                  </div>
                </div>
              </div>

              {/* Predictive SLA Early Warning */}
              <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '14px', color: '#fbbf24' }}>
                  Predictive SLA Early Warning System (Active At-Risk Slots)
                </h3>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Vacancy ID</th>
                        <th>Project</th>
                        <th>Position</th>
                        <th>Location</th>
                        <th>Hours Left</th>
                        <th>Breach Risk %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics?.slaVelocity.predictiveBreachRisk.highRiskList.map((b) => (
                        <tr key={b.id}>
                          <td><strong>{b.vacancyCode}</strong></td>
                          <td>{b.projectCode}</td>
                          <td>{b.title}</td>
                          <td>{b.area}</td>
                          <td>{b.hoursLeft} Hours</td>
                          <td>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: '800',
                                backgroundColor: b.score > 70 ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)',
                                color: b.score > 70 ? '#f87171' : '#fbbf24',
                              }}
                            >
                              {b.score}% Risk
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Module 5: Sourcing Pareto */}
          {activeTab === 'REJECTIONS' && (
            <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '14px' }}>
                Quality of Sourcing & Rejection Root-Cause Pareto
              </h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rejection Root Cause</th>
                      <th>Incident Count</th>
                      <th>Pareto Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.rejectionPareto.map((r) => (
                      <tr key={r.cause}>
                        <td><strong>{r.cause}</strong></td>
                        <td>{r.count}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '40px', height: '6px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${r.percent}%`, backgroundColor: '#f87171' }} />
                            </div>
                            <span style={{ color: '#fbbf24', fontWeight: '700' }}>{r.percent}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* 5. USER LOGIN ACTIVITY & USAGE AUDIT LOG LEDGER */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '800' }}>User Login Activity & Usage Audit Log</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Real-time security authentication ledger tracking all user sign-in sessions and client telemetry
            </p>
          </div>
          <button
            onClick={handleDownloadLoginAudits}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Download complete login audit dataset in CSV"
          >
            <Download size={13} />
            <span>Download Audit CSV</span>
          </button>
        </div>

        {loginAudits.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>No login audit records found yet.</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User Email</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>IP Address</th>
                  <th>Browser / Client Agent</th>
                </tr>
              </thead>
              <tbody>
                {loginAudits.slice(0, 8).map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{log.userEmail}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: '#38bdf8',
                          backgroundColor: 'rgba(56, 189, 248, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        {log.roleName}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#34d399' }}>{log.action}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td style={{ fontSize: '11.5px', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.userAgent || 'Desktop Browser'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-start' }}>
          <button
            onClick={handleDownloadLoginAudits}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
          >
            <Download size={14} />
            <span>📥 Download Complete Login & Usage Logs (.CSV)</span>
          </button>
        </div>
      </div>

      {/* 6. VACANCY DOSSIER MODAL */}
      <Modal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        title={`Requisition Dossier: ${selectedVacancy?.vacancyCode || 'Pending Ingest'}`}
        maxWidth="750px"
      >
        {selectedVacancy && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header Summary */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                backgroundColor: 'var(--bg-surface-elevated)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PROJECT / BRAND</div>
                <strong style={{ fontSize: '15px', color: '#38bdf8' }}>
                  {selectedVacancy.project?.name || 'Project'} ({selectedVacancy.project?.code})
                </strong>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>POSITION ROLE</div>
                <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{selectedVacancy.title}</strong>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AREA LOCATION</div>
                <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                  {selectedVacancy.zone} Zone — {selectedVacancy.area}
                </strong>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>COMPENSATION / SALARY</div>
                <strong style={{ fontSize: '15px', color: '#34d399' }}>
                  {selectedVacancy.salary || 'Standard Band (₹)'}
                </strong>
              </div>
            </div>

            {/* SLA & Reviewers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(251, 191, 36, 0.05)',
                  border: '1px solid rgba(251, 191, 36, 0.2)',
                }}
              >
                <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: '700' }}>SLA TURNAROUND</div>
                <div style={{ fontSize: '18px', fontWeight: '800', marginTop: '4px' }}>
                  {selectedVacancy.targetDaysToFill || 2} Days Window
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Created on {new Date(selectedVacancy.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>

              <div
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(56, 189, 248, 0.05)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                }}
              >
                <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '700' }}>APPROVAL HIERARCHY</div>
                <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '4px' }}>
                  Level 1 (PM): {selectedVacancy.approverL1Email || 'Role Default'}
                </div>
                <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '2px' }}>
                  Level 2 (ASM): {selectedVacancy.approverL2Email || 'Role Default'}
                </div>
                {selectedVacancy.approverL3Email && (
                  <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '2px' }}>
                    Level 3 (RSM): {selectedVacancy.approverL3Email}
                  </div>
                )}
              </div>
            </div>

            {/* Candidate Sourcing Status */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>Candidate Sourcing Record</h4>
              {selectedVacancy.submissions && selectedVacancy.submissions.length > 0 ? (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '15px' }}>{selectedVacancy.submissions[0].fullName}</strong>
                    <Badge status={selectedVacancy.status} level={selectedVacancy.submissions[0].currentLevel} />
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Email: {selectedVacancy.submissions[0].email || 'N/A'} • Phone: {selectedVacancy.submissions[0].phone || 'N/A'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Current Level: Tier {selectedVacancy.submissions[0].currentLevel} ({selectedVacancy.submissions[0].status})
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(15, 23, 42, 0.02)',
                    border: '1px dashed var(--border-subtle)',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                    textAlign: 'center',
                  }}
                >
                  No candidate has been submitted for this vacancy yet. Active for recruiter sourcing.
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setIsDossierOpen(false)}>
                Close
              </button>
              <Link to="/vacancies" className="btn btn-primary" onClick={() => setIsDossierOpen(false)}>
                <span>Go to Sourcing Feed</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
