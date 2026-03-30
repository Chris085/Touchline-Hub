import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc, getDoc, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Trash2, Shield, Copy, Check, UserPlus, ChevronRight, Settings } from 'lucide-react';
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
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
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
  const [halfDuration, setHalfDuration] = useState(20);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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

    // Fetch players
    const playersRef = collection(db, 'players');
    const q = profile.role === 'coach'
      ? query(playersRef, where('teamId', '==', profile.teamId))
      : query(playersRef, where('parentIds', 'array-contains', profile.uid));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      // Sort by name
      playersData.sort((a, b) => a.name.localeCompare(b.name));
      setPlayers(playersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'players'));

    return () => unsub();
  }, [profile?.teamId, profile?.uid, profile?.role]);

  useEffect(() => {
    if (team?.halfDuration) {
      setHalfDuration(team.halfDuration);
    }
  }, [team]);

  const handleSaveSettings = async () => {
    if (!profile?.teamId) return;
    setIsSavingSettings(true);
    try {
      await updateDoc(doc(db, 'teams', profile.teamId), {
        halfDuration: Number(halfDuration)
      });
      setTeam(prev => ({ ...prev, halfDuration: Number(halfDuration) }));
      setShowSettings(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `teams/${profile.teamId}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

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
    if (!profile?.teamId || !newPlayerName.trim()) return;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Team Squad</h1>
            {profile?.role === 'coach' && (
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
              >
                <Settings size={20} />
              </button>
            )}
          </div>
          <p className="text-slate-400 text-sm">{team?.name || 'Loading team...'}</p>
        </div>
        
        <div className="flex gap-3">
          {profile?.role === 'coach' && team && (
            <button
              onClick={() => setShowTeamInviteModal(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors border border-slate-700"
            >
              {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
              <span>Code: <span className="font-mono text-green-400 tracking-widest ml-1">{team.code}</span></span>
            </button>
          )}
          
          {(profile?.role === 'coach') && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-green-500 hover:bg-green-400 text-slate-950 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Add Player</span>
            </button>
          )}
          
          {(profile?.role === 'parent') && (
            <button
              onClick={() => setShowJoinModal(true)}
              className="bg-green-500 hover:bg-green-400 text-slate-950 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Add Player</span>
            </button>
          )}
        </div>
      </div>

      {showSettings && profile?.role === 'coach' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6"
        >
          <h2 className="text-lg font-bold text-white mb-4">Team Settings</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Half Duration (minutes)</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={halfDuration}
                  onChange={(e) => setHalfDuration(Number(e.target.value))}
                  min="1"
                  max="60"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white px-6 py-2 rounded-xl font-bold transition-colors"
                >
                  {isSavingSettings ? 'Saving...' : 'Save'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">This will be used as the default duration for each half in the match controller.</p>
            </div>
          </div>
        </motion.div>
      )}

      {players.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={32} className="text-slate-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No players yet</h3>
          <p className="text-slate-400">
            {profile?.role === 'coach' 
              ? "Add players to your squad to generate invite codes for their parents." 
              : "Click 'Add Player' and enter an invite code from your coach."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between group cursor-pointer hover:border-slate-700 transition-colors"
              onClick={() => navigate(`/player/${player.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold uppercase overflow-hidden border border-slate-700">
                  {player.profileImageUrl ? (
                    <img 
                      src={player.profileImageUrl} 
                      alt={player.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    player.name.charAt(0)
                  )}
                </div>
                <div>
                  <h4 className="text-white font-medium group-hover:text-green-400 transition-colors">{player.name}</h4>
                  <div className="flex items-center gap-2 text-xs mt-0.5">
                    {player.position && (
                      <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-medium">
                        {player.position}
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-yellow-500">
                      <Shield size={12} />
                      <span>{player.motmAwards} MOTM</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                {profile?.role === 'coach' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInviteClick(player);
                      }}
                      className="text-slate-400 hover:text-green-400 transition-colors p-2"
                      title="Invite Parent"
                    >
                      <UserPlus size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleParentStatus(player);
                      }}
                      className={`transition-colors p-2 ${player.parentIds?.includes(profile?.uid || '') ? 'text-green-500 hover:text-green-400' : 'text-slate-400 hover:text-green-400'}`}
                      title={player.parentIds?.includes(profile?.uid || '') ? "Unlink as Parent" : "Link as Parent"}
                    >
                      <Users size={18} />
                    </button>
                  </>
                )}
                {(profile?.role === 'coach' || player.parentIds?.includes(profile?.uid || '')) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePlayer(player.id);
                    }}
                    className="text-slate-500 hover:text-red-400 transition-colors p-2"
                    title="Remove Player"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <ChevronRight size={20} className="text-slate-600 sm:hidden group-hover:block ml-2" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Team Invite Modal */}
      {showTeamInviteModal && team && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-xl font-bold text-white mb-2">Invite Coach or Parent</h2>
            <p className="text-slate-400 text-sm mb-6">
              Share this team code with other coaches to help manage the team, or with parents to join the team.
            </p>
            
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6 text-center">
              <span className="text-xs text-slate-500 uppercase tracking-wider block mb-2">Team Invite Code</span>
              <span className="text-3xl font-mono font-bold text-green-400 tracking-[0.2em] ml-2">{team.code}</span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowTeamInviteModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-medium transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={copyTeamInvite}
                className="flex-1 bg-green-500 hover:bg-green-400 text-slate-950 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy Invite'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Invite Player Modal */}
      {invitePlayer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-xl font-bold text-white mb-2">Invite Parent/Player</h2>
            <p className="text-slate-400 text-sm mb-6">
              Share this invite code with {invitePlayer.name}'s parents or the player themselves. Up to 3 people can manage this profile.
            </p>
            
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6 text-center">
              <span className="text-xs text-slate-500 uppercase tracking-wider block mb-2">Player Invite Code</span>
              <span className="text-3xl font-mono font-bold text-green-400 tracking-widest">{invitePlayer.inviteCode}</span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setInvitePlayer(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-medium transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => copyInviteLink(invitePlayer)}
                className="flex-1 bg-green-500 hover:bg-green-400 text-slate-950 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                {inviteCopied ? <Check size={18} /> : <Copy size={18} />}
                {inviteCopied ? 'Copied!' : 'Copy Invite'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Join Player Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-xl font-bold text-white mb-4">Add Another Player</h2>
            <form onSubmit={handleJoinPlayer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Player Invite Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-green-500 uppercase"
                  placeholder="P-XXXXXX"
                  maxLength={8}
                  required
                  autoFocus
                />
              </div>
              
              {joinError && <div className="text-red-400 text-sm text-center">{joinError}</div>}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowJoinModal(false); setJoinError(''); }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="flex-1 bg-green-500 hover:bg-green-400 text-slate-950 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-xl font-bold text-white mb-4">Add Player</h2>
            <form onSubmit={handleAddPlayer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Player Name</label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
                  placeholder="e.g. Marcus Rashford"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Position</label>
                <select
                  value={newPlayerPosition}
                  onChange={(e) => setNewPlayerPosition(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
                >
                  <option value="">Select Position (Optional)</option>
                  <option value="GK">Goalkeeper (GK)</option>
                  <option value="CB">Center Back (CB)</option>
                  <option value="LB">Left Back (LB)</option>
                  <option value="RB">Right Back (RB)</option>
                  <option value="LWB">Left Wing Back (LWB)</option>
                  <option value="RWB">Right Wing Back (RWB)</option>
                  <option value="CDM">Defensive Midfielder (CDM)</option>
                  <option value="CM">Central Midfielder (CM)</option>
                  <option value="CAM">Attacking Midfielder (CAM)</option>
                  <option value="LM">Left Midfielder (LM)</option>
                  <option value="RM">Right Midfielder (RM)</option>
                  <option value="LW">Left Winger (LW)</option>
                  <option value="RW">Right Winger (RW)</option>
                  <option value="CF">Center Forward (CF)</option>
                  <option value="ST">Striker (ST)</option>
                </select>
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
