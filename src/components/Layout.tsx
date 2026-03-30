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
  Newspaper, 
  MessageSquare,
  Menu,
  X,
  Bell,
  FileText
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { AnimatePresence, motion } from 'motion/react';

export function Layout() {
  const { profile, signOut, deleteProfile } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeMatch, setActiveMatch] = useState<boolean>(false);
  const [activeVoting, setActiveVoting] = useState<boolean>(false);
  const [hasUnreadNews, setHasUnreadNews] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  
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

    // Listen for latest news
    const newsQuery = query(
      collection(db, 'newsPosts'),
      where('teamId', '==', profile.teamId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribeNews = onSnapshot(newsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const latestNews = snapshot.docs[0].data();
        const lastRead = localStorage.getItem(`lastReadNews_${profile.teamId}`);
        if (!lastRead || new Date(latestNews.createdAt) > new Date(lastRead)) {
          if (location.pathname !== '/news') {
            setHasUnreadNews(true);
          }
        }
      }
    });

    // Listen for latest chat
    const chatQuery = query(
      collection(db, 'chatMessages'),
      where('teamId', '==', profile.teamId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
      if (!snapshot.empty) {
        const latestChat = snapshot.docs[0].data();
        const lastRead = localStorage.getItem(`lastReadChat_${profile.teamId}`);
        if (!lastRead || new Date(latestChat.createdAt) > new Date(lastRead)) {
          if (location.pathname !== '/chat') {
            setHasUnreadChat(true);
          }
        }
      }
    });

    return () => {
      unsubscribeMatches();
      unsubscribeVoting();
      unsubscribeNews();
      unsubscribeChat();
    };
  }, [profile?.teamId, location.pathname]);

  // Mark as read when navigating
  useEffect(() => {
    if (!profile?.teamId) return;
    if (location.pathname === '/news') {
      localStorage.setItem(`lastReadNews_${profile.teamId}`, new Date().toISOString());
      setHasUnreadNews(false);
    }
    if (location.pathname === '/chat') {
      localStorage.setItem(`lastReadChat_${profile.teamId}`, new Date().toISOString());
      setHasUnreadChat(false);
    }
  }, [location.pathname, profile?.teamId]);

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
    hasBadge?: boolean;
  }[] = [
    { name: 'Schedule', path: '/', icon: Calendar, alwaysShow: true },
    { name: 'News', path: '/news', icon: Newspaper, hasBadge: hasUnreadNews },
    { name: 'Chat', path: '/chat', icon: MessageSquare, hasBadge: hasUnreadChat },
    { name: 'Squad', path: '/squad', icon: Users },
    { name: 'Notes', path: '/notes', icon: FileText, coachOnly: true },
    { 
      name: 'Live Match', 
      path: '/live', 
      icon: Activity, 
      active: activeMatch, 
      dynamic: true,
      pulse: true,
      glow: false 
    },
    { 
      name: 'MOTM', 
      path: '/motm', 
      icon: Award, 
      active: activeVoting, 
      dynamic: true,
      pulse: true,
      glow: true 
    },
  ];

  const bottomNavItems = navItems.filter(item => 
    item.alwaysShow || (item.dynamic && item.active && (!item.coachOnly || profile?.role === 'coach'))
  );

  const burgerItems = navItems.filter(item => !item.alwaysShow);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMenuOpen(true)}
                className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors relative"
              >
                <Menu size={24} />
                {(hasUnreadNews || hasUnreadChat) && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900"></span>
                )}
              </button>
              
              <Link to="/" className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-slate-950 font-bold text-lg">TH</span>
                </div>
                <span className="text-xl font-bold tracking-tight text-white hidden sm:block">The Touchline Hub</span>
              </Link>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/50 border border-slate-700/50">
                {profile?.role === 'coach' ? (
                  <Shield size={14} className="text-green-400" />
                ) : (
                  <User size={14} className="text-blue-400" />
                )}
                <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                  {profile?.role === 'coach' ? 'Coach' : 'Parent'}
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
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-50 flex flex-col"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-slate-950 font-bold text-lg">TH</span>
                  </div>
                  <span className="font-bold text-white">Menu</span>
                </div>
                <button onClick={() => setIsMenuOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4">
                <div className="px-4 mb-4">
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400">
                      <User size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white truncate max-w-[160px]">{profile?.displayName || 'User'}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{profile?.role}</p>
                    </div>
                  </div>
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
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
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
                </nav>
              </div>

              <div className="p-4 border-t border-slate-800 space-y-1">
                <button
                  onClick={signOut}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
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
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>

      {/* Dynamic Bottom Nav */}
      <nav className="fixed bottom-0 w-full bg-slate-900/80 backdrop-blur-lg border-t border-slate-800 pb-safe z-30">
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
