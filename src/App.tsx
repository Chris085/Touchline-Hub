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
import { Paywall } from './pages/Paywall';
import { Admin } from './pages/Admin';
import { Dashboard } from './pages/Dashboard';
import { Squad } from './pages/Squad';
import { MatchController } from './pages/MatchController';
import { MotmVoting } from './pages/MotmVoting';
import { ScheduleDetails } from './pages/ScheduleDetails';
import { PlayerProfile } from './pages/PlayerProfile';
import { NewsFeed } from './pages/NewsFeed';
import { TeamChat } from './pages/TeamChat';
import { Notes } from './pages/Notes';
import { Features } from './pages/Features';
import { Stats } from './pages/Stats';
import { Profile } from './pages/Profile';

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

  const isSubscribed = profile?.subscriptionStatus === 'active' || 
                      profile?.email === 'chrisjeal9@gmail.com' ||
                      (profile?.trialEndDate && new Date(profile.trialEndDate) > new Date());

  return (
    <Routes>
      <Route path="/login" element={user ? (profile?.role ? <Navigate to="/" replace /> : <Navigate to={`/onboarding${location.search}`} replace />) : <Login />} />
      <Route path="/onboarding" element={user && !profile?.role ? <Onboarding /> : user && profile?.role ? <Navigate to="/" replace /> : <Navigate to={`/login${location.search}`} replace />} />
      <Route path="/upgrade" element={user && profile?.role ? (isSubscribed ? <Navigate to="/" replace /> : <Paywall />) : <Navigate to="/login" replace />} />
      
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="news" element={<NewsFeed />} />
        <Route path="chat" element={<TeamChat />} />
        <Route path="schedule/:id" element={<ScheduleDetails />} />
        <Route path="player/:id" element={<PlayerProfile />} />
        <Route path="squad" element={<Squad />} />
        <Route path="live" element={<MatchController />} />
        <Route path="motm" element={<MotmVoting />} />
        <Route path="notes" element={<Notes />} />
        <Route path="stats" element={<Stats />} />
        <Route path="features" element={<Features />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin" element={<Admin />} />
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
