import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProtectedRoute } from './ProtectedRoute';

// Lazy load pages for performance
const LandingPage = React.lazy(() => import('../pages/LandingPage'));
const LoginPage = React.lazy(() => import('../pages/LoginPage'));
const SignupPage = React.lazy(() => import('../pages/SignupPage'));
const ForgotPasswordPage = React.lazy(() => import('../pages/ForgotPasswordPage'));
const DashboardPage = React.lazy(() => import('../pages/DashboardPage'));
const ProfilePage = React.lazy(() => import('../pages/ProfilePage'));
const WardrobePage = React.lazy(() => import('../pages/WardrobePage'));
const SettingsPage = React.lazy(() => import('../pages/SettingsPage'));

export function AppRoutes() {
  return (
    <React.Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <Routes>
        {/* Public Routes with MainLayout (Navbar + Footer) */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Protected Routes with DashboardLayout (Sidebar) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/wardrobe" element={<WardrobePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </React.Suspense>
  );
}
