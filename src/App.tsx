/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Roster } from './pages/Roster';
import { MatchController } from './pages/MatchController';
import { MotmVoting } from './pages/MotmVoting';
import { ScheduleDetails } from './pages/ScheduleDetails';
import { PlayerProfile } from './pages/PlayerProfile';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login${location.search}`} replace />;
  }

  if (!profile?.role) {
    return <Navigate to={`/onboarding${location.search}`} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? (profile?.role ? <Navigate to="/" replace /> : <Navigate to={`/onboarding${location.search}`} replace />) : <Login />} />
      <Route path="/onboarding" element={user && !profile?.role ? <Onboarding /> : user && profile?.role ? <Navigate to="/" replace /> : <Navigate to={`/login${location.search}`} replace />} />
      
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="schedule/:id" element={<ScheduleDetails />} />
        <Route path="player/:id" element={<PlayerProfile />} />
        <Route path="roster" element={<Roster />} />
        <Route path="live" element={<MatchController />} />
        <Route path="motm" element={<MotmVoting />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
