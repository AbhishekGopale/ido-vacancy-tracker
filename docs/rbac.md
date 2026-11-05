# Role-Based Access Control (RBAC)

## 1. Security Boundary Principle
- **Frontend RBAC is for User Experience:** UI hiding or disabling buttons improves user workflow but provides no security.
- **Backend Authorization is Final:** Every endpoint is protected by `requirePermission('<slug>')`. Any unauthorized request receives `403 Forbidden`.

## 2. Standard Roles & Permissions
```text
SUPER_ADMIN
 ├── users.manage
 ├── roles.manage
 └── (All permissions)

HR_MANAGER
 ├── jobs.*
 ├── candidates.*
 ├── applications.*
 ├── interviews.*
 ├── offers.*
 └── reports.view

RECRUITER
 ├── jobs.read, jobs.create, jobs.update
 ├── candidates.*
 ├── applications.*
 ├── interviews.*
 └── offers.read, offers.create

INTERVIEWER
 ├── jobs.read
 ├── candidates.read
 ├── interviews.read
 └── interviews.feedback.submit
```
