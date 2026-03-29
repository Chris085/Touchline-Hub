import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Users, Activity, LogOut, Award, UserX, Shield, User } from 'lucide-react';
import { useState } from 'react';
import { ConfirmModal } from './ConfirmModal';

export function Layout() {
  const { profile, signOut, deleteProfile } = useAuth();
  const location = useLocation();
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  const handleDeleteProfile = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Profile',
      message: 'Are you sure you want to delete your profile and start over? This cannot be undone.',
      onConfirm: async () => {
        await deleteProfile();
      }
    });
  };

  const navItems = [
    { name: 'Schedule', path: '/', icon: Calendar },
    { name: 'Roster', path: '/roster', icon: Users },
    { name: 'Live Match', path: '/live', icon: Activity, coachOnly: true },
    { name: 'MOTM', path: '/motm', icon: Award },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-slate-950 font-bold text-lg">TH</span>
                </div>
                <span className="text-xl font-bold tracking-tight text-white hidden sm:block">The Touchline Hub</span>
              </div>
              
              {/* Desktop Nav */}
              <nav className="hidden sm:flex items-center gap-6">
                {navItems.filter(item => !item.coachOnly || profile?.role === 'coach').map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={`text-sm font-medium transition-colors ${
                        isActive ? 'text-green-400' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/50 border border-slate-700/50">
                {profile?.role === 'coach' ? (
                  <Shield size={14} className="text-green-400" />
                ) : (
                  <User size={14} className="text-blue-400" />
                )}
                <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                  {profile?.role === 'coach' ? 'Coach' : 'Parent'}
                </span>
              </div>
              <button
                onClick={handleDeleteProfile}
                className="text-slate-400 hover:text-red-400 transition-colors"
                title="Reset Profile"
              >
                <UserX size={20} />
              </button>
              <button
                onClick={signOut}
                className="text-slate-400 hover:text-white transition-colors"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="sm:hidden fixed bottom-0 w-full bg-slate-900 border-t border-slate-800 pb-safe">
        <div className="flex justify-around items-center h-16">
          {navItems.filter(item => !item.coachOnly || profile?.role === 'coach').map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  isActive ? 'text-green-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] uppercase tracking-wider font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar (Optional, but we use top nav for simplicity, let's add desktop nav links here if needed) */}
      
      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
    </div>
  );
}
