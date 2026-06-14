import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, Timestamp, serverTimestamp, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Play, Square, Goal, ArrowLeftRight, Clock, Activity, Trash2, AlertTriangle, UserMinus, ArrowLeft, Trophy, Star, Shield, Users, FileText, Tag, X, CheckCircle, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MatchEvent {
  id: string;
  type: 'goal' | 'sub' | 'yellow' | 'red' | 'opponent_goal';
  playerId?: string;
  playerName?: string;
  subPlayerId?: string;
  subPlayerName?: string;
  assistPlayerId?: string;
  assistPlayerName?: string;
  description?: string;
  time: string;
  isOwnGoal?: boolean;
}

import { ConfirmModal } from '../components/ConfirmModal';
import { triggerNotification } from '../lib/notifications';
import { LivePitchView, Player as PitchPlayer, PITCH_SPOTS } from '../components/LivePitchView';
import { logEvent } from '../services/eventLogging';

export function MatchController() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const matchIdParam = searchParams.get('matchId');
  
  const [matches, setMatches] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [activeMatch, setActiveMatch] = useState<any | null>(null);
  const [timer, setTimer] = useState(0); // in seconds
  const [activeFormationId, setActiveFormationId] = useState<string | null>(null);
  const [team, setTeam] = useState<any>(null);
  const [showEventModal, setShowEventModal] = useState<'goal' | 'sub' | 'yellow' | 'red' | null>(null);
  const [subPlayerOff, setSubPlayerOff] = useState<any | null>(null);
  const [goalScorer, setGoalScorer] = useState<any | null>(null);
  const [goalDescription, setGoalDescription] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [matchNote, setMatchNote] = useState({ content: '', playerIds: [] as string[] });
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

  useEffect(() => {
    if (showEventModal || showNoteModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showEventModal, showNoteModal]);

  const [preMatch, setPreMatch] = useState(false);
  const [availabilities, setAvailabilities] = useState<Record<string, any>>({});
  const [startingLineup, setStartingLineup] = useState<string[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [userVote, setUserVote] = useState<any | null>(null);
  
  const [isEditingOpponent, setIsEditingOpponent] = useState(false);
  const [editOpponentName, setEditOpponentName] = useState('');
  
  const isCoach = profile?.role === 'coach' || isAdmin;
  const isParentOfAny = players.some(p => p.parentIds?.includes(profile?.uid));
  
  useEffect(() => {
    if (!profile?.teamId) return;
    const fetchTeam = async () => {
      try {
        const teamDoc = await getDoc(doc(db, 'teams', profile.teamId!));
        if (teamDoc.exists()) {
          setTeam({ id: teamDoc.id, ...teamDoc.data() });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `teams/${profile.teamId}`);
      }
    };
    fetchTeam();
  }, [profile?.teamId]);

  useEffect(() => {
    if (!profile?.teamId) return;

    const matchesRef = collection(db, 'matches');
    const qMatches = query(matchesRef, where('teamId', '==', profile.teamId), where('type', '==', 'match'));
    
    const unsubMatches = onSnapshot(qMatches, (snapshot) => {
      const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      matchesData.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      setMatches(matchesData);
      
      setActiveMatch(prev => {
        if (matchIdParam) {
          const specificMatch = matchesData.find(m => m.id === matchIdParam);
          if (specificMatch) {
            // Skip pre-match screen when explicitly editing via matchId
            setPreMatch(false);
            return specificMatch;
          }
        }
        if (!prev) {
          const inProgress = matchesData.find(m => m.status === 'in-progress');
          if (inProgress) {
            setPreMatch(false);
            return inProgress;
          }
          return null;
        }
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
  }, [profile?.teamId]);

  useEffect(() => {
    if (!activeMatch?.id || !profile?.uid) return;
    
    const votesRef = collection(db, 'motmVotes');
    const qVotes = query(
      votesRef, 
      where('matchId', '==', activeMatch.id),
      where('teamId', '==', profile.teamId)
    );
    
    const unsubVotes = onSnapshot(qVotes, (snapshot) => {
      const votesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVotes(votesData);
      
      const myVote = votesData.find((v: any) => v.parentId === profile.uid);
      setUserVote(myVote || null);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'motmVotes'));
    
    return () => unsubVotes();
  }, [activeMatch?.id, profile?.uid]);

  useEffect(() => {
    if (!activeMatch?.id) return;
    const availRef = collection(db, 'availabilities');
    const qAvail = query(
      availRef, 
      where('matchId', '==', activeMatch.id),
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
    return () => unsubAvail();
  }, [activeMatch?.id]);

  useEffect(() => {
    if (!activeMatch) return;
    
    const updateTimer = () => {
      if (activeMatch.isTimerRunning && activeMatch.timerStartTime) {
        const startTime = activeMatch.timerStartTime.toDate().getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setTimer((activeMatch.timerAccumulated || 0) + elapsed);
      } else {
        setTimer(activeMatch.timerAccumulated || 0);
      }
    };

    updateTimer();
    let interval: NodeJS.Timeout | null = null;
    
    if (activeMatch.isTimerRunning) {
      interval = setInterval(updateTimer, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeMatch?.isTimerRunning, activeMatch?.timerStartTime, activeMatch?.timerAccumulated]);

  const formatTime = (seconds: number) => {
    const half = activeMatch?.currentHalf || 1;
    const nominalHalfSeconds = (team?.halfDuration || 0) * 60;
    
    if (half === 1) {
      if (seconds > nominalHalfSeconds) {
        const addedSeconds = seconds - nominalHalfSeconds;
        const am = Math.floor(addedSeconds / 60);
        const as = addedSeconds % 60;
        return `H1 ${team?.halfDuration || 0}:00 +${am}:${as.toString().padStart(2, '0')}`;
      }
    } else {
      const nominalMatchSeconds = nominalHalfSeconds * 2;
      if (seconds > nominalMatchSeconds) {
        const addedSeconds = seconds - nominalMatchSeconds;
        const am = Math.floor(addedSeconds / 60);
        const as = addedSeconds % 60;
        return `H2 ${team?.halfDuration * 2 || 0}:00 +${am}:${as.toString().padStart(2, '0')}`;
      }
    }

    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `H${half} ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getTimerDisplay = (seconds: number) => {
    const half = activeMatch?.currentHalf || 1;
    const nominalHalfSeconds = (team?.halfDuration || 0) * 60;
    
    let nominalTime = '';
    let addedTime = '';
    
    if (half === 1) {
      if (seconds > nominalHalfSeconds) {
        nominalTime = `${team?.halfDuration || 0}:00`;
        const addedSeconds = seconds - nominalHalfSeconds;
        const am = Math.floor(addedSeconds / 60);
        const as = addedSeconds % 60;
        addedTime = `+${am}:${as.toString().padStart(2, '0')}`;
      } else {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        nominalTime = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      }
    } else {
      const nominalMatchSeconds = nominalHalfSeconds * 2;
      if (seconds > nominalMatchSeconds) {
        nominalTime = `${team?.halfDuration * 2 || 0}:00`;
        const addedSeconds = seconds - nominalMatchSeconds;
        const am = Math.floor(addedSeconds / 60);
        const as = addedSeconds % 60;
        addedTime = `+${am}:${as.toString().padStart(2, '0')}`;
      } else {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        nominalTime = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      }
    }
    
    return { nominalTime, addedTime };
  };

  const handleSelectMatch = (match: any) => {
    setActiveMatch(match);
    if (match.status === 'in-progress') {
      setPreMatch(false);
    } else {
      setPreMatch(true);
      setStartingLineup(match.onPitch || []);
    }
  };

  const maxPlayersAllowed = parseInt(team?.maxMatchPlayers?.toString() || '16', 10);

  const toggleStartingPlayer = (playerId: string) => {
    setStartingLineup(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      }
      if (prev.length >= maxPlayersAllowed) {
        alert(`You can only select a maximum of ${maxPlayersAllowed} players`);
        return prev;
      }
      return [...prev, playerId];
    });
  };

  const handleStartMatch = async () => {
    if (!activeMatch || !isCoach) return;
    
    if (preMatch && startingLineup.length > maxPlayersAllowed) {
      alert(`You cannot start the match with more than ${maxPlayersAllowed} players.`);
      return;
    }

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
        timerAccumulated: 0,
        isTimerRunning: true,
        timerStartTime: serverTimestamp(),
        currentHalf: 1
      });

      // Trigger Notification
      await triggerNotification({
        teamId: profile.teamId,
        title: 'Match Started! ⚽',
        body: `Live match vs ${activeMatch.opponent} has started. Follow the live score!`,
        data: { type: 'match_started', matchId: activeMatch.id }
      });

      setPreMatch(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
    }
  };

  const handleToggleTimer = async () => {
    if (!activeMatch || !isCoach) return;
    
    const isStarting = !activeMatch.isTimerRunning;
    
    try {
      if (isStarting) {
        await updateDoc(doc(db, 'matches', activeMatch.id), {
          isTimerRunning: true,
          timerStartTime: serverTimestamp()
        });
      } else {
        const startTime = activeMatch.timerStartTime.toDate().getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        const newAccumulated = (activeMatch.timerAccumulated || 0) + elapsed;
        
        await updateDoc(doc(db, 'matches', activeMatch.id), {
          isTimerRunning: false,
          timerStartTime: null,
          timerAccumulated: newAccumulated
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
    }
  };

  const handleEndHalf = async () => {
    if (!activeMatch || !isCoach) return;
    
    const currentHalf = activeMatch.currentHalf || 1;
    const isLastHalf = currentHalf === 2;
    
    setConfirmModal({
      isOpen: true,
      title: isLastHalf ? 'End Match' : 'End Half',
      message: isLastHalf ? 'Are you sure you want to end the match?' : 'Are you sure you want to end the first half?',
      onConfirm: async () => {
        try {
          let updates: any = {
            isTimerRunning: false,
            timerStartTime: null
          };
          
          let currentAccumulated = activeMatch.timerAccumulated || 0;
          if (activeMatch.isTimerRunning && activeMatch.timerStartTime) {
            const startTime = activeMatch.timerStartTime.toDate().getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - startTime) / 1000);
            currentAccumulated += elapsed;
          }
          
          if (isLastHalf) {
            const scoreUs = activeMatch.scoreUs || 0;
            const scoreThem = activeMatch.scoreThem || 0;
            const matchResult = scoreUs > scoreThem ? 'win' : scoreUs < scoreThem ? 'loss' : 'draw';
            
            updates.status = 'completed';
            updates.timerAccumulated = currentAccumulated;
            updates.half2Duration = currentAccumulated - ((team?.halfDuration || 0) * 60);
            updates.isPotmVotingOpen = false;
            updates.result = matchResult;
            updates.score = `${scoreUs}-${scoreThem}`;
            updates.seasonId = team?.seasonTag || activeMatch.season || '';
            updates.summary = activeMatch.summary || '';

            // Trigger Notification
            await triggerNotification({
              teamId: profile.teamId,
              title: 'Match Finished! 🏁',
              body: `Final Score: Us ${activeMatch.scoreUs} - ${activeMatch.scoreThem} ${activeMatch.opponent}`,
              data: { type: 'match_finished', matchId: activeMatch.id, scoreUs: activeMatch.scoreUs, scoreThem: activeMatch.scoreThem }
            });
          } else {
            updates.currentHalf = 2;
            updates.half1Duration = currentAccumulated;
            // Second half starts from the nominal half duration
            updates.timerAccumulated = (team?.halfDuration || 0) * 60;
          }
          
          await updateDoc(doc(db, 'matches', activeMatch.id), updates);
          if (isLastHalf) {
            setActiveMatch(null);
            setTimer(0);
          }
          closeConfirmModal();
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
        }
      }
    });
  };

  const handleAddEvent = async (player: any, secondaryPlayer?: any) => {
    if (!activeMatch || !showEventModal || !isCoach) return;

    const eventTime = formatTime(timer);
    const newEvent: MatchEvent = {
      id: Date.now().toString(),
      type: showEventModal,
      playerId: player.id,
      playerName: player.name,
      time: eventTime
    };

    if (showEventModal === 'sub' && secondaryPlayer) {
      newEvent.subPlayerId = secondaryPlayer.id;
      newEvent.subPlayerName = secondaryPlayer.name;
    } else if (showEventModal === 'goal') {
      if (player.id === 'own_goal') {
        newEvent.playerName = 'Own Goal';
        newEvent.isOwnGoal = true;
      }
      
      if (secondaryPlayer) {
        newEvent.assistPlayerId = secondaryPlayer.id;
        newEvent.assistPlayerName = secondaryPlayer.name;
      }
      if (goalDescription.trim()) {
        newEvent.description = goalDescription.trim();
      }
    }

    try {
      const updates: any = {
        events: arrayUnion(newEvent)
      };

      if (showEventModal === 'goal') {
        updates.scoreUs = (activeMatch.scoreUs || 0) + 1;
      } else if (showEventModal === 'sub' && secondaryPlayer) {
        // Let's do it manually
        const currentPitch = activeMatch.onPitch || [];
        const currentBench = activeMatch.onBench || [];
        updates.onPitch = currentPitch.map((id: string) => id === player.id ? secondaryPlayer.id : id);
        updates.onBench = currentBench.filter((id: string) => id !== secondaryPlayer.id).concat(player.id);
      }

      await updateDoc(doc(db, 'matches', activeMatch.id), updates);
      
      logEvent(activeMatch.id, {
        type: showEventModal,
        team: showEventModal === 'goal' && player.id === 'own_goal' ? 'them' : 'us',
        playerId: player.id,
        ...(secondaryPlayer && { subPlayerId: secondaryPlayer.id }),
        minute: Math.floor(timer / 60),
        formationId: activeFormationId || "default_formation"
      });

      setShowEventModal(null);
      setSubPlayerOff(null);
      setGoalScorer(null);
      setGoalDescription('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
    }
  };

  const handleOpponentGoal = async () => {
    if (!activeMatch || !isCoach) return;
    
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
      
      logEvent(activeMatch.id, {
        type: 'goal',
        team: 'them',
        playerId: 'unknown',
        minute: Math.floor(timer / 60),
        formationId: activeFormationId || "default_formation"
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
    }
  };

  const handleSaveMatchNote = async () => {
    if (!activeMatch || !matchNote.content.trim()) return;

    try {
      await addDoc(collection(db, 'notes'), {
        teamId: activeMatch.teamId,
        authorId: profile.uid,
        content: matchNote.content.trim(),
        type: 'match',
        relatedId: activeMatch.id,
        playerIds: matchNote.playerIds,
        createdAt: serverTimestamp()
      });
      setMatchNote({ content: '', playerIds: [] });
      setShowNoteModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notes');
    }
  };

  const toggleNotePlayerTag = (playerId: string) => {
    setMatchNote(prev => ({
      ...prev,
      playerIds: prev.playerIds.includes(playerId)
        ? prev.playerIds.filter(id => id !== playerId)
        : [...prev.playerIds, playerId]
    }));
  };

  const handleRemoveEvent = async (event: MatchEvent) => {
    if (!activeMatch || !isCoach) return;
    
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
            updates.onPitch = currentPitch.map((id: string) => id === event.subPlayerId ? event.playerId : id);
            updates.onBench = currentBench.filter((id: string) => id !== event.playerId).concat(event.subPlayerId);
          }

          await updateDoc(doc(db, 'matches', activeMatch.id), updates);
          closeConfirmModal();
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
        }
      }
    });
  };

  const handleVotePotm = async (playerId: string) => {
    if (!activeMatch || !profile?.uid) return;
    
    try {
      if (userVote) {
        // Change vote
        await updateDoc(doc(db, 'motmVotes', userVote.id), {
          playerId: playerId
        });
      } else {
        // New vote
        await addDoc(collection(db, 'motmVotes'), {
          matchId: activeMatch.id,
          playerId: playerId,
          parentId: profile.uid,
          teamId: profile.teamId
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'motmVotes');
    }
  };

  const handleSetCoachPotm = async (player: any) => {
    if (!activeMatch || !isCoach) return;
    
    try {
      await updateDoc(doc(db, 'matches', activeMatch.id), {
        coachPotmId: player.id,
        coachPotmName: player.name
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
    }
  };

  const handleSetParentsPotm = async (player: any) => {
    if (!activeMatch || !isCoach) return;
    
    try {
      await updateDoc(doc(db, 'matches', activeMatch.id), {
        parentsPotmId: player.id,
        parentsPotmName: player.name
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
    }
  };

  const handleTogglePotmVoting = async () => {
    if (!activeMatch || !isCoach) return;
    try {
      await updateDoc(doc(db, 'matches', activeMatch.id), {
        isPotmVotingOpen: !activeMatch.isPotmVotingOpen
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
    }
  };

  const handleCompleteScheduledMatch = async () => {
    if (!activeMatch || !isCoach) return;
    setConfirmModal({
      isOpen: true,
      title: 'Complete Match',
      message: 'Are you sure you want to mark this match as completed? This will save the current score and events.',
      onConfirm: async () => {
        try {
          const scoreUs = activeMatch.scoreUs || 0;
          const scoreThem = activeMatch.scoreThem || 0;
          const matchResult = scoreUs > scoreThem ? 'win' : scoreUs < scoreThem ? 'loss' : 'draw';
          const matchScore = `${scoreUs}-${scoreThem}`;
          
          await updateDoc(doc(db, 'matches', activeMatch.id), {
            status: 'completed',
            isTimerRunning: false,
            timerStartTime: null,
            timerAccumulated: 0,
            currentHalf: 2,
            scoreUs: scoreUs,
            scoreThem: scoreThem,
            result: matchResult,
            score: matchScore,
            seasonId: team?.seasonTag || activeMatch.season || '',
            summary: activeMatch.summary || '',
            isPotmVotingOpen: false
          });
          closeConfirmModal();
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
        }
      }
    });
  };

  const handleSaveOpponent = async () => {
    if (!activeMatch || !isCoach) return;
    try {
      await updateDoc(doc(db, 'matches', activeMatch.id), {
        opponent: editOpponentName
      });
      setIsEditingOpponent(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
    }
  };

  if (profile?.role !== 'coach' && profile?.role !== 'parent') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Activity size={48} className="text-slate-700 mb-4" />
        <h2 className="text-xl font-bold text-slate-50 mb-2">Access Restricted</h2>
        <p className="text-slate-400">Please log in as a coach or parent to view matches.</p>
      </div>
    );
  }

  if (activeMatch && preMatch) {
    const confirmedPlayers = players.filter(p => availabilities[p.id]?.status === 'going');
    
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-50">Starting Lineup</h2>
            <button onClick={() => setActiveMatch(null)} className="text-slate-400 hover:text-slate-50">
              Cancel
            </button>
          </div>
          
          <div className="mb-6">
            {isCoach ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-slate-400 text-sm">Select the players starting the match. Unselected players will be on the bench.</p>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    startingLineup.length > maxPlayersAllowed 
                      ? 'bg-red-500/20 text-red-500' 
                      : startingLineup.length === maxPlayersAllowed
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : 'bg-green-500/20 text-green-500'
                  }`}>
                    {startingLineup.length} / {maxPlayersAllowed} Selected
                  </span>
                </div>
                <div className="space-y-2">
                  {confirmedPlayers.map(player => {
                    const isSelected = startingLineup.includes(player.id);
                    const isMaxedOut = !isSelected && startingLineup.length >= maxPlayersAllowed;
                    
                    return (
                    <button
                      key={player.id}
                      onClick={() => toggleStartingPlayer(player.id)}
                      disabled={isMaxedOut}
                      className={`w-full text-left p-4 rounded-xl font-medium transition-colors flex justify-between items-center ${
                        isSelected 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                          : isMaxedOut
                            ? 'bg-slate-800/50 text-slate-600 border border-slate-800 cursor-not-allowed opacity-50'
                            : 'bg-slate-800 text-slate-50 border border-slate-700'
                      }`}
                    >
                      {player.name}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-green-500 bg-green-500' : isMaxedOut ? 'border-slate-700' : 'border-slate-600'
                      }`}>
                        {isSelected && <div className="w-2 h-2 bg-slate-900 rounded-full" />}
                      </div>
                    </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Clock size={48} className="text-slate-700 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-50 mb-2">Match Not Started</h3>
                <p className="text-slate-400">The coach hasn't started the live match controller yet. Check back once the match kicks off!</p>
              </div>
            )}
            {confirmedPlayers.length === 0 && isCoach && (
              <p className="text-slate-500 text-center py-4">No players have confirmed attendance.</p>
            )}
          </div>

          {isCoach && (
            <button
              onClick={handleStartMatch}
              className="w-full bg-green-500 hover:bg-green-400 text-slate-950 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <Play size={20} fill="currentColor" />
              START MATCH
            </button>
          )}
        </div>
      </div>
    );
  }

  if (activeMatch && !preMatch) {
    const isSuspended = (playerId: string) => activeMatch?.events?.some((e: MatchEvent) => e.type === 'red' && e.playerId === playerId);

    const onPitchPlayers = (activeMatch.onPitch && activeMatch.onPitch.length > 0) 
      ? activeMatch.onPitch.map((id: string) => players.find(p => p.id === id)).filter((p: any) => p && !isSuspended(p.id))
      : players.filter(p => !isSuspended(p.id));
    const onBenchPlayers = players.filter(p => (activeMatch.onBench || []).includes(p.id) && !isSuspended(p.id));

    const pitchPlayersData: PitchPlayer[] = onPitchPlayers.map((p, idx) => {
      const originalIdx = (activeMatch.onPitch || []).indexOf(p.id);
      const effectiveIdx = originalIdx !== -1 ? originalIdx : idx;
      return {
        id: p.id,
        name: p.name,
        position: p.position || 'Unknown',
        x: activeMatch.customPositions?.[effectiveIdx]?.x ?? PITCH_SPOTS[effectiveIdx % PITCH_SPOTS.length]?.x ?? 50,
        y: activeMatch.customPositions?.[effectiveIdx]?.y ?? PITCH_SPOTS[effectiveIdx % PITCH_SPOTS.length]?.y ?? 50,
        isOnPitch: true
      };
    });

    const benchPlayersData: PitchPlayer[] = onBenchPlayers.map(p => ({
      id: p.id,
      name: p.name,
      position: p.position || 'Unknown',
      x: 0,
      y: 0,
      isOnPitch: false
    }));

    const handlePitchMove = async (playerId: string, x: number, y: number) => {
      if (!isCoach) return;
      const idx = (activeMatch.onPitch || []).indexOf(playerId);
      if (idx !== -1) {
        try {
          const currentCustomPositions = activeMatch.customPositions || {};
          await updateDoc(doc(db, 'matches', activeMatch.id), {
            [`customPositions.${idx}`]: { x, y }
          });
          setActiveFormationId(`formation_${Date.now()}`);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
        }
      }
    };

    const handlePitchSubstitution = async (playerOffId: string, playerOnId: string) => {
      if (!activeMatch || !isCoach) return;
      const playerOff = players.find(p => p.id === playerOffId);
      const playerOn = players.find(p => p.id === playerOnId);
      
      if (!playerOff || !playerOn) return;

      const eventTime = formatTime(timer);
      const newEvent: MatchEvent = {
        id: Date.now().toString(),
        type: 'sub',
        playerId: playerOff.id,
        playerName: playerOff.name,
        subPlayerId: playerOn.id,
        subPlayerName: playerOn.name,
        time: eventTime
      };

      try {
        const currentPitch = activeMatch.onPitch || [];
        const currentBench = activeMatch.onBench || [];
        
        const updates: any = {
          events: arrayUnion(newEvent),
          onPitch: currentPitch.map((id: string) => id === playerOffId ? playerOnId : id),
          onBench: currentBench.filter((id: string) => id !== playerOnId).concat(playerOffId)
        };

        await updateDoc(doc(db, 'matches', activeMatch.id), updates);
        
        logEvent(activeMatch.id, {
          type: 'sub',
          team: 'us',
          playerId: playerOffId,
          subPlayerId: playerOnId,
          minute: Math.floor(timer / 60),
          formationId: activeFormationId || "default_formation"
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `matches/${activeMatch.id}`);
      }
    };

    const { nominalTime, addedTime } = getTimerDisplay(timer);

    const getParentsPotmWinner = () => {
      if (activeMatch.parentsPotmId) return { id: activeMatch.parentsPotmId, name: activeMatch.parentsPotmName };
      if (votes.length === 0) return null;
      
      const voteCounts: Record<string, number> = {};
      votes.forEach(v => {
        voteCounts[v.playerId] = (voteCounts[v.playerId] || 0) + 1;
      });
      
      let maxVotes = 0;
      let winnerId = '';
      
      Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          winnerId = id;
        }
      });
      
      const winner = players.find(p => p.id === winnerId);
      return winner ? { id: winner.id, name: winner.name, count: maxVotes } : null;
    };

    const parentsPotmWinner = getParentsPotmWinner();

    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        {matchIdParam && (
          <button
            onClick={() => navigate(`/schedule/${matchIdParam}`)}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-50 transition-colors mb-2"
          >
            <ArrowLeft size={20} />
            Back to Match Details
          </button>
        )}
        {/* Match Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-blue-500" />
          
          {activeMatch.opponent && (
            <div className="absolute top-4 left-0 w-full text-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full">
                vs {activeMatch.opponent}
              </span>
            </div>
          )}
          
          <div className="flex flex-col items-center justify-center mb-6 mt-4">
            <div className="flex items-center justify-center gap-2 text-green-400 font-mono text-4xl font-bold tracking-wider">
              <Clock size={32} className={activeMatch.isTimerRunning ? "animate-pulse" : ""} />
              <span>{nominalTime}</span>
              {addedTime && (
                <div className="flex flex-col items-start">
                  <span className="text-amber-500 text-2xl leading-none">{addedTime}</span>
                  <span className="text-[10px] text-amber-500/60 uppercase tracking-tighter leading-none mt-1">Added Time</span>
                </div>
              )}
            </div>
            <div className="text-slate-500 text-xs uppercase tracking-widest mt-2 font-bold">
              {activeMatch.currentHalf === 1 ? 'First Half' : 'Second Half'}
            </div>
          </div>

          <div className="flex justify-between items-center px-4 mb-8">
            <div className="text-center flex-1">
              <div className="text-sm text-slate-400 uppercase tracking-widest mb-2">Us</div>
              <div className="text-6xl font-black text-slate-50">{activeMatch.scoreUs || 0}</div>
            </div>
            <div className="text-4xl font-black text-slate-700 px-4">-</div>
            <div className="text-center flex-1">
              {isEditingOpponent ? (
                <div className="flex items-center justify-center gap-2 mb-2">
                  <input
                    type="text"
                    value={editOpponentName}
                    onChange={(e) => setEditOpponentName(e.target.value)}
                    className="w-24 bg-slate-800 border-none rounded px-2 py-1 text-sm text-slate-50 text-center uppercase tracking-widest focus:ring-1 focus:ring-green-500"
                    placeholder="Opponent"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveOpponent()}
                  />
                  <button onClick={handleSaveOpponent} className="text-green-500 hover:text-green-400">
                    <CheckCircle size={16} />
                  </button>
                </div>
              ) : (
                <div 
                  className="text-sm text-slate-400 uppercase tracking-widest mb-2 cursor-pointer hover:text-slate-50 transition-colors flex items-center justify-center gap-1 group break-words"
                  onClick={() => {
                    if (isCoach) {
                      setEditOpponentName(activeMatch.opponent || '');
                      setIsEditingOpponent(true);
                    }
                  }}
                >
                  {activeMatch.opponent || 'Opponent'}
                  {isCoach && <Edit2 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                </div>
              )}
              <div className="text-6xl font-black text-slate-50">{activeMatch.scoreThem || 0}</div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            {isCoach ? (
              activeMatch.status === 'completed' ? (
                <div className="flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-slate-800/50 text-slate-400 border border-slate-700/50 italic">
                  <Trophy size={20} className="text-yellow-500" />
                  MATCH COMPLETED
                </div>
              ) : activeMatch.status === 'scheduled' ? (
                <div className="flex gap-4 w-full">
                  <button
                    onClick={handleStartMatch}
                    className="flex-1 bg-green-500/20 text-green-500 hover:bg-green-500/30 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border border-green-500/50"
                  >
                    <Play size={20} fill="currentColor" />
                    START LIVE
                  </button>
                  <button
                    onClick={handleCompleteScheduledMatch}
                    className="flex-1 bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border border-blue-500/50"
                  >
                    <CheckCircle size={20} />
                    COMPLETE MATCH
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleToggleTimer}
                    className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                      activeMatch.isTimerRunning ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                    }`}
                  >
                    {activeMatch.isTimerRunning ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                    {activeMatch.isTimerRunning ? 'PAUSE' : 'RESUME'}
                  </button>
                  <button
                    onClick={handleEndHalf}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-50 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-700"
                  >
                    <Clock size={20} />
                    {activeMatch.currentHalf === 1 ? 'END HALF' : 'END MATCH'}
                  </button>
                </>
              )
            ) : (
              <div className="flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-slate-800/50 text-slate-400 border border-slate-700/50 italic">
                {activeMatch.isTimerRunning ? 'Match is Live' : 'Match is Paused'}
              </div>
            )}
          </div>

          {team?.halfDuration && (
            <div className="mt-6 w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-green-500"
                initial={{ width: 0 }}
                animate={{ 
                  width: `${Math.min(100, (
                    activeMatch.currentHalf === 1 
                      ? (timer / (team.halfDuration * 60)) * 100
                      : ((timer - (team.halfDuration * 60)) / (team.halfDuration * 60)) * 100
                  ))}%` 
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          )}
        </div>

        {/* Live Pitch View */}
        {team?.features?.dragAndDropPitch !== false ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <LivePitchView 
              initialPitchPlayers={pitchPlayersData} 
              initialBenchPlayers={benchPlayersData}
              onSubstitute={handlePitchSubstitution}
              onMove={handlePitchMove}
              isCoach={isCoach}
            />
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">On Pitch</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pitchPlayersData.map(p => (
                  <div key={p.id} className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl font-bold text-sm truncate">
                    {p.name}
                  </div>
                ))}
                {pitchPlayersData.length === 0 && (
                  <p className="text-slate-500 text-sm italic col-span-full">No players on pitch.</p>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Subs Bench</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {benchPlayersData.map(p => (
                  <div key={p.id} className="bg-slate-800 border border-slate-700 text-slate-300 p-3 rounded-xl font-bold text-sm truncate">
                    {p.name}
                  </div>
                ))}
                {benchPlayersData.length === 0 && (
                  <p className="text-slate-500 text-sm italic col-span-full">No players on bench.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {isCoach && (
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
              className="bg-slate-800 hover:bg-slate-700 text-slate-50 p-6 rounded-2xl font-bold flex flex-col items-center justify-center gap-3 transition-transform active:scale-95"
            >
              <Goal size={32} className="text-slate-500" />
              <span className="text-lg uppercase tracking-wider">Their Goal</span>
            </button>
            <button
              onClick={() => setShowEventModal('sub')}
              className="col-span-2 bg-blue-500 hover:bg-blue-400 text-slate-50 p-6 rounded-2xl font-bold flex flex-col items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg shadow-blue-500/20"
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
              className="bg-red-500 hover:bg-red-400 text-slate-50 p-6 rounded-2xl font-bold flex flex-col items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg shadow-red-500/20"
            >
              <UserMinus size={32} />
              <span className="text-lg uppercase tracking-wider">Red Card</span>
            </button>
            <button
              onClick={() => setShowNoteModal(true)}
              className="col-span-2 bg-slate-800 hover:bg-slate-700 text-slate-50 p-6 rounded-2xl font-bold flex flex-col items-center justify-center gap-3 transition-transform active:scale-95 border border-slate-700"
            >
              <FileText size={32} className="text-green-500" />
              <span className="text-lg uppercase tracking-wider">Match Notes</span>
            </button>
          </div>
        )}

        {/* POTM Voting / Selection */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="text-yellow-500" size={20} />
              <h3 className="text-lg font-bold text-slate-50">Player of the Match</h3>
            </div>
            {isCoach && (
              <button
                onClick={handleTogglePotmVoting}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeMatch.isPotmVotingOpen 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {activeMatch.isPotmVotingOpen ? 'VOTING OPEN' : 'OPEN VOTING'}
              </button>
            )}
          </div>

          <div className="space-y-6">
            {/* Parents' POTM Voting / Result */}
            {(isParentOfAny || isCoach) && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Parents' Selection</h4>
                  {parentsPotmWinner && (
                    <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                      <Trophy size={12} className="text-yellow-500" />
                      <span className="text-[10px] font-black text-yellow-500 uppercase italic font-display tracking-tight">
                        Winner: {parentsPotmWinner.name}
                      </span>
                    </div>
                  )}
                </div>
                
                {(activeMatch.isPotmVotingOpen || isCoach) ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {onPitchPlayers.map(player => (
                        <button
                          key={player.id}
                          onClick={() => {
                            if (activeMatch.isPotmVotingOpen) {
                              handleVotePotm(player.id);
                            } else if (isCoach) {
                              handleSetParentsPotm(player);
                            }
                          }}
                          disabled={!activeMatch.isPotmVotingOpen && !isCoach}
                          className={`p-3 rounded-xl text-sm font-medium transition-all border flex flex-col items-center gap-1 ${
                            (userVote?.playerId === player.id || activeMatch.parentsPotmId === player.id)
                              ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' 
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                          } ${(!activeMatch.isPotmVotingOpen && !isCoach) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span>{player.name}</span>
                          {votes.filter(v => v.playerId === player.id).length > 0 && (
                            <span className="text-[10px] opacity-60 flex items-center gap-1">
                              <Users size={10} />
                              {votes.filter(v => v.playerId === player.id).length}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    {userVote && (
                      <p className="text-xs text-slate-500 mt-2 italic text-center">
                        You voted for {players.find(p => p.id === userVote.playerId)?.name}
                      </p>
                    )}
                    {isCoach && activeMatch.parentsPotmId && (
                      <p className="text-xs text-slate-500 mt-2 italic text-center">
                        Manual selection: {activeMatch.parentsPotmName}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="bg-slate-950/50 border border-dashed border-slate-800 rounded-xl p-8 text-center">
                    <p className="text-slate-500 text-sm italic">
                      Voting hasn't been opened by the coach yet.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Coach's POTM Selection */}
            {isCoach && (
              <div className="pt-6 border-t border-slate-800">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Coach's Selection</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {onPitchPlayers.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleSetCoachPotm(player)}
                      className={`p-3 rounded-xl text-sm font-medium transition-all border flex flex-col items-center gap-1 ${
                        activeMatch.coachPotmId === player.id 
                          ? 'bg-blue-500/20 border-blue-500 text-blue-400' 
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span>{player.name}</span>
                    </button>
                  ))}
                </div>
                {activeMatch.coachPotmId && (
                  <p className="text-xs text-slate-500 mt-2 italic text-center">
                    You selected {activeMatch.coachPotmName}
                  </p>
                )}
              </div>
            )}
            
            {(!isCoach && !isParentOfAny) && (
              <p className="text-slate-500 text-sm italic text-center">
                Only parents of players in this team can vote for POTM.
              </p>
            )}
          </div>
        </div>

        {/* Event Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-50 mb-4">Match Timeline</h3>
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
                    
                    <span className="text-slate-50 font-medium">
                      {event.type === 'opponent_goal' ? 'Opponent Goal' : event.playerName}
                      {event.isOwnGoal && (
                        <span className="ml-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded border border-amber-500/30">
                          OG
                        </span>
                      )}
                      {event.type === 'sub' && <span className="text-slate-400 font-normal"> OFF, {event.subPlayerName} ON</span>}
                      {event.type === 'goal' && event.assistPlayerName && <span className="text-slate-400 font-normal text-xs ml-1">(Assist: {event.assistPlayerName})</span>}
                      {event.description && <p className="text-slate-400 text-xs mt-1 italic">"{event.description}"</p>}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => isCoach && handleRemoveEvent(event)}
                    className={`transition-colors p-2 ${isCoach ? 'text-slate-500 hover:text-red-400' : 'opacity-0 cursor-default'}`}
                    title={isCoach ? "Remove Event" : ""}
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
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 overflow-y-auto px-4 py-8 flex justify-center items-start sm:items-center">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  {((showEventModal === 'sub' && subPlayerOff) || (showEventModal === 'goal' && goalScorer)) && (
                    <button onClick={() => { setSubPlayerOff(null); setGoalScorer(null); }} className="text-slate-500 hover:text-slate-50 transition-colors">
                      <ArrowLeft size={24} />
                    </button>
                  )}
                  <h2 className="text-xl font-bold text-slate-50 uppercase tracking-wider">
                    {showEventModal === 'sub' && !subPlayerOff ? 'Select Player Coming OFF' :
                     showEventModal === 'sub' && subPlayerOff ? 'Select Player Coming ON' :
                     showEventModal === 'goal' && !goalScorer ? 'Select Goal Scorer' :
                     showEventModal === 'goal' && goalScorer ? 'Select Assist' :
                     `Select Player for ${showEventModal}`}
                  </h2>
                </div>
                <button onClick={() => { setShowEventModal(null); setSubPlayerOff(null); setGoalScorer(null); setGoalDescription(''); }} className="text-slate-500 hover:text-slate-50">
                  <Square size={24} />
                </button>
              </div>

              {showEventModal === 'goal' && (
                <div className="mb-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">
                    Goal/Assist Description (Optional)
                  </label>
                  <textarea
                    value={goalDescription}
                    onChange={(e) => setGoalDescription(e.target.value)}
                    placeholder="E.g. Great header from a corner..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 resize-none h-20"
                  />
                </div>
              )}
              
              <div className="overflow-y-auto flex-1 pr-2 space-y-2">
                {showEventModal === 'sub' && subPlayerOff ? (
                  // Select player coming ON (from bench)
                  onBenchPlayers.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleAddEvent(subPlayerOff, player)}
                      className="w-full text-left bg-slate-800 hover:bg-slate-700 text-slate-50 p-4 rounded-xl font-medium transition-colors flex justify-between items-center"
                    >
                      {player.name}
                      <ArrowLeftRight size={18} className="text-blue-400" />
                    </button>
                  ))
                ) : showEventModal === 'goal' && goalScorer ? (
                  // Select assist (from pitch, excluding scorer)
                  <>
                    <button
                      onClick={() => handleAddEvent(goalScorer)}
                      className="w-full text-left bg-slate-800 hover:bg-slate-700 text-slate-400 p-4 rounded-xl font-medium transition-colors flex justify-between items-center mb-4"
                    >
                      No Assist
                    </button>
                    {onPitchPlayers.filter(p => p.id !== goalScorer.id).map(player => (
                      <button
                        key={player.id}
                        onClick={() => handleAddEvent(goalScorer, player)}
                        className="w-full text-left bg-slate-800 hover:bg-slate-700 text-slate-50 p-4 rounded-xl font-medium transition-colors flex justify-between items-center"
                      >
                        {player.name}
                      </button>
                    ))}
                  </>
                ) : (
                  // Select player coming OFF or for other events (from pitch)
                  <>
                    {showEventModal === 'goal' && !goalScorer && (
                      <button
                        onClick={() => setGoalScorer({ id: 'own_goal', name: 'Own Goal' })}
                        className="w-full text-left bg-slate-800 hover:bg-slate-700 text-amber-400 p-4 rounded-xl font-bold transition-colors flex justify-between items-center mb-4 border border-amber-500/30"
                      >
                        Own Goal (for Us)
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                      </button>
                    )}
                    {onPitchPlayers.map(player => (
                      <button
                        key={player.id}
                        onClick={() => {
                          if (showEventModal === 'sub') {
                            setSubPlayerOff(player);
                          } else if (showEventModal === 'goal') {
                            setGoalScorer(player);
                          } else {
                            handleAddEvent(player);
                          }
                        }}
                        className="w-full text-left bg-slate-800 hover:bg-slate-700 text-slate-50 p-4 rounded-xl font-medium transition-colors flex justify-between items-center"
                      >
                        {player.name}
                        {showEventModal === 'sub' && <ArrowLeftRight size={18} className="text-slate-500" />}
                      </button>
                    ))}
                  </>
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

        {/* Match Note Modal */}
        <AnimatePresence>
          {showNoteModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 overflow-y-auto px-4 py-8 flex justify-center items-start sm:items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-50">Match Notes</h2>
                  <button onClick={() => setShowNoteModal(false)} className="text-slate-400 hover:text-slate-50">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Observations</label>
                    <textarea
                      value={matchNote.content}
                      onChange={(e) => setMatchNote(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Write your match notes here..."
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
                            matchNote.playerIds.includes(player.id)
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
                    onClick={handleSaveMatchNote}
                    disabled={!matchNote.content.trim()}
                    className="flex-1 px-6 py-3 rounded-2xl bg-green-500 text-slate-950 font-bold hover:bg-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Note
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
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
        <h1 className="text-2xl font-bold text-slate-50">Live Match Controller</h1>
      </div>

      {upcomingMatches.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <h3 className="text-xl font-semibold text-slate-50 mb-2">No active matches</h3>
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
                <h3 className="text-xl font-bold text-slate-50 mb-1">vs {match.opponent}</h3>
                <p className="text-slate-400 text-sm mb-6">
                  {match.date ? (
                    <>
                      {new Date(match.date).toLocaleDateString()} • {new Date(match.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </>
                  ) : (
                    'Postponed TBA'
                  )}
                </p>
              </div>
              {isCoach ? (
                <button
                  onClick={() => handleSelectMatch(match)}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 ${match.status === 'in-progress' ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-950' : 'bg-green-500 hover:bg-green-400 text-slate-950'}`}
                >
                  <Play size={20} fill="currentColor" />
                  {match.status === 'in-progress' ? 'RESUME MATCH' : 'START MATCH'}
                </button>
              ) : (
                <button
                  onClick={() => handleSelectMatch(match)}
                  className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 bg-slate-800 hover:bg-slate-700 text-slate-50 border border-slate-700"
                >
                  <Activity size={20} />
                  VIEW LIVE
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
