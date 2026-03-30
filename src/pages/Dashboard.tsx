import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, MapPin, Clock, Plus, Trash2, Check, X, HelpCircle, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
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
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [availabilities, setAvailabilities] = useState<Record<string, Availability>>({});
  const [players, setPlayers] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
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
    if (!profile?.teamId) return;

    try {
      if (newMatch.type === 'training' && isRecurring) {
        const promises = [];
        let currentDate = new Date(newMatch.date!);
        for (let i = 0; i < occurrences; i++) {
          promises.push(addDoc(collection(db, 'matches'), {
            ...newMatch,
            date: currentDate.toISOString().slice(0, 16),
            teamId: profile.teamId,
          }));
          currentDate.setDate(currentDate.getDate() + repeatDays);
        }
        await Promise.all(promises);
      } else {
        await addDoc(collection(db, 'matches'), {
          ...newMatch,
          teamId: profile.teamId,
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Schedule</h1>
        {profile?.role === 'coach' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-500 hover:bg-green-400 text-slate-950 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Add Event</span>
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
        <button 
          onClick={() => setFilter('all')} 
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === 'all' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
        >
          All Events
        </button>
        <button 
          onClick={() => setFilter('match')} 
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === 'match' ? 'bg-green-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
        >
          Matches
        </button>
        <button 
          onClick={() => setFilter('training')} 
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === 'training' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
        >
          Training
        </button>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarIcon size={32} className="text-slate-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No events found</h3>
          <p className="text-slate-400">
            {profile?.role === 'coach' 
              ? "Time to schedule the next training session or match!" 
              : "Check back later for the schedule."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedMatches).map(([month, monthMatches]: [string, Match[]]) => (
            <div key={month} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleMonth(month)}
                className="w-full px-6 py-4 flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-white">{month}</h2>
                  <span className="bg-slate-700 text-slate-300 text-xs font-bold px-2.5 py-1 rounded-full">
                    {monthMatches.length}
                  </span>
                </div>
                {expandedMonths[month] ? (
                  <ChevronUp size={20} className="text-slate-400" />
                ) : (
                  <ChevronDown size={20} className="text-slate-400" />
                )}
              </button>
              
              {expandedMonths[month] && (
                <div className="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {monthMatches.map((match) => (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-4 relative overflow-hidden group flex flex-col"
                    >
                      <div className={`absolute top-0 left-0 w-1 h-full ${match.type === 'match' ? 'bg-green-500' : 'bg-blue-500'}`} />
                      
                      <div className="flex justify-between items-start mb-3 pl-2">
                        <div 
                          className="cursor-pointer group-hover:text-green-400 transition-colors flex-1"
                          onClick={() => navigate(`/schedule/${match.id}`)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${match.type === 'match' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                              {match.type}
                            </span>
                            {match.type === 'match' && match.matchCategory && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                {match.matchCategory.replace('-', ' ')}
                              </span>
                            )}
                            {match.type === 'match' && (match.status === 'in-progress' || match.status === 'completed') && (
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${match.status === 'in-progress' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-slate-800 text-slate-300'}`}>
                                {match.scoreUs || 0} - {match.scoreThem || 0}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-base font-bold text-white group-hover:text-green-400 transition-colors leading-tight">
                              {match.type === 'match' ? `vs ${match.opponent}` : 'Training Session'}
                            </h3>
                            <ChevronRight size={14} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        {profile?.role === 'coach' && (
                          <button 
                            onClick={() => handleDeleteMatch(match.id)}
                            className="text-slate-500 hover:text-red-400 transition-colors p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-400 mb-4 pl-2">
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} className="text-slate-500 shrink-0" />
                          <span>{format(new Date(match.date), 'MMM d, yyyy • h:mm a')}</span>
                        </div>
                        {match.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={14} className="text-slate-500 shrink-0" />
                            <span className="truncate">{match.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Availability Section */}
                      <div className="border-t border-slate-800/50 pt-3 mt-auto pl-2">
                        {profile?.role === 'parent' ? (
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Set Availability</h4>
                            {players.map(player => {
                              const status = availabilities[`${match.id}_${player.id}`]?.status;
                              return (
                                <div key={player.id} className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-slate-300 truncate pr-2">{player.name}</span>
                                  <div className="flex gap-0.5 bg-slate-900 p-0.5 rounded-md shrink-0">
                                    <button
                                      onClick={() => handleSetAvailability(match.id, player.id, 'going')}
                                      className={`p-1 rounded transition-colors ${status === 'going' ? 'bg-green-500/20 text-green-400' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                      <Check size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleSetAvailability(match.id, player.id, 'maybe')}
                                      className={`p-1 rounded transition-colors ${status === 'maybe' ? 'bg-yellow-500/20 text-yellow-400' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                      <HelpCircle size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleSetAvailability(match.id, player.id, 'not-going')}
                                      className={`p-1 rounded transition-colors ${status === 'not-going' ? 'bg-red-500/20 text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {players.length === 0 && (
                              <p className="text-[10px] text-yellow-400">Add a player in the Squad tab first.</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">Confirmed:</span>
                            <span className="font-bold text-white">
                              {Object.values(availabilities).filter((a: any) => a.matchId === match.id && a.status === 'going').length}
                            </span>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-xl font-bold text-white mb-4">Schedule Event</h2>
            <form onSubmit={handleAddMatch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Event Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewMatch({ ...newMatch, type: 'match' })}
                    className={`flex-1 py-3 rounded-lg font-medium transition-colors ${newMatch.type === 'match' ? 'bg-green-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}
                  >
                    Match
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewMatch({ ...newMatch, type: 'training' })}
                    className={`flex-1 py-3 rounded-lg font-medium transition-colors ${newMatch.type === 'training' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                  >
                    Training
                  </button>
                </div>
              </div>

              {newMatch.type === 'match' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Match Type</label>
                    <select
                      value={newMatch.matchCategory || 'league'}
                      onChange={(e) => setNewMatch({ ...newMatch, matchCategory: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
                    >
                      <option value="league">League Game</option>
                      <option value="cup">Cup Game</option>
                      <option value="friendly">Friendly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Opponent</label>
                    <input
                      type="text"
                      value={newMatch.opponent || ''}
                      onChange={(e) => setNewMatch({ ...newMatch, opponent: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={newMatch.date}
                  onChange={(e) => setNewMatch({ ...newMatch, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
                  required
                />
              </div>

              {newMatch.type === 'training' && (
                <div className="space-y-4 border border-slate-800 rounded-lg p-4 bg-slate-950/50">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-800 text-green-500 focus:ring-green-500 bg-slate-900"
                    />
                    <span className="text-sm font-medium text-slate-300">Repeat this training session</span>
                  </label>
                  
                  {isRecurring && (
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Repeat every (days)</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={repeatDays}
                          onChange={(e) => setRepeatDays(parseInt(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-3 text-white focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Occurrences</label>
                        <input
                          type="number"
                          min="2"
                          max="20"
                          value={occurrences}
                          onChange={(e) => setOccurrences(parseInt(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-3 text-white focus:outline-none focus:border-green-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Location</label>
                <input
                  type="text"
                  value={newMatch.location || ''}
                  onChange={(e) => setNewMatch({ ...newMatch, location: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
                  placeholder="e.g. Home Pitch 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Postcode</label>
                <input
                  type="text"
                  value={newMatch.postcode || ''}
                  onChange={(e) => setNewMatch({ ...newMatch, postcode: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500 uppercase"
                  placeholder="e.g. SW1A 1AA"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-500 hover:bg-green-400 text-slate-950 py-3 rounded-lg font-bold transition-colors"
                >
                  Schedule
                </button>
              </div>
            </form>
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
