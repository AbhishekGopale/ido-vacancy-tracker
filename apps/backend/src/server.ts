import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { prisma } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './modules/health/health.router.js';
import { authRouter } from './modules/auth/auth.router.js';
import { usersRouter } from './modules/users/users.router.js';
import { rolesRouter } from './modules/roles/roles.router.js';
import { projectRolesRouter } from './modules/projectRoles/projectRoles.router.js';
import { vacanciesRouter } from './modules/vacancies/vacancies.router.js';
import { submissionsRouter } from './modules/submissions/submissions.router.js';
import { pmOverridesRouter } from './modules/overrides/pmOverrides.router.js';
import { reportsRouter } from './modules/reports/reports.router.js';
import { projectsRouter } from './modules/projects/projects.router.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// API Routes
const api = express.Router();
api.use('/health', healthRouter);
api.use('/auth', authRouter);
api.use('/users', usersRouter);
api.use('/roles', rolesRouter);
api.use('/projects', projectsRouter);
api.use('/project-roles', projectRolesRouter);
api.use('/vacancies', vacanciesRouter);
api.use('/submissions', submissionsRouter);
api.use('/overrides', pmOverridesRouter);
api.use('/reports', reportsRouter);

app.use('/api/v1', api);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Recruitment OS Backend API running on http://localhost:${env.PORT}`);
  console.log(`📋 Health check available at http://localhost:${env.PORT}/api/v1/health`);
});

async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Shutting down HTTP server gracefully...`);
  server.close(async () => {
    console.log('🔒 HTTP server closed.');
    await prisma.$disconnect();
    console.log('💾 Database connection closed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default app;
