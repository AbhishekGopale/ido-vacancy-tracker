# Local Development Guide

## Step-by-Step Environment Setup

### 1. Start Services with Docker
```bash
docker-compose up -d
```
Verify PostgreSQL is up on `5432` and Redis on `6379`.

### 2. Configure Environment
```bash
cp .env.example apps/backend/.env
```

### 3. Initialize Prisma Database
```bash
cd apps/backend
npm install
npx prisma db push
npm run prisma:seed
```

### 4. Run Development Servers
- Backend: `npm run dev` (Port 4000)
- BullMQ Worker: `npm run worker`
- Frontend: `npm run dev` (Port 5173)

### 5. Running Tests
```bash
cd apps/backend
npm test
```
