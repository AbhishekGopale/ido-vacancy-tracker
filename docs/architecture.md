# System Architecture Documentation

## 1. High-Level Architecture
The **Smart Recruitment Lifecycle Tracker** is designed as a clean, modular monolith:

```
[React SPA (Vite)] ──(HTTP / REST with JWT)──> [Node.js Express API]
                                                      │
                                   ┌──────────────────┴──────────────────┐
                                   ▼                                     ▼
                        [PostgreSQL Database]                  [BullMQ Email Queue]
                           (Prisma Client)                               │
                                                                         ▼
                                                                      [Redis]
                                                                         │
                                                                         ▼
                                                               [Email Worker Process]
                                                                         │
                                                                         ▼
                                                               [Candidate / Recipient]
```

## 2. Key Architectural Decisions (Ponytail Principles)

### No Unnecessary Layering
We avoid arbitrary layers like `controller -> manager -> service -> repository -> dao`.
- **Router / Controller:** Validates input with Zod, checks permissions via middleware, and coordinates the response.
- **Service / Database Layer:** Prisma Client performs type-safe queries directly with built-in transactions and relations.

### Independent Worker Process
- The email worker (`apps/backend/src/worker.ts`) runs as a dedicated Node.js process.
- The API pushes jobs to Redis in milliseconds without waiting for SMTP handshakes.
- If the worker is restarted or crashed, Redis persists queued jobs until the worker resumes.
