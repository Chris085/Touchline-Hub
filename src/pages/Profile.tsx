import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  User as UserIcon, 
  Mail, 
  Shield, 
  Users, 
  Bell, 
  ChevronRight, 
  CreditCard, 
  Zap,
  Activity,
  Settings,
  LogOut,
  UserX,
  Calendar,
  Plus,
  RefreshCw,
  BellOff
} from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, getDoc, getDocs, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { ConfirmModal } from '../components/ConfirmModal';

interface TeamMember {
  uid: string;
  displayName: string;
  email: string;
  role: string;
  photoURL?: string;
  subscriptionStatus?: string;
  stripeCustomerId?: string;
}

interface ActivityItem {
  id: string;
  type: 'news' | 'chat' | 'match';
  title: string;
  description: string;
  timestamp: string;
  icon: any;
}

export function Profile() {
  const { profile, signOut, deleteProfile, isSubscribed, isAdmin, switchTeam, updateProfile } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'activity' | 'season' | 'teams' | 'settings' | 'notifications'>('overview');
  const [teamData, setTeamData] = useState<any>(null);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [showNewSeasonModal, setShowNewSeasonModal] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [seasonSettings, setSeasonSettings] = useState({
    name: '',
    badge: '',
    seasonStart: '',
    seasonEnd: '',
    seasonTag: '',
    halfDuration: 20,
    maxMatchPlayers: 16,
    seasons: [] as string[],
    features: {
      dragAndDropPitch: true,
      enablePayments: true,
      enableLearning: true,
      enableNotes: true
    },
    notificationSettings: {
      matchScheduled: false,
      matchUpdate: false,
      attendanceReminder: false,
      trainingReminder: false,
      liveMatchUpdates: false
    }
  });
  const [isSavingSeason, setIsSavingSeason] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ isOpen: boolean; userId: string; name: string }>({
    isOpen: false,
    userId: '',
    name: ''
  });

  useEffect(() => {
    if (!profile?.teamId) return;

    // Fetch team data
    const fetchTeam = async () => {
      const teamRef = doc(db, 'teams', profile.teamId);
      const teamSnap = await getDoc(teamRef);
      if (teamSnap.exists()) {
        const data = teamSnap.data();
        setTeamData(data);
        setSeasonSettings({
          name: data.name || '',
          badge: data.badge || '',
          seasonStart: data.seasonStart || '',
          seasonEnd: data.seasonEnd || '',
          seasonTag: data.seasonTag || '',
          halfDuration: data.halfDuration || 20,
          maxMatchPlayers: data.maxMatchPlayers || 16,
          seasons: data.seasons || (data.seasonTag ? [data.seasonTag] : []),
          features: {
            dragAndDropPitch: data.features?.dragAndDropPitch ?? true,
            enablePayments: data.features?.enablePayments ?? true,
            enableLearning: data.features?.enableLearning ?? true,
            enableNotes: data.features?.enableNotes ?? true
          },
          notificationSettings: {
            matchScheduled: data.notificationSettings?.matchScheduled ?? false,
            matchUpdate: data.notificationSettings?.matchUpdate ?? false,
            attendanceReminder: data.notificationSettings?.attendanceReminder ?? false,
            trainingReminder: data.notificationSettings?.trainingReminder ?? false,
            liveMatchUpdates: data.notificationSettings?.liveMatchUpdates ?? false
          }
        });
      }
    };
    fetchTeam();

    // Fetch team members
    const membersQuery = query(
      collection(db, 'users'),
      where('teamId', '==', profile.teamId)
    );

    const unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
      const members = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as TeamMember[];
      setTeamMembers(members);
      setLoading(false);
    });

    // Fetch recent match events
    const matchesQuery = query(
      collection(db, 'matches'),
      where('teamId', '==', profile.teamId),
      orderBy('date', 'desc'),
      limit(1)
    );

    const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
      if (!snapshot.empty) {
        const match = snapshot.docs[0].data();
        const matchEvents: ActivityItem[] = (match.events || []).map((e: any, index: number) => ({
          id: `match-event-${snapshot.docs[0].id}-${index}`,
          type: 'match',
          title: e.type === 'goal' ? 'Goal Scored!' : 'Substitution',
          description: e.type === 'goal' 
            ? `${e.playerName} scored against ${match.opponent}`
            : `${e.playerName} was involved in a substitution`,
          timestamp: match.date, // Use match date as proxy for event time if not specific
          icon: Activity
        }));
        setActivities(prev => {
          const filtered = prev.filter(a => a.type !== 'match');
          return [...filtered, ...matchEvents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
        });
      }
    });

    return () => {
      unsubscribeMembers();
      unsubscribeMatches();
    };
  }, [profile?.teamId]);

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

  const handleRemoveMember = (userId: string, name: string) => {
    setConfirmRemove({ isOpen: true, userId, name });
  };

  const confirmRemoveMember = async () => {
    if (!confirmRemove.userId) return;
    try {
      const userRef = doc(db, 'users', confirmRemove.userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const updatedJoinedTeams = (userData.joinedTeams || []).filter((t: any) => t.teamId !== profile?.teamId);
        
        await updateDoc(userRef, {
          teamId: updatedJoinedTeams.length > 0 ? updatedJoinedTeams[0].teamId : null,
          role: updatedJoinedTeams.length > 0 ? updatedJoinedTeams[0].role : null,
          joinedTeams: updatedJoinedTeams
        });
      }
      
      setConfirmRemove({ isOpen: false, userId: '', name: '' });
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member. Please try again.');
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const updatedJoinedTeams = (userData.joinedTeams || []).map((t: any) => 
          t.teamId === profile?.teamId ? { ...t, role: newRole } : t
        );
        
        await updateDoc(userRef, {
          role: newRole,
          joinedTeams: updatedJoinedTeams
        });
      }
    } catch (error) {
      console.error('Error changing role:', error);
      alert('Failed to change role. Please try again.');
    }
  };

  const handleStartNewSeason = async () => {
    if (!profile?.teamId || !newSeasonName) return;

    try {
      const updatedSeasons = [...(seasonSettings.seasons || [])];
      if (seasonSettings.seasonTag && !updatedSeasons.includes(seasonSettings.seasonTag)) {
        updatedSeasons.push(seasonSettings.seasonTag);
      }
      if (!updatedSeasons.includes(newSeasonName)) {
        updatedSeasons.push(newSeasonName);
      }

      const teamRef = doc(db, 'teams', profile.teamId);
      await updateDoc(teamRef, {
        seasonTag: newSeasonName,
        seasonStart: '',
        seasonEnd: '',
        seasons: updatedSeasons
      });

      setSeasonSettings(prev => ({
        ...prev,
        seasonTag: newSeasonName,
        seasonStart: '',
        seasonEnd: '',
        seasons: updatedSeasons
      }));
      setTeamData({ ...teamData, seasonTag: newSeasonName, seasonStart: '', seasonEnd: '', seasons: updatedSeasons });
      
      setShowNewSeasonModal(false);
      setNewSeasonName('');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch (error) {
      console.error('Error starting new season:', error);
      alert('Failed to start new season.');
    }
  };

  const handleSaveSeason = async () => {
    if (!profile?.teamId) return;
    setIsSavingSeason(true);
    try {
      const teamRef = doc(db, 'teams', profile.teamId);
      await updateDoc(teamRef, {
        ...seasonSettings
      });
      setTeamData({ ...teamData, ...seasonSettings });

      if (profile.joinedTeams) {
        const updatedJoinedTeams = profile.joinedTeams.map(t => 
          t.teamId === profile.teamId ? { ...t, teamName: seasonSettings.name } : t
        );
        await updateProfile({ joinedTeams: updatedJoinedTeams });
      }

      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch (error) {
      console.error('Error saving season settings:', error);
      alert('Failed to save season settings.');
    } finally {
      setIsSavingSeason(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !profile) return;
    
    setIsJoining(true);
    setJoinError('');
    
    try {
      const code = joinCode.trim().toUpperCase();
      const teamsRef = collection(db, 'teams');
      const q = query(teamsRef, where('code', '==', code));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Try player code
        if (code.startsWith('P-')) {
          const playersRef = collection(db, 'players');
          const pq = query(playersRef, where('inviteCode', '==', code));
          const pSnapshot = await getDocs(pq);
          
          if (pSnapshot.empty) {
            setJoinError('Invalid invite code.');
            setIsJoining(false);
            return;
          }

          const playerDoc = pSnapshot.docs[0];
          const playerData = playerDoc.data();
          
          // Get team name
          const teamRef = doc(db, 'teams', playerData.teamId);
          const teamSnap = await getDoc(teamRef);
          const teamName = teamSnap.exists() ? teamSnap.data().name : 'Unknown Team';

          // Add to player
          await updateDoc(doc(db, 'players', playerDoc.id), {
            parentIds: arrayUnion(profile.uid)
          });

          const newTeam = { teamId: playerData.teamId, role: 'parent' as const, teamName };
          const currentTeams = profile.joinedTeams || [];
          
          if (currentTeams.some(t => t.teamId === newTeam.teamId)) {
            setJoinError('You are already a member of this team.');
            setIsJoining(false);
            return;
          }

          await updateProfile({
            joinedTeams: [...currentTeams, newTeam],
            teamId: newTeam.teamId,
            role: newTeam.role
          });
          
          setJoinCode('');
          alert(`Successfully joined ${teamName}!`);
        } else {
          setJoinError('Invalid team code.');
        }
      } else {
        const teamDoc = querySnapshot.docs[0];
        const teamData = teamDoc.data();
        
        const newTeam = { teamId: teamDoc.id, role: 'parent' as const, teamName: teamData.name };
        const currentTeams = profile.joinedTeams || [];
        
        if (currentTeams.some(t => t.teamId === newTeam.teamId)) {
          setJoinError('You are already a member of this team.');
          setIsJoining(false);
          return;
        }

        await updateProfile({
          joinedTeams: [...currentTeams, newTeam],
          teamId: newTeam.teamId,
          role: newTeam.role
        });
        
        setJoinCode('');
        alert(`Successfully joined ${teamData.name}!`);
      }
    } catch (err) {
      console.error('Error joining team:', err);
      setJoinError('Failed to join team. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const isSubscriptionOwner = !!profile?.stripeCustomerId;
  const isCoach = profile?.role === 'coach' || isAdmin;

  // Filter team members based on role
  const visibleMembers = teamMembers.filter(m => {
    if (m.uid === profile?.uid) return false; // Don't show self in list
    if (isSubscriptionOwner || isAdmin) return true; // Owner and Admin see everyone
    if (isCoach) return m.role === 'parent'; // Coach sees parents
    return false; // Parents see no one by default in this view
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 blur-3xl rounded-full -mr-32 -mt-32"></div>
        
        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center text-slate-400 shadow-xl overflow-hidden">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={40} />
            )}
          </div>
          
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-50 mb-1 break-words">{profile?.displayName || 'User'}</h1>
            <div className="flex flex-wrap justify-center sm:justify-start gap-3 items-center">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider border border-slate-700">
                <Shield size={12} className={isCoach ? "text-green-400" : "text-blue-400"} />
                {isAdmin ? 'Admin' : profile?.role}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider border border-slate-700">
                <Mail size={12} className="text-slate-500" />
                {profile?.email}
              </div>
              {isSubscribed && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-bold uppercase tracking-wider border border-green-500/20">
                  <Zap size={12} />
                  Premium
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={signOut}
              className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-slate-50 hover:bg-slate-700 transition-all border border-slate-700"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 p-1 bg-slate-900 rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
            activeTab === 'overview' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <UserIcon size={16} />
          <span className="hidden sm:inline">Overview</span>
        </button>
        {(isCoach || isSubscriptionOwner) && (
          <button
            onClick={() => setActiveTab('team')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'team' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Users size={16} />
            <span className="hidden sm:inline">Team</span>
          </button>
        )}
        {isCoach && (
          <button
            onClick={() => setActiveTab('season')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'season' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">Season</span>
          </button>
        )}
        {isCoach && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'settings' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Settings size={16} />
            <span className="hidden sm:inline">Settings</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('teams')}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
            activeTab === 'teams' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Shield size={16} />
          <span className="hidden sm:inline">Teams</span>
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
            activeTab === 'activity' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Activity size={16} />
          <span className="hidden sm:inline">Activity</span>
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
            activeTab === 'notifications' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Bell size={16} />
          <span className="hidden sm:inline">Alerts</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Subscription Card */}
                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-50">Subscription</h3>
                    <CreditCard size={20} className="text-slate-500" />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Status</span>
                        <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-full ${
                          isSubscribed ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {isSubscribed ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-slate-50 font-bold">
                        {isSubscribed ? 'Premium Access' : 'Free Plan'}
                      </p>
                      {profile?.trialEndDate && !isSubscribed && (
                        <p className="text-xs text-slate-500 mt-1">Trial expired on {new Date(profile.trialEndDate).toLocaleDateString()}</p>
                      )}
                    </div>

                    {isSubscriptionOwner ? (
                      <button
                        onClick={handleManageSubscription}
                        className="w-full py-3 bg-green-500 hover:bg-green-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <Settings size={16} />
                        Manage Billing
                      </button>
                    ) : isSubscribed ? (
                      <div className="p-4 bg-green-500/5 rounded-2xl border border-green-500/10">
                        <p className="text-xs text-green-400/80 font-medium leading-relaxed">
                          Your team has a premium subscription. You have full access to all features.
                        </p>
                      </div>
                    ) : (
                      <Link
                        to="/upgrade"
                        className="w-full py-3 bg-green-500 hover:bg-green-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <Zap size={16} />
                        Upgrade to Premium
                      </Link>
                    )}
                  </div>
                </div>

                {/* Quick Stats Card */}
                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-50">Quick Stats</h3>
                    <Activity size={20} className="text-slate-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-center">
                      <p className="text-2xl font-black text-slate-50">{teamMembers.length}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Members</p>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-center">
                      <p className="text-2xl font-black text-slate-50">{activities.length}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Activities</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Preview */}
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-50">Recent Activity</h3>
                  <button onClick={() => setActiveTab('activity')} className="text-xs text-green-400 font-bold uppercase tracking-wider hover:text-green-300 transition-colors">View All</button>
                </div>
                <div className="space-y-3">
                  {activities.slice(0, 3).map((activity) => {
                    const Icon = activity.icon;
                    return (
                      <div key={activity.id} className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                        <div className="p-2 rounded-lg bg-slate-800 text-slate-400">
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-50 truncate">{activity.title}</p>
                          <p className="text-[10px] text-slate-500 truncate">{activity.description}</p>
                        </div>
                      </div>
                    );
                  })}
                  {activities.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4 italic">No recent activity</p>
                  )}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-red-500/5 rounded-3xl border border-red-500/10 p-6">
                <h3 className="text-lg font-bold text-red-400 mb-4">Danger Zone</h3>
                <p className="text-sm text-slate-500 mb-4">Once you delete your profile, there is no going back. Please be certain.</p>
                <button
                  onClick={deleteProfile}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-slate-50 transition-all text-xs font-bold uppercase tracking-wider"
                >
                  <UserX size={16} />
                  Delete Profile
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'team' && (
            <motion.div
              key="team"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-slate-50">Team Members</h3>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{visibleMembers.length} Connected</span>
              </div>

              {visibleMembers.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {visibleMembers.map((member) => (
                    <div 
                      key={member.uid}
                      className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 overflow-hidden border border-slate-700 flex-shrink-0">
                          {member.photoURL ? (
                            <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <UserIcon size={20} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-50 truncate">{member.displayName || 'Anonymous'}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            {(isSubscriptionOwner || isAdmin) ? (
                              <select
                                value={member.role}
                                onChange={(e) => handleChangeRole(member.uid, e.target.value)}
                                className="text-[10px] bg-slate-800 text-slate-300 border-none p-0 focus:ring-0 cursor-pointer uppercase font-bold tracking-widest"
                              >
                                <option value="coach">Coach</option>
                                <option value="parent">Parent</option>
                                <option value="player">Player</option>
                              </select>
                            ) : (
                              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{member.role}</span>
                            )}
                            <span className="w-1 h-1 bg-slate-700 rounded-full hidden sm:block"></span>
                            <span className="text-[10px] text-slate-500 truncate w-full sm:w-auto">{member.email}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-slate-800 pt-3 sm:border-none sm:pt-0">
                        <div className="flex items-center gap-2">
                          {member.stripeCustomerId && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-wider">
                              Owner
                            </span>
                          )}
                          {member.subscriptionStatus === 'active' && (
                            <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-wider">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {(isSubscriptionOwner || isAdmin) && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleRemoveMember(member.uid, member.displayName);
                              }}
                              className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-slate-50 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                              title="Remove from Team"
                            >
                              <UserX size={16} />
                            </button>
                          )}
                          <ChevronRight size={18} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 border-dashed">
                  <Users size={40} className="mx-auto text-slate-700 mb-4" />
                  <p className="text-slate-500 font-medium">No other members connected to your team yet.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'season' && isCoach && (
            <motion.div
              key="season"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-50">Team & Season Settings</h3>
                  <Settings size={20} className="text-slate-500" />
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Team Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Astley & Buckshaw U10s"
                      value={seasonSettings.name}
                      onChange={(e) => setSeasonSettings({ ...seasonSettings, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Team Badge URL</label>
                    <input
                      type="url"
                      placeholder="https://example.com/badge.png"
                      value={seasonSettings.badge}
                      onChange={(e) => setSeasonSettings({ ...seasonSettings, badge: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                    <p className="text-[10px] text-slate-500 italic">Provide a direct link to an image (PNG, JPG, SVG) to display as your team badge.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Season Start Date</label>
                      <input
                        type="date"
                        value={seasonSettings.seasonStart}
                        onChange={(e) => setSeasonSettings({ ...seasonSettings, seasonStart: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Season End Date</label>
                      <input
                        type="date"
                        value={seasonSettings.seasonEnd}
                        onChange={(e) => setSeasonSettings({ ...seasonSettings, seasonEnd: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Season Tag (e.g., 25/26)</label>
                    <input
                      type="text"
                      placeholder="e.g., 25/26"
                      value={seasonSettings.seasonTag}
                      onChange={(e) => setSeasonSettings({ ...seasonSettings, seasonTag: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                    <p className="text-[10px] text-slate-500 italic">This tag will be automatically applied to all new matches and training sessions.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Half Duration (minutes)</label>
                    <input
                      type="number"
                      placeholder="e.g., 20"
                      value={seasonSettings.halfDuration}
                      onChange={(e) => setSeasonSettings({ ...seasonSettings, halfDuration: Number(e.target.value) })}
                      min="1"
                      max="60"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                    <p className="text-[10px] text-slate-500 italic">Default duration for each half in the match controller.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Max Players per Match</label>
                    <input
                      type="number"
                      placeholder="e.g., 16"
                      value={seasonSettings.maxMatchPlayers}
                      onChange={(e) => setSeasonSettings({ ...seasonSettings, maxMatchPlayers: Number(e.target.value) })}
                      min="1"
                      max="30"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <button
                    onClick={handleSaveSeason}
                    disabled={isSavingSeason}
                    className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 hover:shadow-green-500/40 hover:-translate-y-1 active:scale-[0.98] border border-green-400/50 hover:border-green-300"
                  >
                    {isSavingSeason ? (
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Settings size={16} />
                    )}
                    Save Season Settings
                  </button>
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-3xl border border-slate-700/30 p-6">
                <h4 className="text-sm font-bold text-slate-50 mb-2">Current Season Info</h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-slate-800 text-green-400">
                      <Zap size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Active Season</p>
                      <p className="text-lg font-black text-slate-50 italic font-display">{seasonSettings.seasonTag || 'Not Set'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowNewSeasonModal(true)}
                    className="px-4 py-2 bg-slate-800 text-green-400 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-slate-700 transition-colors"
                  >
                    Start New Season
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && isCoach && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-50">Feature Toggles</h3>
                  <Zap size={20} className="text-slate-500" />
                </div>

                <div className="space-y-6">
                  <label className="flex items-start gap-4 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-1">
                      <input
                        type="checkbox"
                        checked={seasonSettings.features.dragAndDropPitch}
                        onChange={(e) => setSeasonSettings(prev => ({
                          ...prev,
                          features: {
                            ...prev.features,
                            dragAndDropPitch: e.target.checked
                          }
                        }))}
                        className="peer sr-only"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-50 group-hover:text-green-400 transition-colors">Drag & Drop Pitch</p>
                      <p className="text-xs text-slate-400 mt-1">Enable or disable the interactive match pitch within the Live Match screen.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-4 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-1">
                      <input
                        type="checkbox"
                        checked={seasonSettings.features.enablePayments ?? true}
                        onChange={(e) => setSeasonSettings(prev => ({
                          ...prev,
                          features: {
                            ...prev.features,
                            enablePayments: e.target.checked
                          }
                        }))}
                        className="peer sr-only"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-50 group-hover:text-green-400 transition-colors">Payments Module</p>
                      <p className="text-xs text-slate-400 mt-1">Enable the subscriptions & payments tracking module (Coach only).</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-4 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-1">
                      <input
                        type="checkbox"
                        checked={seasonSettings.features.enableLearning ?? true}
                        onChange={(e) => setSeasonSettings(prev => ({
                          ...prev,
                          features: {
                            ...prev.features,
                            enableLearning: e.target.checked
                          }
                        }))}
                        className="peer sr-only"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-50 group-hover:text-green-400 transition-colors">Learning Hub</p>
                      <p className="text-xs text-slate-400 mt-1">Enable access to educational resources and session plans.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-4 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-1">
                      <input
                        type="checkbox"
                        checked={seasonSettings.features.enableNotes ?? true}
                        onChange={(e) => setSeasonSettings(prev => ({
                          ...prev,
                          features: {
                            ...prev.features,
                            enableNotes: e.target.checked
                          }
                        }))}
                        className="peer sr-only"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-50 group-hover:text-green-400 transition-colors">Coaches Notes</p>
                      <p className="text-xs text-slate-400 mt-1">Enable the private notes module for coaches to log observations.</p>
                    </div>
                  </label>

                  <div className="border-t border-slate-700 pt-6">
                    <h3 className="text-lg font-bold text-slate-50 mb-6">Notification Settings</h3>
                    <div className="space-y-6">
                        {Object.entries({
                            matchScheduled: false,
                            matchUpdate: false,
                            attendanceReminder: false,
                            trainingReminder: false,
                            liveMatchUpdates: false,
                            ...(seasonSettings.notificationSettings || {})
                        }).map(([key, value]) => {
                          const info = {
                            matchScheduled: {
                              title: 'Match Scheduled',
                              description: 'Enable to allow notifications when a new match is added to the calendar.'
                            },
                            matchUpdate: {
                              title: 'Match Details Changed',
                              description: 'Enable to allow alerts if the time or location of an upcoming match is updated.'
                            },
                            attendanceReminder: {
                              title: 'Attendance Reminders',
                              description: 'Enable to allow reminders for players to mark their attendance before matches and training.'
                            },
                            trainingReminder: {
                              title: 'Training Reminders',
                              description: 'Enable to allow reminders for upcoming training sessions.'
                            },
                            liveMatchUpdates: {
                              title: 'Live Match Updates',
                              description: 'Enable to allow real-time score updates, cards, and alerts when a match is live.'
                            }
                          }[key] || { title: key.replace(/([A-Z])/g, ' $1').trim(), description: `Enable to send ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} notifications to all team members.` };

                          return (
                          <label key={key} className="flex items-start gap-4 cursor-pointer group">
                            <div className="relative flex items-center justify-center mt-1">
                              <input
                                type="checkbox"
                                checked={value as boolean}
                                onChange={(e) => setSeasonSettings(prev => ({
                                  ...prev,
                                  notificationSettings: {
                                    ...prev.notificationSettings,
                                    [key]: e.target.checked
                                  }
                                }))}
                                className="peer sr-only"
                              />
                              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-50 group-hover:text-green-400 transition-colors capitalize">{info.title}</p>
                                <p className="text-xs text-slate-400 mt-1">{info.description}</p>
                            </div>
                          </label>
                        )})}
                    </div>
                  </div>

                  <button
                    onClick={handleSaveSeason}
                    disabled={isSavingSeason}
                    className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 hover:shadow-green-500/40 hover:-translate-y-1 active:scale-[0.98] border border-green-400/50 hover:border-green-300"
                  >
                    {isSavingSeason ? (
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Settings size={16} />
                    )}
                    Save Settings
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
                <h3 className="text-lg font-bold text-slate-50 mb-6">Notification Preferences</h3>
                <p className="text-sm text-slate-400 mb-6">Choose which notifications you'd like to receive.</p>
                
                <div className="space-y-6">
                  {(() => {
                    const availableNotifications = Object.entries({
                        matchScheduled: false,
                        matchUpdate: false,
                        attendanceReminder: false,
                        trainingReminder: false,
                        liveMatchUpdates: false,
                        ...(profile?.notificationPreferences || {})
                    }).filter(([key]) => teamData?.notificationSettings ? teamData.notificationSettings[key] !== false : true);

                    if (availableNotifications.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-900/50 rounded-2xl border border-dashed border-slate-700/50">
                          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                            <BellOff className="h-8 w-8 text-slate-500" />
                          </div>
                          <h4 className="text-slate-50 font-medium mb-2">No Alerts Available</h4>
                          <p className="text-sm text-slate-400 max-w-sm">The coach hasn't enabled any alerts for the team yet. When they do, they'll appear here for you to manage.</p>
                        </div>
                      );
                    }

                    return availableNotifications.map(([key, value]) => {
                      const info = {
                        matchScheduled: {
                          title: 'Match Scheduled',
                          description: 'Get notified when a new match is added to the calendar.'
                        },
                        matchUpdate: {
                          title: 'Match Details Changed',
                          description: 'Receive alerts if the time or location of an upcoming match is updated.'
                        },
                        attendanceReminder: {
                          title: 'Attendance Reminders',
                          description: 'Get reminded to mark your attendance before matches and training.'
                        },
                        trainingReminder: {
                          title: 'Training Reminders',
                          description: 'Receive reminders for upcoming training sessions.'
                        },
                        liveMatchUpdates: {
                          title: 'Live Match Updates',
                          description: 'Real-time score updates, cards, and alerts when a match is live.'
                        }
                      }[key] || { title: key.replace(/([A-Z])/g, ' $1').trim(), description: 'Toggle this notification preference.' };

                      return (
                      <label key={key} className="flex items-start gap-4 cursor-pointer group">
                        <div className="relative flex items-center justify-center mt-1">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => updateProfile({
                                notificationPreferences: {
                                    ...(profile?.notificationPreferences || {
                                        matchScheduled: false,
                                        matchUpdate: false,
                                        attendanceReminder: false,
                                        trainingReminder: false,
                                        liveMatchUpdates: false
                                    }),
                                    [key]: e.target.checked
                                }
                            })}
                            className="peer sr-only"
                          />
                          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-50 group-hover:text-green-400 transition-colors capitalize">{info.title}</p>
                            <p className="text-sm text-slate-400 mt-1">{info.description}</p>
                        </div>
                      </label>
                      );
                    });
                  })()}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'activity' && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-slate-50">Recent Activity</h3>
                <Bell size={18} className="text-slate-500" />
              </div>

              {activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map((activity) => {
                    const Icon = activity.icon;
                    return (
                      <div 
                        key={activity.id}
                        className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-start gap-4"
                      >
                        <div className="p-2 rounded-xl bg-slate-800 text-slate-400">
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-bold text-slate-50 text-sm">{activity.title}</p>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {new Date(activity.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {activity.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 border-dashed">
                  <Bell size={40} className="mx-auto text-slate-700 mb-4" />
                  <p className="text-slate-500 font-medium">No recent activity found.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'teams' && (
            <motion.div
              key="teams"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-50">Join Another Team</h3>
                  <Plus size={20} className="text-slate-500" />
                </div>

                <form onSubmit={handleJoinTeam} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Invite Code</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="P-XXXXXX or 000000"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all uppercase font-mono"
                        maxLength={8}
                      />
                      <button
                        type="submit"
                        disabled={isJoining || !joinCode.trim()}
                        className="px-6 bg-green-500 hover:bg-green-400 disabled:bg-slate-700 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        {isJoining ? (
                          <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          'Join'
                        )}
                      </button>
                    </div>
                    {joinError && <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest mt-2">{joinError}</p>}
                  </div>
                </form>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-50">My Teams</h3>
                <div className="grid grid-cols-1 gap-3">
                  {(profile?.joinedTeams || []).map((team) => (
                    <div 
                      key={team.teamId}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                        profile?.teamId === team.teamId 
                          ? 'bg-green-500/10 border-green-500/50' 
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                          profile?.teamId === team.teamId ? 'bg-green-500/20 border-green-500' : 'bg-slate-800 border-slate-700'
                        }`}>
                          <Users size={20} className={profile?.teamId === team.teamId ? 'text-green-400' : 'text-slate-500'} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-50">{team.teamName}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{team.role}</p>
                        </div>
                      </div>

                      {profile?.teamId === team.teamId ? (
                        <div className="px-3 py-1 rounded-full bg-green-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-lg shadow-green-500/20">
                          Active
                        </div>
                      ) : (
                        <button
                          onClick={() => switchTeam(team.teamId)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-50 transition-all text-[10px] font-bold uppercase tracking-widest border border-slate-700"
                        >
                          <RefreshCw size={14} />
                          Switch
                        </button>
                      )}
                    </div>
                  ))}
                  {(!profile?.joinedTeams || profile.joinedTeams.length === 0) && (
                    <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 border-dashed">
                      <Users size={40} className="mx-auto text-slate-700 mb-4" />
                      <p className="text-slate-500 font-medium">You haven't joined any teams yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showNewSeasonModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 w-full max-w-md shadow-2xl"
            >
              <h2 className="text-2xl font-black text-slate-50 uppercase italic font-display tracking-tight mb-2">Start New Season</h2>
              <p className="text-slate-400 text-sm mb-6">
                Enter a name for the new season (e.g. 26/27). Past data will still be accessible, and all current players, notes, and team settings will be carried over.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">New Season Tag</label>
                  <input
                    type="text"
                    value={newSeasonName}
                    onChange={(e) => setNewSeasonName(e.target.value)}
                    placeholder="e.g. 26/27"
                    autoFocus
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowNewSeasonModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartNewSeason}
                    disabled={!newSeasonName}
                    className="flex-1 px-4 py-3 bg-green-500 text-slate-950 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-400 transition-colors"
                  >
                    Start Season
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmRemove.isOpen}
        title="Remove Member"
        message={`Are you sure you want to remove ${confirmRemove.name} from the team? They will need to re-onboard to join again.`}
        onConfirm={confirmRemoveMember}
        onCancel={() => setConfirmRemove({ isOpen: false, userId: '', name: '' })}
      />
      {/* Toast Notification */}
      <AnimatePresence>
        {saveToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-500 text-slate-950 px-6 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-2 z-50 w-max max-w-[90vw]"
          >
            <Zap size={20} />
            Season settings saved successfully!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
