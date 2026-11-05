import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with Enterprise Hierarchy & Many-to-Many Mappings...');

  // 1. Base Roles (Reference templates)
  const baseRolesData = [
    { name: 'Promoter', description: 'In-store brand ambassador and field sales representative' },
    { name: 'Merchandiser', description: 'Shelf positioning, display setup, and inventory auditor' },
    { name: 'Team Lead', description: 'Territory team supervisor and field operational manager' },
    { name: 'F-Promoter', description: 'Field retail sales activator and product demonstrator' },
  ];

  const baseRoleMap = new Map<string, string>();
  for (const br of baseRolesData) {
    const created = await prisma.baseRole.upsert({
      where: { name: br.name },
      update: { description: br.description },
      create: br,
    });
    baseRoleMap.set(br.name, created.id);
  }

  // 2. Permissions
  const permissionsList = [
    { slug: 'users.manage', description: 'Manage system users, roles, and hierarchy assignments' },
    { slug: 'roles.manage', description: 'Manage system permissions' },
    { slug: 'projects.manage', description: 'Create and configure client projects and PM mappings' },
    { slug: 'vacancies.read', description: 'View vacancy requisitions' },
    { slug: 'vacancies.create', description: 'Ingest vacancy requisitions (Single & Bulk Excel)' },
    { slug: 'vacancies.dedup_decision', description: 'Unified PM Ingest Review & Composite Deduplication' },
    { slug: 'vacancies.override', description: 'Execute PM master overrides (Force Fill, Cancel, Delete)' },
    { slug: 'submissions.create', description: 'Submit single candidate per open vacancy slot' },
    { slug: 'submissions.review', description: 'Review and approve/reject candidate submissions' },
    { slug: 'project_roles.manage', description: 'Configure project-level job roles and approver mappings' },
    { slug: 'reports.view', description: 'Access operational recruitment analytics' },
  ];

  for (const perm of permissionsList) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: { description: perm.description },
      create: perm,
    });
  }

  const allDbPermissions = await prisma.permission.findMany();
  const permMap = new Map(allDbPermissions.map((p) => [p.slug, p.id]));

  // 3. System Roles
  const rolesData = [
    {
      name: 'ADMIN',
      description: 'System Administrator with full platform controls',
      permissions: permissionsList.map((p) => p.slug),
    },
    {
      name: 'OWNER',
      description: 'Company Executive Owner with global enterprise visibility',
      permissions: permissionsList.map((p) => p.slug),
    },
    {
      name: 'SUPER_MANAGER',
      description: 'Super Manager / Director supervising portfolio of PMs and projects',
      permissions: [
        'projects.manage', 'project_roles.manage', 'vacancies.read', 'vacancies.create',
        'vacancies.dedup_decision', 'vacancies.override', 'submissions.review', 'reports.view', 'users.manage',
      ],
    },
    {
      name: 'PM',
      description: 'Project Manager running day-to-day vacancies and deduplication for assigned projects',
      permissions: [
        'project_roles.manage', 'vacancies.read', 'vacancies.create', 'vacancies.dedup_decision',
        'vacancies.override', 'submissions.review', 'reports.view',
      ],
    },
    {
      name: 'HIGHER_MANAGEMENT',
      description: 'Higher Management & Executive Leadership with global data science intelligence, predictive analytics, and raw data download',
      permissions: permissionsList.map((p) => p.slug),
    },
    {
      name: 'RECRUITER',
      description: 'Zone Recruiter sourcing candidate per open slot in assigned territory',
      permissions: ['vacancies.read', 'submissions.create'],
    },
  ];

  const roleMap = new Map<string, string>();
  for (const roleDef of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: { name: roleDef.name, description: roleDef.description },
    });
    roleMap.set(roleDef.name, role.id);

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    for (const permSlug of roleDef.permissions) {
      const permId = permMap.get(permSlug);
      if (permId) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: permId },
        });
      }
    }
  }

  // 4. Default Seed Password Hashes
  const adminPasswordHash = await bcrypt.hash('Admin@123456', 10);
  const ownerPasswordHash = await bcrypt.hash('Owner@123456', 10);
  const superPasswordHash = await bcrypt.hash('Super@123456', 10);
  const directorPasswordHash = await bcrypt.hash('Director@123456', 10);
  const pmPasswordHash = await bcrypt.hash('Pm@123456', 10);
  const recruiterPasswordHash = await bcrypt.hash('Recruiter@123456', 10);

  // 5. Seed Users across Hierarchy with User IDs
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@recruitment.local' },
    update: { username: 'admin', roleId: roleMap.get('ADMIN')! },
    create: {
      username: 'admin',
      email: 'admin@recruitment.local',
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'System',
      roleId: roleMap.get('ADMIN')!,
    },
  });

  const ownerUser = await prisma.user.upsert({
    where: { email: 'owner@recruitment.local' },
    update: { username: 'owner', roleId: roleMap.get('OWNER')! },
    create: {
      username: 'owner',
      email: 'owner@recruitment.local',
      passwordHash: ownerPasswordHash,
      firstName: 'Robert',
      lastName: 'Vance',
      roleId: roleMap.get('OWNER')!,
    },
  });

  const superFmcg = await prisma.user.upsert({
    where: { email: 'super.fmcg@recruitment.local' },
    update: { username: 'super_fmcg', roleId: roleMap.get('SUPER_MANAGER')! },
    create: {
      username: 'super_fmcg',
      email: 'super.fmcg@recruitment.local',
      passwordHash: superPasswordHash,
      firstName: 'Maria',
      lastName: 'Santos',
      roleId: roleMap.get('SUPER_MANAGER')!,
    },
  });

  const superRetail = await prisma.user.upsert({
    where: { email: 'super.retail@recruitment.local' },
    update: { username: 'super_retail', roleId: roleMap.get('SUPER_MANAGER')! },
    create: {
      username: 'super_retail',
      email: 'super.retail@recruitment.local',
      passwordHash: superPasswordHash,
      firstName: 'John',
      lastName: 'Miller',
      roleId: roleMap.get('SUPER_MANAGER')!,
    },
  });

  const directorUser = await prisma.user.upsert({
    where: { email: 'director@recruitment.local' },
    update: { username: 'director', roleId: roleMap.get('HIGHER_MANAGEMENT')! },
    create: {
      username: 'director',
      email: 'director@recruitment.local',
      passwordHash: directorPasswordHash,
      firstName: 'Executive',
      lastName: 'Director',
      roleId: roleMap.get('HIGHER_MANAGEMENT')!,
    },
  });

  const pmUnilever = await prisma.user.upsert({
    where: { email: 'pm.unilever@recruitment.local' },
    update: { username: 'pm_unilever', roleId: roleMap.get('PM')! },
    create: {
      username: 'pm_unilever',
      email: 'pm.unilever@recruitment.local',
      passwordHash: pmPasswordHash,
      firstName: 'David',
      lastName: 'Chen',
      roleId: roleMap.get('PM')!,
    },
  });

  const pmPG = await prisma.user.upsert({
    where: { email: 'pm.pg@recruitment.local' },
    update: { username: 'pm_pg', roleId: roleMap.get('PM')! },
    create: {
      username: 'pm_pg',
      email: 'pm.pg@recruitment.local',
      passwordHash: pmPasswordHash,
      firstName: 'Sarah',
      lastName: 'Connor',
      roleId: roleMap.get('PM')!,
    },
  });

  const pmPepsi = await prisma.user.upsert({
    where: { email: 'pm.pepsi@recruitment.local' },
    update: { username: 'pm_pepsi', roleId: roleMap.get('PM')! },
    create: {
      username: 'pm_pepsi',
      email: 'pm.pepsi@recruitment.local',
      passwordHash: pmPasswordHash,
      firstName: 'Alex',
      lastName: 'Kim',
      roleId: roleMap.get('PM')!,
    },
  });

  // 6. Seed the 10 Operational Area Recruiters (1-to-1 Area Binding)
  const operationalAreas = [
    { zone: 'West', area: 'West Mumbai', username: 'rec_west_mumbai', email: 'recruiter.west.mumbai@recruitment.local', firstName: 'Prakash', lastName: 'Shinde' },
    { zone: 'West', area: 'West ROM', username: 'rec_west_rom', email: 'recruiter.west.rom@recruitment.local', firstName: 'Sameer', lastName: 'Kulkarni' },
    { zone: 'West', area: 'West Gujarat', username: 'rec_west_gujarat', email: 'recruiter.west.gujarat@recruitment.local', firstName: 'Nitin', lastName: 'Patel' },
    { zone: 'South', area: 'South AP', username: 'rec_south_ap', email: 'recruiter.south.ap@recruitment.local', firstName: 'Suresh', lastName: 'Reddy' },
    { zone: 'South', area: 'South KN', username: 'rec_south_kn', email: 'recruiter.south.kn@recruitment.local', firstName: 'Ananya', lastName: 'Rao' },
    { zone: 'South', area: 'South TG', username: 'rec_south_tg', email: 'recruiter.south.tg@recruitment.local', firstName: 'Kiran', lastName: 'Kumar' },
    { zone: 'South', area: 'South TN', username: 'rec_south_tn', email: 'recruiter.south.tn@recruitment.local', firstName: 'Karthik', lastName: 'Raman' },
    { zone: 'East', area: 'East', username: 'rec_east', email: 'recruiter.east@recruitment.local', firstName: 'Marcus', lastName: 'Brody' },
    { zone: 'North', area: 'North Delhi', username: 'rec_north_delhi', email: 'recruiter.north.delhi@recruitment.local', firstName: 'Alex', lastName: 'Morgan' },
    { zone: 'North', area: 'North Punjab', username: 'rec_north_punjab', email: 'recruiter.north.punjab@recruitment.local', firstName: 'Gurpreet', lastName: 'Singh' },
  ];

  const recruiterMap = new Map<string, any>();
  for (const rec of operationalAreas) {
    const user = await prisma.user.upsert({
      where: { email: rec.email },
      update: {
        username: rec.username,
        roleId: roleMap.get('RECRUITER')!,
        zone: rec.zone,
        area: rec.area,
        firstName: rec.firstName,
        lastName: rec.lastName,
      },
      create: {
        username: rec.username,
        email: rec.email,
        passwordHash: recruiterPasswordHash,
        firstName: rec.firstName,
        lastName: rec.lastName,
        roleId: roleMap.get('RECRUITER')!,
        zone: rec.zone,
        area: rec.area,
      },
    });
    recruiterMap.set(rec.area, user);
  }

  // 7. Client Projects (matching Excel Matrix)
  const clientProjectsData = [
    { code: 'PAR', name: 'Parag', pmUserId: pmUnilever.id },
    { code: 'BRIT', name: 'Britania', pmUserId: pmUnilever.id },
    { code: 'BSN', name: 'Beyond Snacks', pmUserId: pmPG.id },
    { code: 'RSN', name: 'Rajam Snacks', pmUserId: pmPG.id },
    { code: 'NUA', name: 'Nua', pmUserId: pmPepsi.id },
    { code: 'MTR', name: 'MTR Food', pmUserId: pmUnilever.id },
    { code: 'PWK', name: 'Pawak Food', pmUserId: pmPepsi.id },
  ];

  const projectMap = new Map<string, any>();
  for (const proj of clientProjectsData) {
    const p = await prisma.project.upsert({
      where: { code: proj.code },
      update: { name: proj.name, pmUserId: proj.pmUserId },
      create: {
        code: proj.code,
        name: proj.name,
        pmUserId: proj.pmUserId,
        asmEmail: 'abhishek.gopale@idonneous.com',
        rsmEmail: 'abhishek.gopale@idonneous.com',
        currentSeq: 0,
      },
    });
    projectMap.set(proj.name, p);
  }

  // 8. Stores Master (from Excel Dmart & Reliance Sheets)
  const storesData = [
    // Western Line (Modern Trade)
    { code: 'DM-MHV', name: 'Dmart Mahavir', chain: 'DMART', line: 'Western', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Mumbai' },
    { code: 'DM-TV', name: 'Dmart Thakur Village', chain: 'DMART', line: 'Western', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Mumbai' },
    { code: 'DM-MR', name: 'Dmart Mira Road', chain: 'DMART', line: 'Western', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Thane' },
    { code: 'DM-BY', name: 'Dmart Bhayander', chain: 'DMART', line: 'Western', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Thane' },
    { code: 'DM-VR', name: 'Dmart Virar', chain: 'DMART', line: 'Western', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Palghar' },
    { code: 'DM-MLD', name: 'Dmart Malad Link Rd', chain: 'DMART', line: 'Western', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Mumbai' },
    { code: 'DM-KND', name: 'Dmart Kandivali East', chain: 'DMART', line: 'Western', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Mumbai' },
    { code: 'DM-BV', name: 'Dmart Borivali West', chain: 'DMART', line: 'Western', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Mumbai' },
    { code: 'DM-AND', name: 'Dmart Andheri West', chain: 'DMART', line: 'Western', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Mumbai' },

    // Central Line (Modern Trade)
    { code: 'DM-KLY', name: 'Dmart Kalyan West', chain: 'DMART', line: 'Central', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Kalyan' },
    { code: 'DM-DOM', name: 'Dmart Dombivli MIDC', chain: 'DMART', line: 'Central', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Dombivli' },
    { code: 'DM-THN', name: 'Dmart Thane Kolshet', chain: 'DMART', line: 'Central', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Thane' },
    { code: 'DM-MUL', name: 'Dmart Mulund West', chain: 'DMART', line: 'Central', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Mumbai' },
    { code: 'DM-GHT', name: 'Dmart Ghatkopar', chain: 'DMART', line: 'Central', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Mumbai' },

    // Harbour Line (Modern Trade)
    { code: 'DM-VSH', name: 'Dmart Vashi Sector 19', chain: 'DMART', line: 'Harbour', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Navi Mumbai' },
    { code: 'DM-NER', name: 'Dmart Nerul Sector 20', chain: 'DMART', line: 'Harbour', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Navi Mumbai' },
    { code: 'DM-BEL', name: 'Dmart Belapur CBD', chain: 'DMART', line: 'Harbour', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Navi Mumbai' },
    { code: 'DM-PNV', name: 'Dmart Panvel City', chain: 'DMART', line: 'Harbour', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Panvel' },
    { code: 'DM-KHG', name: 'Dmart Kharghar', chain: 'DMART', line: 'Harbour', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Navi Mumbai' },

    // Reliance Smart Modern Trade
    { code: 'REL-KLY', name: 'Reliance Kalyan 1', chain: 'RELIANCE', line: 'Central', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Kalyan' },
    { code: 'REL-VIV', name: 'Reliance Thane Viviana', chain: 'RELIANCE', line: 'Central', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Thane' },
    { code: 'REL-BOR', name: 'Reliance Borivali Link Rd', chain: 'RELIANCE', line: 'Western', tradeType: 'MT', area: 'West Mumbai', zone: 'West', city: 'Mumbai' },

    // General Trade (GT) Outlets
    { code: 'GT-GANESH', name: 'Shree Ganesh Supermarket GT', chain: 'GENERAL_TRADE', line: 'Central', tradeType: 'GT', area: 'West Mumbai', zone: 'West', city: 'Kalyan' },
    { code: 'GT-MAHALAXMI', name: 'Mahalaxmi Kirana Stores GT', chain: 'GENERAL_TRADE', line: 'Western', tradeType: 'GT', area: 'West Mumbai', zone: 'West', city: 'Borivali' },
    { code: 'GT-APNA', name: 'Apna Bazaar Dadar GT', chain: 'GENERAL_TRADE', line: 'Harbour', tradeType: 'GT', area: 'West Mumbai', zone: 'West', city: 'Mumbai' },

    // Other Operational Areas
    { code: 'DM-BLR-WF', name: 'Dmart Whitefield MT', chain: 'DMART', line: 'Metro', tradeType: 'MT', area: 'South KN', zone: 'South', city: 'Bengaluru' },
    { code: 'REL-BLR-KM', name: 'Reliance Koramangala MT', chain: 'RELIANCE', line: 'Metro', tradeType: 'MT', area: 'South KN', zone: 'South', city: 'Bengaluru' },
    { code: 'DM-DEL-ROH', name: 'Dmart Rohini MT', chain: 'DMART', line: 'Metro', tradeType: 'MT', area: 'North Delhi', zone: 'North', city: 'Delhi' },
    { code: 'REL-DEL-CP', name: 'Reliance Connaught Place MT', chain: 'RELIANCE', line: 'Metro', tradeType: 'MT', area: 'North Delhi', zone: 'North', city: 'Delhi' },
    { code: 'DM-AHM-SG', name: 'Dmart SG Highway MT', chain: 'DMART', line: 'Metro', tradeType: 'MT', area: 'West Gujarat', zone: 'West', city: 'Ahmedabad' },
    { code: 'DM-PUN-HIN', name: 'Dmart Hinjewadi MT', chain: 'DMART', line: 'Metro', tradeType: 'MT', area: 'West ROM', zone: 'West', city: 'Pune' },
  ];

  const storeMap = new Map<string, any>();
  for (const s of storesData) {
    const createdStore = await prisma.store.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        chain: s.chain,
        line: s.line,
        tradeType: s.tradeType,
        area: s.area,
        zone: s.zone,
        city: s.city,
      },
      create: s,
    });
    storeMap.set(s.name, createdStore);
  }

  // 9. Clear & Seed Live Vacancies matching Matrix Table
  await prisma.candidateSubmission.deleteMany();
  await prisma.vacancy.deleteMany();

  const recWestMumbai = recruiterMap.get('West Mumbai');

  // Matrix entries for West Mumbai
  const matrixSeedRecords = [
    // Dmart Mahavir
    { storeName: 'Dmart Mahavir', projName: 'Parag', status: 'ON_HOLD', holdReason: 'Store floor renovation', req: 1, fill: 0, type: 'REGULAR', candidate: null },
    { storeName: 'Dmart Mahavir', projName: 'Britania', status: 'FILLED', holdReason: null, req: 1, fill: 1, type: 'REGULAR', candidate: { name: 'Pooja Sharma', phone: '9876543210', stage: 'JOINED' } },
    { storeName: 'Dmart Mahavir', projName: 'MTR Food', status: 'FILLED', holdReason: null, req: 1, fill: 1, type: 'REGULAR', candidate: { name: 'Sunil Verma', phone: '9812345678', stage: 'JOINED' } },

    // Dmart Thakur Village
    { storeName: 'Dmart Thakur Village', projName: 'Parag', status: 'FILLED', holdReason: null, req: 1, fill: 1, type: 'REGULAR', candidate: { name: 'Rohit Kadam', phone: '9823456789', stage: 'JOINED' } },
    { storeName: 'Dmart Thakur Village', projName: 'Britania', status: 'ACTIVE', holdReason: null, req: 1, fill: 0, type: 'REGULAR', candidate: { name: 'Amit Patkar', phone: '9834567890', stage: 'INTERVIEW_PENDING' } },
    { storeName: 'Dmart Thakur Village', projName: 'Beyond Snacks', status: 'ACTIVE', holdReason: null, req: 1, fill: 0, type: 'TACT', candidate: { name: 'Vikas Dubey', phone: '9890123456', stage: 'PROPOSED' } },

    // Dmart Mira Road
    { storeName: 'Dmart Mira Road', projName: 'Parag', status: 'FILLED', holdReason: null, req: 1, fill: 1, type: 'REGULAR', candidate: { name: 'Deepak More', phone: '9845678901', stage: 'JOINED' } },
    { storeName: 'Dmart Mira Road', projName: 'Britania', status: 'FILLED', holdReason: null, req: 1, fill: 1, type: 'REGULAR', candidate: { name: 'Kiran Patil', phone: '9856789012', stage: 'JOINED' } },
    { storeName: 'Dmart Mira Road', projName: 'Nua', status: 'ACTIVE', holdReason: null, req: 1, fill: 0, type: 'REGULAR', candidate: { name: 'Sneha Rao', phone: '9867890123', stage: 'SELECTED' } },

    // Dmart Bhayander
    { storeName: 'Dmart Bhayander', projName: 'Britania', status: 'ACTIVE', holdReason: null, req: 1, fill: 0, type: 'REGULAR', candidate: null },
    { storeName: 'Dmart Bhayander', projName: 'Rajam Snacks', status: 'ON_HOLD', holdReason: 'Client budget hold for Q4', req: 1, fill: 0, type: 'TACT', candidate: null },

    // Dmart Virar
    { storeName: 'Dmart Virar', projName: 'Parag', status: 'ACTIVE', holdReason: null, req: 1, fill: 0, type: 'REGULAR', candidate: null },
    { storeName: 'Dmart Virar', projName: 'Pawak Food', status: 'ACTIVE', holdReason: null, req: 1, fill: 0, type: 'TACT', candidate: { name: 'Manish Singh', phone: '9870123456', stage: 'PROPOSED' } },

    // Dmart Kalyan West
    { storeName: 'Dmart Kalyan West', projName: 'Parag', status: 'FILLED', holdReason: null, req: 1, fill: 1, type: 'REGULAR', candidate: { name: 'Santosh Jadhav', phone: '9822334455', stage: 'JOINED' } },
    { storeName: 'Dmart Kalyan West', projName: 'Britania', status: 'ACTIVE', holdReason: null, req: 1, fill: 0, type: 'REGULAR', candidate: { name: 'Pradeep Rane', phone: '9833445566', stage: 'INTERVIEW_PENDING' } },

    // Dmart Vashi Sector 19
    { storeName: 'Dmart Vashi Sector 19', projName: 'Beyond Snacks', status: 'FILLED', holdReason: null, req: 1, fill: 1, type: 'REGULAR', candidate: { name: 'Ankita Sawant', phone: '9844556677', stage: 'JOINED' } },
    { storeName: 'Dmart Vashi Sector 19', projName: 'Nua', status: 'ACTIVE', holdReason: null, req: 1, fill: 0, type: 'REGULAR', candidate: null },

    // Reliance Kalyan 1
    { storeName: 'Reliance Kalyan 1', projName: 'Parag', status: 'FILLED', holdReason: null, req: 1, fill: 1, type: 'REGULAR', candidate: { name: 'Gaurav Shinde', phone: '9878901234', stage: 'JOINED' } },
    { storeName: 'Reliance Kalyan 1', projName: 'Britania', status: 'ON_HOLD', holdReason: 'Store manager approval pending', req: 1, fill: 0, type: 'REGULAR', candidate: null },

    // General Trade (GT) Outlets
    { storeName: 'Shree Ganesh Supermarket GT', projName: 'Britania', status: 'FILLED', holdReason: null, req: 1, fill: 1, type: 'REGULAR', candidate: { name: 'Ramesh Yadav', phone: '9811223344', stage: 'JOINED' } },
    { storeName: 'Mahalaxmi Kirana Stores GT', projName: 'Parag', status: 'ACTIVE', holdReason: null, req: 1, fill: 0, type: 'REGULAR', candidate: null },
    { storeName: 'Apna Bazaar Dadar GT', projName: 'MTR Food', status: 'ACTIVE', holdReason: null, req: 1, fill: 0, type: 'TACT', candidate: null },

    // Outstation Store Vacancies
    { storeName: 'Dmart Whitefield MT', projName: 'Britania', status: 'ACTIVE', holdReason: null, req: 2, fill: 1, type: 'REGULAR', candidate: { name: 'Chethan Gowda', phone: '9845012345', stage: 'JOINED' } },
    { storeName: 'Dmart Rohini MT', projName: 'Parag', status: 'ACTIVE', holdReason: null, req: 2, fill: 1, type: 'REGULAR', candidate: { name: 'Rajesh Sharma', phone: '9811098765', stage: 'JOINED' } },
  ];

  let vacIdx = 100;
  for (const item of matrixSeedRecords) {
    const store = storeMap.get(item.storeName);
    const project = projectMap.get(item.projName);
    if (!store || !project) continue;

    vacIdx++;
    const areaRecruiter = recruiterMap.get(store.area) || recWestMumbai;

    const vac = await prisma.vacancy.create({
      data: {
        vacancyCode: `${project.code}${vacIdx}`,
        projectId: project.id,
        storeId: store.id,
        title: `${item.projName} Promoter - ${store.name}`,
        zone: store.zone,
        area: store.area,
        line: store.line,
        tradeType: store.tradeType,
        manpowerType: item.type,
        requiredPositions: item.req,
        filledPositions: item.fill,
        salary: item.type === 'TACT' ? '₹16,000 / month' : '₹18,500 / month',
        experience: '6 Months - 1 Year Retail',
        targetDaysToFill: 2,
        status: item.status,
        holdReason: item.holdReason,
        holdSetById: item.status === 'ON_HOLD' ? pmUnilever.id : null,
        holdSetAt: item.status === 'ON_HOLD' ? new Date() : null,
        createdById: project.pmUserId || pmUnilever.id,
        assignedRecruiterId: areaRecruiter.id,
      },
    });

    if (item.candidate) {
      await prisma.candidateSubmission.create({
        data: {
          vacancyId: vac.id,
          fullName: item.candidate.name,
          phone: item.candidate.phone,
          stage: item.candidate.stage,
          status: item.candidate.stage === 'JOINED' ? 'APPROVED' : 'PENDING',
          currentLevel: item.candidate.stage === 'JOINED' ? 2 : 1,
        },
      });
    }
  }

  console.log('✅ Enterprise Seed completed successfully!');
  console.log(`- 10 Operational Area Recruiters seeded with clean User IDs`);
  console.log(`- Stores catalog populated (Modern Trade + General Trade)`);
  console.log(`- Store × Project matrix seeded with active, vacant, and hold requirements`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
