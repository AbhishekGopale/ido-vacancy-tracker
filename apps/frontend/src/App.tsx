import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { LoginPage } from './pages/Auth/LoginPage.js';
import { DashboardPage } from './pages/Dashboard/DashboardPage.js';
import { ProjectRolesPage } from './pages/ProjectRoles/ProjectRolesPage.js';
import { VacanciesPage } from './pages/Vacancies/VacanciesPage.js';
import { DuplicateQueuePage } from './pages/Duplicates/DuplicateQueuePage.js';
import { SettingsPage } from './pages/Settings/SettingsPage.js';
import { RejectionWebFormPage } from './pages/Public/RejectionWebFormPage.js';
import { ApprovalLandingPage } from './pages/Public/ApprovalLandingPage.js';
import { Layout } from './components/Layout.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { NotFoundPage } from './pages/NotFound/NotFoundPage.js';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reject" element={<RejectionWebFormPage />} />
      <Route path="/approve" element={<ApprovalLandingPage />} />

      {/* Authenticated Layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route
            path="/project-roles"
            element={
              <ProtectedRoute requiredPermission="project_roles.manage">
                <ProjectRolesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vacancies"
            element={
              <ProtectedRoute requiredPermission="vacancies.read">
                <VacanciesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/duplicates"
            element={
              <ProtectedRoute requiredPermission="vacancies.dedup_decision">
                <DuplicateQueuePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requiredPermission="users.manage">
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>

      {/* Custom 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
