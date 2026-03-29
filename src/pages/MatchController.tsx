import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Play, Square, Goal, ArrowLeftRight, Clock, Activity, Trash2, AlertTriangle, UserMinus } from 'lucide-react';
import { motion } from 'motion/react';

interface MatchEvent {
  id: string;
  type: 'goal' | 'sub' | 'yellow' | 'red' | 'opponent_goal';
  playerId?: string;
  playerName?: string;
  subPlayerId?: string;
  subPlayerName?: string;
  time: string;
}

import { ConfirmModal } from '../components/ConfirmModal';

export function MatchController() {
  const { profile } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [activeMatch, setActiveMatch] = useState<any | null>(null);
  const [timer, setTimer] = useState(0); // in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [showEventModal, setShowEventModal] = useState<'goal' | 'sub' | 'yellow' | 'red' | null>(null);
  const [subPlayerOff, setSubPlayerOff] = useState<any | null>(null);
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [preMatch, setPreMatch] = useState(false);
  const [availabilities, setAvailabilities] = useState<Record<string, any>>({});
  const [startingLineup, setStartingLineup] = useState<string[]>([]);
  
  useEffect(() => {
    if (profile?.role !== 'coach' || !profile?.teamId) return;

    const matchesRef = collection(db, 'matches');
    const qMatches = query(matchesRef, where('teamId', '==', profile.teamId), where('type', '==', 'match'));
    
    const unsubMatches = onSnapshot(qMatches, (snapshot) => {
      const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      matchesData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setMatches(matchesData);
      
      setActiveMatch(prev => {
        if (!prev) return null;
        const updated = matchesData.find(m => m.id === prev.id);
        return updated || prev;
      });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'matches'));

    const playersRef = collection(db, 'players');
    const qPlayers = query(playersRef, where('teamId', '==', profile.teamId));
    
    const unsubPlayers = onSnapshot(qPlayers, (snapshot) => {
      setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'players'));

    return () => {
      unsubMatches();
      unsubPlayers();
    };
  }, [profile?.role, profile?.teamId]);

  useEffect(() => {
    if (!activeMatch?.id) return;
    const availRef = collection(db, 'availabilities');
    const qAvail = query(availRef, where('matchId', '==', activeMatch.id));
    const unsubAvail = onSnapshot(qAvail, (snapshot) => {
      const availData: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        availData[data.playerId] = { id: doc.id, ...data };
      });
      setAvailabilities(availData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'availabilities'));
    return () => unsubAvail();
  }, [activeMatch?.id]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectMatch = (match: any) => {
    setActiveMatch(match);
    if (match.status === 'in-progress') {
      setPreMatch(false);
      setIsRunning(true);
      // We could try to restore timer here, but for now just start from 0 or saved time
      setTimer(match.timer || 0);
    } else {
      setPreMatch(true);
      setStartingLineup(match.onPitch || []);
    }
  };

  const toggleStartingPlayer = (playerId: string) => {
    setStartingLineup(prev => 
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    );
  };

  const handleStartMatch = async () => {
    if (!activeMatch) return;
    
    const confirmedPlayers = players.filter(p => availabilities[p.id]?.status === 'going');
    const bench = confirmedPlayers.filter(p => !startingLineup.includes(p.id)).map(p => p.id);

    try {
      await updateDoc(doc(db, 'matches', activeMatch.id), {
        status: 'in-progress',
        scoreUs: activeMatch.scoreUs || 0,
        scoreThem: activeMatch.scoreThem || 0,
        events: activeMatch.events || [],
        onPitch: startingLineup,
        onBench: bench,
        timer: 0
      });
      setPreMatch(false);
      setTimer(0);
      setIsRunning(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
    }
  };

  const handleEndMatch = async () => {
    if (!activeMatch) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'End Match',
      message: 'Are you sure you want to end this match? This will open MOTM voting.',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'matches', activeMatch.id), {
            status: 'completed',
            timer
          });
          setIsRunning(false);
          setActiveMatch(null);
          setTimer(0);
          setPreMatch(false);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
        }
      }
    });
  };

  const handleAddEvent = async (player: any, subPlayer?: any) => {
    if (!activeMatch || !showEventModal) return;

    const eventTime = formatTime(timer);
    const newEvent: MatchEvent = {
      id: Date.now().toString(),
      type: showEventModal,
      playerId: player.id,
      playerName: player.name,
      time: eventTime
    };

    if (showEventModal === 'sub' && subPlayer) {
      newEvent.subPlayerId = subPlayer.id;
      newEvent.subPlayerName = subPlayer.name;
    }

    try {
      const updates: any = {
        events: arrayUnion(newEvent)
      };

      if (showEventModal === 'goal') {
        updates.scoreUs = (activeMatch.scoreUs || 0) + 1;
      } else if (showEventModal === 'sub' && subPlayer) {
        // Let's do it manually
        const currentPitch = activeMatch.onPitch || [];
        const currentBench = activeMatch.onBench || [];
        updates.onPitch = currentPitch.filter((id: string) => id !== player.id).concat(subPlayer.id);
        updates.onBench = currentBench.filter((id: string) => id !== subPlayer.id).concat(player.id);
      }

      await updateDoc(doc(db, 'matches', activeMatch.id), updates);
      setShowEventModal(null);
      setSubPlayerOff(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
    }
  };

  const handleOpponentGoal = async () => {
    if (!activeMatch) return;
    
    const newEvent: MatchEvent = {
      id: Date.now().toString(),
      type: 'opponent_goal',
      time: formatTime(timer)
    };

    try {
      await updateDoc(doc(db, 'matches', activeMatch.id), {
        scoreThem: (activeMatch.scoreThem || 0) + 1,
        events: arrayUnion(newEvent)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
    }
  };

  const handleRemoveEvent = async (event: MatchEvent) => {
    if (!activeMatch) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'Remove Event',
      message: 'Are you sure you want to remove this event?',
      onConfirm: async () => {
        try {
          const updates: any = {
            events: (activeMatch.events || []).filter((e: MatchEvent) => {
              if (event.id && e.id) return e.id !== event.id;
              // Fallback for older events without IDs
              return e !== event;
            })
          };

          if (event.type === 'goal') {
            updates.scoreUs = Math.max(0, (activeMatch.scoreUs || 0) - 1);
          } else if (event.type === 'opponent_goal') {
            updates.scoreThem = Math.max(0, (activeMatch.scoreThem || 0) - 1);
          } else if (event.type === 'sub' && event.playerId && event.subPlayerId) {
            // Reverse sub
            const currentPitch = activeMatch.onPitch || [];
            const currentBench = activeMatch.onBench || [];
            updates.onPitch = currentPitch.filter((id: string) => id !== event.subPlayerId).concat(event.playerId);
            updates.onBench = currentBench.filter((id: string) => id !== event.playerId).concat(event.subPlayerId);
          }

          await updateDoc(doc(db, 'matches', activeMatch.id), updates);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
        }
      }
    });
  };

  if (profile?.role !== 'coach') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Activity size={48} className="text-slate-700 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Coach Access Only</h2>
        <p className="text-slate-400">Only coaches can manage live matches.</p>
      </div>
    );
  }

  if (activeMatch && preMatch) {
    const confirmedPlayers = players.filter(p => availabilities[p.id]?.status === 'going');
    
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Starting Lineup</h2>
            <button onClick={() => setActiveMatch(null)} className="text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>
          
          <div className="mb-6">
            <p className="text-slate-400 text-sm mb-4">Select the players starting the match. Unselected players will be on the bench.</p>
            <div className="space-y-2">
              {confirmedPlayers.map(player => (
                <button
                  key={player.id}
                  onClick={() => toggleStartingPlayer(player.id)}
                  className={`w-full text-left p-4 rounded-xl font-medium transition-colors flex justify-between items-center ${
                    startingLineup.includes(player.id) ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-slate-800 text-white border border-slate-700'
                  }`}
                >
                  {player.name}
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    startingLineup.includes(player.id) ? 'border-green-500 bg-green-500' : 'border-slate-600'
                  }`}>
                    {startingLineup.includes(player.id) && <div className="w-2 h-2 bg-slate-900 rounded-full" />}
                  </div>
                </button>
              ))}
              {confirmedPlayers.length === 0 && (
                <p className="text-slate-500 text-center py-4">No players have confirmed attendance.</p>
              )}
            </div>
          </div>

          <button
            onClick={handleStartMatch}
            className="w-full bg-green-500 hover:bg-green-400 text-slate-950 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <Play size={20} fill="currentColor" />
            START MATCH
          </button>
        </div>
      </div>
    );
  }

  if (activeMatch && !preMatch) {
    const onPitchPlayers = players.filter(p => (activeMatch.onPitch || []).includes(p.id));
    const onBenchPlayers = players.filter(p => (activeMatch.onBench || []).includes(p.id));

    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Match Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-blue-500" />
          
          <div className="flex items-center justify-center gap-2 text-green-400 font-mono text-4xl font-bold tracking-wider mb-6">
            <Clock size={32} className="animate-pulse" />
            {formatTime(timer)}
          </div>

          <div className="flex justify-between items-center px-4 mb-8">
            <div className="text-center flex-1">
              <div className="text-sm text-slate-400 uppercase tracking-widest mb-2">Us</div>
              <div className="text-6xl font-black text-white">{activeMatch.scoreUs || 0}</div>
            </div>
            <div className="text-4xl font-black text-slate-700 px-4">-</div>
            <div className="text-center flex-1">
              <div className="text-sm text-slate-400 uppercase tracking-widest mb-2">{activeMatch.opponent}</div>
              <div className="text-6xl font-black text-white">{activeMatch.scoreThem || 0}</div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isRunning ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30' : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'}`}
            >
              {isRunning ? <Square size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
            <button
              onClick={handleEndMatch}
              className="bg-red-500/20 text-red-500 hover:bg-red-500/30 px-6 rounded-full font-bold uppercase tracking-wider text-sm transition-colors"
            >
              End Match
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setShowEventModal('goal')}
            className="bg-green-500 hover:bg-green-400 text-slate-950 p-6 rounded-2xl font-bold flex flex-col items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg shadow-green-500/20"
          >
            <Goal size={32} />
            <span className="text-lg uppercase tracking-wider">Our Goal</span>
          </button>
          <button
            onClick={handleOpponentGoal}
            className="bg-slate-800 hover:bg-slate-700 text-white p-6 rounded-2xl font-bold flex flex-col items-center justify-center gap-3 transition-transform active:scale-95"
          >
            <Goal size={32} className="text-slate-500" />
            <span className="text-lg uppercase tracking-wider">Their Goal</span>
          </button>
          <button
            onClick={() => setShowEventModal('sub')}
            className="col-span-2 bg-blue-500 hover:bg-blue-400 text-white p-6 rounded-2xl font-bold flex flex-col items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg shadow-blue-500/20"
          >
            <ArrowLeftRight size={32} />
            <span className="text-lg uppercase tracking-wider">Substitution</span>
          </button>
          <button
            onClick={() => setShowEventModal('yellow')}
            className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 p-6 rounded-2xl font-bold flex flex-col items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg shadow-yellow-500/20"
          >
            <AlertTriangle size={32} />
            <span className="text-lg uppercase tracking-wider">Yellow Card</span>
          </button>
          <button
            onClick={() => setShowEventModal('red')}
            className="bg-red-500 hover:bg-red-400 text-white p-6 rounded-2xl font-bold flex flex-col items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg shadow-red-500/20"
          >
            <UserMinus size={32} />
            <span className="text-lg uppercase tracking-wider">Red Card</span>
          </button>
        </div>

        {/* Event Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Match Timeline</h3>
          <div className="space-y-3">
            {(!activeMatch.events || activeMatch.events.length === 0) ? (
              <p className="text-slate-500 text-sm text-center py-4">No events recorded yet.</p>
            ) : (
              [...activeMatch.events].reverse().map((event: MatchEvent, idx) => (
                <div key={event.id || idx} className="flex items-center gap-4 text-sm border-b border-slate-800/50 pb-3 last:border-0 last:pb-0 group">
                  <span className="font-mono text-slate-400 w-12">{event.time}</span>
                  
                  <div className="flex-1 flex items-center gap-3">
                    {event.type === 'goal' && <Goal size={16} className="text-green-500" />}
                    {event.type === 'opponent_goal' && <Goal size={16} className="text-slate-500" />}
                    {event.type === 'sub' && <ArrowLeftRight size={16} className="text-blue-500" />}
                    {event.type === 'yellow' && <div className="w-3 h-4 bg-yellow-500 rounded-sm" />}
                    {event.type === 'red' && <div className="w-3 h-4 bg-red-500 rounded-sm" />}
                    
                    <span className="text-white font-medium">
                      {event.type === 'opponent_goal' ? 'Opponent Goal' : event.playerName}
                      {event.type === 'sub' && <span className="text-slate-400 font-normal"> OFF, {event.subPlayerName} ON</span>}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => handleRemoveEvent(event)}
                    className="text-slate-600 hover:text-red-400 transition-colors p-2"
                    title="Remove Event"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Player Selection Modal */}
        {showEventModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 pb-safe">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white uppercase tracking-wider">
                  {showEventModal === 'sub' && !subPlayerOff ? 'Select Player Coming OFF' :
                   showEventModal === 'sub' && subPlayerOff ? 'Select Player Coming ON' :
                   `Select Player for ${showEventModal}`}
                </h2>
                <button onClick={() => { setShowEventModal(null); setSubPlayerOff(null); }} className="text-slate-500 hover:text-white">
                  <Square size={24} />
                </button>
              </div>
              
              <div className="overflow-y-auto flex-1 pr-2 space-y-2">
                {showEventModal === 'sub' && subPlayerOff ? (
                  // Select player coming ON (from bench)
                  onBenchPlayers.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleAddEvent(subPlayerOff, player)}
                      className="w-full text-left bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-xl font-medium transition-colors flex justify-between items-center"
                    >
                      {player.name}
                      <ArrowLeftRight size={18} className="text-blue-400" />
                    </button>
                  ))
                ) : (
                  // Select player coming OFF or for other events (from pitch)
                  onPitchPlayers.map(player => (
                    <button
                      key={player.id}
                      onClick={() => {
                        if (showEventModal === 'sub') {
                          setSubPlayerOff(player);
                        } else {
                          handleAddEvent(player);
                        }
                      }}
                      className="w-full text-left bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-xl font-medium transition-colors flex justify-between items-center"
                    >
                      {player.name}
                      {showEventModal === 'sub' && <ArrowLeftRight size={18} className="text-slate-500" />}
                    </button>
                  ))
                )}
                
                {((showEventModal === 'sub' && subPlayerOff && onBenchPlayers.length === 0) || 
                  ((showEventModal !== 'sub' || !subPlayerOff) && onPitchPlayers.length === 0)) && (
                  <p className="text-slate-500 text-center py-4">No players available.</p>
                )}
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

  const upcomingMatches = matches.filter(m => m.status === 'scheduled' || m.status === 'in-progress');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
          <Activity className="text-green-500" size={24} />
        </div>
        <h1 className="text-2xl font-bold text-white">Live Match Controller</h1>
      </div>

      {upcomingMatches.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <h3 className="text-xl font-semibold text-white mb-2">No active matches</h3>
          <p className="text-slate-400">Schedule a match in the Dashboard first.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {upcomingMatches.map(match => (
            <div key={match.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md inline-block ${match.status === 'in-progress' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'}`}>
                    {match.status === 'in-progress' ? 'In Progress' : 'Match'}
                  </span>
                  {match.matchCategory && (
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-slate-800 text-slate-300 inline-block">
                      {match.matchCategory.replace('-', ' ')}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-white mb-1">vs {match.opponent}</h3>
                <p className="text-slate-400 text-sm mb-6">
                  {new Date(match.date).toLocaleDateString()} • {new Date(match.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
              <button
                onClick={() => handleSelectMatch(match)}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 ${match.status === 'in-progress' ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-950' : 'bg-green-500 hover:bg-green-400 text-slate-950'}`}
              >
                <Play size={20} fill="currentColor" />
                {match.status === 'in-progress' ? 'RESUME MATCH' : 'START MATCH'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
