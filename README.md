# 🎯 Smart Recruitment Lifecycle Tracker (Recruitment OS)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg?style=flat&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg?style=flat&logo=node.js)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748.svg?style=flat&logo=prisma)](https://www.prisma.io/)
[![Redis & BullMQ](https://img.shields.io/badge/BullMQ-5.21-DC382D.svg?style=flat&logo=redis)](https://bullmq.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> A modern, high-performance, and secure full-stack Recruitment Management System built following **Ponytail** engineering principles (simple, clean, minimal dependencies, strictly secure, zero unnecessary abstractions, and production-ready).

---

## 📑 Table of Contents

1. [System Architecture](#-system-architecture)
2. [End-to-End Use Case & Workflow Diagrams](#-end-to-end-use-case--workflow-diagrams)
   - [Full Recruitment Lifecycle Workflow](#1-full-recruitment-lifecycle-workflow)
   - [Actor Use Case Diagram](#2-actor-use-case-diagram)
   - [Asynchronous BullMQ Email Queue Workflow](#3-asynchronous-bullmq-email-queue-workflow)
3. [Database Entity Relationship Diagram (ERD)](#-database-entity-relationship-diagram-erd)
4. [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
5. [Technology Stack](#-technology-stack)
6. [Quick Start & Local Development](#-quick-start--local-development)
7. [API Reference](#-api-reference)
8. [Security & Ponytail Principles](#-security--ponytail-principles)

---

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Tier (React + Vite + TypeScript)"]
        UI["SPA Interface (Kanban Board, Dashboard, Modals)"]
        AuthCtx["Auth & RBAC Context (Stateless JWT)"]
        ApiClient["Typed API Client (Auto-Header Injection)"]
        UI --> AuthCtx --> ApiClient
    end

    subgraph Backend ["Application Tier (Node.js + Express)"]
        Router["Express REST API Router (/api/v1)"]
        AuthGuard["Auth & Permission Middleware (RBAC)"]
        Controllers["Domain Handlers (Jobs, Candidates, Pipeline, Offers)"]
        EmailProducer["BullMQ Queue Producer"]

        Router --> AuthGuard --> Controllers
        Controllers --> EmailProducer
    end

    subgraph Storage ["Persistence Tier"]
        DB[("PostgreSQL / SQLite Database\n(Prisma ORM)")]
        RedisStore[("Redis (BullMQ Queue Store)")]
    end

    subgraph WorkerService ["Background Worker Tier (Node.js)"]
        Worker["BullMQ Email Worker (Concurrency: 5)"]
        Transporter["Nodemailer Transporter (Log / SMTP)"]
        Worker --> Transporter
    end

    ApiClient -->|HTTP / REST with Bearer JWT| Router
    Controllers -->|Prisma Type-Safe Queries| DB
    EmailProducer -->|Push Job with Backoff| RedisStore
    RedisStore -->|Fetch Job| Worker
    Transporter -->|Async Dispatch| Recipient["Candidate / Interviewer Inbox"]
```

---

## 🔄 End-to-End Use Case & Workflow Diagrams

### 1. Full Recruitment Lifecycle Workflow

```mermaid
sequenceDiagram
    autonumber
    actor HR as Recruiter / HR Manager
    actor Candidate as Candidate
    actor Panel as Interviewer / Tech Lead
    participant Frontend as React Frontend (UI)
    participant API as Node.js Express Backend
    participant DB as PostgreSQL Database
    participant Queue as BullMQ & Redis Queue
    participant Worker as Email Worker

    %% Stage 1: Job Opening
    Note over HR,API: Phase 1: Requisition Creation
    HR->>Frontend: Creates Job Opening (Title, Salary, Department)
    Frontend->>API: POST /api/v1/jobs
    API->>DB: Insert Job Record (Status: OPEN)
    API-->>Frontend: 201 Created

    %% Stage 2: Sourcing & Application
    Note over HR,Candidate: Phase 2: Sourcing & Application
    HR->>Frontend: Adds Candidate Profile & Links to Job
    Frontend->>API: POST /api/v1/applications
    API->>DB: Insert Application (Stage: APPLIED)
    API->>Queue: Enqueue 'APPLICATION_RECEIVED'
    API-->>Frontend: 201 Created
    Queue->>Worker: Process Job (Attempt 1..5)
    Worker->>Candidate: Dispatches Application Confirmation Email

    %% Stage 3: Screening & Interview Scheduling
    Note over HR,Panel: Phase 3: Screening & Interview
    HR->>Frontend: Advances Candidate to INTERVIEW Stage
    HR->>Frontend: Schedules Interview (Date, Duration, Meeting Link)
    Frontend->>API: POST /api/v1/interviews
    API->>DB: Insert Interview (Status: SCHEDULED)
    API->>Queue: Enqueue 'INTERVIEW_SCHEDULED'
    API-->>Frontend: 201 Created
    Queue->>Worker: Process Job
    Worker->>Candidate: Sends Interview Confirmation & Calendar Details
    Worker->>Panel: Sends Interview Notification

    %% Stage 4: Evaluation & Scorecard
    Note over Panel,API: Phase 4: Scorecard Evaluation
    Panel->>Frontend: Conducts Technical Panel & Submits Scorecard
    Frontend->>API: POST /api/v1/interviews/:id/feedback
    API->>DB: Insert Feedback (Rating: 1-5, Recommendation: STRONG_HIRE)
    API->>DB: Update Interview Status -> COMPLETED
    API-->>Frontend: 201 Created

    %% Stage 5: Offer Generation & Hired
    Note over HR,Candidate: Phase 5: Offer Package & Onboarding
    HR->>Frontend: Generates Formal Offer (Salary, Start Date)
    Frontend->>API: POST /api/v1/offers
    API->>DB: Insert Offer (Status: DRAFT)
    HR->>Frontend: Dispatches Formal Offer Letter
    Frontend->>API: PATCH /api/v1/offers/:id/status (SENT)
    API->>Queue: Enqueue 'OFFER_LETTER_SENT'
    API-->>Frontend: 200 OK
    Queue->>Worker: Process Job
    Worker->>Candidate: Dispatches Formal Offer Email

    Candidate-->>HR: Candidate Signs & Accepts Offer
    HR->>Frontend: Marks Offer as ACCEPTED
    Frontend->>API: PATCH /api/v1/offers/:id/status (ACCEPTED)
    API->>DB: Update Application Stage -> HIRED 🎉
    API-->>Frontend: 200 OK
```

---

### 2. Actor Use Case Diagram

```mermaid
flowchart LR
    subgraph Actors ["System Actors"]
        Admin(("👑 Super Admin"))
        Recruiter(("💼 Recruiter / HR"))
        Interviewer(("🧑‍💻 Tech Lead / Interviewer"))
    end

    subgraph CoreUseCases ["Recruitment OS Capabilities"]
        UC1(["Manage Users & Assign Roles"])
        UC2(["Create & Publish Job Requisitions"])
        UC3(["Manage Candidate Pipeline (Kanban)"])
        UC4(["Advance Application Stages"])
        UC5(["Schedule Technical Interviews"])
        UC6(["Submit Scorecards & Evaluations"])
        UC7(["Generate & Dispatch Compensation Offers"])
        UC8(["View Recruitment Analytics & KPIs"])
        UC9(["Monitor System & Queue Health"])
    end

    Admin --> UC1
    Admin --> UC9
    Admin --> UC8
    Admin --> UC2

    Recruiter --> UC2
    Recruiter --> UC3
    Recruiter --> UC4
    Recruiter --> UC5
    Recruiter --> UC7
    Recruiter --> UC8

    Interviewer --> UC5
    Interviewer --> UC6
    Interviewer --> UC3
```

---

### 3. Asynchronous BullMQ Email Queue Workflow

```mermaid
flowchart TD
    A["HTTP Request Trigger\n(e.g., Application, Interview, Offer)"] --> B["Controller writes business data to DB"]
    B --> C["enqueueEmail(template, payload)"]
    C --> D["Push Job into Redis Queue ('email-queue')"]
    D --> E["Return HTTP 200/201 to Client (Zero Blocking)"]

    subgraph BackgroundProcessing ["Independent Email Worker (apps/backend/src/worker.ts)"]
        F["Worker pulls job from Redis"]
        G{"Validate payload & Render Template"}
        H["Send email via Nodemailer (SMTP / Log)"]
        I["Mark Job as Completed"]
        J{"Send Failure?"}
        K["Exponential Backoff Retry\n(Attempts: 5 | 3s, 6s, 12s, 24s, 48s)"]
        L["Dead Letter Retention (removeOnFail: 500)"]

        F --> G
        G --> H
        H -->|Success| I
        H -->|Error| J
        J -->|Attempt < 5| K
        K --> F
        J -->|Attempt = 5| L
    end

    D -.->|Asynchronous Fetch| F
```

---

## 🗄 Database Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    users ||--o{ jobs : "creates"
    users ||--o{ interviews : "conducts"
    users ||--o{ interview_feedback : "submits"
    roles ||--o{ users : "assigned_to"
    roles ||--o{ role_permissions : "has"
    permissions ||--o{ role_permissions : "belongs_to"
    jobs ||--o{ applications : "receives"
    candidates ||--o{ applications : "submits"
    applications ||--o{ interviews : "includes"
    applications ||--o| offers : "results_in"
    interviews ||--o| interview_feedback : "evaluated_by"

    users {
        string id PK
        string email UK
        string passwordHash
        string firstName
        string lastName
        string roleId FK
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    roles {
        string id PK
        string name UK
        string description
    }

    permissions {
        string id PK
        string slug UK
        string description
    }

    role_permissions {
        string roleId PK,FK
        string permissionId PK,FK
    }

    jobs {
        string id PK
        string title
        string department
        string location
        string employmentType
        string status
        string description
        float salaryMin
        float salaryMax
        string createdById FK
    }

    candidates {
        string id PK
        string firstName
        string lastName
        string email UK
        string phone
        string resumeUrl
        string linkedinUrl
        string notes
    }

    applications {
        string id PK
        string jobId FK
        string candidateId FK
        string stage
        string status
        datetime appliedAt
    }

    interviews {
        string id PK
        string applicationId FK
        string interviewerId FK
        datetime scheduledAt
        int durationMinutes
        string meetingLink
        string status
    }

    interview_feedback {
        string id PK
        string interviewId FK,UK
        string interviewerId FK
        int rating
        string recommendation
        string comments
        string strengths
        string areasForImprovement
    }

    offers {
        string id PK
        string applicationId FK,UK
        float salary
        string currency
        datetime startDate
        string status
        datetime expiresAt
    }
```

---

## 🛡 Role-Based Access Control (RBAC)

All security boundaries are **authoritatively enforced on the backend** using `requirePermission('<slug>')`. Frontend RBAC guards are strictly for UX optimization.

| Permission Slug | Super Admin | HR Manager | Recruiter | Interviewer | Description |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `users.manage` | ✅ | ❌ | ❌ | ❌ | Create, toggle active state, and manage team accounts |
| `roles.manage` | ✅ | ❌ | ❌ | ❌ | Configure roles and privilege mappings |
| `jobs.create` / `jobs.update` | ✅ | ✅ | ✅ | ❌ | Publish and update job openings and salary bands |
| `jobs.read` | ✅ | ✅ | ✅ | ✅ | View open requisitions and job descriptions |
| `candidates.create` / `update` | ✅ | ✅ | ✅ | ❌ | Source and manage candidate profiles and resumes |
| `candidates.read` | ✅ | ✅ | ✅ | ✅ | View candidate records and application histories |
| `applications.advance_stage` | ✅ | ✅ | ✅ | ❌ | Move candidates across Kanban pipeline stages |
| `interviews.schedule` | ✅ | ✅ | ✅ | ❌ | Schedule technical panel sessions with meeting links |
| `interviews.feedback.submit` | ✅ | ✅ | ✅ | ✅ | Submit structured scorecards and rating evaluations |
| `offers.create` / `offers.send` | ✅ | ✅ | ❌ | ❌ | Generate compensation drafts and dispatch formal letters |
| `reports.view` | ✅ | ✅ | ✅ | ❌ | Access recruitment KPI dashboard and funnel analytics |

---

## 💻 Technology Stack

| Component | Technology | Rationale & Ponytail Justification |
| :--- | :--- | :--- |
| **Frontend UI** | **React 18 + Vite + TypeScript** | Instant build/HMR times, strict type safety, zero runtime framework bloat. |
| **Design System** | **Vanilla CSS + Glassmorphism** | Ultra-responsive, dark-mode harmonized, accessible without heavy UI libraries. |
| **Backend API** | **Node.js + Express + TypeScript** | Fast, modular REST routing with zero unnecessary abstraction layers. |
| **Validation** | **Zod** | Single source of truth for runtime validation and TypeScript inferred types. |
| **Database** | **PostgreSQL / SQLite + Prisma** | Relational 3NF integrity, automated schema sync, indexed queries. |
| **Job Queue** | **BullMQ + Redis** | Industry standard for reliable async jobs, backoff retries, and persistence. |
| **Security** | **JWT + bcryptjs + Helmet + CORS** | Stateless token auth, salted password hashing, HTTP security headers. |
| **Transporter** | **Nodemailer** | Dual-mode: Zero-config local console logging or production SMTP. |

---

## 🚀 Quick Start & Local Development

### 1. Prerequisites
- **Node.js** (v18 or v20+)
- **npm** (v9+)
- *(Optional for Production)* Docker & Docker Compose

---

### 2. Immediate 1-Command Startup (Zero Docker Required)

The repository comes pre-configured with a local SQLite database (`dev.db`) for immediate offline evaluation:

```bash
# 1. Install dependencies
npm install

# 2. Run Database Migrations & Seed Sample Pipeline
cd apps/backend
npx prisma db push
npm run prisma:seed

# 3. Start Backend API (Port 4000)
npm run dev

# 4. Start Frontend UI (Port 5173 - in another terminal)
cd ../frontend
npm run dev
```

---

### 3. Production Docker Startup (PostgreSQL + Redis)

To run the complete production stack with PostgreSQL and Redis:

```bash
# 1. Spin up PostgreSQL (5432) and Redis (6379)
docker-compose up -d

# 2. Configure .env in apps/backend/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recruitment_tracker?schema=public"
REDIS_URL="redis://localhost:6379"
EMAIL_PROVIDER="smtp"

# 3. Sync PostgreSQL & Seed
cd apps/backend
cp prisma/schema.postgres.prisma prisma/schema.prisma
npx prisma db push
npm run prisma:seed

# 4. Start Backend API & Dedicated BullMQ Worker
npm run dev
npm run worker
```

---

### 4. Default Demo Credentials

You can log in at [**http://localhost:5173/login**](http://localhost:5173/login) using the 1-click test buttons:

| Account | Email | Password | Role / Access |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@recruitment.local` | `Admin@123456` | Full system access, users, settings |
| **Recruiter** | `recruiter@recruitment.local` | `Recruiter@123456` | Jobs, candidate pipeline, interviews |
| **Tech Lead** | `techlead@recruitment.local` | `TechLead@123456` | Interviews & scorecard evaluations |

---

## 📡 API Reference

All routes are prefixed with `/api/v1`.

### Authentication
- `POST /api/v1/auth/login` — Authenticate user and receive JWT access + refresh tokens.
- `GET  /api/v1/auth/me` — Retrieve current authenticated user profile and permissions.
- `POST /api/v1/auth/refresh` — Exchange refresh token for a new access token.

### Job Requisitions
- `GET    /api/v1/jobs` — List job requisitions (filters: `search`, `department`, `status`).
- `GET    /api/v1/jobs/:id` — Retrieve job details and application pipeline summary.
- `POST   /api/v1/jobs` — Create new job opening *(requires `jobs.create`)*.
- `PATCH  /api/v1/jobs/:id` — Update job requisition *(requires `jobs.update`)*.
- `DELETE /api/v1/jobs/:id` — Delete job requisition *(requires `jobs.delete`)*.

### Candidates & Pipeline
- `GET   /api/v1/candidates` — Search and list candidate profiles.
- `GET   /api/v1/candidates/:id` — Full candidate profile with interview history.
- `POST  /api/v1/candidates` — Create candidate profile *(requires `candidates.create`)*.
- `GET   /api/v1/applications` — List applications (filters: `jobId`, `stage`, `status`).
- `POST  /api/v1/applications` — Submit application *(triggers `APPLICATION_RECEIVED` email)*.
- `PATCH /api/v1/applications/:id/stage` — Advance pipeline stage *(triggers rejection email if rejected)*.

### Interviews & Scorecards
- `GET  /api/v1/interviews` — List scheduled interviews.
- `POST /api/v1/interviews` — Schedule interview session *(triggers `INTERVIEW_SCHEDULED` email)*.
- `POST /api/v1/interviews/:id/feedback` — Submit scorecard rating and qualitative review.

### Compensation Offers
- `GET   /api/v1/offers` — List compensation offers.
- `POST  /api/v1/offers` — Draft offer package *(requires `offers.create`)*.
- `PATCH /api/v1/offers/:id/status` — Update status (`SENT` triggers email, `ACCEPTED` marks as `HIRED`).

### Reports & Health
- `GET /api/v1/reports/overview` — Aggregated KPI metrics and pipeline funnel counts.
- `GET /api/v1/health` — Live infrastructure health check (API, Database, Redis status).

---

## 🔒 Security & Ponytail Principles

1. **Authoritative Backend Security:** Never trust frontend checks; backend authorization middleware guards every endpoint.
2. **Zero Secrets in Queue Payloads:** BullMQ jobs contain only template identifiers, recipient emails, and sanitized data.
3. **No Over-Engineering:** Direct `Route -> Service / Database` flow without artificial wrapper abstractions.
4. **Structured Error Handling:** Masked internal stack traces in production with clean, actionable user feedback.
5. **Graceful Shutdown:** All server and worker processes intercept `SIGINT`/`SIGTERM` to safely drain queues and release database connections.

---

## 📄 License
This project is open-source and licensed under the [MIT License](LICENSE).
