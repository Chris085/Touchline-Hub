import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc, getDoc, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Trash2, Shield, Copy, Check, UserPlus, ChevronRight, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface Player {
  id: string;
  name: string;
  teamId: string;
  parentIds: string[];
  inviteCode?: string;
  motmAwards: number;
  position?: string;
}

import { ConfirmModal } from '../components/ConfirmModal';

export function Squad() {
  const { profile, isSubscribed } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [team, setTeam] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPosition, setNewPlayerPosition] = useState('');
  const [copied, setCopied] = useState(false);
  const [invitePlayer, setInvitePlayer] = useState<Player | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [showTeamInviteModal, setShowTeamInviteModal] = useState(false);
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

  useEffect(() => {
    if (!profile?.teamId) return;

    // Fetch team details
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

    // Fetch team members (for parent names)
    const membersRef = collection(db, 'users');
    const qMembers = query(membersRef, where('teamId', '==', profile.teamId));
    const unsubMembers = onSnapshot(qMembers, (snapshot) => {
      setTeamMembers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    });

    // Fetch players
    const playersRef = collection(db, 'players');
    const q = query(playersRef, where('teamId', '==', profile.teamId));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      // Sort by name
      playersData.sort((a, b) => a.name.localeCompare(b.name));
      setPlayers(playersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'players'));

    return () => {
      unsub();
      unsubMembers();
    };
  }, [profile?.teamId, profile?.uid, profile?.role]);

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'P-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleInviteClick = async (player: Player) => {
    if (!player.inviteCode) {
      const newCode = generateInviteCode();
      try {
        await updateDoc(doc(db, 'players', player.id), {
          inviteCode: newCode
        });
        setInvitePlayer({ ...player, inviteCode: newCode });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `players/${player.id}`);
      }
    } else {
      setInvitePlayer(player);
    }
  };

  const handleToggleParentStatus = async (player: Player) => {
    if (!profile?.uid) return;
    const isParent = player.parentIds?.includes(profile.uid);
    const newParentIds = isParent 
      ? (player.parentIds || []).filter(uid => uid !== profile.uid)
      : [...(player.parentIds || []), profile.uid];

    try {
      await updateDoc(doc(db, 'players', player.id), {
        parentIds: newParentIds
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `players/${player.id}`);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.teamId || !newPlayerName.trim() || !isSubscribed) return;

    try {
      await addDoc(collection(db, 'players'), {
        name: newPlayerName.trim(),
        position: newPlayerPosition,
        teamId: profile.teamId,
        parentIds: [],
        inviteCode: generateInviteCode(),
        motmAwards: 0
      });
      setShowAddModal(false);
      setNewPlayerName('');
      setNewPlayerPosition('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'players');
    }
  };

  const handleJoinPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubscribed) return;
    const code = joinCode.trim().toUpperCase();
    if (!code || !code.startsWith('P-')) {
      setJoinError('Please enter a valid player invite code (e.g. P-XXXXXX)');
      return;
    }
    
    setJoinLoading(true);
    setJoinError('');

    try {
      const playersRef = collection(db, 'players');
      const q = query(playersRef, where('inviteCode', '==', code));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setJoinError('Invalid player invite code. Please check with your coach.');
        setJoinLoading(false);
        return;
      }

      const playerDoc = querySnapshot.docs[0];
      const playerData = playerDoc.data();
      
      if (playerData.parentIds && playerData.parentIds.length >= 3) {
        setJoinError('This player already has the maximum number of parents/managers (3).');
        setJoinLoading(false);
        return;
      }

      if (playerData.parentIds?.includes(profile?.uid)) {
        setJoinError('You are already managing this player.');
        setJoinLoading(false);
        return;
      }

      // Add user to player's parentIds
      await updateDoc(doc(db, 'players', playerDoc.id), {
        parentIds: arrayUnion(profile?.uid)
      });

      setShowJoinModal(false);
      setJoinCode('');
    } catch (err: any) {
      try {
        handleFirestoreError(err, OperationType.GET, 'players');
      } catch (e: any) {
        try {
          const parsed = JSON.parse(e.message);
          setJoinError(parsed.error || 'Failed to join player');
        } catch {
          setJoinError(e.message || 'Failed to join player');
        }
      }
    } finally {
      setJoinLoading(false);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Player',
      message: 'Are you sure you want to remove this player?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'players', playerId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `players/${playerId}`);
        }
      }
    });
  };

  const copyTeamInvite = () => {
    if (team?.code) {
      const inviteUrl = `${window.location.origin}/?code=${team.code}`;
      const text = `Join ${team.name} on The Touchline Hub!\n\nUse this invite link:\n${inviteUrl}\n\nOr enter code manually: ${team.code}`;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyInviteLink = (player: Player) => {
    if (player.inviteCode) {
      const inviteUrl = `${window.location.origin}/?code=${player.inviteCode}`;
      const text = `Join ${player.name}'s profile on The Touchline Hub!\n\nUse this invite link:\n${inviteUrl}\n\nOr enter code manually: ${player.inviteCode}`;
      navigator.clipboard.writeText(text);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    }
  };

  const isCoach = profile?.role === 'coach';
  const canViewProfile = (player: Player) => isCoach || player.parentIds?.includes(profile?.uid || '');

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-display italic uppercase font-black text-chalk-white tracking-tight">Team Squad</h1>
          </div>
          <p className="text-pitch-green font-bold uppercase tracking-widest text-[10px] mt-1">{team?.name || 'Loading team...'}</p>
        </div>
        
        <div className="flex gap-3">
          {profile?.role === 'coach' && team && (
            <button
              onClick={() => setShowTeamInviteModal(true)}
              className="bg-pitch-dark/50 hover:bg-pitch-dark text-chalk-white px-5 py-3 rounded-xl font-bold flex items-center gap-3 transition-all border border-chalk-white/5 shadow-xl group"
            >
              {copied ? <Check size={18} className="text-pitch-green" /> : <Copy size={18} className="text-chalk-white/40 group-hover:text-pitch-green transition-colors" />}
              <span className="text-xs uppercase tracking-wider">Code: <span className="font-mono text-pitch-green tracking-widest ml-1">{team.code}</span></span>
            </button>
          )}
          
          {(profile?.role === 'coach') && (
            <button
              onClick={() => {
                if (!isSubscribed) {
                  navigate('/upgrade');
                  return;
                }
                setShowAddModal(true);
              }}
              className={`${isSubscribed ? 'bg-pitch-green hover:bg-pitch-accent shadow-pitch-green/20' : 'bg-slate-700 hover:bg-slate-600 shadow-none'} text-pitch-dark px-6 py-3 rounded-xl font-display italic uppercase font-black flex items-center gap-2 transition-all shadow-lg`}
            >
              {isSubscribed ? <Plus size={20} strokeWidth={3} /> : <Zap size={18} className="text-chalk-white/60" />}
              <span className="hidden sm:inline">{isSubscribed ? 'Add Player' : 'Upgrade to Add'}</span>
            </button>
          )}
          
          {(profile?.role === 'parent') && (
            <button
              onClick={() => {
                if (!isSubscribed) {
                  navigate('/upgrade');
                  return;
                }
                setShowJoinModal(true);
              }}
              className={`${isSubscribed ? 'bg-pitch-green hover:bg-pitch-accent shadow-pitch-green/20' : 'bg-slate-700 hover:bg-slate-600 shadow-none'} text-pitch-dark px-6 py-3 rounded-xl font-display italic uppercase font-black flex items-center gap-2 transition-all shadow-lg`}
            >
              {isSubscribed ? <Plus size={20} strokeWidth={3} /> : <Zap size={18} className="text-chalk-white/60" />}
              <span className="hidden sm:inline">{isSubscribed ? 'Add Player' : 'Upgrade to Add'}</span>
            </button>
          )}
        </div>
      </div>

      {players.length === 0 ? (
        <div className="bg-turf-surface/20 border border-chalk-white/5 rounded-[2rem] p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-pitch-green/5 opacity-50" />
          <div className="w-24 h-24 bg-pitch-dark/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-chalk-white/10 relative z-10">
            <Users size={40} className="text-chalk-white/20" />
          </div>
          <h3 className="text-2xl font-display italic uppercase font-black text-chalk-white mb-3 relative z-10">No players yet</h3>
          <p className="text-chalk-white/40 text-sm font-medium max-w-xs mx-auto relative z-10">
            {profile?.role === 'coach' 
              ? "Add players to your squad to generate invite codes for their parents." 
              : "Click 'Add Player' and enter an invite code from your coach."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={canViewProfile(player) ? { y: -4 } : {}}
              className={`bg-turf-surface/40 backdrop-blur-md border border-chalk-white/10 rounded-2xl p-5 flex items-center justify-between group transition-all shadow-xl relative overflow-hidden ${
                canViewProfile(player) ? 'cursor-pointer hover:border-pitch-green/50' : 'cursor-default opacity-60'
              }`}
              onClick={() => {
                if (canViewProfile(player)) {
                  navigate(`/player/${player.id}`);
                }
              }}
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-pitch-green/20 group-hover:bg-pitch-green transition-colors" />
              
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-pitch-dark/50 flex items-center justify-center text-chalk-white font-black text-xl uppercase overflow-hidden border border-chalk-white/10 shadow-inner group-hover:border-pitch-green/30 transition-colors">
                  {player.profileImageUrl ? (
                    <img 
                      src={player.profileImageUrl} 
                      alt={player.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="font-display italic">{player.name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <h4 className="text-chalk-white font-display italic uppercase font-black text-lg group-hover:text-pitch-green transition-colors leading-tight">{player.name}</h4>
                  <div className="flex items-center gap-3 mt-1.5">
                    {player.position && (
                      <span className="bg-pitch-green/10 text-pitch-green px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-pitch-green/20">
                        {player.position}
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-pitch-accent">
                      <Shield size={12} strokeWidth={3} />
                      <span className="text-[10px] font-black uppercase tracking-wider">{player.motmAwards} MOTM</span>
                    </div>
                  </div>
                  {isCoach && player.parentIds && player.parentIds.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {player.parentIds.map(pid => {
                        const parent = teamMembers.find(m => m.uid === pid);
                        if (!parent) return null;
                        return (
                          <span key={pid} className="text-[9px] text-chalk-white/40 font-bold uppercase tracking-widest bg-chalk-white/5 px-2 py-0.5 rounded border border-chalk-white/5">
                            {parent.displayName || parent.email.split('@')[0]}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1 relative z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all transform sm:translate-x-4 sm:group-hover:translate-x-0">
                {isCoach && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInviteClick(player);
                      }}
                      className="text-chalk-white/40 hover:text-pitch-green transition-colors p-2 hover:bg-pitch-dark/50 rounded-lg"
                      title="Invite Parent"
                    >
                      <UserPlus size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleParentStatus(player);
                      }}
                      className={`transition-colors p-2 hover:bg-pitch-dark/50 rounded-lg ${player.parentIds?.includes(profile?.uid || '') ? 'text-pitch-green' : 'text-chalk-white/40 hover:text-pitch-green'}`}
                      title={player.parentIds?.includes(profile?.uid || '') ? "Unlink as Parent" : "Link as Parent"}
                    >
                      <Users size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlayer(player.id);
                      }}
                      className="text-chalk-white/20 hover:text-red-500 transition-colors p-2 hover:bg-red-500/10 rounded-lg"
                      title="Remove Player"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
                {canViewProfile(player) && (
                  <ChevronRight size={20} className="text-chalk-white/20 sm:hidden group-hover:block ml-1" />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Team Invite Modal */}
      {showTeamInviteModal && team && (
        <div className="fixed inset-0 bg-pitch-dark/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-turf-surface/60 border border-chalk-white/10 rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-pitch-green/50" />
            <h2 className="text-2xl font-display italic uppercase font-black text-chalk-white mb-2 tracking-tight">Invite Coach or Parent</h2>
            <p className="text-chalk-white/60 text-sm mb-8 font-medium">
              Share this team code with other coaches to help manage the team, or with parents to join the team.
            </p>
            
            <div className="bg-pitch-dark/50 border border-chalk-white/10 rounded-2xl p-8 mb-8 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-pitch-green/5 opacity-50" />
              <span className="text-[10px] font-bold text-chalk-white/30 uppercase tracking-widest block mb-3 relative z-10">Team Invite Code</span>
              <span className="text-4xl font-mono font-black text-pitch-green tracking-[0.25em] relative z-10">{team.code}</span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowTeamInviteModal(false)}
                className="flex-1 bg-pitch-dark/50 hover:bg-pitch-dark text-chalk-white/60 py-4 rounded-xl font-display italic uppercase font-black transition-all border border-chalk-white/5 text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={copyTeamInvite}
                className="flex-1 bg-pitch-green hover:bg-pitch-accent text-pitch-dark py-4 rounded-xl font-display italic uppercase font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-pitch-green/20 text-xs"
              >
                {copied ? <Check size={18} strokeWidth={3} /> : <Copy size={18} strokeWidth={3} />}
                {copied ? 'Copied!' : 'Copy Invite'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Invite Player Modal */}
      {invitePlayer && (
        <div className="fixed inset-0 bg-pitch-dark/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-turf-surface/60 border border-chalk-white/10 rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-pitch-green/50" />
            <h2 className="text-2xl font-display italic uppercase font-black text-chalk-white mb-2 tracking-tight">Invite Parent/Player</h2>
            <p className="text-chalk-white/60 text-sm mb-8 font-medium">
              Share this invite code with {invitePlayer.name}'s parents or the player themselves. Up to 3 people can manage this profile.
            </p>
            
            <div className="bg-pitch-dark/50 border border-chalk-white/10 rounded-2xl p-8 mb-8 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-pitch-green/5 opacity-50" />
              <span className="text-[10px] font-bold text-chalk-white/30 uppercase tracking-widest block mb-3 relative z-10">Player Invite Code</span>
              <span className="text-4xl font-mono font-black text-pitch-green tracking-widest relative z-10">{invitePlayer.inviteCode}</span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setInvitePlayer(null)}
                className="flex-1 bg-pitch-dark/50 hover:bg-pitch-dark text-chalk-white/60 py-4 rounded-xl font-display italic uppercase font-black transition-all border border-chalk-white/5 text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => copyInviteLink(invitePlayer)}
                className="flex-1 bg-pitch-green hover:bg-pitch-accent text-pitch-dark py-4 rounded-xl font-display italic uppercase font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-pitch-green/20 text-xs"
              >
                {inviteCopied ? <Check size={18} strokeWidth={3} /> : <Copy size={18} strokeWidth={3} />}
                {inviteCopied ? 'Copied!' : 'Copy Invite'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Join Player Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-pitch-dark/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-turf-surface/60 border border-chalk-white/10 rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-pitch-green/50" />
            <h2 className="text-2xl font-display italic uppercase font-black text-chalk-white mb-6 tracking-tight">Add Another Player</h2>
            <form onSubmit={handleJoinPlayer} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-chalk-white/50 uppercase tracking-widest mb-1.5 ml-1">Player Invite Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-4 text-chalk-white text-center text-3xl font-mono font-black tracking-[0.2em] focus:outline-none focus:border-pitch-green focus:ring-1 focus:ring-pitch-green transition-all uppercase placeholder:text-chalk-white/10"
                  placeholder="P-XXXXXX"
                  maxLength={8}
                  required
                  autoFocus
                />
              </div>
              
              {joinError && <div className="text-red-400 text-[10px] font-bold uppercase tracking-widest text-center bg-red-500/10 p-3 rounded-lg border border-red-500/20">{joinError}</div>}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowJoinModal(false); setJoinError(''); }}
                  className="flex-1 bg-pitch-dark/50 hover:bg-pitch-dark text-chalk-white/60 py-4 rounded-xl font-display italic uppercase font-black transition-all border border-chalk-white/5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="flex-1 bg-pitch-green hover:bg-pitch-accent text-pitch-dark py-4 rounded-xl font-display italic uppercase font-black transition-all disabled:opacity-50 shadow-lg shadow-pitch-green/20 text-xs"
                >
                  {joinLoading ? 'Adding...' : 'Add Player'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Player Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-pitch-dark/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-turf-surface/60 border border-chalk-white/10 rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-pitch-green/50" />
            <h2 className="text-2xl font-display italic uppercase font-black text-chalk-white mb-6 tracking-tight">Add Player</h2>
            <form onSubmit={handleAddPlayer} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-chalk-white/50 uppercase tracking-widest mb-1.5 ml-1">Player Name</label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-4 text-chalk-white focus:outline-none focus:border-pitch-green focus:ring-1 focus:ring-pitch-green transition-all placeholder:text-chalk-white/20"
                  placeholder="e.g. Marcus Rashford"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-chalk-white/50 uppercase tracking-widest mb-1.5 ml-1">Position</label>
                <select
                  value={newPlayerPosition}
                  onChange={(e) => setNewPlayerPosition(e.target.value)}
                  className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-4 text-chalk-white focus:outline-none focus:border-pitch-green focus:ring-1 focus:ring-pitch-green transition-all appearance-none"
                >
                  <option value="" className="bg-pitch-dark">Select Position (Optional)</option>
                  <option value="GK" className="bg-pitch-dark">Goalkeeper (GK)</option>
                  <option value="CB" className="bg-pitch-dark">Center Back (CB)</option>
                  <option value="LB" className="bg-pitch-dark">Left Back (LB)</option>
                  <option value="RB" className="bg-pitch-dark">Right Back (RB)</option>
                  <option value="LWB" className="bg-pitch-dark">Left Wing Back (LWB)</option>
                  <option value="RWB" className="bg-pitch-dark">Right Wing Back (RWB)</option>
                  <option value="CDM" className="bg-pitch-dark">Defensive Midfielder (CDM)</option>
                  <option value="CM" className="bg-pitch-dark">Central Midfielder (CM)</option>
                  <option value="CAM" className="bg-pitch-dark">Attacking Midfielder (CAM)</option>
                  <option value="LM" className="bg-pitch-dark">Left Midfielder (LM)</option>
                  <option value="RM" className="bg-pitch-dark">Right Midfielder (RM)</option>
                  <option value="LW" className="bg-pitch-dark">Left Winger (LW)</option>
                  <option value="RW" className="bg-pitch-dark">Right Winger (RW)</option>
                  <option value="CF" className="bg-pitch-dark">Center Forward (CF)</option>
                  <option value="ST" className="bg-pitch-dark">Striker (ST)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-pitch-dark/50 hover:bg-pitch-dark text-chalk-white/60 py-4 rounded-xl font-display italic uppercase font-black transition-all border border-chalk-white/5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-pitch-green hover:bg-pitch-accent text-pitch-dark py-4 rounded-xl font-display italic uppercase font-black transition-all shadow-lg shadow-pitch-green/20 text-xs"
                >
                  Add Player
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
