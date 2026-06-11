import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar, 
  Users, 
  Activity, 
  LogOut, 
  Award, 
  UserX, 
  Shield, 
  User, 
  Menu,
  X,
  Bell,
  FileText,
  LayoutGrid,
  Zap,
  Plus,
  BarChart3,
  CreditCard,
  ChevronRight,
  Wallet,
  BookOpen,
  Sun,
  Moon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { AnimatePresence, motion } from 'motion/react';
import { useTheme } from '../contexts/ThemeContext';

export function Layout() {
  const { profile, signOut, deleteProfile, isSubscribed, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeMatch, setActiveMatch] = useState<boolean>(false);
  const [activeVoting, setActiveVoting] = useState<boolean>(false);
  
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

  useEffect(() => {
    if (!profile?.teamId) return;

    // Listen for active matches
    const matchesQuery = query(
      collection(db, 'matches'),
      where('teamId', '==', profile.teamId),
      where('status', '==', 'in-progress')
    );

    const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
      setActiveMatch(!snapshot.empty);
    });

    // Listen for active voting
    const votingQuery = query(
      collection(db, 'matches'),
      where('teamId', '==', profile.teamId),
      where('isPotmVotingOpen', '==', true)
    );

    const unsubscribeVoting = onSnapshot(votingQuery, (snapshot) => {
      setActiveVoting(!snapshot.empty);
    });

    return () => {
      unsubscribeMatches();
      unsubscribeVoting();
    };
  }, [profile?.teamId, location.pathname]);

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile?.uid }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create portal session');
      }
    } catch (error: any) {
      console.error('Error managing subscription:', error);
      alert(error.message);
    }
  };

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

  const navItems: {
    name: string;
    path: string;
    icon: any;
    alwaysShow?: boolean;
    dynamic?: boolean;
    active?: boolean;
    pulse?: boolean;
    glow?: boolean;
    coachOnly?: boolean;
    adminOnly?: boolean;
    hasBadge?: boolean;
    hideIfActive?: boolean;
    hideInMenu?: boolean;
  }[] = [
    { name: 'Stats', path: '/stats', icon: BarChart3 },
    { name: 'Payments', path: '/payments', icon: Wallet, coachOnly: true },
    { name: 'Squad', path: '/squad', icon: Users },
    { name: 'Schedule', path: '/', icon: Calendar, alwaysShow: true },
    { name: 'Learning', path: '/learning', icon: BookOpen },
    { name: 'Features', path: '/features', icon: LayoutGrid },
    { name: 'Notes', path: '/notes', icon: FileText, coachOnly: true },
    { name: 'Admin', path: '/admin', icon: Shield, adminOnly: true },
    { 
      name: 'Live Match', 
      path: '/live', 
      icon: Activity, 
      active: activeMatch, 
      dynamic: true,
      pulse: true,
      glow: false,
      hideInMenu: true
    },
    { 
      name: 'MOTM', 
      path: '/motm', 
      icon: Award, 
      active: activeVoting, 
      dynamic: true,
      pulse: true,
      glow: true,
      hideInMenu: !activeVoting
    },
  ];

  const trialDaysLeft = profile?.trialEndDate 
    ? Math.ceil((new Date(profile.trialEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const showTrialBanner = (profile?.role === 'coach' || isAdmin) && 
                          profile?.subscriptionStatus !== 'active' && 
                          profile?.email !== 'chrisjeal9@gmail.com' &&
                          trialDaysLeft > 0;

  const bottomNavItems = navItems.filter(item => 
    item.alwaysShow || (item.dynamic && item.active && (!item.coachOnly || profile?.role === 'coach' || isAdmin))
  );

  const burgerItems = navItems.filter(item => 
    !item.alwaysShow && 
    !item.hideInMenu &&
    (!item.coachOnly || profile?.role === 'coach' || isAdmin) &&
    (!item.adminOnly || isAdmin) &&
    (!item.hideIfActive || !isSubscribed)
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col">
      {/* Trial Banner */}
      {showTrialBanner && (
        <div className="bg-green-500 text-slate-950 py-1.5 px-4 text-center text-[10px] font-black uppercase tracking-[0.2em] relative z-40">
          Trial Active: {trialDaysLeft} Days Remaining • <Link to="/upgrade" className="underline hover:text-slate-50 transition-colors">Upgrade Now</Link>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMenuOpen(true)}
                className="p-2 -ml-2 text-slate-400 hover:text-slate-50 transition-colors relative"
              >
                <Menu size={24} />
              </button>
              
              <Link to="/" className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-slate-950 font-bold text-lg">TH</span>
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-50 hidden sm:block">The Touchline Hub</span>
              </Link>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
                {isAdmin ? (
                  <Shield size={14} className="text-purple-400" />
                ) : profile?.role === 'coach' ? (
                  <Shield size={14} className="text-green-400" />
                ) : (
                  <User size={14} className="text-blue-400" />
                )}
                <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                  {isAdmin ? 'Admin' : profile?.role === 'coach' ? 'Coach' : 'Parent'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Burger Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-[70] flex flex-col"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-slate-950 font-bold text-lg">TH</span>
                  </div>
                  <span className="font-bold text-slate-50">Menu</span>
                </div>
                <button onClick={() => setIsMenuOpen(false)} className="text-slate-400 hover:text-slate-50">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4">
                <div className="px-4 mb-4">
                  <Link 
                    to="/profile"
                    onClick={() => setIsMenuOpen(false)}
                    className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 flex items-center gap-3 hover:bg-slate-800 hover:border-slate-600 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 group-hover:text-green-400 transition-colors">
                      <User size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-50 truncate">{profile?.displayName || 'User'}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                        {isAdmin ? 'Admin' : profile?.role}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </Link>
                </div>

                <nav className="px-2 space-y-1">
                  {burgerItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        onClick={() => setIsMenuOpen(false)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                          isActive 
                            ? 'bg-green-500/10 text-green-400' 
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={20} />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        {item.hasBadge && (
                          <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                        )}
                      </Link>
                    );
                  })}
                  
                  {/* Theme Toggle in Scrollable Area */}
                  <button
                    onClick={toggleTheme}
                    className="flex items-center justify-between w-full px-4 py-3 mt-4 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? <Moon size={20} className="text-slate-400 group-hover:text-blue-400" /> : <Sun size={20} className="text-slate-400 group-hover:text-yellow-400" />}
                      <span className="font-medium">Theme</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-bold bg-slate-800 px-2 py-1 rounded-lg group-hover:bg-slate-700 transition-colors">{theme}</span>
                  </button>
                </nav>
              </div>

              <div className="p-4 border-t border-slate-800 space-y-4 shrink-0 pb-safe">
                {(profile?.role === 'coach' || isAdmin) && (
                  <div className="px-4 py-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Subscription</span>
                      <Zap size={14} className={isSubscribed ? "text-green-400" : "text-slate-500"} />
                    </div>
                    
                    {profile?.subscriptionStatus === 'active' || isAdmin ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <p className="text-sm font-bold text-slate-50">Premium Active</p>
                      </div>
                    ) : trialDaysLeft > 0 ? (
                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <p className="text-lg font-black text-slate-50 leading-none">{trialDaysLeft} Days</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Trial Remaining</p>
                        </div>
                        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(5, Math.min(100, (trialDaysLeft / 90) * 100))}%` }}
                            className="h-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                          />
                        </div>
                        <Link 
                          to="/upgrade" 
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-500 hover:bg-green-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95"
                        >
                          Upgrade Now
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-bold text-red-400">Trial Expired</p>
                        <Link 
                          to="/upgrade" 
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-500 hover:bg-green-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95"
                        >
                          Upgrade Now
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  {profile?.stripeCustomerId && (
                    <button
                      onClick={handleManageSubscription}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-green-400 hover:bg-green-500/10 transition-all"
                    >
                      <CreditCard size={20} />
                      <span className="font-medium">Manage Subscription</span>
                    </button>
                  )}
                  <button
                    onClick={signOut}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-50 transition-all"
                  >
                    <LogOut size={20} />
                    <span className="font-medium">Sign Out</span>
                  </button>
                  <button
                    onClick={handleDeleteProfile}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all"
                  >
                    <UserX size={20} />
                    <span className="font-medium">Reset Profile</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>

      {/* Dynamic Bottom Nav */}
      <nav className="fixed bottom-0 w-full bg-slate-950 border-t border-slate-800 pb-safe z-50">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isPulse = item.pulse;
            const isGlow = item.glow;
            
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 relative group ${
                  isActive ? 'text-green-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon size={22} className={isPulse ? 'animate-pulse' : ''} />
                  {isGlow && (
                    <span className="absolute inset-0 bg-green-500/40 blur-lg rounded-full animate-pulse"></span>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold">{item.name}</span>
                {isActive && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute top-0 w-12 h-1 bg-green-500 rounded-b-full shadow-[0_0_12px_rgba(34,197,94,0.5)]"
                  />
                )}
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
