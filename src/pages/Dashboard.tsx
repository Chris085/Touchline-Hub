import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, setDoc, deleteDoc, orderBy, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { format } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar as CalendarIcon, MapPin, Clock, Plus, Trash2, Check, X, HelpCircle, ChevronRight, ChevronDown, ChevronUp, Pencil, Users, Trophy, Activity, LayoutGrid, Zap, BarChart3 } from 'lucide-react';
import { motion } from 'motion/react';

interface Match {
  id: string;
  teamId: string;
  type: 'match' | 'training';
  matchCategory?: 'league' | 'cup' | 'friendly';
  opponent?: string;
  date: string;
  location?: string;
  postcode?: string;
  status: 'scheduled' | 'in-progress' | 'completed';
  scoreUs?: number;
  scoreThem?: number;
  season?: string;
}

interface Availability {
  id: string;
  matchId: string;
  playerId: string;
  parentId: string;
  status: 'going' | 'not-going' | 'maybe';
}

import { ConfirmModal } from '../components/ConfirmModal';

export function Dashboard() {
  const { profile, isSubscribed } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [matches, setMatches] = useState<Match[]>([]);
  const [availabilities, setAvailabilities] = useState<Record<string, Availability>>({});
  const [players, setPlayers] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [teamData, setTeamData] = useState<any>(null);

  useEffect(() => {
    if (!profile?.teamId) return;

    // Fetch team data
    const fetchTeam = async () => {
      const teamRef = doc(db, 'teams', profile.teamId);
      const teamSnap = await getDoc(teamRef);
      if (teamSnap.exists()) {
        setTeamData(teamSnap.data());
      }
    };
    fetchTeam();
    if (searchParams.get('add') === 'true') {
      setShowAddModal(true);
      // Clean up the URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('add');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const isAdmin = profile?.email === 'chrisjeal9@gmail.com' || profile?.email === 'cjeal85@gmail.com';
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [filter, setFilter] = useState<'all' | 'match' | 'training'>('all');
  const [newMatch, setNewMatch] = useState<Partial<Match>>({
    type: 'match',
    matchCategory: 'league',
    status: 'scheduled',
    date: new Date().toISOString().slice(0, 16)
  });
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatDays, setRepeatDays] = useState(7);
  const [occurrences, setOccurrences] = useState(4);
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
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!profile?.teamId) return;

    // Fetch matches
    const matchesRef = collection(db, 'matches');
    const qMatches = query(matchesRef, where('teamId', '==', profile.teamId));
    
    const unsubMatches = onSnapshot(qMatches, (snapshot) => {
      const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
      // Sort client-side to avoid needing a composite index initially
      matchesData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setMatches(matchesData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'matches'));

    // Fetch players for this parent or all players for coach
    const playersRef = collection(db, 'players');
    const qPlayers = profile.role === 'coach' 
      ? query(playersRef, where('teamId', '==', profile.teamId))
      : query(playersRef, where('parentIds', 'array-contains', profile.uid));

    const unsubPlayers = onSnapshot(qPlayers, (snapshot) => {
      setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'players'));

    return () => {
      unsubMatches();
      unsubPlayers();
    };
  }, [profile?.teamId, profile?.role, profile?.uid]);

  useEffect(() => {
    if (!profile?.teamId || matches.length === 0) return;

    // Fetch availabilities
    const availRef = collection(db, 'availabilities');
    const qAvail = query(availRef, where('teamId', '==', profile.teamId));

    const unsubAvail = onSnapshot(qAvail, (snapshot) => {
      const availData: Record<string, Availability> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as Availability;
        availData[`${data.matchId}_${data.playerId}`] = { id: doc.id, ...data };
      });
      setAvailabilities(availData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'availabilities'));

    return () => unsubAvail();
  }, [profile?.teamId, matches]);

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.teamId || !isSubscribed) return;

    try {
      if (newMatch.type === 'training' && isRecurring) {
        const promises = [];
        let currentDate = new Date(newMatch.date!);
        for (let i = 0; i < occurrences; i++) {
          promises.push(addDoc(collection(db, 'matches'), {
            ...newMatch,
            date: currentDate.toISOString().slice(0, 16),
            teamId: profile.teamId,
            season: teamData?.seasonTag || null
          }));
          currentDate.setDate(currentDate.getDate() + repeatDays);
        }
        await Promise.all(promises);
      } else {
        await addDoc(collection(db, 'matches'), {
          ...newMatch,
          teamId: profile.teamId,
          season: teamData?.seasonTag || null
        });
      }
      setShowAddModal(false);
      setNewMatch({ type: 'match', matchCategory: 'league', status: 'scheduled', date: new Date().toISOString().slice(0, 16) });
      setIsRecurring(false);
      setRepeatDays(7);
      setOccurrences(4);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'matches');
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Event',
      message: 'Are you sure you want to delete this event?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'matches', matchId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `matches/${matchId}`);
        }
      }
    });
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatch(match);
    setShowEditModal(true);
  };

  const handleUpdateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.teamId || !editingMatch) return;

    try {
      const { id, ...updateData } = editingMatch;
      await setDoc(doc(db, 'matches', id), updateData, { merge: true });
      setShowEditModal(false);
      setEditingMatch(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${editingMatch.id}`);
    }
  };

  const handleSetAvailability = async (matchId: string, playerId: string, status: 'going' | 'not-going' | 'maybe') => {
    if (!profile?.uid || !profile?.teamId) return;
    
    const existingKey = `${matchId}_${playerId}`;
    const existing = availabilities[existingKey];

    try {
      if (existing) {
        await setDoc(doc(db, 'availabilities', existing.id), { status, parentId: profile.uid }, { merge: true });
      } else {
        await setDoc(doc(db, 'availabilities', `${matchId}_${playerId}`), {
          matchId,
          playerId,
          parentId: profile.uid,
          teamId: profile.teamId,
          status
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'availabilities');
    }
  };

  const filteredMatches = matches.filter(m => filter === 'all' || m.type === filter);

  // Group matches by month
  const groupedMatches = filteredMatches.reduce((groups, match) => {
    const monthYear = format(new Date(match.date), 'MMMM yyyy');
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(match);
    return groups;
  }, {} as Record<string, Match[]>);

  // Initialize expanded state for the first month if not set
  useEffect(() => {
    const months = Object.keys(groupedMatches);
    if (months.length > 0 && Object.keys(expandedMonths).length === 0) {
      setExpandedMonths({ [months[0]]: true });
    }
  }, [groupedMatches]);

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));
  };

  const nextMatch = matches.find(m => m.type === 'match' && new Date(m.date) > new Date());

  return (
    <div className="space-y-8 relative pb-20">
      <div className="absolute inset-0 pitch-grid pointer-events-none opacity-5" />
      
      {/* Pitch Lines Decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.03] z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] border-[10px] border-chalk-white rounded-full -translate-y-1/2" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] border-[10px] border-chalk-white rounded-full translate-y-1/2" />
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[400px] h-[600px] border-[10px] border-chalk-white -translate-x-1/2" />
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[400px] h-[600px] border-[10px] border-chalk-white translate-x-1/2" />
      </div>

      <div className="flex justify-between items-center relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pitch-green/20 rounded-xl flex items-center justify-center border border-pitch-green/30 rotate-3">
            <Trophy size={24} className="text-pitch-green" />
          </div>
          <h1 className="text-4xl font-black text-chalk-white uppercase tracking-tighter italic font-display leading-none">Matchday</h1>
        </div>
        <div className="flex items-center gap-2">
          {profile?.role === 'coach' && !isSubscribed && (
            <button
              onClick={() => navigate('/upgrade')}
              className="px-4 py-3 bg-green-500/10 border border-green-500/20 text-green-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-500/20 transition-all flex items-center gap-2 group"
            >
              <Zap size={14} className="group-hover:scale-110 transition-transform" />
              <span>Upgrade</span>
            </button>
          )}
          <button
            onClick={() => navigate('/stats')}
            className="p-3 bg-turf-surface/20 backdrop-blur-md border border-chalk-white/10 rounded-2xl text-chalk-white/60 hover:text-pitch-green hover:border-pitch-green/30 transition-all group"
            title="Team Stats"
          >
            <BarChart3 size={20} className="group-hover:scale-110 transition-transform" />
          </button>
          <button
            onClick={() => navigate('/features')}
            className="p-3 bg-turf-surface/20 backdrop-blur-md border border-chalk-white/10 rounded-2xl text-chalk-white/60 hover:text-pitch-green hover:border-pitch-green/30 transition-all group"
            title="All Features"
          >
            <LayoutGrid size={20} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* Team Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        <div className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic">Squad Size</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-3xl font-black text-chalk-white font-display italic leading-none">{players.length}</span>
            <Users size={20} className="text-pitch-green/40" />
          </div>
        </div>
        <div className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic">Upcoming</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-3xl font-black text-chalk-white font-display italic leading-none">
              {matches.filter(m => new Date(m.date) > new Date()).length}
            </span>
            <CalendarIcon size={20} className="text-pitch-green/40" />
          </div>
        </div>
        <div className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic">Next Training</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-3xl font-black text-chalk-white font-display italic leading-none">
              {matches.filter(m => m.type === 'training' && new Date(m.date) > new Date()).length > 0 ? '1' : '0'}
            </span>
            <Activity size={20} className="text-blue-500/40" />
          </div>
        </div>
        <div className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic">Completed</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-3xl font-black text-chalk-white font-display italic leading-none">
              {matches.filter(m => m.status === 'completed').length}
            </span>
            <Trophy size={20} className="text-yellow-500/40" />
          </div>
        </div>
      </div>

      {/* Next Match Highlight */}
      {nextMatch && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-pitch-green to-blue-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition-opacity" />
          <div 
            onClick={() => navigate(`/schedule/${nextMatch.id}`)}
            className="relative bg-turf-surface/40 backdrop-blur-xl border border-chalk-white/10 rounded-[2rem] p-8 overflow-hidden cursor-pointer hover:border-pitch-green/40 transition-all"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Activity size={120} className="text-pitch-green" />
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="bg-pitch-green text-pitch-dark px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest font-display italic">Next Match</span>
                  <span className="text-chalk-white/40 text-[10px] font-black uppercase tracking-widest font-display italic">{format(new Date(nextMatch.date), 'EEEE, MMMM do')}</span>
                </div>
                <h2 className="text-5xl font-black text-chalk-white uppercase italic font-display tracking-tighter leading-none">
                  vs {nextMatch.opponent}
                </h2>
                <div className="flex items-center gap-6 text-chalk-white/60 text-xs font-bold uppercase tracking-widest font-display italic">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-pitch-green" />
                    <span>{format(new Date(nextMatch.date), 'h:mm a')}</span>
                  </div>
                  {nextMatch.location && (
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-pitch-green" />
                      <span>{nextMatch.location}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-center px-6 py-4 bg-pitch-dark/50 rounded-2xl border border-chalk-white/5 backdrop-blur-md">
                  <div className="text-3xl font-black text-pitch-green font-display italic leading-none">
                    {Object.values(availabilities).filter((a: any) => a.matchId === nextMatch.id && a.status === 'going').length}
                  </div>
                  <div className="text-[9px] font-black text-chalk-white/20 uppercase tracking-widest mt-1">Confirmed</div>
                </div>
                <div className="w-12 h-12 bg-pitch-green text-pitch-dark rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(22,163,74,0.4)] group-hover:scale-110 transition-transform">
                  <ChevronRight size={24} strokeWidth={3} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between gap-4 mb-8 relative z-10">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar flex-1">
          <button 
            onClick={() => setFilter('all')} 
            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-display italic ${filter === 'all' ? 'bg-chalk-white text-pitch-dark shadow-lg' : 'bg-chalk-white/5 text-chalk-white/40 hover:bg-chalk-white/10'}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilter('match')} 
            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-display italic ${filter === 'match' ? 'bg-pitch-green text-pitch-dark shadow-[0_0_15px_rgba(22,163,74,0.4)]' : 'bg-chalk-white/5 text-chalk-white/40 hover:bg-chalk-white/10'}`}
          >
            Matches
          </button>
          <button 
            onClick={() => setFilter('training')} 
            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-display italic ${filter === 'training' ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'bg-chalk-white/5 text-chalk-white/40 hover:bg-chalk-white/10'}`}
          >
            Training
          </button>
        </div>
        {(profile?.role === 'coach' || isAdmin) && (
          <button 
            onClick={() => {
              if (!isSubscribed) {
                navigate('/upgrade');
                return;
              }
              setShowAddModal(true);
            }}
            className={`p-2.5 ${isSubscribed ? 'bg-pitch-green shadow-pitch-green/30' : 'bg-slate-700 shadow-none'} text-pitch-dark rounded-xl shadow-[0_0_20px_rgba(22,163,74,0.3)] hover:scale-105 active:scale-95 transition-all flex-shrink-0`}
            title={isSubscribed ? "Add Entry" : "Upgrade to Add"}
          >
            {isSubscribed ? <Plus size={20} strokeWidth={3} /> : <Zap size={18} className="text-chalk-white/60" />}
          </button>
        )}
      </div>

      {filteredMatches.length === 0 ? (
        <div className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/10 rounded-[2rem] p-12 text-center relative overflow-hidden z-10">
          <div className="absolute inset-0 pitch-grid opacity-10" />
          <div className="relative z-10">
            <div className="w-16 h-16 bg-pitch-green/20 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 border border-pitch-green/30">
              <CalendarIcon size={32} className="text-pitch-green" />
            </div>
            <h3 className="text-xl font-black text-chalk-white mb-2 uppercase italic font-display tracking-tight">No events found</h3>
            <p className="text-chalk-white/40 text-xs font-bold uppercase tracking-widest">
              {profile?.role === 'coach' 
                ? "Time to schedule the next training session or match!" 
                : "Check back later for the schedule."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8 relative z-10">
          {Object.entries(groupedMatches).map(([month, monthMatches]: [string, Match[]]) => (
            <div key={month} className="space-y-4">
              <button
                onClick={() => toggleMonth(month)}
                className="w-full flex items-center justify-between group px-2"
              >
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-black text-chalk-white uppercase tracking-tighter italic font-display">{month}</h2>
                  <div className="h-px w-12 bg-pitch-green/30" />
                  <span className="text-[9px] font-black text-pitch-green uppercase tracking-widest bg-pitch-green/10 px-2 py-0.5 rounded border border-pitch-green/20 font-display italic">
                    {monthMatches.length} EVENTS
                  </span>
                </div>
                <div className="p-1.5 rounded-xl bg-chalk-white/5 text-chalk-white/40 group-hover:text-pitch-green transition-colors border border-chalk-white/5">
                  {expandedMonths[month] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>
              
              {expandedMonths[month] && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {monthMatches.map((match) => (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-[2rem] p-6 relative overflow-hidden group flex flex-col hover:border-pitch-green/30 transition-all hover:shadow-[0_0_40px_rgba(22,163,74,0.05)] cursor-pointer"
                      onClick={() => navigate(`/schedule/${match.id}`)}
                    >
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border font-display italic ${match.type === 'match' ? 'bg-pitch-green/10 text-pitch-green border-pitch-green/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                              {match.type}
                            </span>
                            {match.status === 'completed' && (
                              <span className="text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-chalk-white/5 text-chalk-white/30 border border-chalk-white/10 font-display italic">
                                Final
                              </span>
                            )}
                            {match.season && (
                              <span className="text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 font-display italic">
                                {match.season}
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-black text-chalk-white group-hover:text-pitch-green transition-colors leading-tight uppercase italic font-display tracking-tighter">
                            {match.type === 'match' ? `vs ${match.opponent}` : 'Training'}
                          </h3>
                        </div>
                        {profile?.role === 'coach' && (
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleEditMatch(match); }}
                              className="text-chalk-white/20 hover:text-pitch-green transition-colors p-2.5 bg-pitch-dark/40 rounded-xl border border-chalk-white/5"
                            >
                              <Pencil size={14} strokeWidth={3} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteMatch(match.id); }}
                              className="text-chalk-white/20 hover:text-red-400 transition-colors p-2.5 bg-pitch-dark/40 rounded-xl border border-chalk-white/5"
                            >
                              <Trash2 size={14} strokeWidth={3} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="space-y-3 mb-8">
                        <div className="flex items-center gap-3 text-[10px] font-black text-chalk-white/40 uppercase tracking-widest font-display italic">
                          <div className="w-8 h-8 rounded-lg bg-pitch-dark/50 flex items-center justify-center border border-chalk-white/5">
                            <Clock size={14} className="text-pitch-green" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-chalk-white/60">{format(new Date(match.date), 'MMM d, yyyy')}</span>
                            <span>{format(new Date(match.date), 'h:mm a')}</span>
                          </div>
                        </div>
                        {match.location && (
                          <div className="flex items-center gap-3 text-[10px] font-black text-chalk-white/40 uppercase tracking-widest font-display italic">
                            <div className="w-8 h-8 rounded-lg bg-pitch-dark/50 flex items-center justify-center border border-chalk-white/5">
                              <MapPin size={14} className="text-pitch-green" />
                            </div>
                            <span className="truncate">{match.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Availability Section */}
                      <div className="mt-auto">
                        {profile?.role === 'parent' ? (
                          <div className="space-y-4 bg-pitch-dark/30 rounded-2xl p-4 border border-chalk-white/5">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-[9px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic">Squad Selection</h4>
                              <Activity size={12} className="text-pitch-green/30" />
                            </div>
                            {players.map(player => {
                              const status = availabilities[`${match.id}_${player.id}`]?.status;
                              return (
                                <div key={player.id} className="flex items-center justify-between gap-4">
                                  <span className="text-xs font-black text-chalk-white/80 uppercase tracking-tight truncate italic font-display">{player.name}</span>
                                  <div className="flex gap-1 shrink-0">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSetAvailability(match.id, player.id, 'going'); }}
                                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${status === 'going' ? 'bg-pitch-green text-pitch-dark shadow-[0_0_15px_rgba(22,163,74,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/10 hover:text-chalk-white/30'}`}
                                    >
                                      <Check size={16} strokeWidth={4} />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSetAvailability(match.id, player.id, 'maybe'); }}
                                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${status === 'maybe' ? 'bg-yellow-500 text-pitch-dark shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/10 hover:text-chalk-white/30'}`}
                                    >
                                      <HelpCircle size={16} strokeWidth={4} />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSetAvailability(match.id, player.id, 'not-going'); }}
                                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${status === 'not-going' ? 'bg-red-500 text-pitch-dark shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/10 hover:text-chalk-white/30'}`}
                                    >
                                      <X size={16} strokeWidth={4} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex justify-between items-center bg-pitch-dark/30 rounded-2xl p-4 border border-chalk-white/5">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic">Squad Confirmed</span>
                              <span className="text-2xl font-black text-pitch-green italic font-display leading-none mt-1">
                                {Object.values(availabilities).filter((a: any) => a.matchId === match.id && a.status === 'going').length}
                              </span>
                            </div>
                            <div className="w-10 h-10 bg-pitch-green/10 rounded-xl flex items-center justify-center border border-pitch-green/20">
                              <Users size={20} className="text-pitch-green" />
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Match Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-pitch-dark/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-turf-surface/60 backdrop-blur-xl border border-chalk-white/10 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 pitch-grid opacity-10 pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-2xl font-black text-chalk-white mb-6 uppercase italic font-display tracking-tight">Schedule Event</h2>
              <form onSubmit={handleAddMatch} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Event Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewMatch({ ...newMatch, type: 'match' })}
                      className={`flex-1 py-3.5 rounded-xl font-black uppercase tracking-tight transition-all font-display italic ${newMatch.type === 'match' ? 'bg-pitch-green text-pitch-dark shadow-[0_0_15px_rgba(22,163,74,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/40 border border-chalk-white/5'}`}
                    >
                      Match
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMatch({ ...newMatch, type: 'training' })}
                      className={`flex-1 py-3.5 rounded-xl font-black uppercase tracking-tight transition-all font-display italic ${newMatch.type === 'training' ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/40 border border-chalk-white/5'}`}
                    >
                      Training
                    </button>
                  </div>
                </div>

                {newMatch.type === 'match' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Match Type</label>
                      <select
                        value={newMatch.matchCategory || 'league'}
                        onChange={(e) => setNewMatch({ ...newMatch, matchCategory: e.target.value as any })}
                        className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors appearance-none"
                      >
                        <option value="league">League Game</option>
                        <option value="cup">Cup Game</option>
                        <option value="friendly">Friendly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Opponent</label>
                      <input
                        type="text"
                        value={newMatch.opponent || ''}
                        onChange={(e) => setNewMatch({ ...newMatch, opponent: e.target.value })}
                        className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors placeholder:text-chalk-white/10"
                        required
                        placeholder="Team Name"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={newMatch.date}
                    onChange={(e) => setNewMatch({ ...newMatch, date: e.target.value })}
                    className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors"
                    required
                  />
                </div>

                {newMatch.type === 'training' && (
                  <div className="space-y-4 border border-chalk-white/10 rounded-2xl p-4 bg-pitch-dark/30">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        className="w-5 h-5 rounded-lg border-chalk-white/10 text-pitch-green focus:ring-pitch-green bg-pitch-dark"
                      />
                      <span className="text-[10px] font-black text-chalk-white/40 uppercase tracking-widest group-hover:text-chalk-white transition-colors font-display italic">Repeat Session</span>
                    </label>
                    
                    {isRecurring && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="block text-[9px] font-black text-chalk-white/20 mb-1 uppercase tracking-widest font-display italic">Every (days)</label>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={repeatDays}
                            onChange={(e) => setRepeatDays(parseInt(e.target.value))}
                            className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-3 py-2 text-chalk-white font-bold focus:outline-none focus:border-pitch-green"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-chalk-white/20 mb-1 uppercase tracking-widest font-display italic">Occurrences</label>
                          <input
                            type="number"
                            min="2"
                            max="20"
                            value={occurrences}
                            onChange={(e) => setOccurrences(parseInt(e.target.value))}
                            className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-3 py-2 text-chalk-white font-bold focus:outline-none focus:border-pitch-green"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Location</label>
                  <input
                    type="text"
                    value={newMatch.location || ''}
                    onChange={(e) => setNewMatch({ ...newMatch, location: e.target.value })}
                    className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors placeholder:text-chalk-white/10"
                    placeholder="e.g. Home Pitch 1"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Postcode</label>
                  <input
                    type="text"
                    value={newMatch.postcode || ''}
                    onChange={(e) => setNewMatch({ ...newMatch, postcode: e.target.value })}
                    className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors uppercase placeholder:text-chalk-white/10"
                    placeholder="e.g. SW1A 1AA"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-chalk-white/5 hover:bg-chalk-white/10 text-chalk-white/40 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all font-display italic"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-pitch-green hover:bg-pitch-accent text-pitch-dark py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-[0_0_20px_rgba(22,163,74,0.2)] font-display italic"
                  >
                    Schedule
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Match Modal */}
      {showEditModal && editingMatch && (
        <div className="fixed inset-0 bg-pitch-dark/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-turf-surface/60 backdrop-blur-xl border border-chalk-white/10 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 pitch-grid opacity-10 pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-2xl font-black text-chalk-white mb-6 uppercase italic font-display tracking-tight">Edit Event</h2>
              <form onSubmit={handleUpdateMatch} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Event Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingMatch({ ...editingMatch, type: 'match' })}
                      className={`flex-1 py-3.5 rounded-xl font-black uppercase tracking-tight transition-all font-display italic ${editingMatch.type === 'match' ? 'bg-pitch-green text-pitch-dark shadow-[0_0_15px_rgba(22,163,74,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/40 border border-chalk-white/5'}`}
                    >
                      Match
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMatch({ ...editingMatch, type: 'training' })}
                      className={`flex-1 py-3.5 rounded-xl font-black uppercase tracking-tight transition-all font-display italic ${editingMatch.type === 'training' ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/40 border border-chalk-white/5'}`}
                    >
                      Training
                    </button>
                  </div>
                </div>

                {editingMatch.type === 'match' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Match Type</label>
                      <select
                        value={editingMatch.matchCategory || 'league'}
                        onChange={(e) => setEditingMatch({ ...editingMatch, matchCategory: e.target.value as any })}
                        className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors appearance-none"
                      >
                        <option value="league">League Game</option>
                        <option value="cup">Cup Game</option>
                        <option value="friendly">Friendly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Opponent</label>
                      <input
                        type="text"
                        value={editingMatch.opponent || ''}
                        onChange={(e) => setEditingMatch({ ...editingMatch, opponent: e.target.value })}
                        className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors"
                        required
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={editingMatch.date}
                    onChange={(e) => setEditingMatch({ ...editingMatch, date: e.target.value })}
                    className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Location</label>
                  <input
                    type="text"
                    value={editingMatch.location || ''}
                    onChange={(e) => setEditingMatch({ ...editingMatch, location: e.target.value })}
                    className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors"
                    placeholder="e.g. Home Pitch 1"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Postcode</label>
                  <input
                    type="text"
                    value={editingMatch.postcode || ''}
                    onChange={(e) => setEditingMatch({ ...editingMatch, postcode: e.target.value })}
                    className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors uppercase"
                    placeholder="e.g. SW1A 1AA"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingMatch(null);
                    }}
                    className="flex-1 bg-chalk-white/5 hover:bg-chalk-white/10 text-chalk-white/40 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all font-display italic"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-pitch-green hover:bg-pitch-accent text-pitch-dark py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-[0_0_20px_rgba(22,163,74,0.2)] font-display italic"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

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
