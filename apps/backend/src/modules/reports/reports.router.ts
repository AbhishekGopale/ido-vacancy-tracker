import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.get('/overview', requirePermission('reports.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalVacancies,
      activeVacancies,
      duplicateFlags,
      pendingApprovals,
      filledVacancies,
      totalSubmissions,
      rejectedSubmissions,
      projectsCount,
    ] = await Promise.all([
      prisma.vacancy.count(),
      prisma.vacancy.count({ where: { status: 'ACTIVE' } }),
      prisma.vacancy.count({ where: { status: 'DRAFT_DUPLICATE_FLAG' } }),
      prisma.vacancy.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.vacancy.count({ where: { status: 'FILLED' } }),
      prisma.candidateSubmission.count(),
      prisma.candidateSubmission.count({ where: { status: 'REJECTED' } }),
      prisma.project.count(),
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalVacancies,
          activeVacancies,
          duplicateFlags,
          pendingApprovals,
          filledVacancies,
          totalSubmissions,
          rejectedSubmissions,
          projectsCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// Helper for percentiles
function getPercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
}

// GET /api/v1/reports/executive-analytics (Data Science Intelligence Cockpit)
reportsRouter.get('/executive-analytics', requirePermission('reports.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vacancies = await prisma.vacancy.findMany({
      include: {
        project: { include: { pmUser: true } },
        projectRole: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        submissions: {
          include: {
            audits: { orderBy: { createdAt: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const now = Date.now();
    const totalVacancies = vacancies.length;
    const filledVacancies = vacancies.filter((v) => v.status === 'FILLED');
    const activeVacancies = vacancies.filter((v) => v.status === 'ACTIVE');
    const pendingVacancies = vacancies.filter((v) => v.status === 'PENDING_APPROVAL');

    // 1. Consumption Time & SLA Calculations
    const consumptionDaysList: number[] = [];
    let withinSlaCount = 0;

    for (const vac of filledVacancies) {
      const createdTime = new Date(vac.createdAt).getTime();
      const approvedAudits = vac.submissions.flatMap((s) => s.audits).filter((a) => a.action === 'APPROVED');
      const finishTime = approvedAudits.length > 0 ? new Date(approvedAudits[approvedAudits.length - 1].createdAt).getTime() : new Date(vac.updatedAt).getTime();
      const diffDays = Math.max(0.1, Number(((finishTime - createdTime) / (1000 * 60 * 60 * 24)).toFixed(1)));
      consumptionDaysList.push(diffDays);

      const targetDays = vac.targetDaysToFill || 2;
      if (diffDays <= targetDays) {
        withinSlaCount++;
      }
    }

    const avgConsumptionDays = consumptionDaysList.length > 0
      ? Number((consumptionDaysList.reduce((a, b) => a + b, 0) / consumptionDaysList.length).toFixed(1))
      : 1.8;

    const slaComplianceRate = filledVacancies.length > 0
      ? Math.round((withinSlaCount / filledVacancies.length) * 100)
      : 92;

    const overallFillRate = totalVacancies > 0
      ? Math.round((filledVacancies.length / totalVacancies) * 100)
      : 0;

    // 2. First-Time-Right Ratio
    const allSubmissions = vacancies.flatMap((v) => v.submissions);
    const submissionsWithRejections = vacancies.filter((v) => v.submissions.some((s) => s.status === 'REJECTED')).length;
    const firstTimeRightRate = allSubmissions.length > 0
      ? Math.round((Math.max(0, allSubmissions.length - submissionsWithRejections) / allSubmissions.length) * 100)
      : 85;

    // 3. Daily Velocity & Completion Date Forecaster
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentHires = filledVacancies.filter((v) => new Date(v.updatedAt).getTime() >= sevenDaysAgo).length;
    const dailyVelocity = Math.max(0.5, Number((recentHires / 7).toFixed(1)));
    const remainingOpenSlots = activeVacancies.length + pendingVacancies.length;
    const estimatedCompletionDays = dailyVelocity > 0 ? Math.ceil(remainingOpenSlots / dailyVelocity) : 0;

    // 4. Role Intelligence
    const roleMap = new Map<string, { roleTitle: string; total: number; active: number; pending: number; filled: number; salaries: number[] }>();
    for (const v of vacancies) {
      const title = v.title || 'General Position';
      if (!roleMap.has(title)) {
        roleMap.set(title, { roleTitle: title, total: 0, active: 0, pending: 0, filled: 0, salaries: [] });
      }
      const item = roleMap.get(title)!;
      item.total++;
      if (v.status === 'ACTIVE') item.active++;
      else if (v.status === 'PENDING_APPROVAL') item.pending++;
      else if (v.status === 'FILLED') item.filled++;

      // Parse Rupee salary numbers
      if (v.salary) {
        const matches = v.salary.match(/\d+([,\.]\d+)?/g);
        if (matches) {
          const num = parseInt(matches[0].replace(/,/g, ''), 10);
          if (!isNaN(num) && num > 1000) item.salaries.push(num);
        }
      }
    }

    const roleIntelligence = Array.from(roleMap.values()).map((r) => {
      const avgSalary = r.salaries.length > 0
        ? Math.round(r.salaries.reduce((a, b) => a + b, 0) / r.salaries.length)
        : 28000;
      const minSalary = r.salaries.length > 0 ? Math.min(...r.salaries) : 22000;
      const maxSalary = r.salaries.length > 0 ? Math.max(...r.salaries) : 35000;
      const fillRate = r.total > 0 ? Math.round((r.filled / r.total) * 100) : 0;
      return {
        roleTitle: r.roleTitle,
        total: r.total,
        active: r.active,
        pending: r.pending,
        filled: r.filled,
        fillRate,
        salaryDisplay: `₹${minSalary.toLocaleString('en-IN')} - ₹${maxSalary.toLocaleString('en-IN')}`,
        avgSalaryInr: avgSalary,
      };
    });

    // 5. Area & Zone Friction Index
    const areaMap = new Map<string, { zone: string; area: string; total: number; filled: number; totalDaysConsumed: number }>();
    for (const v of vacancies) {
      const key = `${v.zone}__${v.area}`;
      if (!areaMap.has(key)) {
        areaMap.set(key, { zone: v.zone, area: v.area, total: 0, filled: 0, totalDaysConsumed: 0 });
      }
      const item = areaMap.get(key)!;
      item.total++;
      if (v.status === 'FILLED') item.filled++;
      const created = new Date(v.createdAt).getTime();
      const days = (now - created) / (1000 * 60 * 60 * 24);
      item.totalDaysConsumed += days;
    }

    const areaFrictionList = Array.from(areaMap.values()).map((a) => {
      const fillRate = a.total > 0 ? Math.round((a.filled / a.total) * 100) : 0;
      const avgDays = a.total > 0 ? Number((a.totalDaysConsumed / a.total).toFixed(1)) : 1;
      const frictionScore = Math.min(100, Math.round((avgDays * 15) + (100 - fillRate) * 0.4));
      return {
        zone: a.zone,
        area: a.area,
        total: a.total,
        filled: a.filled,
        fillRate,
        avgDays,
        frictionScore,
        frictionCategory: frictionScore > 65 ? 'High Friction' : frictionScore > 35 ? 'Moderate' : 'Smooth Flow',
      };
    }).sort((a, b) => b.frictionScore - a.frictionScore);

    // 6. Project Forecast & Health
    const projectMap = new Map<string, { id: string; name: string; code: string; pmName: string; total: number; filled: number; active: number }>();
    for (const v of vacancies) {
      const p = v.project;
      if (!p) continue;
      if (!projectMap.has(p.id)) {
        const pmName = p.pmUser ? `${p.pmUser.firstName} ${p.pmUser.lastName}` : 'Unassigned PM';
        projectMap.set(p.id, { id: p.id, name: p.name, code: p.code, pmName, total: 0, filled: 0, active: 0 });
      }
      const pItem = projectMap.get(p.id)!;
      pItem.total++;
      if (v.status === 'FILLED') pItem.filled++;
      if (v.status === 'ACTIVE') pItem.active++;
    }

    const projectForecasting = Array.from(projectMap.values()).map((p) => {
      const progressPercent = p.total > 0 ? Math.round((p.filled / p.total) * 100) : 0;
      const remaining = p.total - p.filled;
      const pVelocity = Math.max(0.3, Number((p.filled / 5).toFixed(1)));
      const etaDays = Math.ceil(remaining / pVelocity);
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        pmName: p.pmName,
        total: p.total,
        filled: p.filled,
        active: p.active,
        progressPercent,
        velocityHiresPerDay: pVelocity,
        etaDays,
      };
    });

    // 7. SLA & Bottleneck Velocity
    const tier1Latencies: number[] = [];
    const tier2Latencies: number[] = [];
    const tier3Latencies: number[] = [];
    const overallLatencies: number[] = [];

    for (const v of vacancies) {
      for (const sub of v.submissions) {
        const subCreated = new Date(sub.createdAt).getTime();
        const audits = sub.audits;
        if (audits.length > 0) {
          const l1Audit = audits.find((a) => a.level === 1);
          if (l1Audit) {
            const h = Math.max(0.5, (new Date(l1Audit.createdAt).getTime() - subCreated) / (1000 * 60 * 60));
            tier1Latencies.push(Number(h.toFixed(1)));
          }
          const l2Audit = audits.find((a) => a.level === 2);
          if (l2Audit && l1Audit) {
            const h = Math.max(0.5, (new Date(l2Audit.createdAt).getTime() - new Date(l1Audit.createdAt).getTime()) / (1000 * 60 * 60));
            tier2Latencies.push(Number(h.toFixed(1)));
          }
          const l3Audit = audits.find((a) => a.level === 3);
          if (l3Audit && l2Audit) {
            const h = Math.max(0.5, (new Date(l3Audit.createdAt).getTime() - new Date(l2Audit.createdAt).getTime()) / (1000 * 60 * 60));
            tier3Latencies.push(Number(h.toFixed(1)));
          }
          const lastAudit = audits[audits.length - 1];
          const totalH = (new Date(lastAudit.createdAt).getTime() - subCreated) / (1000 * 60 * 60);
          overallLatencies.push(Number(totalH.toFixed(1)));
        }
      }
    }

    const p50OverallHours = getPercentile(overallLatencies, 0.5) || 14.5;
    const p90OverallHours = getPercentile(overallLatencies, 0.9) || 38.0;

    const avgTier1Hours = tier1Latencies.length > 0 ? Number((tier1Latencies.reduce((a, b) => a + b, 0) / tier1Latencies.length).toFixed(1)) : 8.2;
    const avgTier2Hours = tier2Latencies.length > 0 ? Number((tier2Latencies.reduce((a, b) => a + b, 0) / tier2Latencies.length).toFixed(1)) : 18.4;
    const avgTier3Hours = tier3Latencies.length > 0 ? Number((tier3Latencies.reduce((a, b) => a + b, 0) / tier3Latencies.length).toFixed(1)) : 10.1;

    let bottleneckTier = 'Tier 2: Area Sales Manager (ASM)';
    if (avgTier1Hours > avgTier2Hours && avgTier1Hours > avgTier3Hours) {
      bottleneckTier = 'Tier 1: Project Manager (PM)';
    } else if (avgTier3Hours > avgTier2Hours && avgTier3Hours > avgTier1Hours) {
      bottleneckTier = 'Tier 3: Regional Sales Manager (RSM)';
    }

    // Predictive SLA Risk for Active Vacancies
    let lowRiskCount = 0;
    let medRiskCount = 0;
    let highRiskCount = 0;
    const highRiskList: any[] = [];

    for (const v of activeVacancies) {
      const created = new Date(v.createdAt).getTime();
      const targetDays = v.targetDaysToFill || 2;
      const dueTime = v.targetDueDate ? new Date(v.targetDueDate).getTime() : created + targetDays * 24 * 60 * 60 * 1000;
      const elapsed = now - created;
      const totalWindow = dueTime - created;
      const ratio = elapsed / totalWindow;

      let score = Math.round(ratio * 75);
      if (v.submissions.some((s) => s.status === 'REJECTED')) score += 20;
      score = Math.max(5, Math.min(99, score));

      const hoursLeft = Math.round((dueTime - now) / (1000 * 60 * 60));

      if (score >= 70 || hoursLeft <= 12) {
        highRiskCount++;
        highRiskList.push({
          id: v.id,
          vacancyCode: v.vacancyCode || 'STAGING',
          title: v.title,
          area: v.area,
          projectCode: v.project?.code || 'P',
          score,
          hoursLeft,
        });
      } else if (score >= 40) {
        medRiskCount++;
      } else {
        lowRiskCount++;
      }
    }

    // 8. Rejection Root-Cause Pareto
    const allRejected = allSubmissions.filter((s) => s.status === 'REJECTED');
    let salaryMismatch = 0;
    let experienceDeficit = 0;
    let locationDistance = 0;
    let otherCount = 0;

    for (const r of allRejected) {
      const text = `${r.rejectionReason || ''} ${r.rejectionComments || ''}`.toLowerCase();
      if (text.includes('salary') || text.includes('budget') || text.includes('compensation') || text.includes('ctc') || text.includes('rate')) {
        salaryMismatch++;
      } else if (text.includes('exp') || text.includes('skill') || text.includes('qualif') || text.includes('technical')) {
        experienceDeficit++;
      } else if (text.includes('loc') || text.includes('dist') || text.includes('travel') || text.includes('area') || text.includes('commute')) {
        locationDistance++;
      } else {
        otherCount++;
      }
    }

    const totalRejectionsCount = Math.max(1, allRejected.length);
    const rejectionPareto = [
      { cause: 'Compensation / Salary Expectations', count: salaryMismatch, percent: Math.round((salaryMismatch / totalRejectionsCount) * 100) },
      { cause: 'Experience & Background Deficit', count: experienceDeficit, percent: Math.round((experienceDeficit / totalRejectionsCount) * 100) },
      { cause: 'Commute / Geographic Distance', count: locationDistance, percent: Math.round((locationDistance / totalRejectionsCount) * 100) },
      { cause: 'Other Ground Constraints', count: otherCount, percent: Math.round((otherCount / totalRejectionsCount) * 100) },
    ];

    const totalPayrollBudgetInr = roleIntelligence.reduce((acc, curr) => acc + curr.total * curr.avgSalaryInr, 0);

    res.json({
      success: true,
      data: {
        scorecard: {
          overallFillRate,
          totalVacancies,
          activeVacancies: activeVacancies.length,
          pendingVacancies: pendingVacancies.length,
          filledVacancies: filledVacancies.length,
          avgConsumptionDays,
          slaComplianceRate,
          firstTimeRightRate,
          dailyVelocity,
          estimatedCompletionDays,
          totalPayrollBudgetInr,
          totalPayrollDisplay: `₹${(totalPayrollBudgetInr / 100000).toFixed(1)} Lakhs`,
        },
        roleIntelligence,
        areaFrictionList,
        projectForecasting,
        slaVelocity: {
          p50OverallHours,
          p90OverallHours,
          avgTier1Hours,
          avgTier2Hours,
          avgTier3Hours,
          bottleneckTier,
          predictiveBreachRisk: {
            lowRiskCount,
            medRiskCount,
            highRiskCount,
            highRiskList: highRiskList.slice(0, 5),
          },
        },
        rejectionPareto,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/export-raw-csv (Proper Row-Level Raw Data Download)
reportsRouter.get('/export-raw-csv', requirePermission('reports.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vacancies = await prisma.vacancy.findMany({
      include: {
        project: { include: { pmUser: true } },
        projectRole: true,
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        submissions: {
          include: { audits: { orderBy: { createdAt: 'asc' } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'Vacancy_Code',
      'Project_Name',
      'Project_Code',
      'Job_Title',
      'Zone',
      'Area',
      'Salary_In_Rupees',
      'SLA_Target_Days',
      'Status',
      'Created_Date',
      'Target_Due_Date',
      'Consumption_Days',
      'SLA_Outcome',
      'Candidate_Name',
      'Candidate_Email',
      'Candidate_Phone',
      'Submission_Status',
      'Current_Tier',
      'Tier1_Status',
      'Tier2_Status',
      'Tier3_Status',
      'PM_Creator',
    ].join(',');

    const now = Date.now();
    const rows: string[] = [headers];

    for (const v of vacancies) {
      const activeSub = v.submissions[0];
      const createdDate = new Date(v.createdAt).toISOString().split('T')[0];
      const dueDate = v.targetDueDate ? new Date(v.targetDueDate).toISOString().split('T')[0] : '';
      
      let consumptionDays = 'N/A';
      let slaOutcome = 'OPEN';

      if (v.status === 'FILLED') {
        const diffMs = new Date(v.updatedAt).getTime() - new Date(v.createdAt).getTime();
        const days = Math.max(0.1, diffMs / (1000 * 60 * 60 * 24));
        consumptionDays = days.toFixed(1);
        slaOutcome = days <= (v.targetDaysToFill || 2) ? 'MET_SLA' : 'BREACHED_SLA';
      } else if (v.targetDueDate && now > new Date(v.targetDueDate).getTime()) {
        slaOutcome = 'OVERDUE';
      }

      const tier1Status = activeSub ? (activeSub.currentLevel > 1 || activeSub.status === 'APPROVED' ? 'Approved' : 'Pending') : 'Unassigned';
      const tier2Status = activeSub ? (activeSub.currentLevel > 2 || activeSub.status === 'APPROVED' ? 'Approved' : activeSub.currentLevel === 2 ? 'Pending' : 'Locked') : 'Unassigned';
      const tier3Status = activeSub ? (activeSub.status === 'APPROVED' ? 'Approved' : activeSub.currentLevel === 3 ? 'Pending' : 'Locked') : 'Unassigned';

      const pmName = v.createdBy ? `${v.createdBy.firstName} ${v.createdBy.lastName}` : (v.project?.pmUser ? `${v.project.pmUser.firstName} ${v.project.pmUser.lastName}` : 'System');

      const escapeCsv = (str?: string | null) => {
        if (!str) return '""';
        return `"${String(str).replace(/"/g, '""')}"`;
      };

      const line = [
        escapeCsv(v.vacancyCode || 'STAGING'),
        escapeCsv(v.project?.name),
        escapeCsv(v.project?.code),
        escapeCsv(v.title),
        escapeCsv(v.zone),
        escapeCsv(v.area),
        escapeCsv(v.salary || 'Market Rate (₹)'),
        v.targetDaysToFill || 2,
        escapeCsv(v.status),
        createdDate,
        dueDate,
        consumptionDays,
        slaOutcome,
        escapeCsv(activeSub?.fullName),
        escapeCsv(activeSub?.email),
        escapeCsv(activeSub?.phone),
        escapeCsv(activeSub?.status),
        activeSub?.currentLevel || 1,
        tier1Status,
        tier2Status,
        tier3Status,
        escapeCsv(pmName),
      ].join(',');

      rows.push(line);
    }

    const csvOutput = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="recruitment_operations_raw_data.csv"');
    res.status(200).send(csvOutput);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/login-audits (Recent Login Activity Ledger)
reportsRouter.get('/login-audits', requirePermission('reports.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const audits = await prisma.userLoginAudit.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    const totalCount = await prisma.userLoginAudit.count();

    res.json({
      success: true,
      data: {
        audits,
        totalCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/export-logins-csv (Download Login Activity & Usage Audit Log)
reportsRouter.get('/export-logins-csv', requirePermission('reports.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const audits = await prisma.userLoginAudit.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Timestamp', 'User_Email', 'Role_Name', 'Action', 'IP_Address', 'User_Agent'].join(',');
    const rows = [headers];

    for (const a of audits) {
      const escapeCsv = (str?: string | null) => (str ? `"${String(str).replace(/"/g, '""')}"` : '""');
      const timeStr = new Date(a.createdAt).toLocaleString('en-GB');
      rows.push([
        escapeCsv(timeStr),
        escapeCsv(a.userEmail),
        escapeCsv(a.roleName),
        escapeCsv(a.action),
        escapeCsv(a.ipAddress),
        escapeCsv(a.userAgent),
      ].join(','));
    }

    const csvOutput = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="user_login_audit_logs.csv"');
    res.status(200).send(csvOutput);
  } catch (err) {
    next(err);
  }
});

// Helper: Extract monthly salary number in INR
function extractSalaryInr(salaryStr?: string | null): number {
  if (!salaryStr) return 26000;
  const numbers = salaryStr.match(/\d+[\d,]*/g);
  if (numbers && numbers.length > 0) {
    const parsed = numbers.map((n) => parseInt(n.replace(/,/g, ''), 10)).filter((n) => !isNaN(n) && n > 1000);
    if (parsed.length > 0) {
      return Math.round(parsed.reduce((a, b) => a + b, 0) / parsed.length);
    }
  }
  return 26000;
}

// GET /api/v1/reports/workforce-mandays (Power BI Workforce, Mandays & Percentage Analytics)
reportsRouter.get('/workforce-mandays', requirePermission('reports.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, area, roleTitle, timeframe } = req.query;

    const allVacancies = await prisma.vacancy.findMany({
      include: {
        project: true,
        projectRole: true,
        submissions: {
          include: { audits: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();

    // Slicer filters
    const filtered = allVacancies.filter((v) => {
      if (projectId && typeof projectId === 'string' && projectId !== 'ALL') {
        if (v.project?.id !== projectId && v.project?.code !== projectId) return false;
      }
      if (area && typeof area === 'string' && area !== 'ALL') {
        if (v.area?.toLowerCase() !== area.toLowerCase()) return false;
      }
      if (roleTitle && typeof roleTitle === 'string' && roleTitle !== 'ALL') {
        if (v.title?.toLowerCase() !== roleTitle.toLowerCase()) return false;
      }
      if (timeframe && typeof timeframe === 'string' && timeframe !== 'ALL') {
        const itemTime = new Date(v.createdAt).getTime();
        if (timeframe === '7D' && now - itemTime > 7 * 24 * 60 * 60 * 1000) return false;
        if (timeframe === '30D' && now - itemTime > 30 * 24 * 60 * 60 * 1000) return false;
        if (timeframe === 'THIS_MONTH') {
          const itemD = new Date(v.createdAt);
          const currentD = new Date();
          if (itemD.getMonth() !== currentD.getMonth() || itemD.getFullYear() !== currentD.getFullYear()) {
            return false;
          }
        }
      }
      return true;
    });

    // Dynamic Slicer Options (from whole DB)
    const projectSlicerMap = new Map<string, { code: string; name: string }>();
    const areaSlicerSet = new Set<string>();
    const roleSlicerSet = new Set<string>();

    allVacancies.forEach((v) => {
      if (v.project) projectSlicerMap.set(v.project.code, { code: v.project.code, name: v.project.name });
      if (v.area) areaSlicerSet.add(v.area.trim());
      if (v.title) roleSlicerSet.add(v.title.trim());
    });

    // Calculate individual position mandays
    const positionMetrics = filtered.map((v) => {
      const createdTime = new Date(v.createdAt).getTime();
      const daysSinceCreation = Math.max(1, Math.floor((now - createdTime) / (1000 * 60 * 60 * 24)));
      const plannedMandays = 26; // Standard 26 working days in operational month

      let deliveredMandays = 0;
      let lostMandays = 0;
      let daysToFill = 0;

      if (v.status === 'FILLED') {
        const approvedAudits = v.submissions.flatMap((s) => s.audits).filter((a) => a.action === 'APPROVED');
        const finishTime = approvedAudits.length > 0
          ? new Date(approvedAudits[approvedAudits.length - 1].createdAt).getTime()
          : new Date(v.updatedAt).getTime();
        daysToFill = Math.max(1, Math.floor((finishTime - createdTime) / (1000 * 60 * 60 * 24)));
        const targetDays = v.targetDaysToFill || 2;
        const delayedDays = Math.max(0, daysToFill - targetDays);
        deliveredMandays = Math.max(1, plannedMandays - delayedDays);
        lostMandays = delayedDays;
      } else {
        // ACTIVE, PENDING_APPROVAL, etc.
        lostMandays = Math.min(plannedMandays, daysSinceCreation);
        deliveredMandays = 0;
      }

      const avgSalary = extractSalaryInr(v.salary);
      const dailyRate = Math.round(avgSalary / 26);
      const financialLoss = lostMandays * dailyRate;

      return {
        id: v.id,
        vacancyCode: v.vacancyCode || 'FLAGGED',
        projectCode: v.project?.code || 'GEN',
        projectName: v.project?.name || 'Project',
        area: v.area || 'General',
        zone: v.zone || 'General',
        title: v.title,
        status: v.status,
        salary: v.salary,
        plannedMandays,
        deliveredMandays,
        lostMandays,
        financialLoss,
      };
    });

    // Overall Totals
    const totalPositions = positionMetrics.length;
    const filledPositions = positionMetrics.filter((p) => p.status === 'FILLED').length;
    const activeVacancies = positionMetrics.filter((p) => p.status === 'ACTIVE').length;
    const pendingVacancies = positionMetrics.filter((p) => p.status === 'PENDING_APPROVAL').length;
    const closedVacancies = positionMetrics.filter((p) => p.status === 'CANCELLED' || p.status === 'DRAFT_DUPLICATE_FLAG').length;

    const totalPlannedMandays = positionMetrics.reduce((acc, p) => acc + p.plannedMandays, 0);
    const totalDeliveredMandays = positionMetrics.reduce((acc, p) => acc + p.deliveredMandays, 0);
    const totalLostMandays = positionMetrics.reduce((acc, p) => acc + p.lostMandays, 0);
    const totalLossInr = positionMetrics.reduce((acc, p) => acc + p.financialLoss, 0);

    const overallFulfillmentPercent = totalPlannedMandays > 0
      ? Math.round((totalDeliveredMandays / totalPlannedMandays) * 100)
      : 0;

    const overallFillRatePercent = totalPositions > 0
      ? Math.round((filledPositions / totalPositions) * 100)
      : 0;

    const totalLossDisplay = totalLossInr >= 100000
      ? `₹${(totalLossInr / 100000).toFixed(2)} Lakhs`
      : `₹${totalLossInr.toLocaleString('en-IN')}`;

    // Graph 1 Dataset: Mandays by Project (Delivered vs Lost)
    const projectAggMap = new Map<string, { code: string; name: string; planned: number; delivered: number; lost: number; positions: number; filled: number }>();
    positionMetrics.forEach((p) => {
      if (!projectAggMap.has(p.projectCode)) {
        projectAggMap.set(p.projectCode, {
          code: p.projectCode,
          name: p.projectName,
          planned: 0,
          delivered: 0,
          lost: 0,
          positions: 0,
          filled: 0,
        });
      }
      const agg = projectAggMap.get(p.projectCode)!;
      agg.planned += p.plannedMandays;
      agg.delivered += p.deliveredMandays;
      agg.lost += p.lostMandays;
      agg.positions += 1;
      if (p.status === 'FILLED') agg.filled += 1;
    });

    const mandaysByProject = Array.from(projectAggMap.values()).map((p) => ({
      code: p.code,
      name: p.name,
      plannedMandays: p.planned,
      deliveredMandays: p.delivered,
      lostMandays: p.lost,
      fulfillmentPercent: p.planned > 0 ? Math.round((p.delivered / p.planned) * 100) : 0,
      fillRatePercent: p.positions > 0 ? Math.round((p.filled / p.positions) * 100) : 0,
    }));

    // Graph 1 Secondary: Mandays by Area
    const areaAggMap = new Map<string, { area: string; planned: number; delivered: number; lost: number; positions: number; filled: number }>();
    positionMetrics.forEach((p) => {
      if (!areaAggMap.has(p.area)) {
        areaAggMap.set(p.area, {
          area: p.area,
          planned: 0,
          delivered: 0,
          lost: 0,
          positions: 0,
          filled: 0,
        });
      }
      const agg = areaAggMap.get(p.area)!;
      agg.planned += p.plannedMandays;
      agg.delivered += p.deliveredMandays;
      agg.lost += p.lostMandays;
      agg.positions += 1;
      if (p.status === 'FILLED') agg.filled += 1;
    });

    const mandaysByArea = Array.from(areaAggMap.values())
      .map((a) => ({
        area: a.area,
        deliveredMandays: a.delivered,
        lostMandays: a.lost,
        plannedMandays: a.planned,
        fulfillmentPercent: a.planned > 0 ? Math.round((a.delivered / a.planned) * 100) : 0,
      }))
      .sort((a, b) => b.lostMandays - a.lostMandays);

    // Graph 2 Dataset: Efficiency & Percentage by Role
    const roleAggMap = new Map<string, { title: string; planned: number; delivered: number; lost: number; total: number; filled: number }>();
    positionMetrics.forEach((p) => {
      if (!roleAggMap.has(p.title)) {
        roleAggMap.set(p.title, {
          title: p.title,
          planned: 0,
          delivered: 0,
          lost: 0,
          total: 0,
          filled: 0,
        });
      }
      const agg = roleAggMap.get(p.title)!;
      agg.planned += p.plannedMandays;
      agg.delivered += p.deliveredMandays;
      agg.lost += p.lostMandays;
      agg.total += 1;
      if (p.status === 'FILLED') agg.filled += 1;
    });

    const efficiencyByRole = Array.from(roleAggMap.values()).map((r) => ({
      roleTitle: r.title,
      totalPositions: r.total,
      filledPositions: r.filled,
      openPositions: r.total - r.filled,
      fillRatePercent: r.total > 0 ? Math.round((r.filled / r.total) * 100) : 0,
      fulfillmentPercent: r.planned > 0 ? Math.round((r.delivered / r.planned) * 100) : 0,
      benchmarkTarget: 90,
      deliveredMandays: r.delivered,
      lostMandays: r.lost,
    })).sort((a, b) => b.totalPositions - a.totalPositions);

    // Multi-Dimensional Power BI Matrix (Project × Area × Position)
    const matrixMap = new Map<string, {
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
    }>();

    positionMetrics.forEach((p) => {
      const key = `${p.projectCode}__${p.area}__${p.title}`;
      if (!matrixMap.has(key)) {
        matrixMap.set(key, {
          projectCode: p.projectCode,
          projectName: p.projectName,
          area: p.area,
          roleTitle: p.title,
          totalSlots: 0,
          filledSlots: 0,
          openSlots: 0,
          plannedMandays: 0,
          deliveredMandays: 0,
          lostMandays: 0,
          lossInr: 0,
        });
      }
      const row = matrixMap.get(key)!;
      row.totalSlots += 1;
      if (p.status === 'FILLED') row.filledSlots += 1;
      else row.openSlots += 1;
      row.plannedMandays += p.plannedMandays;
      row.deliveredMandays += p.deliveredMandays;
      row.lostMandays += p.lostMandays;
      row.lossInr += p.financialLoss;
    });

    const matrixRows = Array.from(matrixMap.values())
      .map((r) => ({
        ...r,
        efficiencyPercent: r.plannedMandays > 0 ? Math.round((r.deliveredMandays / r.plannedMandays) * 100) : 0,
        fillRatePercent: r.totalSlots > 0 ? Math.round((r.filledSlots / r.totalSlots) * 100) : 0,
        lossDisplay: `₹${r.lossInr.toLocaleString('en-IN')}`,
      }))
      .sort((a, b) => b.lostMandays - a.lostMandays);

    res.json({
      success: true,
      data: {
        scorecard: {
          totalPositions,
          filledPositions,
          activeVacancies,
          pendingVacancies,
          closedVacancies,
          totalPlannedMandays,
          totalDeliveredMandays,
          totalLostMandays,
          overallFulfillmentPercent,
          overallFillRatePercent,
          totalLossInr,
          totalLossDisplay,
        },
        mandaysByProject,
        mandaysByArea,
        efficiencyByRole,
        matrixRows,
        slicerOptions: {
          projects: Array.from(projectSlicerMap.values()),
          areas: Array.from(areaSlicerSet).sort(),
          roles: Array.from(roleSlicerSet).sort(),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/export-workforce-excel (Download Multi-Dimensional Workforce & Mandays Report in Excel format)
reportsRouter.get('/export-workforce-excel', requirePermission('reports.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, area, roleTitle, timeframe } = req.query;

    const allVacancies = await prisma.vacancy.findMany({
      include: {
        project: true,
        submissions: { include: { audits: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();

    const filtered = allVacancies.filter((v) => {
      if (projectId && typeof projectId === 'string' && projectId !== 'ALL') {
        if (v.project?.id !== projectId && v.project?.code !== projectId) return false;
      }
      if (area && typeof area === 'string' && area !== 'ALL') {
        if (v.area?.toLowerCase() !== area.toLowerCase()) return false;
      }
      if (roleTitle && typeof roleTitle === 'string' && roleTitle !== 'ALL') {
        if (v.title?.toLowerCase() !== roleTitle.toLowerCase()) return false;
      }
      if (timeframe && typeof timeframe === 'string' && timeframe !== 'ALL') {
        const itemTime = new Date(v.createdAt).getTime();
        if (timeframe === '7D' && now - itemTime > 7 * 24 * 60 * 60 * 1000) return false;
        if (timeframe === '30D' && now - itemTime > 30 * 24 * 60 * 60 * 1000) return false;
        if (timeframe === 'THIS_MONTH') {
          const itemD = new Date(v.createdAt);
          const currentD = new Date();
          if (itemD.getMonth() !== currentD.getMonth() || itemD.getFullYear() !== currentD.getFullYear()) {
            return false;
          }
        }
      }
      return true;
    });

    // Grouping
    const matrixMap = new Map<string, {
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
    }>();

    for (const v of filtered) {
      const createdTime = new Date(v.createdAt).getTime();
      const daysSinceCreation = Math.max(1, Math.floor((now - createdTime) / (1000 * 60 * 60 * 24)));
      const plannedMandays = 26;

      let deliveredMandays = 0;
      let lostMandays = 0;
      if (v.status === 'FILLED') {
        const approvedAudits = v.submissions.flatMap((s) => s.audits).filter((a) => a.action === 'APPROVED');
        const finishTime = approvedAudits.length > 0
          ? new Date(approvedAudits[approvedAudits.length - 1].createdAt).getTime()
          : new Date(v.updatedAt).getTime();
        const daysToFill = Math.max(1, Math.floor((finishTime - createdTime) / (1000 * 60 * 60 * 24)));
        const delayedDays = Math.max(0, daysToFill - (v.targetDaysToFill || 2));
        deliveredMandays = Math.max(1, plannedMandays - delayedDays);
        lostMandays = delayedDays;
      } else {
        lostMandays = Math.min(plannedMandays, daysSinceCreation);
        deliveredMandays = 0;
      }

      const avgSalary = extractSalaryInr(v.salary);
      const dailyRate = Math.round(avgSalary / 26);
      const financialLoss = lostMandays * dailyRate;

      const pCode = v.project?.code || 'GEN';
      const pName = v.project?.name || 'Project';
      const pArea = v.area || 'General';
      const key = `${pCode}__${pArea}__${v.title}`;

      if (!matrixMap.has(key)) {
        matrixMap.set(key, {
          projectCode: pCode,
          projectName: pName,
          area: pArea,
          roleTitle: v.title,
          totalSlots: 0,
          filledSlots: 0,
          openSlots: 0,
          plannedMandays: 0,
          deliveredMandays: 0,
          lostMandays: 0,
          lossInr: 0,
        });
      }
      const row = matrixMap.get(key)!;
      row.totalSlots += 1;
      if (v.status === 'FILLED') row.filledSlots += 1;
      else row.openSlots += 1;
      row.plannedMandays += plannedMandays;
      row.deliveredMandays += deliveredMandays;
      row.lostMandays += lostMandays;
      row.lossInr += financialLoss;
    }

    const rows = [
      'Project_Code,Project_Name,Area_Territory,Role_Title,Target_Positions,Filled_Slots,Open_Vacancies,Planned_Mandays,Delivered_Mandays,Lost_Mandays,Efficiency_Percent,Estimated_Loss_INR',
    ];

    let gTotal = 0, gFilled = 0, gOpen = 0, gPlanned = 0, gDelivered = 0, gLost = 0, gLossInr = 0;

    for (const r of matrixMap.values()) {
      const eff = r.plannedMandays > 0 ? Math.round((r.deliveredMandays / r.plannedMandays) * 100) : 0;
      gTotal += r.totalSlots;
      gFilled += r.filledSlots;
      gOpen += r.openSlots;
      gPlanned += r.plannedMandays;
      gDelivered += r.deliveredMandays;
      gLost += r.lostMandays;
      gLossInr += r.lossInr;

      rows.push(
        `"${r.projectCode}","${r.projectName}","${r.area}","${r.roleTitle}",${r.totalSlots},${r.filledSlots},${r.openSlots},${r.plannedMandays},${r.deliveredMandays},${r.lostMandays},${eff}%,₹${r.lossInr.toLocaleString('en-IN')}`
      );
    }

    // Grand Total Row
    const gEff = gPlanned > 0 ? Math.round((gDelivered / gPlanned) * 100) : 0;
    rows.push(
      `"GRAND TOTAL","All Projects","All Areas","All Positions",${gTotal},${gFilled},${gOpen},${gPlanned},${gDelivered},${gLost},${gEff}%,₹${gLossInr.toLocaleString('en-IN')}`
    );

    const csvOutput = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="powerbi_workforce_mandays_analytics.csv"');
    res.status(200).send(csvOutput);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/area-trends (Daily time-series multi-line trend by Area / Territory)
reportsRouter.get('/area-trends', requirePermission('reports.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, projectId, roleTitle } = req.query;

    const allVacancies = await prisma.vacancy.findMany({
      include: {
        project: true,
        submissions: { include: { audits: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 1. Filter by Project & Role Title
    const filtered = allVacancies.filter((v) => {
      if (projectId && typeof projectId === 'string' && projectId !== 'ALL') {
        if (v.project?.id !== projectId && v.project?.code !== projectId) return false;
      }
      if (roleTitle && typeof roleTitle === 'string' && roleTitle !== 'ALL') {
        if (v.title?.toLowerCase() !== roleTitle.toLowerCase()) return false;
      }
      return true;
    });

    // 2. Extract available filter options
    const projectSlicerMap = new Map<string, { id: string; code: string; name: string }>();
    const roleSlicerSet = new Set<string>();
    const allAreasSet = new Set<string>();

    allVacancies.forEach((v) => {
      if (v.project) {
        projectSlicerMap.set(v.project.id, { id: v.project.id, code: v.project.code, name: v.project.name });
      }
      if (v.title) roleSlicerSet.add(v.title);
      if (v.area) allAreasSet.add(v.area);
    });

    if (filtered.length === 0) {
      return res.json({
        success: true,
        data: {
          dates: [],
          areas: [],
          summary: {
            startDate: '',
            endDate: '',
            totalDays: 0,
            totalRequisitions: 0,
            totalFilled: 0,
            overallFillRate: 0,
          },
          filterOptions: {
            projects: Array.from(projectSlicerMap.values()),
            roles: Array.from(roleSlicerSet).sort(),
            availableAreas: Array.from(allAreasSet).sort(),
            minDate: '',
            maxDate: '',
          },
        },
      });
    }

    // Determine min and max dates across the dataset
    const timestamps = filtered.map((v) => new Date(v.createdAt).getTime());
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    const minDateStr = new Date(minTimestamp).toISOString().slice(0, 10);
    const maxDateStr = new Date(maxTimestamp).toISOString().slice(0, 10);

    // Apply user-provided date range bounds
    const effectiveStartStr = startDate && typeof startDate === 'string' ? startDate : minDateStr;
    const effectiveEndStr = endDate && typeof endDate === 'string' ? endDate : maxDateStr;

    // Generate day list between effectiveStartStr and effectiveEndStr
    const startObj = new Date(effectiveStartStr + 'T00:00:00.000Z');
    const endObj = new Date(effectiveEndStr + 'T23:59:59.999Z');

    const dayList: string[] = [];
    const curObj = new Date(startObj);
    while (curObj.getTime() <= endObj.getTime()) {
      dayList.push(curObj.toISOString().slice(0, 10));
      curObj.setUTCDate(curObj.getUTCDate() + 1);
    }

    // Distinct areas present in filtered set
    const areaMap = new Map<string, typeof filtered>();
    filtered.forEach((v) => {
      const a = v.area || 'General';
      if (!areaMap.has(a)) areaMap.set(a, []);
      areaMap.get(a)!.push(v);
    });

    // Distinct vibrant color palette for line curves
    const palette = [
      '#38bdf8', // Sky Blue
      '#10b981', // Emerald Green
      '#f59e0b', // Amber
      '#f43f5e', // Rose / Red
      '#a855f7', // Purple
      '#06b6d4', // Cyan
      '#ec4899', // Pink
      '#6366f1', // Indigo
      '#14b8a6', // Teal
      '#84cc16', // Lime
    ];

    let colorIdx = 0;
    const areaSeriesList: any[] = [];

    // Calculate time-series points for each area
    for (const [areaName, vacs] of areaMap.entries()) {
      const color = palette[colorIdx % palette.length];
      colorIdx++;

      // Pre-compute fill date for each vacancy
      const processedVacs = vacs.map((v) => {
        const createdDateStr = new Date(v.createdAt).toISOString().slice(0, 10);
        let filledDateStr: string | null = null;
        if (v.status === 'FILLED') {
          const approvedAudits = v.submissions.flatMap((s) => s.audits).filter((a) => a.action === 'APPROVED');
          if (approvedAudits.length > 0) {
            filledDateStr = new Date(approvedAudits[approvedAudits.length - 1].createdAt).toISOString().slice(0, 10);
          } else {
            filledDateStr = new Date(v.updatedAt).toISOString().slice(0, 10);
          }
        }
        return {
          id: v.id,
          createdDateStr,
          filledDateStr,
          status: v.status,
        };
      });

      const seriesPoints = dayList.map((day) => {
        // Requisitions created on or before this day
        const cumVacs = processedVacs.filter((v) => v.createdDateStr <= day);
        const cumTotal = cumVacs.length;

        // Requisitions filled on or before this day
        const cumFilled = cumVacs.filter((v) => v.filledDateStr !== null && v.filledDateStr <= day).length;

        // Open vacancies on this day
        const openCount = cumTotal - cumFilled;

        // Fill rate percentage
        const percentage = cumTotal > 0 ? Math.round((cumFilled / cumTotal) * 100) : 0;

        // New requisitions created on this specific day
        const newVacancies = processedVacs.filter((v) => v.createdDateStr === day).length;

        return {
          date: day,
          percentage,
          filledCount: cumFilled,
          openCount,
          totalCount: cumTotal,
          newVacancies,
        };
      });

      const lastPoint = seriesPoints[seriesPoints.length - 1] || { percentage: 0, filledCount: 0, totalCount: 0 };

      areaSeriesList.push({
        name: areaName,
        color,
        totalVacancies: lastPoint.totalCount,
        currentFilled: lastPoint.filledCount,
        currentFillRate: lastPoint.percentage,
        data: seriesPoints,
      });
    }

    // Sort areas by total vacancies descending (most active areas first)
    areaSeriesList.sort((a, b) => b.totalVacancies - a.totalVacancies);

    // Summary calculations across all areas
    const totalRequisitions = filtered.length;
    const totalFilled = filtered.filter((v) => v.status === 'FILLED').length;
    const overallFillRate = totalRequisitions > 0 ? Math.round((totalFilled / totalRequisitions) * 100) : 0;

    res.json({
      success: true,
      data: {
        dates: dayList,
        areas: areaSeriesList,
        summary: {
          startDate: effectiveStartStr,
          endDate: effectiveEndStr,
          totalDays: dayList.length,
          totalRequisitions,
          totalFilled,
          overallFillRate,
        },
        filterOptions: {
          projects: Array.from(projectSlicerMap.values()),
          roles: Array.from(roleSlicerSet).sort(),
          availableAreas: Array.from(allAreasSet).sort(),
          minDate: minDateStr,
          maxDate: maxDateStr,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/store-matrix (Consolidated Store × Project Excel Matrix)
reportsRouter.get('/store-matrix', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zone, area, tradeType, chain, line, manpowerType, projectId } = req.query;

    // Default zone scoping for Recruiter
    let effectiveZone = typeof zone === 'string' ? zone : 'ALL';
    if (req.user?.roleName === 'RECRUITER' && (!zone || zone === 'ALL')) {
      if (req.user.zone) {
        effectiveZone = req.user.zone;
      }
    }

    // 1. Filter Stores
    const storeWhere: any = {};
    if (effectiveZone !== 'ALL') storeWhere.zone = effectiveZone;
    if (area && area !== 'ALL') storeWhere.area = area;
    if (tradeType && tradeType !== 'ALL') storeWhere.tradeType = tradeType;
    if (chain && chain !== 'ALL') storeWhere.chain = chain;
    if (line && line !== 'ALL') storeWhere.line = line;

    const allStores = await prisma.store.findMany({
      where: storeWhere,
      orderBy: [{ zone: 'asc' }, { city: 'asc' }, { name: 'asc' }],
    });

    const storeIds = allStores.map((s) => s.id);

    // 2. Strict PM Project Scoping
    let allProjects = await prisma.project.findMany({
      orderBy: { name: 'asc' },
    });

    if (req.user?.roleName === 'PM') {
      const pmProjectRecords = await prisma.project.findMany({
        where: {
          OR: [
            { pmUserId: req.user.id },
            { projectAssignments: { some: { userId: req.user.id } } },
          ],
        },
        select: { id: true },
      });
      const pmProjectIds = new Set(pmProjectRecords.map((p) => p.id));
      allProjects = allProjects.filter((p) => pmProjectIds.has(p.id));
    }

    // 3. Filter Vacancies for these Stores & Projects
    const vacancyWhere: any = {
      storeId: { in: storeIds },
      status: { notIn: ['CANCELLED', 'PENDING_INGEST_REVIEW', 'DRAFT_DUPLICATE_FLAG'] },
    };

    if (req.user?.roleName === 'PM') {
      const pmAllowedIds = allProjects.map((p) => p.id);
      vacancyWhere.projectId = { in: pmAllowedIds };
    }

    if (manpowerType && manpowerType !== 'ALL') {
      vacancyWhere.manpowerType = manpowerType;
    }
    if (projectId && projectId !== 'ALL') {
      vacancyWhere.projectId = projectId;
    }

    const vacancies = await prisma.vacancy.findMany({
      where: vacancyWhere,
      include: {
        project: true,
        submissions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Determine relevant projects
    const relevantProjectIds = new Set(vacancies.map((v) => v.projectId));
    const matrixProjects = req.user?.roleName === 'PM'
      ? allProjects
      : allProjects.filter((p) => relevantProjectIds.has(p.id) || allProjects.length <= 8);

    // 4. Group vacancies by storeId and projectId
    const vacancyMap = new Map<string, any>(); // key: `${storeId}_${projectId}`
    for (const v of vacancies) {
      if (v.storeId) {
        vacancyMap.set(`${v.storeId}_${v.projectId}`, v);
      }
    }

    // 5. Construct Store Rows
    let totalRequiredPositions = 0;
    let totalActiveFilled = 0;
    let totalVacant = 0;
    let totalOnHold = 0;

    const storeRows = allStores.map((store) => {
      let storeReq = 0;
      let storeAct = 0;
      let storeVac = 0;
      let storeHld = 0;

      const projectStatuses: Record<string, any> = {};

      for (const proj of matrixProjects) {
        const key = `${store.id}_${proj.id}`;
        const vac = vacancyMap.get(key);

        if (vac) {
          const reqQty = vac.requiredPositions || 1;
          const fillQty = vac.filledPositions || 0;
          const isOnHold = vac.status === 'ON_HOLD';
          const vacantQty = isOnHold ? 0 : Math.max(0, reqQty - fillQty);
          const holdQty = isOnHold ? reqQty : 0;

          storeReq += reqQty;
          storeAct += fillQty;
          storeVac += vacantQty;
          storeHld += holdQty;

          projectStatuses[proj.name] = {
            status: 'Yes',
            remark: isOnHold ? 'Hold' : (fillQty >= reqQty ? 'Active' : 'Vacant'),
            vacancyId: vac.id,
            vacancyCode: vac.vacancyCode,
            required: reqQty,
            active: fillQty,
            vacant: vacantQty,
            onHold: holdQty,
            holdReason: vac.holdReason,
            manpowerType: vac.manpowerType,
            candidates: (vac.submissions || []).map((sub: any) => ({
              id: sub.id,
              name: sub.fullName,
              phone: sub.phone,
              stage: sub.stage || 'PROPOSED',
              status: sub.status,
            })),
          };
        } else {
          projectStatuses[proj.name] = {
            status: 'NA',
            remark: 'NA',
            vacancyId: null,
            required: 0,
            active: 0,
            vacant: 0,
            onHold: 0,
            candidates: [],
          };
        }
      }

      totalRequiredPositions += storeReq;
      totalActiveFilled += storeAct;
      totalVacant += storeVac;
      totalOnHold += storeHld;

      return {
        storeId: store.id,
        storeCode: store.code,
        storeName: store.name,
        chain: store.chain,
        line: store.line || 'General',
        area: store.area,
        zone: store.zone,
        city: store.city || '',
        tradeType: store.tradeType,
        totalRequired: storeReq,
        totalActive: storeAct,
        totalVacant: storeVac,
        totalOnHold: storeHld,
        projectStatuses,
      };
    });

    // 6. Calculate Project Column Totals
    const projectSummary = matrixProjects.map((p) => {
      const projVacancies = vacancies.filter((v) => v.projectId === p.id);
      const req = projVacancies.reduce((acc, v) => acc + (v.requiredPositions || 1), 0);
      const act = projVacancies.reduce((acc, v) => acc + (v.filledPositions || 0), 0);
      const hld = projVacancies.filter((v) => v.status === 'ON_HOLD').reduce((acc, v) => acc + (v.requiredPositions || 1), 0);
      const vac = Math.max(0, req - act - hld);

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        totalRequired: req,
        totalActive: act,
        totalVacant: vac,
        totalOnHold: hld,
      };
    });

    // 7. Distinct Filter Options
    const [allStoresForFilters, allProjectsList] = await Promise.all([
      prisma.store.findMany({ select: { area: true, tradeType: true, chain: true, line: true, zone: true } }),
      prisma.project.findMany({ select: { id: true, name: true, code: true } }),
    ]);

    const distinctAreas = Array.from(new Set(allStoresForFilters.map((s) => s.area))).filter(Boolean).sort();
    const distinctChains = Array.from(new Set(allStoresForFilters.map((s) => s.chain))).filter(Boolean).sort();
    const distinctLines = Array.from(new Set(allStoresForFilters.map((s) => s.line))).filter(Boolean).sort();

    res.json({
      success: true,
      data: {
        zone: effectiveZone,
        area: typeof area === 'string' ? area : 'ALL',
        tradeType: typeof tradeType === 'string' ? tradeType : 'ALL',
        chain: typeof chain === 'string' ? chain : 'ALL',
        line: typeof line === 'string' ? line : 'ALL',
        manpowerType: typeof manpowerType === 'string' ? manpowerType : 'ALL',
        projects: projectSummary,
        stores: storeRows,
        summaryTotals: {
          uniqueStores: allStores.length,
          totalRequiredPositions,
          totalActiveFilled,
          totalVacant,
          totalOnHold,
          mtStoresCount: allStores.filter((s) => s.tradeType === 'MT').length,
          gtStoresCount: allStores.filter((s) => s.tradeType === 'GT').length,
        },
        filterOptions: {
          zones: [
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
          ],
          areas: distinctAreas,
          tradeTypes: ['ALL', 'MT', 'GT'],
          chains: distinctChains,
          lines: distinctLines,
          manpowerTypes: ['ALL', 'REGULAR', 'TACT'],
          projects: matrixProjects.map((p) => ({ id: p.id, name: p.name, code: p.code })),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/recruiter-cockpit (Interactive 1-Click Recruiter Drill-down Metrics)
reportsRouter.get('/recruiter-cockpit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = (req.query.recruiterId as string) || req.user?.id;
    if (!targetUserId) {
      throw new AppError('User authentication required', 401);
    }

    const recruiter = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, firstName: true, lastName: true, area: true, zone: true, role: true },
    });

    if (!recruiter) {
      throw new AppError('Recruiter user not found', 404);
    }

    // Find vacancies assigned to this recruiter OR belonging to their designated operational area
    const whereCondition: any = {
      status: { notIn: ['CANCELLED', 'PENDING_INGEST_REVIEW', 'DRAFT_DUPLICATE_FLAG'] },
    };

    if (recruiter.area) {
      whereCondition.OR = [
        { assignedRecruiterId: recruiter.id },
        { area: recruiter.area },
      ];
    } else {
      whereCondition.assignedRecruiterId = recruiter.id;
    }

    const vacancies = await prisma.vacancy.findMany({
      where: whereCondition,
      include: {
        submissions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // 1. Pending Sourcing: Active vacancies with 0 submissions
    const pendingSourcingVacancies = vacancies.filter(
      (v) => v.status === 'ACTIVE' && (!v.submissions || v.submissions.length === 0)
    );

    // 2. Interviews Pending: Vacancies with at least one candidate in INTERVIEW_PENDING stage
    const interviewsPendingVacancies = vacancies.filter((v) =>
      v.submissions?.some((s) => s.stage === 'INTERVIEW_PENDING')
    );

    // 3. Approvals Pending: Vacancies with at least one candidate in SELECTED stage or status PENDING
    const approvalsPendingVacancies = vacancies.filter((v) =>
      v.submissions?.some((s) => s.stage === 'SELECTED' || s.status === 'PENDING')
    );

    // 4. Joined This Month: Vacancies with joined candidates or filled status
    const joinedVacancies = vacancies.filter((v) =>
      v.status === 'FILLED' || v.submissions?.some((s) => s.stage === 'JOINED')
    );

    // 5. On Hold: Vacancies in ON_HOLD status
    const onHoldVacancies = vacancies.filter((v) => v.status === 'ON_HOLD');

    const totalAssignedPositions = vacancies.reduce((sum, v) => sum + (v.requiredPositions || 1), 0);

    res.json({
      success: true,
      data: {
        recruiterId: recruiter.id,
        username: recruiter.username || 'recruiter',
        recruiterName: `${recruiter.firstName} ${recruiter.lastName}`.trim(),
        assignedArea: recruiter.area || 'All Areas',
        assignedZone: recruiter.zone || 'All Zones',
        metrics: {
          totalAssignedPositions,
          pendingSourcing: {
            count: pendingSourcingVacancies.length,
            vacancyIds: pendingSourcingVacancies.map((v) => v.id),
          },
          interviewsPending: {
            count: interviewsPendingVacancies.length,
            vacancyIds: interviewsPendingVacancies.map((v) => v.id),
          },
          approvalsPending: {
            count: approvalsPendingVacancies.length,
            vacancyIds: approvalsPendingVacancies.map((v) => v.id),
          },
          joinedThisMonth: {
            count: joinedVacancies.length,
            vacancyIds: joinedVacancies.map((v) => v.id),
          },
          onHold: {
            count: onHoldVacancies.length,
            vacancyIds: onHoldVacancies.map((v) => v.id),
          },
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

