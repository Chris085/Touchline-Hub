import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, collection, query, where, onSnapshot, setDoc, updateDoc, addDoc, serverTimestamp, orderBy, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { triggerNotification } from '../lib/notifications';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, MapPin, Clock, ArrowLeft, Check, X, HelpCircle, Navigation, Users, FileText, UserCheck, AlertCircle, Goal, ArrowLeftRight, AlertTriangle, UserMinus, Plus, Trash2, Tag, Pencil, Trophy, Activity, Play, Shield, Edit2, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { ConfirmModal } from '../components/ConfirmModal';
import { MatchSummaryModal } from '../components/MatchSummaryModal';
import { Drill } from './TrainingLibrary';
import { OpponentSelector } from '../components/OpponentSelector';

export function ScheduleDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const [match, setMatch] = useState<any>(null);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [availabilities, setAvailabilities] = useState<Record<string, any>>({});
  const [attendances, setAttendances] = useState<Record<string, any>>({});
  const [votes, setVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [trainingNotes, setTrainingNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [sessionNotes, setSessionNotes] = useState<any[]>([]);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showMatchSummary, setShowMatchSummary] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const [newNote, setNewNote] = useState({ content: '', playerIds: [] as string[] });
  const [startingLineup, setStartingLineup] = useState<string[]>([]);
  const [isPostponing, setIsPostponing] = useState(false);
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
  const [teamName, setTeamName] = useState<string>('Your Team');
  const [maxMatchPlayers, setMaxMatchPlayers] = useState<number>(16);
  const [updateMatchLoading, setUpdateMatchLoading] = useState(false);
  const [updateMatchSuccess, setUpdateMatchSuccess] = useState(false);

  useEffect(() => {
    if (!profile?.teamId) return;
    const unsub = onSnapshot(doc(db, 'teams', profile.teamId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setTeamName(data.name || 'Your Team');
        setMaxMatchPlayers(parseInt(data.maxMatchPlayers?.toString() || '16', 10));
      }
    });
    return () => unsub();
  }, [profile?.teamId]);

  useEffect(() => {
    if (showEditModal || showNoteModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showEditModal, showNoteModal]);

  useEffect(() => {
    if (match?.onPitch) {
      setStartingLineup(match.onPitch);
    }
  }, [match?.onPitch]);

  const toggleStartingPlayer = (playerId: string) => {
    setStartingLineup(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      }
      if (prev.length >= maxMatchPlayers) {
        alert(`You can only select a maximum of ${maxMatchPlayers} players`);
        return prev;
      }
      return [...prev, playerId];
    });
  };

  const handleStartMatch = async () => {
    if (!match || !profile?.teamId) return;
    
    if (startingLineup.length > maxMatchPlayers) {
      alert(`You cannot start the match with more than ${maxMatchPlayers} players.`);
      return;
    }
    
    const confirmedPlayers = players.filter(p => availabilities[p.id]?.status === 'going');
    const bench = confirmedPlayers.filter(p => !startingLineup.includes(p.id)).map(p => p.id);

    try {
      await updateDoc(doc(db, 'matches', match.id), {
        status: 'in-progress',
        scoreUs: match.scoreUs || 0,
        scoreThem: match.scoreThem || 0,
        events: match.events || [],
        onPitch: startingLineup,
        onBench: bench,
        timerAccumulated: 0,
        isTimerRunning: true,
        timerStartTime: serverTimestamp(),
        currentHalf: 1
      });
      navigate('/live');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${match.id}`);
    }
  };

  useEffect(() => {
    if (!id || !profile?.teamId) return;

    const isCoach = profile?.role === 'coach' || profile?.email === 'chrisjeal9@gmail.com';
    if (!isCoach) return;

    const notesRef = collection(db, 'notes');
    const qNotes = query(
      notesRef,
      where('teamId', '==', profile.teamId),
      where('relatedId', '==', id),
      orderBy('createdAt', 'desc')
    );

    const unsubNotes = onSnapshot(qNotes, (snapshot) => {
      setSessionNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notes'));

    return () => unsubNotes();
  }, [id, profile?.teamId, profile?.role, profile?.email]);

  const handlePostponeMatch = async () => {
    if (!match?.id) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'Postpone Match',
      message: 'Are you sure you want to postpone this match? This will clear the date and time.',
      onConfirm: async () => {
        setIsPostponing(true);
        try {
          const originalDate = match.date ? format(new Date(match.date), 'MMM d, h:mm a') : 'TBA';
          const postponedNote = `${originalDate} - Postponed TBA`;
          await updateDoc(doc(db, 'matches', match.id), {
            status: 'postponed',
            date: '', // Clear date as requested
            postponedNote
          });
          closeConfirmModal();
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `matches/${match.id}`);
        } finally {
          setIsPostponing(false);
        }
      }
    });
  };

  const handleAddSessionNote = async () => {
    if (!profile?.uid || !profile?.teamId || !match?.id || !newNote.content.trim()) return;

    try {
      await addDoc(collection(db, 'notes'), {
        teamId: profile.teamId,
        authorId: profile.uid,
        content: newNote.content.trim(),
        type: match.type,
        relatedId: match.id,
        playerIds: newNote.playerIds,
        createdAt: serverTimestamp()
      });
      setNewNote({ content: '', playerIds: [] });
      setShowNoteModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notes');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Note',
      message: 'Are you sure you want to delete this note?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'notes', noteId));
          closeConfirmModal();
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `notes/${noteId}`);
        }
      }
    });
  };

  const toggleNotePlayerTag = (playerId: string) => {
    setNewNote(prev => ({
      ...prev,
      playerIds: prev.playerIds.includes(playerId)
        ? prev.playerIds.filter(id => id !== playerId)
        : [...prev.playerIds, playerId]
    }));
  };

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

    // Fetch drills
    const drillsRef = collection(db, 'drills');
    const qDrills = query(drillsRef, where('teamId', '==', profile.teamId));
    const unsubDrills = onSnapshot(qDrills, (snapshot) => {
      setDrills(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drill)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'drills'));

    // Fetch availabilities for this match
    const availRef = collection(db, 'availabilities');
    const qAvail = query(
      availRef, 
      where('matchId', '==', id),
      where('teamId', '==', profile.teamId)
    );
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
    const qAttendance = query(
      attendanceRef, 
      where('matchId', '==', id),
      where('teamId', '==', profile.teamId)
    );
    const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
      const attData: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        attData[data.playerId] = { id: doc.id, ...data };
      });
      setAttendances(attData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendances'));

    // Fetch POTM votes for this match
    const votesRef = collection(db, 'motmVotes');
    const qVotes = query(
      votesRef, 
      where('matchId', '==', id),
      where('teamId', '==', profile.teamId)
    );
    const unsubVotes = onSnapshot(qVotes, (snapshot) => {
      setVotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'motmVotes'));

    return () => {
      unsubMatch();
      unsubPlayers();
      unsubDrills();
      unsubAvail();
      unsubAttendance();
      unsubVotes();
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

  const handleUpdateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.teamId || !editingMatch) return;

    setUpdateMatchLoading(true);
    try {
      const { id, ...updateData } = editingMatch;
      await setDoc(doc(db, 'matches', id), updateData, { merge: true });
      
      // Trigger Notification
      await triggerNotification({
        teamId: profile.teamId,
        title: `${editingMatch.type === 'match' ? 'Match' : 'Training'} Details Changed`,
        body: `Details for ${editingMatch.type === 'match' ? `vs ${editingMatch.opponent}` : 'training session'} have been updated.`,
        data: { type: 'match_update', eventId: id, url: '/' },
        notificationType: 'matchUpdate'
      });
      
      setUpdateMatchSuccess(true);
      setTimeout(() => {
        setUpdateMatchSuccess(false);
        setShowEditModal(false);
        setEditingMatch(null);
      }, 1000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${editingMatch.id}`);
    } finally {
      setUpdateMatchLoading(false);
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

  const isCoach = profile?.role === 'coach' || isAdmin;
  const myPlayers = players.filter(p => p.parentIds?.includes(profile?.uid));

  // Calculate Parents' POTM
  const voteCounts = votes.reduce((acc: Record<string, number>, vote) => {
    acc[vote.playerId] = (acc[vote.playerId] || 0) + 1;
    return acc;
  }, {});

  const calculatedParentsPotmId = Object.entries(voteCounts).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]?.[0];
  const parentsPotmName = match?.parentPotmName || match?.parentsPotmName || players.find(p => p.id === calculatedParentsPotmId)?.name;
  const parentsPotmVotes = calculatedParentsPotmId ? voteCounts[calculatedParentsPotmId] : 0;

  return (
    <div className="min-h-screen pb-20 relative">
      <div className="absolute inset-0 pitch-grid pointer-events-none opacity-5" />
      
      <div className="space-y-8 max-w-4xl mx-auto p-4 sm:p-6">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-chalk-white/40 hover:text-pitch-green transition-colors relative z-10 font-display italic uppercase text-[10px] font-black tracking-widest"
        >
          <ArrowLeft size={16} strokeWidth={3} />
          <span>Back to Schedule</span>
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-turf-surface/30 backdrop-blur-xl border border-chalk-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden z-10"
        >
          <div className="absolute inset-0 pitch-grid opacity-10 pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border font-display italic ${match.type === 'match' ? 'bg-pitch-green/10 text-pitch-green border-pitch-green/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                {match.type === 'match' ? 'Match' : 'Training'}
              </span>
              {match.season && (
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 font-display italic">
                  {match.season}
                </span>
              )}
              {match.type === 'match' && match.matchCategory && (
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-chalk-white/5 text-chalk-white/40 border border-chalk-white/10 font-display italic">
                  {match.matchCategory}
                </span>
              )}
              {match.status === 'postponed' && (
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 font-display italic">
                  Postponed
                </span>
              )}
            </div>
            {isCoach && (
              <button
                onClick={() => {
                  setEditingMatch(match);
                  setShowEditModal(true);
                }}
                className="p-3 bg-pitch-dark/50 hover:bg-pitch-dark text-chalk-white/20 hover:text-pitch-green rounded-2xl border border-chalk-white/5 transition-all"
                title="Edit Event"
              >
                <Pencil size={20} strokeWidth={3} />
              </button>
            )}
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-chalk-white tracking-tighter mb-6 uppercase italic font-display leading-none break-words">
            {match.type === 'match' ? `vs ${match.opponent}` : 'Training Session'}
          </h1>

          <div className="flex flex-wrap items-stretch sm:items-center gap-3 mb-10">
            <div className="flex-1 sm:flex-none flex items-center gap-2 text-pitch-green bg-pitch-green/10 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-pitch-green/20 font-display italic">
              <Check size={14} strokeWidth={4} />
              <span>{confirmedPlayers.length} Confirmed</span>
            </div>
            <div className="flex-1 sm:flex-none flex items-center gap-2 text-yellow-500 bg-yellow-500/10 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-yellow-500/20 font-display italic">
              <HelpCircle size={14} strokeWidth={4} />
              <span>{maybePlayers.length} Maybe</span>
            </div>
            <div className="flex-1 sm:flex-none flex items-center gap-2 text-red-500 bg-red-500/10 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 font-display italic">
              <X size={14} strokeWidth={4} />
              <span>{notGoingPlayers.length} Unavailable</span>
            </div>
          </div>

          {match.type === 'match' && (match.status === 'in-progress' || match.status === 'completed') && (
            <div className="space-y-6 mb-10">
              <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-8 bg-pitch-dark/50 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-chalk-white/5 w-full sm:w-max backdrop-blur-md overflow-hidden">
                <div className="text-center flex-1 sm:flex-none">
                  <div className="text-[10px] text-chalk-white/20 uppercase tracking-widest mb-2 font-display italic">Us</div>
                  <div className="text-4xl sm:text-6xl font-black text-chalk-white font-display italic leading-none">{match.scoreUs || 0}</div>
                </div>
                <div className="text-2xl sm:text-4xl font-black text-pitch-green/20 font-display italic shrink-0">-</div>
                <div className="text-center flex-1 sm:flex-none min-w-0">
                  <div className="text-[10px] text-chalk-white/20 uppercase tracking-widest mb-2 font-display italic truncate sm:break-words">{match.opponent}</div>
                  <div className="text-4xl sm:text-6xl font-black text-chalk-white font-display italic leading-none">{match.scoreThem || 0}</div>
                </div>
              </div>

              {match.status === 'completed' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {match.coachPotmName && (
                    <div className="bg-pitch-green/10 border border-pitch-green/20 rounded-2xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 bg-pitch-green/20 rounded-xl flex items-center justify-center border border-pitch-green/30">
                        <Trophy size={24} className="text-pitch-green" />
                      </div>
                      <div>
                        <div className="text-[9px] font-black text-pitch-green uppercase tracking-widest mb-1 font-display italic">Coach's POTM</div>
                        <div className="text-xl font-black text-chalk-white uppercase italic font-display tracking-tight leading-none">{match.coachPotmName}</div>
                      </div>
                    </div>
                  )}
                  {parentsPotmName && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                        <Users size={24} className="text-blue-400" />
                      </div>
                      <div>
                        <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1 font-display italic">Parents' POTM</div>
                        <div className="text-xl font-black text-chalk-white uppercase italic font-display tracking-tight leading-none">{parentsPotmName}</div>
                        {parentsPotmVotes > 0 && (
                          <div className="text-[9px] text-blue-400/40 mt-1 font-black uppercase tracking-widest">{parentsPotmVotes} votes</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-pitch-dark/50 rounded-2xl flex items-center justify-center shrink-0 border border-chalk-white/5">
                <Clock size={24} className="text-pitch-green" />
              </div>
              <div>
                <p className="text-[10px] text-chalk-white/20 font-black uppercase tracking-widest mb-1 font-display italic">Kick Off</p>
                {match.status === 'postponed' && !match.date ? (
                  <div className="space-y-1">
                    <p className="text-xl font-black text-red-400 uppercase italic font-display tracking-tight leading-tight">Postponed TBA</p>
                    {match.postponedNote && (
                      <p className="text-chalk-white/40 font-bold uppercase tracking-widest text-[10px]">Original: {match.postponedNote.split(' - ')[0]}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className={`text-xl font-black uppercase italic font-display tracking-tight leading-tight ${match.status === 'postponed' ? 'text-red-400' : 'text-chalk-white'}`}>
                      {match.date ? format(new Date(match.date), 'EEEE, MMM d') : 'TBA'}
                      {match.status === 'postponed' && ' (Posposed)'}
                    </p>
                    <p className="text-chalk-white/40 font-bold uppercase tracking-widest text-[10px] mt-1">
                      {match.date ? format(new Date(match.date), 'h:mm a') : 'TBA'}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-pitch-dark/50 rounded-2xl flex items-center justify-center shrink-0 border border-chalk-white/5">
                <UserCheck size={24} className="text-pitch-green" />
              </div>
              <div>
                <p className="text-[10px] text-chalk-white/20 font-black uppercase tracking-widest mb-1 font-display italic">Meet Time</p>
                <p className="text-xl font-black text-chalk-white uppercase italic font-display tracking-tight leading-tight break-words">{match.meetTime || 'TBD'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-pitch-dark/50 rounded-2xl flex items-center justify-center shrink-0 border border-chalk-white/5">
                <MapPin size={24} className="text-pitch-green" />
              </div>
              <div>
                <p className="text-[10px] text-chalk-white/20 font-black uppercase tracking-widest mb-1 font-display italic">Location</p>
                <p className="text-xl font-black text-chalk-white uppercase italic font-display tracking-tight leading-tight break-words">{match.location || 'TBD'}</p>
                {match.postcode && (
                  <div className="mt-2">
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.postcode)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[10px] bg-pitch-green/10 text-pitch-green hover:bg-pitch-green/20 px-3 py-1.5 rounded-xl transition-all font-black uppercase tracking-widest border border-pitch-green/20 font-display italic"
                    >
                      <Navigation size={12} strokeWidth={3} />
                      {match.postcode.toUpperCase()}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {match.type === 'training' && match.drillIds?.length > 0 && (
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-pitch-dark/50 rounded-2xl flex items-center justify-center shrink-0 border border-chalk-white/5">
                  <FileText size={24} className="text-pitch-green" />
                </div>
                <div className="flex-1 w-full max-w-full overflow-hidden">
                  <p className="text-[10px] text-chalk-white/20 font-black uppercase tracking-widest mb-2 font-display italic">Training Plan</p>
                  <div className="space-y-2 max-w-full">
                    {match.drillIds.map((drillId: string) => {
                      const drill = drills.find(d => d.id === drillId);
                      if (!drill) return null;
                      return (
                        <div key={drill.id} className="bg-chalk-white/5 border border-chalk-white/10 rounded-xl p-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2 max-w-full overflow-hidden group">
                          <div className="min-w-0 pr-4">
                            <h4 className="text-sm font-black text-slate-50 uppercase tracking-tight italic font-display">{drill.title}</h4>
                            <p className="text-xs text-chalk-white/60 truncate w-full" title={drill.description}>{drill.description}</p>
                          </div>
                          {drill.url && (
                            <a 
                              href={drill.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="shrink-0 inline-flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest self-start sm:self-center"
                            >
                              <Play size={12} />
                              Video
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Coach View: Match Preparation (Starting Lineup) */}
      {isCoach && match.type === 'match' && match.status === 'scheduled' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-[2rem] p-8 relative z-10"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-chalk-white uppercase italic font-display tracking-tight flex items-center gap-3 break-words">
              <Shield size={24} className="text-pitch-green" />
              Starting Lineup
            </h2>
            <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border font-display italic ${
              startingLineup.length > maxMatchPlayers 
                ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                : startingLineup.length === maxMatchPlayers
                  ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                  : 'bg-pitch-green/10 text-pitch-green border-pitch-green/20'
            }`}>
              {startingLineup.length} / {maxMatchPlayers} SELECTED
            </div>
          </div>
          
          <p className="text-chalk-white/40 text-xs font-bold uppercase tracking-widest mb-6">
            Select the players who will start the match. Others will be on the bench.
          </p>

          <div className="grid gap-3 mb-8">
            {confirmedPlayers.map(player => {
              const isSelected = startingLineup.includes(player.id);
              const isMaxedOut = !isSelected && startingLineup.length >= maxMatchPlayers;
              
              return (
              <button
                key={player.id}
                onClick={() => toggleStartingPlayer(player.id)}
                disabled={isMaxedOut}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  isSelected 
                    ? 'bg-pitch-green/20 border-pitch-green text-pitch-green shadow-[0_0_15px_rgba(22,163,74,0.2)]' 
                    : isMaxedOut
                      ? 'bg-pitch-dark/80 border-chalk-white/5 text-chalk-white/20 cursor-not-allowed opacity-50'
                      : 'bg-pitch-dark/40 border-chalk-white/5 text-chalk-white/40 hover:border-chalk-white/20'
                }`}
              >
                <span className="text-base font-black uppercase italic font-display tracking-tight">{player.name}</span>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? 'border-pitch-green bg-pitch-green' : isMaxedOut ? 'border-chalk-white/5' : 'border-chalk-white/10'
                }`}>
                  {isSelected && <Check size={14} strokeWidth={4} className="text-pitch-dark" />}
                </div>
              </button>
              );
            })}
            {confirmedPlayers.length === 0 && (
              <div className="text-center py-8 bg-pitch-dark/30 rounded-2xl border border-dashed border-chalk-white/5">
                <p className="text-[10px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic">
                  No players have confirmed yet.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleStartMatch}
            disabled={confirmedPlayers.length === 0 || match.status === 'postponed'}
            className="w-full bg-pitch-green hover:bg-pitch-accent disabled:opacity-50 text-pitch-dark py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(22,163,74,0.3)] hover:scale-[1.02] active:scale-[0.98] font-display italic flex items-center justify-center gap-3"
          >
            <Play size={20} fill="currentColor" />
            Start Live Match
          </button>

          <button
            onClick={() => navigate(`/live?matchId=${match.id}`)}
            disabled={match.status === 'postponed'}
            className="w-full mt-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-50 py-4 rounded-2xl font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] font-display italic flex items-center justify-center gap-3 border border-slate-700"
          >
            <Edit2 size={20} />
            Manual Entry / Edit Data
          </button>

          {match.status !== 'postponed' && (
            <button
              onClick={handlePostponeMatch}
              disabled={isPostponing}
              className="w-full mt-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-4 rounded-2xl font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] font-display italic flex items-center justify-center gap-3 border border-red-500/20"
            >
              <Clock size={20} />
              {isPostponing ? 'Postponing...' : 'Postpone Match'}
            </button>
          )}
        </motion.div>
      )}

      {/* Go to Live Match button if already in progress */}
      {match.status === 'in-progress' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10"
        >
          <button
            onClick={() => navigate('/live')}
            className="w-full bg-pitch-green hover:bg-pitch-accent text-pitch-dark py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(22,163,74,0.3)] hover:scale-[1.02] active:scale-[0.98] font-display italic flex items-center justify-center gap-3"
          >
            <Activity size={20} />
            View Live Match
          </button>
        </motion.div>
      )}

      {/* Edit Match button if completed and coach */}
      {match.status === 'completed' && isCoach && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex flex-col gap-4"
        >
          <button
            onClick={() => setShowMatchSummary(true)}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] font-display italic flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(0,0,0,0.1)]"
          >
            <Share2 size={20} />
            Generate Match Summary
          </button>
          
          <button
            onClick={() => navigate(`/live?matchId=${match.id}`)}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-50 py-4 rounded-2xl font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] font-display italic flex items-center justify-center gap-3 border border-slate-700"
          >
            <Edit2 size={20} />
            Edit Match Details
          </button>
        </motion.div>
      )}

      {/* Parent/Coach View: Set Availability */}
      {(isCoach || myPlayers.length > 0) && match.type !== 'training' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-[2rem] p-8 relative z-10"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-chalk-white uppercase italic font-display tracking-tight flex items-center gap-3 break-words">
              <Users size={24} className="text-pitch-green" />
              {isCoach ? "Squad Selection" : "Your Players"}
            </h2>
            <Activity size={16} className="text-pitch-green/30" />
          </div>
          <div className="grid gap-3">
            {(isCoach ? players : myPlayers).map(player => {
              const status = availabilities[player.id]?.status;
              return (
                <div key={player.id} className="flex items-center justify-between gap-4 p-4 bg-pitch-dark/40 rounded-2xl border border-chalk-white/5">
                  <span className="text-base font-black text-chalk-white uppercase italic font-display tracking-tight break-words">{player.name}</span>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleSetAvailability(player.id, 'going')}
                      className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${status === 'going' ? 'bg-pitch-green text-pitch-dark shadow-[0_0_15px_rgba(22,163,74,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/10 hover:text-chalk-white/30'}`}
                    >
                      <Check size={20} strokeWidth={4} className="scale-75 sm:scale-100" />
                    </button>
                    <button
                      onClick={() => handleSetAvailability(player.id, 'maybe')}
                      className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${status === 'maybe' ? 'bg-yellow-500 text-pitch-dark shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/10 hover:text-chalk-white/30'}`}
                    >
                      <HelpCircle size={20} strokeWidth={4} className="scale-75 sm:scale-100" />
                    </button>
                    <button
                      onClick={() => handleSetAvailability(player.id, 'not-going')}
                      className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${status === 'not-going' ? 'bg-red-500 text-pitch-dark shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/10 hover:text-chalk-white/30'}`}
                    >
                      <X size={20} strokeWidth={4} className="scale-75 sm:scale-100" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Coach View: Session Notes and Attendance */}
      {isCoach && (
        <div className="space-y-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-[2rem] p-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <h2 className="text-xl font-black text-chalk-white uppercase italic font-display tracking-tight flex items-center gap-3 break-words">
                <FileText size={24} className="text-pitch-green shrink-0" />
                Session Observations
              </h2>
              <button
                onClick={() => setShowNoteModal(true)}
                className="bg-pitch-green hover:bg-pitch-accent text-pitch-dark px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(22,163,74,0.3)] font-display italic w-full sm:w-auto shrink-0"
              >
                <Plus size={16} strokeWidth={3} />
                ADD NOTE
              </button>
            </div>

            <div className="space-y-4">
              {sessionNotes.length === 0 ? (
                <div className="text-chalk-white/20 text-[10px] font-black uppercase tracking-widest text-center py-12 bg-pitch-dark/30 rounded-2xl border border-dashed border-chalk-white/5 font-display italic">
                  No observations recorded for this session.
                </div>
              ) : (
                sessionNotes.map(note => (
                  <div key={note.id} className="bg-pitch-dark/40 border border-chalk-white/5 rounded-2xl p-5 space-y-4 relative group">
                    <div className="flex justify-between items-start">
                      <p className="text-[9px] text-chalk-white/20 font-black uppercase tracking-widest font-display italic">
                        {note.createdAt?.toDate ? format(note.createdAt.toDate(), 'MMM d, HH:mm') : 'Just now'}
                      </p>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-chalk-white/10 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} strokeWidth={3} />
                      </button>
                    </div>
                    <p className="text-sm text-chalk-white/80 font-medium leading-relaxed">{note.content}</p>
                    {note.playerIds && note.playerIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {note.playerIds.map(pid => {
                          const player = players.find(p => p.id === pid);
                          return (
                            <span key={pid} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-pitch-green/10 text-pitch-green rounded-lg text-[9px] font-black uppercase tracking-widest border border-pitch-green/20 font-display italic">
                              <Tag size={10} strokeWidth={3} />
                              {player?.name || 'Unknown'}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {match.type === 'training' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-[2rem] p-8"
            >
              <h2 className="text-xl font-black text-chalk-white mb-6 uppercase italic font-display tracking-tight flex items-center gap-3 break-words">
                <FileText size={24} className="text-pitch-green" />
                Training Plan
              </h2>
              <div className="space-y-6">
                <textarea
                  value={trainingNotes}
                  onChange={(e) => setTrainingNotes(e.target.value)}
                  placeholder="Outline the session objectives, drills, and key focus areas..."
                  className="w-full h-40 bg-pitch-dark/40 border border-chalk-white/5 rounded-2xl p-5 text-chalk-white font-medium focus:outline-none focus:border-pitch-green transition-colors resize-none placeholder:text-chalk-white/10"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="bg-pitch-green hover:bg-pitch-accent disabled:opacity-50 text-pitch-dark px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(22,163,74,0.3)] font-display italic"
                  >
                    {savingNotes ? 'Saving...' : 'Save Plan'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-[2rem] p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-chalk-white uppercase italic font-display tracking-tight flex items-center gap-3 break-words">
                <UserCheck size={24} className="text-pitch-green" />
                Attendance
              </h2>
              <Activity size={16} className="text-pitch-green/30" />
            </div>
            <div className="grid gap-3">
              {players.map(player => {
                const status = attendances[player.id]?.status;
                return (
                  <div key={player.id} className="flex items-center justify-between gap-4 p-4 bg-pitch-dark/40 rounded-2xl border border-chalk-white/5">
                    <button 
                      onClick={() => navigate(`/player/${player.id}`)}
                      className="text-base font-black text-chalk-white hover:text-pitch-green transition-colors text-left flex items-center gap-2 break-words uppercase italic font-display tracking-tight"
                    >
                      <span className="break-words">{player.name}</span>
                    </button>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleSetAttendance(player.id, 'present')}
                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${status === 'present' ? 'bg-pitch-green text-pitch-dark shadow-[0_0_15px_rgba(22,163,74,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/10 hover:text-chalk-white/30'}`}
                      >
                        <Check size={20} strokeWidth={4} className="scale-75 sm:scale-100" />
                      </button>
                      <button
                        onClick={() => handleSetAttendance(player.id, 'late')}
                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${status === 'late' ? 'bg-yellow-500 text-pitch-dark shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/10 hover:text-chalk-white/30'}`}
                      >
                        <AlertCircle size={20} strokeWidth={4} className="scale-75 sm:scale-100" />
                      </button>
                      <button
                        onClick={() => handleSetAttendance(player.id, 'absent')}
                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${status === 'absent' ? 'bg-red-500 text-pitch-dark shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/10 hover:text-chalk-white/30'}`}
                      >
                        <X size={20} strokeWidth={4} className="scale-75 sm:scale-100" />
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
          className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-[2rem] p-8 relative z-10"
        >
          <h2 className="text-xl font-black text-chalk-white mb-8 uppercase italic font-display tracking-tight flex items-center gap-3">
            <Clock size={24} className="text-pitch-green" />
            Match Timeline
          </h2>
          <div className="space-y-6">
            {(!match.events || match.events.length === 0) ? (
              <div className="text-chalk-white/20 text-[10px] font-black uppercase tracking-widest text-center py-8 bg-pitch-dark/30 rounded-2xl border border-dashed border-chalk-white/5 font-display italic">
                No events recorded.
              </div>
            ) : (
              [...match.events].reverse().map((event: any, idx) => (
                <div key={event.id || idx} className="flex items-center gap-6 relative group">
                  <div className="w-12 text-[10px] font-black text-pitch-green font-display italic uppercase tracking-widest shrink-0">{event.time}</div>
                  
                  <div className="flex-1 flex items-center gap-4 bg-pitch-dark/40 p-4 rounded-2xl border border-chalk-white/5">
                    <div className="w-10 h-10 rounded-xl bg-pitch-dark/50 flex items-center justify-center border border-chalk-white/5 shrink-0">
                      {event.type === 'goal' && <Goal size={20} className="text-pitch-green" />}
                      {event.type === 'opponent_goal' && <Goal size={20} className="text-chalk-white/20" />}
                      {event.type === 'sub' && <ArrowLeftRight size={20} className="text-blue-400" />}
                      {event.type === 'yellow' && <div className="w-4 h-6 bg-yellow-500 rounded-sm shadow-[0_0_10px_rgba(234,179,8,0.4)]" />}
                      {event.type === 'red' && <div className="w-4 h-6 bg-red-500 rounded-sm shadow-[0_0_10px_rgba(239,68,68,0.4)]" />}
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-base font-black text-chalk-white uppercase italic font-display tracking-tight">
                        {event.type === 'opponent_goal' ? 'Opponent Goal' : event.playerName}
                      </span>
                      {event.type === 'sub' && <span className="text-[10px] font-black text-chalk-white/40 uppercase tracking-widest font-display italic">OFF, {event.subPlayerName} ON</span>}
                      {event.type === 'goal' && event.assistPlayerName && <span className="text-[10px] font-black text-chalk-white/40 uppercase tracking-widest font-display italic">Assist: {event.assistPlayerName}</span>}
                      {event.description && <p className="text-xs text-chalk-white/60 mt-1 italic font-medium">"{event.description}"</p>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* Squad Availability Overview */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid md:grid-cols-3 gap-6 relative z-10"
      >
        {/* Confirmed */}
        <div className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-[2rem] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black text-pitch-green uppercase tracking-widest flex items-center gap-2 font-display italic">
              <Check size={16} strokeWidth={4} />
              Confirmed
            </h3>
            <span className="bg-pitch-green/10 text-pitch-green px-2.5 py-1 rounded-lg text-[10px] font-black font-display italic">
              {confirmedPlayers.length}
            </span>
          </div>
          {confirmedPlayers.length > 0 ? (
            <div className="grid gap-2">
              {confirmedPlayers.map(p => (
                <div key={p.id} className="text-xs font-black text-chalk-white/80 bg-pitch-dark/40 px-4 py-3 rounded-xl border border-chalk-white/5 uppercase italic font-display tracking-tight">
                  {p.name}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] font-black text-chalk-white/20 uppercase tracking-widest italic font-display text-center py-4">None yet.</p>
          )}
        </div>

        {/* Not Going & Maybe */}
        <div className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-[2rem] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2 font-display italic">
              <X size={16} strokeWidth={4} />
              Unavailable
            </h3>
            <span className="bg-red-500/10 text-red-500 px-2.5 py-1 rounded-lg text-[10px] font-black font-display italic">
              {notGoingPlayers.length}
            </span>
          </div>
          {notGoingPlayers.length > 0 ? (
            <div className="grid gap-2 mb-8">
              {notGoingPlayers.map(p => (
                <div key={p.id} className="text-xs font-black text-chalk-white/80 bg-pitch-dark/40 px-4 py-3 rounded-xl border border-chalk-white/5 uppercase italic font-display tracking-tight">
                  {p.name}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] font-black text-chalk-white/20 uppercase tracking-widest italic font-display text-center py-4 mb-8">None.</p>
          )}

          <div className="flex items-center justify-between mb-6 pt-6 border-t border-chalk-white/5">
            <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest flex items-center gap-2 font-display italic">
              <HelpCircle size={16} strokeWidth={4} />
              Maybe
            </h3>
            <span className="bg-yellow-500/10 text-yellow-500 px-2.5 py-1 rounded-lg text-[10px] font-black font-display italic">
              {maybePlayers.length}
            </span>
          </div>
          {maybePlayers.length > 0 ? (
            <div className="grid gap-2">
              {maybePlayers.map(p => (
                <div key={p.id} className="text-xs font-black text-chalk-white/80 bg-pitch-dark/40 px-4 py-3 rounded-xl border border-chalk-white/5 uppercase italic font-display tracking-tight">
                  {p.name}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] font-black text-chalk-white/20 uppercase tracking-widest italic font-display text-center py-4">None.</p>
          )}
        </div>

        {/* Pending / No Response */}
        <div className="bg-turf-surface/20 backdrop-blur-md border border-chalk-white/5 rounded-[2rem] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black text-chalk-white/40 uppercase tracking-widest flex items-center gap-2 font-display italic">
              <Clock size={16} strokeWidth={4} />
              Pending
            </h3>
            <span className="bg-chalk-white/5 text-chalk-white/40 px-2.5 py-1 rounded-lg text-[10px] font-black font-display italic">
              {pendingPlayers.length}
            </span>
          </div>
          {pendingPlayers.length > 0 ? (
            <div className="grid gap-2">
              {pendingPlayers.map(p => (
                <div key={p.id} className="text-xs font-black text-chalk-white/40 bg-pitch-dark/40 px-4 py-3 rounded-xl border border-chalk-white/5 uppercase italic font-display tracking-tight">
                  {p.name}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] font-black text-chalk-white/20 uppercase tracking-widest italic font-display text-center py-4">All responded.</p>
          )}
        </div>
      </motion.div>

      {/* Edit Match Modal */}
      <AnimatePresence>
        {showEditModal && editingMatch && (
          <div className="fixed inset-0 bg-pitch-dark/90 backdrop-blur-md z-50 overflow-y-auto pt-8 pb-20 px-4 flex justify-center items-start sm:items-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-turf-surface/60 backdrop-blur-xl border border-chalk-white/10 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative"
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
                        className={`flex-1 py-3.5 rounded-xl font-black uppercase tracking-tight transition-all font-display italic ${editingMatch.type === 'training' ? 'bg-blue-500 text-slate-50 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-pitch-dark/50 text-chalk-white/40 border border-chalk-white/5'}`}
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
                        <OpponentSelector
                          value={editingMatch.opponent || ''}
                          onChange={(value) => setEditingMatch({ ...editingMatch, opponent: value })}
                        />
                      </div>
                    </>
                  )}

                  {editingMatch.type === 'training' && (
                    <div className="space-y-4 border border-chalk-white/10 rounded-2xl p-4 bg-pitch-dark/30">
                      <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Attached Drills</label>
                      <div className="flex flex-wrap gap-2">
                        {drills.length === 0 ? (
                          <p className="text-xs text-chalk-white/40 italic">No drills available. Create them in the Training Library.</p>
                        ) : (
                          drills.map(drill => {
                            const isSelected = editingMatch.drillIds?.includes(drill.id);
                            return (
                              <button
                                key={drill.id}
                                type="button"
                                onClick={() => {
                                  const current = editingMatch.drillIds || [];
                                  setEditingMatch({
                                    ...editingMatch,
                                    drillIds: isSelected 
                                      ? current.filter((id: string) => id !== drill.id)
                                      : [...current, drill.id]
                                  });
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  isSelected 
                                    ? 'bg-pitch-green text-pitch-dark' 
                                    : 'bg-chalk-white/5 text-chalk-white/60 hover:bg-chalk-white/10'
                                }`}
                              >
                                {drill.title}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Status</label>
                    <select
                      value={editingMatch.status}
                      onChange={(e) => setEditingMatch({ ...editingMatch, status: e.target.value as any })}
                      className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors appearance-none"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="postponed">Postponed</option>
                    </select>
                  </div>

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
                    <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Meet Time</label>
                    <input
                      type="time"
                      value={editingMatch.meetTime || ''}
                      onChange={(e) => setEditingMatch({ ...editingMatch, meetTime: e.target.value })}
                      className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors"
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
                      disabled={updateMatchLoading || updateMatchSuccess}
                      className={`flex-1 ${updateMatchSuccess ? 'bg-pitch-green text-pitch-dark' : 'bg-pitch-green hover:bg-pitch-accent text-pitch-dark'} py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(22,163,74,0.2)] font-display italic flex items-center justify-center gap-2`}
                    >
                      {updateMatchSuccess ? <><Check size={14} strokeWidth={3} /> Saved</> : updateMatchLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Note Modal */}
      <AnimatePresence>
        {showNoteModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 overflow-y-auto pt-8 pb-20 px-4 flex justify-center items-start sm:items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-50">Session Observation</h2>
                <button onClick={() => setShowNoteModal(false)} className="text-slate-400 hover:text-slate-50">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Note Content</label>
                  <textarea
                    value={newNote.content}
                    onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Write your observations here..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 min-h-[150px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tag Players</label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2">
                    {players.map(player => (
                      <button
                        key={player.id}
                        onClick={() => toggleNotePlayerTag(player.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          newNote.playerIds.includes(player.id)
                            ? 'bg-green-500/20 border-green-500 text-green-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {player.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowNoteModal(false)}
                  className="flex-1 px-6 py-3 rounded-2xl bg-slate-800 text-slate-50 font-bold hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSessionNote}
                  disabled={!newNote.content.trim()}
                  className="flex-1 px-6 py-3 rounded-2xl bg-green-500 text-slate-950 font-bold hover:bg-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Note
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
      <MatchSummaryModal
        isOpen={showMatchSummary}
        onClose={() => setShowMatchSummary(false)}
        teamName={teamName}
        match={match}
        presentPlayers={confirmedPlayers.length}
        parentsPotmName={parentsPotmName}
      />
      </div>
    </div>
  );
}
