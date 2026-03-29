import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, collection, query, where, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, MapPin, Clock, ArrowLeft, Check, X, HelpCircle, Navigation, Users, FileText, UserCheck, AlertCircle, Goal, ArrowLeftRight, AlertTriangle, UserMinus } from 'lucide-react';
import { motion } from 'motion/react';

export function ScheduleDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [match, setMatch] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [availabilities, setAvailabilities] = useState<Record<string, any>>({});
  const [attendances, setAttendances] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [trainingNotes, setTrainingNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (!id || !profile?.teamId) return;

    // Fetch match details
    const matchRef = doc(db, 'matches', id);
    const unsubMatch = onSnapshot(matchRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMatch({ id: docSnap.id, ...data });
        if (data.trainingNotes && !trainingNotes) {
          setTrainingNotes(data.trainingNotes);
        }
      } else {
        navigate('/'); // Match not found
      }
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, `matches/${id}`));

    // Fetch all players for the team
    const playersRef = collection(db, 'players');
    const qPlayers = query(playersRef, where('teamId', '==', profile.teamId));
    const unsubPlayers = onSnapshot(qPlayers, (snapshot) => {
      setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'players'));

    // Fetch availabilities for this match
    const availRef = collection(db, 'availabilities');
    const qAvail = query(availRef, where('matchId', '==', id));
    const unsubAvail = onSnapshot(qAvail, (snapshot) => {
      const availData: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        availData[data.playerId] = { id: doc.id, ...data };
      });
      setAvailabilities(availData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'availabilities'));

    // Fetch attendances for this match
    const attendanceRef = collection(db, 'attendances');
    const qAttendance = query(attendanceRef, where('matchId', '==', id));
    const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
      const attData: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        attData[data.playerId] = { id: doc.id, ...data };
      });
      setAttendances(attData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendances'));

    return () => {
      unsubMatch();
      unsubPlayers();
      unsubAvail();
      unsubAttendance();
    };
  }, [id, profile?.teamId, navigate]);

  const handleSetAvailability = async (playerId: string, status: 'going' | 'not-going' | 'maybe') => {
    if (!profile?.uid || !profile?.teamId || !match?.id) return;
    
    const existing = availabilities[playerId];

    try {
      if (existing) {
        await setDoc(doc(db, 'availabilities', existing.id), { status, parentId: profile.uid }, { merge: true });
      } else {
        await setDoc(doc(db, 'availabilities', `${match.id}_${playerId}`), {
          matchId: match.id,
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

  const handleSetAttendance = async (playerId: string, status: 'present' | 'late' | 'absent') => {
    if (!profile?.uid || !profile?.teamId || !match?.id) return;
    
    const existing = attendances[playerId];

    try {
      if (existing) {
        await setDoc(doc(db, 'attendances', existing.id), { status }, { merge: true });
      } else {
        await setDoc(doc(db, 'attendances', `${match.id}_${playerId}`), {
          matchId: match.id,
          playerId,
          teamId: profile.teamId,
          status
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'attendances');
    }
  };

  const handleSaveNotes = async () => {
    if (!match?.id) return;
    setSavingNotes(true);
    try {
      await updateDoc(doc(db, 'matches', match.id), {
        trainingNotes
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${match.id}`);
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!match) return null;

  // Group players by status
  const confirmedPlayers = players.filter(p => availabilities[p.id]?.status === 'going');
  const notGoingPlayers = players.filter(p => availabilities[p.id]?.status === 'not-going');
  const maybePlayers = players.filter(p => availabilities[p.id]?.status === 'maybe');
  const pendingPlayers = players.filter(p => !availabilities[p.id]);

  const isCoach = profile?.role === 'coach';
  const myPlayers = players.filter(p => p.parentIds?.includes(profile?.uid));

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={20} />
        <span>Back to Schedule</span>
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
      >
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none ${match.type === 'match' ? 'bg-green-500/5' : 'bg-blue-500/5'}`} />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md inline-block ${match.type === 'match' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
              {match.type === 'match' ? 'Match' : 'Training Session'}
            </span>
            {match.type === 'match' && match.matchCategory && (
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md inline-block bg-slate-800 text-slate-300">
                {match.matchCategory.replace('-', ' ')}
              </span>
            )}
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
            {match.type === 'match' ? `vs ${match.opponent}` : 'Training Session'}
          </h1>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-1.5 text-green-400 bg-green-500/10 px-3 py-1.5 rounded-lg text-sm font-bold">
              <Check size={16} />
              <span>{confirmedPlayers.length} Conf.</span>
            </div>
            <div className="flex items-center gap-1.5 text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded-lg text-sm font-bold">
              <HelpCircle size={16} />
              <span>{maybePlayers.length} Maybe</span>
            </div>
            <div className="flex items-center gap-1.5 text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg text-sm font-bold">
              <X size={16} />
              <span>{notGoingPlayers.length} Can't Go</span>
            </div>
          </div>

          {match.type === 'match' && (match.status === 'in-progress' || match.status === 'completed') && (
            <div className="flex items-center gap-6 mb-8 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 w-max">
              <div className="text-center">
                <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Us</div>
                <div className="text-4xl font-black text-white">{match.scoreUs || 0}</div>
              </div>
              <div className="text-2xl font-black text-slate-700">-</div>
              <div className="text-center">
                <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">{match.opponent}</div>
                <div className="text-4xl font-black text-white">{match.scoreThem || 0}</div>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center shrink-0 border border-slate-800">
                <Clock size={20} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium mb-1">Date & Time</p>
                <p className="text-white font-semibold">{format(new Date(match.date), 'EEEE, MMMM d, yyyy')}</p>
                <p className="text-slate-300">{format(new Date(match.date), 'h:mm a')}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center shrink-0 border border-slate-800">
                <MapPin size={20} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium mb-1">Location</p>
                <p className="text-white font-semibold">{match.location || 'TBD'}</p>
                {match.postcode && (
                  <div className="mt-2">
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.postcode)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors font-medium"
                    >
                      <Navigation size={14} />
                      {match.postcode.toUpperCase()}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Parent/Coach View: Set Availability */}
      {(isCoach || myPlayers.length > 0) && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
        >
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Users size={20} className="text-slate-400" />
            {isCoach ? "Set Player Availability" : "Your Players' Availability"}
          </h2>
          <div className="space-y-4">
            {(isCoach ? players : myPlayers).map(player => {
              const status = availabilities[player.id]?.status;
              return (
                <div key={player.id} className="flex items-center justify-between gap-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-base font-medium text-white truncate">{player.name}</span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleSetAvailability(player.id, 'going')}
                      className={`flex items-center justify-center p-2.5 rounded-lg transition-colors ${status === 'going' ? 'bg-green-500 text-slate-950' : 'bg-slate-800 text-green-500 hover:bg-slate-700'}`}
                      title="Going"
                    >
                      <Check size={20} />
                    </button>
                    <button
                      onClick={() => handleSetAvailability(player.id, 'maybe')}
                      className={`flex items-center justify-center p-2.5 rounded-lg transition-colors ${status === 'maybe' ? 'bg-yellow-500 text-slate-950' : 'bg-slate-800 text-yellow-500 hover:bg-slate-700'}`}
                      title="Maybe"
                    >
                      <HelpCircle size={20} />
                    </button>
                    <button
                      onClick={() => handleSetAvailability(player.id, 'not-going')}
                      className={`flex items-center justify-center p-2.5 rounded-lg transition-colors ${status === 'not-going' ? 'bg-red-500 text-white' : 'bg-slate-800 text-red-500 hover:bg-slate-700'}`}
                      title="Can't Go"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Coach View: Training Notes and Attendance */}
      {isCoach && match.type === 'training' && (
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileText size={20} className="text-slate-400" />
              Training Session Notes
            </h2>
            <div className="space-y-4">
              <textarea
                value={trainingNotes}
                onChange={(e) => setTrainingNotes(e.target.value)}
                placeholder="Add notes about what was covered in this training session, overall team performance, etc."
                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <UserCheck size={20} className="text-slate-400" />
              Player Attendance & Notes
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Mark attendance for this session. Click on a player's name to view their profile and add individual notes.
            </p>
            <div className="space-y-3">
              {players.map(player => {
                const status = attendances[player.id]?.status;
                return (
                  <div key={player.id} className="flex items-center justify-between gap-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <button 
                      onClick={() => navigate(`/player/${player.id}`)}
                      className="text-base font-medium text-white hover:text-blue-400 transition-colors text-left flex items-center gap-2 truncate"
                    >
                      <span className="truncate">{player.name}</span>
                    </button>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleSetAttendance(player.id, 'present')}
                        className={`flex items-center justify-center p-2.5 rounded-lg transition-colors ${status === 'present' ? 'bg-green-500 text-slate-950' : 'bg-slate-800 text-green-500 hover:bg-slate-700'}`}
                        title="Present"
                      >
                        <Check size={20} />
                      </button>
                      <button
                        onClick={() => handleSetAttendance(player.id, 'late')}
                        className={`flex items-center justify-center p-2.5 rounded-lg transition-colors ${status === 'late' ? 'bg-yellow-500 text-slate-950' : 'bg-slate-800 text-yellow-500 hover:bg-slate-700'}`}
                        title="Late"
                      >
                        <AlertCircle size={20} />
                      </button>
                      <button
                        onClick={() => handleSetAttendance(player.id, 'absent')}
                        className={`flex items-center justify-center p-2.5 rounded-lg transition-colors ${status === 'absent' ? 'bg-red-500 text-white' : 'bg-slate-800 text-red-500 hover:bg-slate-700'}`}
                        title="Absent"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}

      {/* Match Timeline */}
      {match.type === 'match' && (match.status === 'in-progress' || match.status === 'completed') && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
        >
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock size={20} className="text-slate-400" />
            Match Timeline
          </h2>
          <div className="space-y-3">
            {(!match.events || match.events.length === 0) ? (
              <p className="text-slate-500 text-sm text-center py-4">No events recorded.</p>
            ) : (
              [...match.events].reverse().map((event: any, idx) => (
                <div key={event.id || idx} className="flex items-center gap-4 text-sm border-b border-slate-800/50 pb-3 last:border-0 last:pb-0">
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
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* Roster Availability Overview */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid md:grid-cols-3 gap-6"
      >
        {/* Confirmed */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-green-400 flex items-center gap-2">
              <Check size={18} />
              Confirmed
            </h3>
            <span className="bg-green-500/10 text-green-400 px-2.5 py-0.5 rounded-full text-sm font-bold">
              {confirmedPlayers.length}
            </span>
          </div>
          {confirmedPlayers.length > 0 ? (
            <ul className="space-y-2">
              {confirmedPlayers.map(p => (
                <li key={p.id} className="text-slate-300 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800/50">
                  {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 text-sm italic">No players confirmed yet.</p>
          )}
        </div>

        {/* Not Going & Maybe */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-red-400 flex items-center gap-2">
              <X size={18} />
              Not Going
            </h3>
            <span className="bg-red-500/10 text-red-400 px-2.5 py-0.5 rounded-full text-sm font-bold">
              {notGoingPlayers.length}
            </span>
          </div>
          {notGoingPlayers.length > 0 ? (
            <ul className="space-y-2 mb-6">
              {notGoingPlayers.map(p => (
                <li key={p.id} className="text-slate-300 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800/50">
                  {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 text-sm italic mb-6">None.</p>
          )}

          <div className="flex items-center justify-between mb-4 pt-4 border-t border-slate-800">
            <h3 className="font-bold text-yellow-400 flex items-center gap-2">
              <HelpCircle size={18} />
              Maybe
            </h3>
            <span className="bg-yellow-500/10 text-yellow-400 px-2.5 py-0.5 rounded-full text-sm font-bold">
              {maybePlayers.length}
            </span>
          </div>
          {maybePlayers.length > 0 ? (
            <ul className="space-y-2">
              {maybePlayers.map(p => (
                <li key={p.id} className="text-slate-300 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800/50">
                  {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 text-sm italic">None.</p>
          )}
        </div>

        {/* Pending / No Response */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-400 flex items-center gap-2">
              <Clock size={18} />
              Pending
            </h3>
            <span className="bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full text-sm font-bold">
              {pendingPlayers.length}
            </span>
          </div>
          {pendingPlayers.length > 0 ? (
            <ul className="space-y-2">
              {pendingPlayers.map(p => (
                <li key={p.id} className="text-slate-500 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800/50">
                  {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 text-sm italic">All players have responded.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
