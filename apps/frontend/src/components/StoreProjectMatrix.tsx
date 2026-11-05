import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  PauseCircle,
  Phone,
  ExternalLink,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { api } from '../api/client.js';
import { StoreMatrixData, MatrixStoreRow, MatrixProjectStatus } from '../types/index.js';
import { Modal } from './Modal.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';

interface StoreProjectMatrixProps {
  onNavigateToVacancy?: (vacancyId: string) => void;
}

export const StoreProjectMatrix: React.FC<StoreProjectMatrixProps> = ({ onNavigateToVacancy }) => {
  const { user } = useAuth();
  const toast = useToast();

  const [matrixData, setMatrixData] = useState<StoreMatrixData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedZone, setSelectedZone] = useState<string>(user?.zone || 'ALL');
  const [selectedTradeType, setSelectedTradeType] = useState<string>('ALL');
  const [selectedChain, setSelectedChain] = useState<string>('ALL');
  const [selectedManpowerType, setSelectedManpowerType] = useState<string>('ALL');
  const [searchStore, setSearchStore] = useState<string>('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Cell Dossier Drawer
  const [selectedCell, setSelectedCell] = useState<{
    store: MatrixStoreRow;
    projectName: string;
    projectStatus: MatrixProjectStatus;
  } | null>(null);

  // Hold Action Modal
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdTargetVacancyId, setHoldTargetVacancyId] = useState<string | null>(null);
  const [holdActionType, setHoldActionType] = useState<'HOLD' | 'UNHOLD'>('HOLD');
  const [holdReasonInput, setHoldReasonInput] = useState('');
  const [holdSubmitting, setHoldSubmitting] = useState(false);

  const fetchMatrix = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedZone !== 'ALL') params.set('zone', selectedZone);
      if (selectedTradeType !== 'ALL') params.set('tradeType', selectedTradeType);
      if (selectedChain !== 'ALL') params.set('chain', selectedChain);
      if (selectedManpowerType !== 'ALL') params.set('manpowerType', selectedManpowerType);

      const res = await api.get<StoreMatrixData>(`/reports/store-matrix?${params.toString()}`);
      setMatrixData(res);
      setCurrentPage(1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load store matrix data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, [selectedZone, selectedTradeType, selectedChain, selectedManpowerType]);

  const handleResetFilters = () => {
    setSelectedZone(user?.zone || 'ALL');
    setSelectedTradeType('ALL');
    setSelectedChain('ALL');
    setSelectedManpowerType('ALL');
    setSearchStore('');
    setCurrentPage(1);
  };

  // Filtered Store Rows by Search Query
  const filteredStores = useMemo(() => {
    if (!matrixData?.stores) return [];
    if (!searchStore.trim()) return matrixData.stores;
    const q = searchStore.toLowerCase();
    return matrixData.stores.filter(
      (s) =>
        s.storeName.toLowerCase().includes(q) ||
        s.storeCode.toLowerCase().includes(q) ||
        (s.zone && s.zone.toLowerCase().includes(q)) ||
        (s.area && s.area.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q))
    );
  }, [matrixData?.stores, searchStore]);

  const totalPages = Math.max(1, Math.ceil(filteredStores.length / pageSize));

  const pagedStores = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStores.slice(start, start + pageSize);
  }, [filteredStores, currentPage, pageSize]);

  // Handle Cell Click
  const handleCellClick = (store: MatrixStoreRow, projName: string) => {
    const status = store.projectStatuses[projName];
    if (!status || status.status === 'NA') return;
    setSelectedCell({ store, projectName: projName, projectStatus: status });
  };

  // PM/Admin Hold Management
  const isPrivilegedUser = ['PM', 'SUPER_MANAGER', 'ADMIN', 'OWNER'].includes(user?.roleName || '');

  const openHoldModal = (vacancyId: string, action: 'HOLD' | 'UNHOLD') => {
    setHoldTargetVacancyId(vacancyId);
    setHoldActionType(action);
    setHoldReasonInput('');
    setIsHoldModalOpen(true);
  };

  const handleConfirmHoldAction = async () => {
    if (!holdTargetVacancyId) return;
    if (holdActionType === 'HOLD' && !holdReasonInput.trim()) {
      toast.info('Please enter a brief reason for putting this requisition on hold.', 'Hold Reason Required');
      return;
    }

    try {
      setHoldSubmitting(true);
      await api.patch(`/vacancies/${holdTargetVacancyId}/hold`, {
        onHold: holdActionType === 'HOLD',
        holdReason: holdReasonInput.trim() || undefined,
      });

      toast.success(
        holdActionType === 'HOLD'
          ? 'Requisition put on hold. Recruiter SLA timer halted.'
          : 'Requisition restored to Active status.'
      );
      setIsHoldModalOpen(false);
      setSelectedCell(null);
      fetchMatrix();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update hold status');
    } finally {
      setHoldSubmitting(false);
    }
  };

  const totals = matrixData?.summaryTotals;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header & KPI Scoreboard (Direct Excel Totals Replicated) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
        }}
      >
        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Unique Stores
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: '#1e40af' }}>
            {totals?.uniqueStores ?? 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {totals?.mtStoresCount ?? 0} MT · {totals?.gtStoresCount ?? 0} GT
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Demand
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: '#4338ca' }}>
            {totals?.totalRequiredPositions ?? 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Across all projects
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Active / Filled
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: '#047857' }}>
            {totals?.totalActiveFilled ?? 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Confirmed joined promoters
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Open Vacancies
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: '#b45309' }}>
            {totals?.totalVacant ?? 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Active sourcing gap
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #f97316' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            On Hold (Paused)
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: '#c2410c' }}>
            {totals?.totalOnHold ?? 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Client / Store frozen
          </div>
        </div>
      </div>

      {/* 2. Dynamic Filter Ribbon */}
      <div
        className="card"
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="var(--text-primary)" />
            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Excel Slicers & Operational Dimensions:
            </span>
          </div>
          <button
            onClick={handleResetFilters}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
          >
            <RotateCcw size={13} />
            <span>Reset Slicers</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          {/* Operational Zone Slicer */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              📍 Operational Zone
            </label>
            <select
              className="form-input"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              style={{ width: '100%', fontSize: '12.5px', padding: '7px 10px' }}
            >
              <option value="ALL">🌐 All 10 Operational Zones</option>
              {(matrixData?.filterOptions?.zones || [
                'West Mumbai', 'West ROM', 'West Gujarat',
                'South AP', 'South KN', 'South TG', 'South TN',
                'East', 'North Delhi', 'North Punjab',
              ]).map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          {/* Store Type (MT vs GT) Toggle */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              🏪 Store Type (Channel)
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { key: 'ALL', label: 'All' },
                { key: 'MT', label: 'MT (Modern)' },
                { key: 'GT', label: 'GT (General)' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelectedTradeType(t.key)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    borderRadius: '6px',
                    border: selectedTradeType === t.key ? '1.5px solid #069494' : '1px solid var(--border-subtle)',
                    backgroundColor: selectedTradeType === t.key ? 'rgba(6, 148, 148, 0.12)' : 'var(--bg-surface-elevated)',
                    color: selectedTradeType === t.key ? '#067a7a' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vacancy Type (Regular vs Tact) Toggle */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              ⏱️ Vacancy Type
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { key: 'ALL', label: 'All' },
                { key: 'REGULAR', label: 'Regular' },
                { key: 'TACT', label: 'Tact (Temp)' },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelectedManpowerType(m.key)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    borderRadius: '6px',
                    border: selectedManpowerType === m.key ? '1.5px solid #8b5cf6' : '1px solid var(--border-subtle)',
                    backgroundColor: selectedManpowerType === m.key ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-surface-elevated)',
                    color: selectedManpowerType === m.key ? '#6d28d9' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Retail Chain Filter */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              🏬 Retail Chain
            </label>
            <select
              className="form-input"
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              style={{ width: '100%', fontSize: '12.5px', padding: '7px 10px' }}
            >
              <option value="ALL">All Retail Chains</option>
              {(matrixData?.filterOptions?.chains || ['DMART', 'RELIANCE', 'GENERAL_TRADE']).map((c) => (
                <option key={c} value={c}>
                  {c.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Store Quick Search */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              🔍 Find Outlet
            </label>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Search store name or code..."
                value={searchStore}
                onChange={(e) => setSearchStore(e.target.value)}
                style={{ width: '100%', paddingLeft: '30px', fontSize: '12.5px' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Interactive Store × Project Matrix (Direct Excel Replicated Grid) */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: 'var(--bg-surface-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Store × Project Matrix ({filteredStores.length} outlets matching)
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Click any status cell to inspect candidate details & actions
            </span>
          </div>

          {/* Status Legend Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#047857', fontWeight: '700' }}>
              🟢 Active / Filled
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#b45309', fontWeight: '700' }}>
              🟡 Vacant (Open)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#c2410c', fontWeight: '700' }}>
              🟠 Hold (Paused)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: '600' }}>
              ⚪ NA
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading store matrix...
          </div>
        ) : filteredStores.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No stores match the current filter criteria. Try adjusting your Zone or Store Type slicer.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', maxHeight: '680px' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: '#1e293b' }}>
                  {/* Sticky Column: Store Name */}
                  <th
                    style={{
                      position: 'sticky',
                      left: 0,
                      top: 0,
                      zIndex: 10,
                      backgroundColor: '#f1f5f9',
                      padding: '12px 14px',
                      textAlign: 'left',
                      fontWeight: '800',
                      borderBottom: '2px solid var(--border-subtle)',
                      borderRight: '1px solid var(--border-subtle)',
                      minWidth: '220px',
                    }}
                  >
                    Outlet / Store
                  </th>

                  {/* Zone & Location Column */}
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 9,
                      backgroundColor: '#f1f5f9',
                      padding: '12px 10px',
                      textAlign: 'left',
                      fontWeight: '800',
                      borderBottom: '2px solid var(--border-subtle)',
                      borderRight: '1px solid var(--border-subtle)',
                      minWidth: '160px',
                    }}
                  >
                    Zone & Location
                  </th>

                  {/* Summary Totals for Store */}
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 9,
                      backgroundColor: '#e2e8f0',
                      padding: '12px 8px',
                      textAlign: 'center',
                      fontWeight: '800',
                      borderBottom: '2px solid var(--border-subtle)',
                      borderRight: '1px solid var(--border-subtle)',
                      minWidth: '60px',
                    }}
                    title="Total Positions Required for this store"
                  >
                    Req
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 9,
                      backgroundColor: '#d1fae5',
                      padding: '12px 8px',
                      textAlign: 'center',
                      fontWeight: '800',
                      borderBottom: '2px solid var(--border-subtle)',
                      borderRight: '1px solid var(--border-subtle)',
                      color: '#047857',
                      minWidth: '60px',
                    }}
                    title="Active filled promoters"
                  >
                    Act
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 9,
                      backgroundColor: '#fef3c7',
                      padding: '12px 8px',
                      textAlign: 'center',
                      fontWeight: '800',
                      borderBottom: '2px solid var(--border-subtle)',
                      borderRight: '1px solid var(--border-subtle)',
                      color: '#b45309',
                      minWidth: '60px',
                    }}
                    title="Open Vacancies"
                  >
                    Vac
                  </th>

                  {/* Dynamic Project Columns */}
                  {matrixData?.projects?.map((proj) => (
                    <th
                      key={proj.id}
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 8,
                        backgroundColor: '#f8fafc',
                        padding: '12px 10px',
                        textAlign: 'center',
                        fontWeight: '800',
                        borderBottom: '2px solid var(--border-subtle)',
                        borderRight: '1px solid var(--border-subtle)',
                        minWidth: '130px',
                      }}
                    >
                      <div>{proj.name}</div>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Req: {proj.totalRequired} · Act: {proj.totalActive}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedStores.map((store, sIdx) => {
                  const isEven = sIdx % 2 === 0;
                  const rowBg = isEven ? 'var(--bg-surface)' : 'var(--bg-surface-elevated)';

                  return (
                    <tr
                      key={store.storeId}
                      style={{
                        backgroundColor: rowBg,
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Sticky Store Name & Code */}
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 5,
                          backgroundColor: rowBg,
                          padding: '10px 14px',
                          borderRight: '1px solid var(--border-subtle)',
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                            {store.storeName}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: store.tradeType === 'MT' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(234, 88, 12, 0.1)',
                              color: store.tradeType === 'MT' ? '#2563eb' : '#ea580c',
                              fontWeight: '700',
                            }}
                          >
                            {store.tradeType}
                          </span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            {store.storeCode} · {store.chain}
                          </span>
                        </div>
                      </td>

                      {/* Zone & Location Column */}
                      <td
                        style={{
                          padding: '10px',
                          borderRight: '1px solid var(--border-subtle)',
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              color: '#0f766e',
                              backgroundColor: 'rgba(15, 118, 110, 0.08)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'inline-block',
                              width: 'fit-content',
                            }}
                          >
                            {store.zone || 'Zone N/A'}
                          </span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                            {[store.city, store.area].filter(Boolean).join(' • ') || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Store Totals */}
                      <td
                        style={{
                          padding: '10px 6px',
                          textAlign: 'center',
                          fontWeight: '800',
                          borderRight: '1px solid var(--border-subtle)',
                          borderBottom: '1px solid var(--border-subtle)',
                          backgroundColor: 'rgba(0,0,0,0.02)',
                        }}
                      >
                        {store.totalRequired}
                      </td>
                      <td
                        style={{
                          padding: '10px 6px',
                          textAlign: 'center',
                          fontWeight: '800',
                          color: '#047857',
                          borderRight: '1px solid var(--border-subtle)',
                          borderBottom: '1px solid var(--border-subtle)',
                          backgroundColor: 'rgba(16, 185, 129, 0.04)',
                        }}
                      >
                        {store.totalActive}
                      </td>
                      <td
                        style={{
                          padding: '10px 6px',
                          textAlign: 'center',
                          fontWeight: '800',
                          color: store.totalVacant > 0 ? '#b45309' : 'var(--text-muted)',
                          borderRight: '1px solid var(--border-subtle)',
                          borderBottom: '1px solid var(--border-subtle)',
                          backgroundColor: store.totalVacant > 0 ? 'rgba(245, 158, 11, 0.04)' : 'transparent',
                        }}
                      >
                        {store.totalVacant}
                      </td>

                      {/* Dynamic Project Cells */}
                      {matrixData?.projects?.map((proj) => {
                        const cell = store.projectStatuses[proj.name];
                        if (!cell || cell.status === 'NA') {
                          return (
                            <td
                              key={proj.id}
                              style={{
                                padding: '8px',
                                textAlign: 'center',
                                borderRight: '1px solid var(--border-subtle)',
                                borderBottom: '1px solid var(--border-subtle)',
                                color: 'var(--text-muted)',
                                fontSize: '11px',
                              }}
                            >
                              -
                            </td>
                          );
                        }

                        // Determine pill styling based on remark
                        let pillBg = 'rgba(245, 158, 11, 0.15)';
                        let pillColor = '#b45309';
                        let pillBorder = 'rgba(245, 158, 11, 0.3)';
                        let label = 'Vacant';

                        if (cell.remark === 'Active') {
                          pillBg = 'rgba(16, 185, 129, 0.15)';
                          pillColor = '#047857';
                          pillBorder = 'rgba(16, 185, 129, 0.3)';
                          label = `Active (${cell.active})`;
                        } else if (cell.remark === 'Hold') {
                          pillBg = 'rgba(249, 115, 22, 0.18)';
                          pillColor = '#c2410c';
                          pillBorder = 'rgba(249, 115, 22, 0.4)';
                          label = 'Hold';
                        } else {
                          label = `Vacant (${cell.vacant})`;
                        }

                        return (
                          <td
                            key={proj.id}
                            onClick={() => handleCellClick(store, proj.name)}
                            style={{
                              padding: '8px',
                              textAlign: 'center',
                              borderRight: '1px solid var(--border-subtle)',
                              borderBottom: '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                            }}
                            title={`Click to view candidate details for ${store.storeName} - ${proj.name}`}
                          >
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: pillBg,
                                color: pillColor,
                                border: `1px solid ${pillBorder}`,
                                transition: 'transform 0.1s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
                            >
                              {label}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span>Showing</span>
              <strong>{filteredStores.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong>
              <span>to</span>
              <strong>{Math.min(currentPage * pageSize, filteredStores.length)}</strong>
              <span>of</span>
              <strong>{filteredStores.length}</strong>
              <span>outlets</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="form-input"
                  style={{ padding: '4px 8px', fontSize: '12px', width: 'auto' }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 8px', opacity: currentPage <= 1 ? 0.5 : 1, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '0 4px' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 8px', opacity: currentPage >= totalPages ? 0.5 : 1, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>

      {/* 4. Store Position Dossier Drawer (Sheet 2 Replicated) */}
      {selectedCell && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '100%',
            maxWidth: '520px',
            height: '100vh',
            backgroundColor: 'var(--bg-surface)',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.2s ease',
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface-elevated)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {selectedCell.store.tradeType}
                </span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
                  {selectedCell.store.line} Line · {selectedCell.store.area}
                </span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginTop: '4px', color: 'var(--text-primary)' }}>
                {selectedCell.store.storeName}
              </h3>
              <div style={{ fontSize: '13px', color: '#6366f1', fontWeight: '700', marginTop: '2px' }}>
                Project: {selectedCell.projectName}
              </div>
            </div>

            <button
              onClick={() => setSelectedCell(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '4px',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Drawer Body */}
          <div style={{ padding: '22px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Status & Position Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <div className="card" style={{ padding: '12px', margin: 0 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>STATUS</div>
                <div style={{ fontSize: '16px', fontWeight: '800', marginTop: '4px' }}>
                  {selectedCell.projectStatus.remark === 'Active' && <span style={{ color: '#047857' }}>🟢 Active Filled</span>}
                  {selectedCell.projectStatus.remark === 'Vacant' && <span style={{ color: '#b45309' }}>🟡 Vacant ({selectedCell.projectStatus.vacant})</span>}
                  {selectedCell.projectStatus.remark === 'Hold' && <span style={{ color: '#c2410c' }}>🟠 On Hold</span>}
                </div>
              </div>

              <div className="card" style={{ padding: '12px', margin: 0 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>MANPOWER TYPE</div>
                <div style={{ fontSize: '15px', fontWeight: '800', marginTop: '4px', color: 'var(--text-primary)' }}>
                  {selectedCell.projectStatus.manpowerType === 'TACT' ? 'Tactical (Temp)' : 'Regular (Permanent)'}
                </div>
              </div>
            </div>

            {/* Hold Reason Alert if applicable */}
            {selectedCell.projectStatus.remark === 'Hold' && (
              <div
                style={{
                  backgroundColor: 'rgba(249, 115, 22, 0.1)',
                  border: '1px solid rgba(249, 115, 22, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <PauseCircle size={18} color="#c2410c" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#c2410c', fontSize: '13px' }}>Requisition On Hold:</strong>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {selectedCell.projectStatus.holdReason || 'No specific reason entered.'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    SLA timer is paused. Recruiter is not penalized for this open gap.
                  </div>
                </div>
              </div>
            )}

            {/* Candidate Details (Sheet 2 Replicated) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  👥 Proposed Candidates ({selectedCell.projectStatus.candidates.length})
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Sheet 2: Candidate Status
                </span>
              </div>

              {selectedCell.projectStatus.candidates.length === 0 ? (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    border: '1.5px dashed var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-muted)',
                    fontSize: '12.5px',
                  }}
                >
                  No candidate proposed yet for this store slot.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedCell.projectStatus.candidates.map((cand) => (
                    <div
                      key={cand.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--text-primary)' }}>
                          {cand.name}
                        </div>
                        {cand.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            <Phone size={12} />
                            <a href={`tel:${cand.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                              {cand.phone}
                            </a>
                          </div>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor:
                            cand.stage === 'JOINED'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : cand.stage === 'SELECTED'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : cand.stage === 'INTERVIEW_PENDING'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(100, 116, 139, 0.15)',
                          color:
                            cand.stage === 'JOINED'
                              ? '#047857'
                              : cand.stage === 'SELECTED'
                              ? '#2563eb'
                              : cand.stage === 'INTERVIEW_PENDING'
                              ? '#b45309'
                              : '#475569',
                        }}
                      >
                        {cand.stage}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PM/Admin Hold Management Action */}
            {isPrivilegedUser && selectedCell.projectStatus.vacancyId && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.03)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  🛡️ Project Manager Controls
                </div>
                {selectedCell.projectStatus.remark === 'Hold' ? (
                  <button
                    onClick={() => openHoldModal(selectedCell.projectStatus.vacancyId!, 'UNHOLD')}
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', color: '#047857', borderColor: '#047857' }}
                  >
                    ▶️ Release Requisition from Hold
                  </button>
                ) : (
                  <button
                    onClick={() => openHoldModal(selectedCell.projectStatus.vacancyId!, 'HOLD')}
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', color: '#c2410c', borderColor: '#c2410c' }}
                  >
                    ⏸️ Place this Store Requisition on Hold
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div
            style={{
              padding: '14px 22px',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface-elevated)',
              display: 'flex',
              gap: '10px',
            }}
          >
            {selectedCell.projectStatus.vacancyId && onNavigateToVacancy && (
              <button
                onClick={() => {
                  onNavigateToVacancy(selectedCell.projectStatus.vacancyId!);
                  setSelectedCell(null);
                }}
                className="btn btn-primary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <span>View Full Vacancy Card</span>
                <ExternalLink size={14} />
              </button>
            )}
            <button
              onClick={() => setSelectedCell(null)}
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 5. PM/Admin Hold Confirmation Modal */}
      <Modal
        isOpen={isHoldModalOpen}
        onClose={() => setIsHoldModalOpen(false)}
        title={holdActionType === 'HOLD' ? '⏸️ Place Store Requisition on Hold' : '▶️ Release Requisition from Hold'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {holdActionType === 'HOLD' ? (
            <>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Placing this store vacancy on hold halts the SLA countdown timer and removes it from the recruiter's active sourcing gap.
              </p>
              <div className="form-group">
                <label className="form-label">Mandatory Hold Reason</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Client store layout renovation, Space allocation pending with Store Manager..."
                  value={holdReasonInput}
                  onChange={(e) => setHoldReasonInput(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Are you sure you want to release this requisition from hold? Its status will return to <strong>ACTIVE</strong> and the area recruiter will resume sourcing.
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsHoldModalOpen(false)}
              className="btn btn-secondary"
              disabled={holdSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmHoldAction}
              className="btn btn-primary"
              disabled={holdSubmitting}
            >
              {holdSubmitting
                ? 'Processing...'
                : holdActionType === 'HOLD'
                ? 'Confirm Hold'
                : 'Confirm Reactivation'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
