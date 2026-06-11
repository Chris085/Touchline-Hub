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
  RefreshCw
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
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'activity' | 'season' | 'teams'>('overview');
  const [teamData, setTeamData] = useState<any>(null);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [seasonSettings, setSeasonSettings] = useState({
    seasonStart: '',
    seasonEnd: '',
    seasonTag: '',
    halfDuration: 20,
    maxMatchPlayers: 16
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
          seasonStart: data.seasonStart || '',
          seasonEnd: data.seasonEnd || '',
          seasonTag: data.seasonTag || '',
          halfDuration: data.halfDuration || 20,
          maxMatchPlayers: data.maxMatchPlayers || 16
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

  const handleSaveSeason = async () => {
    if (!profile?.teamId) return;
    setIsSavingSeason(true);
    try {
      const teamRef = doc(db, 'teams', profile.teamId);
      await updateDoc(teamRef, {
        ...seasonSettings
      });
      setTeamData({ ...teamData, ...seasonSettings });
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
      <div className="flex p-1 bg-slate-900 rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'overview' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Overview
        </button>
        {(isCoach || isSubscriptionOwner) && (
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'team' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Team Management
          </button>
        )}
        {isCoach && (
          <button
            onClick={() => setActiveTab('season')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'season' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Season Setup
          </button>
        )}
        <button
          onClick={() => setActiveTab('teams')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'teams' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          My Teams
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'activity' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Activity
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
                  <h3 className="text-lg font-bold text-slate-50">Season Configuration</h3>
                  <Calendar size={20} className="text-slate-500" />
                </div>

                <div className="space-y-6">
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
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-slate-800 text-green-400">
                    <Zap size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Active Season</p>
                    <p className="text-lg font-black text-slate-50 italic font-display">{seasonSettings.seasonTag || 'Not Set'}</p>
                  </div>
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
