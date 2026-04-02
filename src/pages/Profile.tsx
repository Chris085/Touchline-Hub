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
  MessageSquare,
  Newspaper,
  Settings,
  LogOut,
  UserX,
  Calendar
} from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, getDoc } from 'firebase/firestore';
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
  const { profile, signOut, deleteProfile, isSubscribed } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'activity' | 'season'>('overview');
  const [teamData, setTeamData] = useState<any>(null);
  const [seasonSettings, setSeasonSettings] = useState({
    seasonStart: '',
    seasonEnd: '',
    seasonTag: '',
    halfDuration: 20
  });
  const [isSavingSeason, setIsSavingSeason] = useState(false);
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
          halfDuration: data.halfDuration || 20
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

    // Fetch recent activity
    const newsQuery = query(
      collection(db, 'newsPosts'),
      where('teamId', '==', profile.teamId),
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    const chatQuery = query(
      collection(db, 'chatMessages'),
      where('teamId', '==', profile.teamId),
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    const unsubscribeNews = onSnapshot(newsQuery, (snapshot) => {
      const newsItems: ActivityItem[] = snapshot.docs.map(doc => ({
        id: doc.id,
        type: 'news',
        title: 'New Post',
        description: doc.data().content.substring(0, 50) + '...',
        timestamp: doc.data().createdAt,
        icon: Newspaper
      }));
      setActivities(prev => {
        const filtered = prev.filter(a => a.type !== 'news');
        return [...filtered, ...newsItems].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
      });
    });

    const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
      const chatItems: ActivityItem[] = snapshot.docs.map(doc => ({
        id: doc.id,
        type: 'chat',
        title: `Message from ${doc.data().senderName}`,
        description: doc.data().content.substring(0, 50) + '...',
        timestamp: doc.data().createdAt,
        icon: MessageSquare
      }));
      setActivities(prev => {
        const filtered = prev.filter(a => a.type !== 'chat');
        return [...filtered, ...chatItems].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
      });
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
      unsubscribeNews();
      unsubscribeChat();
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
      await updateDoc(userRef, {
        teamId: null,
        role: null // Reset role so they have to re-onboard
      });
      setConfirmRemove({ isOpen: false, userId: '', name: '' });
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member. Please try again.');
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole
      });
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
      alert('Season settings saved successfully!');
    } catch (error) {
      console.error('Error saving season settings:', error);
      alert('Failed to save season settings.');
    } finally {
      setIsSavingSeason(false);
    }
  };

  const isSubscriptionOwner = !!profile?.stripeCustomerId;
  const isCoach = profile?.role === 'coach';

  // Filter team members based on role
  const visibleMembers = teamMembers.filter(m => {
    if (m.uid === profile?.uid) return false; // Don't show self in list
    if (isSubscriptionOwner) return true; // Owner sees everyone
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
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-1">{profile?.displayName || 'User'}</h1>
            <div className="flex flex-wrap justify-center sm:justify-start gap-3 items-center">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider border border-slate-700">
                <Shield size={12} className={isCoach ? "text-green-400" : "text-blue-400"} />
                {profile?.role}
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
              className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-700"
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
            activeTab === 'overview' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Overview
        </button>
        {(isCoach || isSubscriptionOwner) && (
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'team' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Team Management
          </button>
        )}
        {isCoach && (
          <button
            onClick={() => setActiveTab('season')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'season' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Season Setup
          </button>
        )}
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'activity' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
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
                    <h3 className="text-lg font-bold text-white">Subscription</h3>
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
                      <p className="text-white font-bold">
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
                    <h3 className="text-lg font-bold text-white">Quick Stats</h3>
                    <Activity size={20} className="text-slate-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-center">
                      <p className="text-2xl font-black text-white">{teamMembers.length}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Members</p>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-center">
                      <p className="text-2xl font-black text-white">{activities.length}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Activities</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Preview */}
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Recent Activity</h3>
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
                          <p className="text-xs font-bold text-white truncate">{activity.title}</p>
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
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
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
                <h3 className="text-lg font-bold text-white">Team Members</h3>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{visibleMembers.length} Connected</span>
              </div>

              {visibleMembers.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {visibleMembers.map((member) => (
                    <div 
                      key={member.uid}
                      className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 overflow-hidden border border-slate-700">
                          {member.photoURL ? (
                            <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <UserIcon size={20} />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white">{member.displayName || 'Anonymous'}</p>
                          <div className="flex items-center gap-2">
                            {isSubscriptionOwner ? (
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
                            <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                            <span className="text-[10px] text-slate-500">{member.email}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
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
                        {isSubscriptionOwner && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handleRemoveMember(member.uid, member.displayName);
                            }}
                            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                            title="Remove from Team"
                          >
                            <UserX size={16} />
                          </button>
                        )}
                        <ChevronRight size={18} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
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
                  <h3 className="text-lg font-bold text-white">Season Configuration</h3>
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
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Season End Date</label>
                      <input
                        type="date"
                        value={seasonSettings.seasonEnd}
                        onChange={(e) => setSeasonSettings({ ...seasonSettings, seasonEnd: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                    <p className="text-[10px] text-slate-500 italic">Default duration for each half in the match controller.</p>
                  </div>

                  <button
                    onClick={handleSaveSeason}
                    disabled={isSavingSeason}
                    className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:bg-slate-700 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
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
                <h4 className="text-sm font-bold text-white mb-2">Current Season Info</h4>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-slate-800 text-green-400">
                    <Zap size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Active Season</p>
                    <p className="text-lg font-black text-white italic font-display">{seasonSettings.seasonTag || 'Not Set'}</p>
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
                <h3 className="text-lg font-bold text-white">Recent Activity</h3>
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
                            <p className="font-bold text-white text-sm">{activity.title}</p>
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
        </AnimatePresence>
      </div>

      <ConfirmModal
        isOpen={confirmRemove.isOpen}
        title="Remove Member"
        message={`Are you sure you want to remove ${confirmRemove.name} from the team? They will need to re-onboard to join again.`}
        onConfirm={confirmRemoveMember}
        onCancel={() => setConfirmRemove({ isOpen: false, userId: '', name: '' })}
      />
    </div>
  );
}
