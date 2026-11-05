# Database Design & Schema Specification

## 1. Relational Entities (PostgreSQL)

1. **`users`**: System users (recruiters, admins, interviewers) with password hashes and role associations.
2. **`roles`**: System roles (`SUPER_ADMIN`, `HR_MANAGER`, `RECRUITER`, `INTERVIEWER`).
3. **`permissions`**: Granular permission slugs (`candidates.create`, `interviews.schedule`, etc.).
4. **`role_permissions`**: Composite join table between roles and permissions.
5. **`jobs`**: Job requisition details, status (`OPEN`, `DRAFT`, `CLOSED`), and salary range.
6. **`candidates`**: Candidate profiles, resumes, contact information.
7. **`applications`**: Application pipeline linking candidates to jobs, tracking stages (`APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `HIRED`, `REJECTED`).
8. **`interviews`**: Scheduled interview sessions with interviewers, dates, and meeting URLs.
9. **`interview_feedback`**: Scorecards with 1-5 star ratings, recommendations, and evaluation comments.
10. **`offers`**: Compensation offers with salary, start date, expiration, and status.

## 2. Integrity & Constraints
- **Unique Constraint on Applications:** `UNIQUE(jobId, candidateId)` prevents duplicate applications.
- **Foreign Key Indexes:** All foreign keys (`roleId`, `jobId`, `candidateId`, `applicationId`, `interviewerId`) are indexed to maintain $O(\log n)$ join queries.
- **Timestamps:** Every record tracks `createdAt` and `updatedAt` with timezone safety.
