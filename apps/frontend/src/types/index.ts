export interface User {
  id: string;
  username?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
  zone?: string | null;
  area?: string | null;
  phone?: string | null;
  permissions: string[];
  isActive?: boolean;
  createdAt?: string;
  role?: {
    id: string;
    name: string;
    description: string;
  };
  projectAssignments?: { projectId: string; project: Project }[];
  supervisingPMs?: { pmUser: { id: string; firstName: string; lastName: string; email: string } }[];
  supervisedBySMs?: { superManager: { id: string; firstName: string; lastName: string; email: string } }[];
}

export interface Store {
  id: string;
  code: string;
  name: string;
  chain: string;
  line?: string | null;
  tradeType: 'MT' | 'GT' | string;
  area: string;
  zone: string;
  city?: string | null;
  address?: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions?: string[];
}

export interface BaseRole {
  id: string;
  name: string; // Promoter, Merchandiser, Team Lead, F-Promoter
  description?: string | null;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  pmUserId?: string | null;
  pmUser?: { id: string; firstName: string; lastName: string; email: string } | null;
  asmEmail: string;
  rsmEmail: string;
  currentSeq: number;
}

export interface ProjectRole {
  id: string;
  projectId: string;
  baseRoleId?: string | null;
  title: string;
  salary?: string | null;
  experience?: string | null;
  description?: string | null;
  targetDaysToFill?: number;
  approvalLevelsCount?: number;
  defaultL1Email?: string | null;
  defaultL2Email?: string | null;
  defaultL3Email?: string | null;
  asmEmail?: string | null;
  rsmEmail?: string | null;
  project?: Project;
  baseRole?: BaseRole;
}

export interface Vacancy {
  id: string;
  vacancyCode?: string | null;
  projectId: string;
  projectRoleId?: string | null;
  storeId?: string | null;
  store?: Store | null;
  title: string;
  zone: string;
  area: string;
  line?: string | null;
  tradeType?: 'MT' | 'GT' | string;
  manpowerType?: 'REGULAR' | 'TACT' | string;
  requiredPositions?: number;
  filledPositions?: number;
  salary?: string | null;
  experience?: string | null;
  targetDaysToFill?: number;
  targetDueDate?: string | null;
  approverL1Email?: string | null;
  approverL2Email?: string | null;
  approverL3Email?: string | null;
  status: 'PENDING_INGEST_REVIEW' | 'ACTIVE' | 'PENDING_APPROVAL' | 'ON_HOLD' | 'FILLED' | 'CANCELLED' | 'DRAFT_DUPLICATE_FLAG';
  holdReason?: string | null;
  holdSetById?: string | null;
  holdSetAt?: string | null;
  createdById: string;
  assignedRecruiterId?: string | null;
  createdAt: string;
  project?: Project;
  projectRole?: ProjectRole;
  assignedRecruiter?: {
    id: string;
    username?: string | null;
    firstName: string;
    lastName: string;
    email: string;
    zone?: string;
    area?: string;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  submissions?: CandidateSubmission[];
}

export interface CandidateSubmission {
  id: string;
  vacancyId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  resumeId?: string | null;
  resumeUrl?: string | null;
  stage?: 'PROPOSED' | 'INTERVIEW_PENDING' | 'SELECTED' | 'APPROVED' | 'JOINED' | 'REJECTED' | string;
  joinedDate?: string | null;
  interviewDate?: string | null;
  currentLevel: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  rejectionComments?: string | null;
  createdAt: string;
  vacancy?: Vacancy;
  audits?: ApprovalAudit[];
}

export interface ApprovalAudit {
  id: string;
  submissionId: string;
  level: number;
  reviewerEmail: string;
  action: string;
  reason?: string | null;
  comments?: string | null;
  createdAt: string;
}

export interface RecruiterStats {
  activeVacancies: number;
  inProcessVacancies: number;
  completedVacancies: number;
  rejectedSubmissions: number;
  fillRatePercentage: number;
  averageDaysToFill: number;
}

export interface DashboardReport {
  summary: {
    totalVacancies: number;
    activeVacancies: number;
    duplicateFlags: number;
    pendingApprovals: number;
    filledVacancies: number;
    totalSubmissions: number;
    rejectedSubmissions: number;
    projectsCount: number;
  };
}

export interface UserLoginAudit {
  id: string;
  userId?: string | null;
  userEmail: string;
  roleName: string;
  action: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface ExecutiveAnalyticsData {
  scorecard: {
    overallFillRate: number;
    totalVacancies: number;
    activeVacancies: number;
    pendingVacancies: number;
    filledVacancies: number;
    avgConsumptionDays: number;
    slaComplianceRate: number;
    firstTimeRightRate: number;
    dailyVelocity: number;
    estimatedCompletionDays: number;
    totalPayrollBudgetInr: number;
    totalPayrollDisplay: string;
  };
  roleIntelligence: {
    roleTitle: string;
    total: number;
    active: number;
    pending: number;
    filled: number;
    fillRate: number;
    salaryDisplay: string;
    avgSalaryInr: number;
  }[];
  areaFrictionList: {
    zone: string;
    area: string;
    total: number;
    filled: number;
    fillRate: number;
    avgDays: number;
    frictionScore: number;
    frictionCategory: string;
  }[];
  projectForecasting: {
    id: string;
    name: string;
    code: string;
    pmName: string;
    total: number;
    filled: number;
    active: number;
    progressPercent: number;
    velocityHiresPerDay: number;
    etaDays: number;
  }[];
  slaVelocity: {
    p50OverallHours: number;
    p90OverallHours: number;
    avgTier1Hours: number;
    avgTier2Hours: number;
    avgTier3Hours: number;
    bottleneckTier: string;
    predictiveBreachRisk: {
      lowRiskCount: number;
      medRiskCount: number;
      highRiskCount: number;
      highRiskList: {
        id: string;
        vacancyCode: string;
        title: string;
        area: string;
        projectCode: string;
        score: number;
        hoursLeft: number;
      }[];
    };
  };
  rejectionPareto: {
    cause: string;
    count: number;
    percent: number;
  }[];
}

export interface WorkforceMandaysData {
  scorecard: {
    totalPositions: number;
    filledPositions: number;
    activeVacancies: number;
    pendingVacancies: number;
    closedVacancies: number;
    totalPlannedMandays: number;
    totalDeliveredMandays: number;
    totalLostMandays: number;
    overallFulfillmentPercent: number;
    overallFillRatePercent: number;
    totalLossInr: number;
    totalLossDisplay: string;
  };
  mandaysByProject: {
    code: string;
    name: string;
    plannedMandays: number;
    deliveredMandays: number;
    lostMandays: number;
    fulfillmentPercent: number;
    fillRatePercent: number;
  }[];
  mandaysByArea: {
    area: string;
    deliveredMandays: number;
    lostMandays: number;
    plannedMandays: number;
    fulfillmentPercent: number;
  }[];
  efficiencyByRole: {
    roleTitle: string;
    totalPositions: number;
    filledPositions: number;
    openPositions: number;
    fillRatePercent: number;
    fulfillmentPercent: number;
    benchmarkTarget: number;
    deliveredMandays: number;
    lostMandays: number;
  }[];
  matrixRows: {
    projectCode: string;
    projectName: string;
    area: string;
    roleTitle: string;
    totalSlots: number;
    filledSlots: number;
    openSlots: number;
    plannedMandays: number;
    deliveredMandays: number;
    lostMandays: number;
    lossInr: number;
    efficiencyPercent: number;
    fillRatePercent: number;
    lossDisplay: string;
  }[];
  slicerOptions: {
    projects: { id: string; code: string; name: string }[];
    areas: string[];
    roles: string[];
  };
}

export interface AreaTrendPoint {
  date: string;
  percentage: number;
  filledCount: number;
  openCount: number;
  totalCount: number;
  newVacancies: number;
}

export interface AreaSeries {
  name: string;
  color: string;
  totalVacancies: number;
  currentFilled: number;
  currentFillRate: number;
  data: AreaTrendPoint[];
}

export interface AreaTrendsData {
  dates: string[];
  areas: AreaSeries[];
  summary: {
    startDate: string;
    endDate: string;
    totalDays: number;
    totalRequisitions: number;
    totalFilled: number;
    overallFillRate: number;
  };
  filterOptions: {
    projects: { id: string; code: string; name: string }[];
    roles: string[];
    availableAreas: string[];
    minDate: string;
    maxDate: string;
  };
}

export interface MatrixCellCandidate {
  id: string;
  name: string;
  phone?: string | null;
  stage: string;
  status: string;
}

export interface MatrixProjectStatus {
  status: 'Yes' | 'NA';
  remark: 'Active' | 'Vacant' | 'Hold' | 'NA';
  vacancyId?: string | null;
  required: number;
  active: number;
  vacant: number;
  onHold: number;
  holdReason?: string | null;
  candidates: MatrixCellCandidate[];
  manpowerType?: string;
}

export interface MatrixStoreRow {
  storeId: string;
  storeCode: string;
  storeName: string;
  chain: string;
  line: string;
  area: string;
  zone: string;
  city?: string;
  tradeType: string;
  totalRequired: number;
  totalActive: number;
  totalVacant: number;
  totalOnHold: number;
  projectStatuses: Record<string, MatrixProjectStatus>;
}

export interface StoreMatrixData {
  zone?: string;
  area: string;
  tradeType: string;
  chain: string;
  line: string;
  manpowerType: string;
  projects: {
    id: string;
    name: string;
    code: string;
    totalRequired: number;
    totalActive: number;
    totalVacant: number;
    totalOnHold: number;
  }[];
  stores: MatrixStoreRow[];
  summaryTotals: {
    uniqueStores: number;
    totalRequiredPositions: number;
    totalActiveFilled: number;
    totalVacant: number;
    totalOnHold: number;
    mtStoresCount: number;
    gtStoresCount: number;
  };
  filterOptions: {
    zones?: string[];
    areas: string[];
    tradeTypes: string[];
    chains: string[];
    lines: string[];
    manpowerTypes: string[];
    projects: { id: string; name: string; code?: string }[];
  };
}

export interface RecruiterCockpitData {
  recruiterId: string;
  username: string;
  recruiterName: string;
  assignedArea: string;
  assignedZone: string;
  metrics: {
    totalAssignedPositions: number;
    pendingSourcing: { count: number; vacancyIds: string[] };
    interviewsPending: { count: number; vacancyIds: string[] };
    approvalsPending: { count: number; vacancyIds: string[] };
    joinedThisMonth: { count: number; vacancyIds: string[] };
    onHold: { count: number; vacancyIds: string[] };
  };
}
