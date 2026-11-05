# 📋 Recruitment OS: Official Enterprise User Directory & Credentials

This directory contains the verified credentials, system roles, organizational hierarchy mappings, and testing instructions for the **Smart Recruitment Lifecycle Tracker (Recruitment OS)**.

---

## 🔐 1. Executive Master Credentials Table

| Level / Tier | Full Name | System Role | Email / User ID | Password | Scope & Assignments |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **System Admin** | Admin System | `ADMIN` | `admin@recruitment.local` | `Admin@123456` | Full technical platform configuration, permissions, user management (`/settings`). |
| **Company Owner** | Robert Vance | `OWNER` | `owner@recruitment.local` | `Owner@123456` | Global executive view: all 30+ PMs, all client projects, global fill rates & revenue (`/`). |
| **Super Manager** | Maria Santos | `SUPER_MANAGER` | `super.fmcg@recruitment.local` | `Super@123456` | FMCG Portfolio Director. Supervises PM David Chen & PM Sarah Connor (Unilever, P&G). |
| **Super Manager** | John Miller | `SUPER_MANAGER` | `super.retail@recruitment.local` | `Super@123456` | Retail Operations Director. Supervises PM Alex Kim & PM Sarah Connor (PepsiCo, P&G). |
| **Project Manager** | David Chen | `PM` | `pm.unilever@recruitment.local` | `Pm@123456` | Primary PM for **Project Unilever (UI)**, Backup PM for P&G and PepsiCo. |
| **Project Manager** | Sarah Connor | `PM` | `pm.pg@recruitment.local` | `Pm@123456` | Primary PM for **Project P&G (PG)**, Backup PM for Unilever. |
| **Project Manager** | Alex Kim | `PM` | `pm.pepsi@recruitment.local` | `Pm@123456` | Primary PM for **Project PepsiCo (PEP)**. |
| **Zone Recruiter** | Alex Morgan | `RECRUITER` | `recruiter.north@recruitment.local` | `Recruiter@123456` | Assigned Territory: **North Zone** (Chicago, Detroit, New York). |
| **Zone Recruiter** | Elena Rostova | `RECRUITER` | `recruiter.south@recruitment.local` | `Recruiter@123456` | Assigned Territory: **South Zone** (Atlanta, Miami, Dallas). |
| **Zone Recruiter** | Marcus Brody | `RECRUITER` | `recruiter.east@recruitment.local` | `Recruiter@123456` | Assigned Territory: **East Zone** (Boston, Philadelphia). |
| **Zone Recruiter** | Chloe Bennett | `RECRUITER` | `recruiter.west@recruitment.local` | `Recruiter@123456` | Assigned Territory: **West Zone** (Los Angeles, Seattle). |

---

## 🏢 2. Many-to-Many Organizational Mappings

### Project ↔ Project Manager (PM) Mappings
* **Project Unilever (`UI`)**:
  * Primary PM: David Chen (`pm.unilever@recruitment.local`)
  * Backup PM: Sarah Connor (`pm.pg@recruitment.local`)
* **Project P&G (`PG`)**:
  * Primary PM: Sarah Connor (`pm.pg@recruitment.local`)
  * Backup PM: David Chen (`pm.unilever@recruitment.local`)
* **Project PepsiCo (`PEP`)**:
  * Primary PM: Alex Kim (`pm.pepsi@recruitment.local`)
  * Backup PM: David Chen (`pm.unilever@recruitment.local`)

### Super Manager ↔ Project Manager Mappings
* **Maria Santos (`super.fmcg@recruitment.local`)**:
  * Supervises: David Chen (Unilever), Sarah Connor (P&G)
* **John Miller (`super.retail@recruitment.local`)**:
  * Supervises: Alex Kim (PepsiCo), Sarah Connor (P&G)

---

## ✉️ 3. Field Approver Escalation Paths

Field Approvers (Area Sales Managers & Regional Sales Managers) review candidates directly from their smartphones via 1-click tokenized links (**Zero portal login required**):

* **Level 1 (PM Review)**: Assigned Project Manager (e.g., `pm.unilever@recruitment.local`)
* **Level 2 (Area Sales Manager - ASM)**:
  * Default Email: `abhishek.gopale@idonneous.com`
  * Area Overrides:
    * Chicago Metro ASM: `chicago.asm@company.com`
    * Atlanta Metro ASM: `atlanta.asm@company.com`
* **Level 3 (Regional Sales Manager - RSM)**:
  * Default Email: `abhishek.gopale@idonneous.com`

---

## 🧪 4. Quick Testing Guide

1. **Access Web Application**: Open [http://localhost:5173](http://localhost:5173) in your browser.
2. **Log In as Project Manager**:
   * Email: `pm.unilever@recruitment.local` | Password: `Pm@123456`
   * View `/project-roles` → Inspect dynamic roles with 2-day target SLA.
   * View `/duplicates` → Inspect duplicate triage queue (`SAME` vs `DIFFERENT & APPROVE`).
3. **Log In as Zone Recruiter**:
   * Email: `recruiter.north@recruitment.local` | Password: `Recruiter@123456`
   * Open `/vacancies` → Experience the Instagram-style card feed with countdown badges (`🔥 Due Today`).
   * Click **"My Profile"** to view personal scoreboard (`Active`, `In Process`, `Completed`).
4. **Log In as Company Owner / Super Manager**:
   * Email: `owner@recruitment.local` | Password: `Owner@123456`
   * Email: `super.fmcg@recruitment.local` | Password: `Super@123456`
   * View the executive operations dashboard with portfolio-level analytics.
