# Email Queue Architecture (BullMQ + Redis)

## 1. Flow of Asynchronous Dispatch
1. API Route receives action (e.g. `POST /api/v1/applications` or `POST /api/v1/interviews`).
2. Controller saves records to PostgreSQL inside a database transaction.
3. Controller calls `enqueueEmail('job-name', payload)`.
4. BullMQ enqueues a job into Redis under `email-queue`.
5. API immediately sends HTTP `201 Created` back to client without blocking.
6. The background Worker process picks up the job, renders the template, and sends the email via Nodemailer.

## 2. Resilience and Retry Policies
- **Backoff:** Exponential with initial 3000ms delay:
  - Attempt 1: immediate
  - Attempt 2: +3s
  - Attempt 3: +6s
  - Attempt 4: +12s
  - Attempt 5: +24s
- **Dead Letter Inspection:** Failed jobs are retained in Redis for operator inspection (`removeOnFail: { count: 500 }`).
- **Zero Secrets:** Queue payloads contain no passwords, API tokens, or credentials.
