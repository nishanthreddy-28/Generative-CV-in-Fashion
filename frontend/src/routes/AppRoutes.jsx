import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MainLayout } from '../layouts/MainLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProtectedRoute } from './ProtectedRoute';

// Lazy load all pages
const LandingPage = React.lazy(() => import('../pages/LandingPage'));
const LoginPage = React.lazy(() => import('../pages/LoginPage'));
const SignupPage = React.lazy(() => import('../pages/SignupPage'));
const ForgotPasswordPage = React.lazy(() => import('../pages/ForgotPasswordPage'));
const DashboardPage = React.lazy(() => import('../pages/DashboardPage'));
const ProfilePage = React.lazy(() => import('../pages/ProfilePage'));
const WardrobePage = React.lazy(() => import('../pages/WardrobePage'));
const SettingsPage = React.lazy(() => import('../pages/SettingsPage'));
const AIStylistPage = React.lazy(() => import('../pages/AIStylistPage'));
const VirtualTryOnPage = React.lazy(() => import('../pages/VirtualTryOnPage'));
const InsightsPage = React.lazy(() => import('../pages/InsightsPage'));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090B]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-10 w-10 rounded-xl bg-gradient-blue-violet animate-pulse" />
          <div className="absolute inset-0 h-10 w-10 rounded-xl bg-gradient-blue-violet animate-ping opacity-30" />
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-zinc-600"
              style={{ animation: `typing-blink 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <React.Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes — standalone (each has its own navbar/layout) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected Dashboard Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/wardrobe" element={<WardrobePage />} />
            <Route path="/ai-stylist" element={<AIStylistPage />} />
            <Route path="/try-on" element={<VirtualTryOnPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </React.Suspense>
  );
}
