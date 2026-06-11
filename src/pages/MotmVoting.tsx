import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Award, Star, Trophy, Clock, Check, Calendar as CalendarIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';

export function MotmVoting() {
  const { profile, isAdmin } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (!profile?.teamId) return;

    // Fetch all matches
    const matchesRef = collection(db, 'matches');
    const qMatches = query(matchesRef, where('teamId', '==', profile.teamId), where('type', '==', 'match'));
    
    const unsubMatches = onSnapshot(qMatches, (snapshot) => {
      const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      matchesData.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA; // Newest first
      });
      setMatches(matchesData);
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
    if (!selectedMatch || !profile?.uid) return;

    const votesRef = collection(db, 'motmVotes');
    const qVotes = query(
      votesRef, 
      where('matchId', '==', selectedMatch.id),
      where('teamId', '==', profile.teamId)
    );
    
    const unsubVotes = onSnapshot(qVotes, (snapshot) => {
      const votesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setVotes(votesData);
      
      if (profile.role === 'parent') {
        const userVote = votesData.find(v => v.parentId === profile.uid);
        setHasVoted(!!userVote);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'motmVotes'));

    return () => unsubVotes();
  }, [selectedMatch, profile?.uid, profile?.role]);

  const toggleVoting = async (matchId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'matches', matchId), {
        isPotmVotingOpen: !currentStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${matchId}`);
    }
  };

  const handleVote = async (playerId: string) => {
    if (!selectedMatch || !profile?.uid || hasVoted) return;

    try {
      await addDoc(collection(db, 'motmVotes'), {
        matchId: selectedMatch.id,
        playerId,
        parentId: profile.uid,
        teamId: profile.teamId
      });
      setHasVoted(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'motmVotes');
    }
  };

  const getVoteCount = (playerId: string) => {
    return votes.filter(v => v.playerId === playerId).length;
  };

  const finalizeParentVote = async (playerId: string, playerName: string) => {
    if (!selectedMatch) return;
    try {
      await updateDoc(doc(db, 'matches', selectedMatch.id), {
        parentPotmId: playerId,
        parentPotmName: playerName,
        isPotmVotingOpen: false
      });
      alert(`Parent's POTM finalized: ${playerName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${selectedMatch.id}`);
    }
  };

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-800 shadow-xl">
          <Award size={40} className="text-slate-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-50 mb-2">No Matches Yet</h2>
        <p className="text-slate-400 max-w-md">
          Schedule a match in the Dashboard to start MOTM voting.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
          <Trophy className="text-yellow-500" size={24} />
        </div>
        <h1 className="text-2xl font-bold text-slate-50">Man of the Match</h1>
      </div>

      {/* Schedule List */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Match Schedule</h3>
        <div className="flex flex-col gap-2">
          {matches.map(match => (
            <div 
              key={match.id} 
              onClick={() => (match.isPotmVotingOpen || profile?.role === 'coach') && setSelectedMatch(match)}
              className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer ${
                selectedMatch?.id === match.id 
                  ? 'bg-slate-800 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' 
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-950 rounded-lg flex items-center justify-center shrink-0 border border-slate-800">
                  <CalendarIcon size={14} className="text-slate-400" />
                </div>
                <div>
                  <h4 className="text-slate-50 font-bold text-sm leading-tight line-clamp-1">vs {match.opponent}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <Clock size={10} />
                    {match.date ? format(new Date(match.date), 'MMM d, yyyy') : 'Postponed TBA'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {match.isPotmVotingOpen ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                    Open
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-slate-950 text-slate-500">
                    Closed
                  </span>
                )}
                
                { (profile?.role === 'coach' || isAdmin) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleVoting(match.id, !!match.isPotmVotingOpen); }}
                    className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors ${
                      match.isPotmVotingOpen 
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    }`}
                  >
                    {match.isPotmVotingOpen ? 'Close' : 'Start'}
                  </button>
                )}
                
                {profile?.role === 'parent' && match.isPotmVotingOpen && selectedMatch?.id !== match.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedMatch(match); }}
                    className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-yellow-500 text-slate-950 hover:bg-yellow-400 transition-colors"
                  >
                    Vote
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedMatch && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div>
              {selectedMatch.isPotmVotingOpen ? (
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-500 mb-3 inline-block">
                  Voting Open
                </span>
              ) : (
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-slate-800 text-slate-400 mb-3 inline-block">
                  Voting Closed
                </span>
              )}
              <h2 className="text-2xl sm:text-3xl font-black text-slate-50 tracking-tight break-words">vs {selectedMatch.opponent}</h2>
              <p className="text-slate-400 mt-1 flex items-center gap-2 text-sm">
                <Clock size={14} />
                {selectedMatch.date ? format(new Date(selectedMatch.date), 'MMM d, yyyy') : 'Postponed TBA'}
              </p>
            </div>
          </div>

          {profile?.role === 'parent' && hasVoted ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center mb-8">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check size={24} className="text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-green-400 mb-1">Vote Cast Successfully</h3>
              <p className="text-slate-400 text-sm">Thank you for voting! Results will be visible to the coach.</p>
            </div>
          ) : profile?.role === 'parent' && selectedMatch.isPotmVotingOpen ? (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Select a Player</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {players.map(player => (
                  <button
                    key={player.id}
                    onClick={() => handleVote(player.id)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-50 p-4 rounded-xl font-medium transition-all flex items-center justify-between group border border-transparent hover:border-yellow-500/50"
                  >
                    <span className="text-lg">{player.name}</span>
                    <Star size={20} className="text-slate-600 group-hover:text-yellow-500 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ) : profile?.role === 'parent' && !selectedMatch.isPotmVotingOpen ? (
             <div className="text-center py-8">
               <p className="text-slate-400">Voting is currently closed for this match.</p>
             </div>
          ) : (profile?.role === 'coach' || isAdmin) ? (
            // Coach View: Show Results
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Current Standings</h3>
              {votes.length === 0 ? (
                <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-slate-800/50">
                  <p className="text-slate-400">No votes cast yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {players
                    .map(p => ({ ...p, votes: getVoteCount(p.id) }))
                    .sort((a, b) => b.votes - a.votes)
                    .filter(p => p.votes > 0)
                    .map((player, idx) => (
                      <div key={player.id} className="bg-slate-800/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-500 text-slate-950' : 'bg-slate-700 text-slate-400'}`}>
                            {idx + 1}
                          </div>
                          <span className="text-lg font-medium text-slate-50">{player.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-slate-50">{player.votes}</span>
                            <span className="text-xs text-slate-500 uppercase tracking-wider">Votes</span>
                          </div>
                          {selectedMatch.isPotmVotingOpen && (
                            <button
                              onClick={() => finalizeParentVote(player.id, player.name)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity bg-yellow-500 text-slate-950 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider"
                            >
                              Finalize
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : null}
        </motion.div>
      )}
    </div>
  );
}
