import React, { useState, useEffect } from 'react';
import { useAuth, UserProfile } from '../contexts/AuthContext';
import { doc, setDoc, collection, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { motion } from 'motion/react';
import { LogOut, UserX } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { ConfirmModal } from '../components/ConfirmModal';

export function Onboarding() {
  const { user, updateProfile, signOut, deleteProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState<'coach' | 'parent' | null>(null);
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [coachCode, setCoachCode] = useState('');
  const [startTrial, setStartTrial] = useState(true);
  const [createdTeam, setCreatedTeam] = useState<{ id: string, code: string } | null>(null);
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
    const code = searchParams.get('code');
    if (code) {
      setInviteCode(code);
      if (code.startsWith('P-')) {
        setRole('parent');
      } else {
        // For team codes, let them choose their role
        setRole(null);
      }
    }
  }, [searchParams]);

  const handleCoachSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName && !inviteCode) return;
    setLoading(true);
    setError('');

    try {
      let subscriptionUpdates: Partial<UserProfile> = {};

      // Handle Coach Code if provided
      if (coachCode.trim()) {
        const response = await fetch('/api/validate-coach-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: coachCode.trim().toUpperCase(), userId: user?.uid }),
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Invalid or already used coach code.');
          setLoading(false);
          return;
        }

        // The API already updates the user profile and marks the code as used.
        // We just need to make sure our local state is updated if we're going to use it.
        subscriptionUpdates.subscriptionStatus = 'active';
      } else if (startTrial) {
        // Start standard 3-month trial
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 3);
        subscriptionUpdates.trialEndDate = endDate.toISOString();
        subscriptionUpdates.subscriptionStatus = 'inactive'; // Still inactive but has trial date
      }

      if (inviteCode) {
        // Joining an existing team as a co-coach
        const code = inviteCode.trim().toUpperCase();
        const teamsRef = collection(db, 'teams');
        const q = query(teamsRef, where('code', '==', code));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setError('Invalid team code. Please check with your head coach.');
          setLoading(false);
          return;
        }

        const teamDoc = querySnapshot.docs[0];

        // Check if the team already has 3 coaches or managers
        const coachesQuery = query(
          collection(db, 'users'),
          where('teamId', '==', teamDoc.id),
          where('role', '==', 'coach')
        );
        const coachesSnapshot = await getDocs(coachesQuery);
        if (coachesSnapshot.size >= 3) {
          setError('This team already has the maximum number of coaches/managers (3).');
          setLoading(false);
          return;
        }

        const teamData = teamDoc.data();
        await updateProfile({ 
          role: 'coach', 
          teamId: teamDoc.id, 
          joinedTeams: [{ teamId: teamDoc.id, role: 'coach', teamName: teamData.name }],
          ...subscriptionUpdates 
        });
      } else {
        // Creating a new team
        // Generate a random 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const teamId = `team_${Date.now()}`;
        
        const teamRef = doc(db, 'teams', teamId);
        await setDoc(teamRef, {
          name: teamName,
          code,
          coachId: user?.uid,
          matchDuration: 45,
          ...subscriptionUpdates
        });

        // Store subscription updates in state to apply later if needed, 
        // but for now we apply them to the profile immediately
        await updateProfile({ ...subscriptionUpdates });

        // Show success screen instead of immediately redirecting
        setCreatedTeam({ id: teamId, code });
      }
    } catch (err: any) {
      try {
        handleFirestoreError(err, OperationType.CREATE, 'teams');
      } catch (e: any) {
        try {
          const parsed = JSON.parse(e.message);
          setError(parsed.error || 'Failed to setup team');
        } catch {
          setError(e.message || 'Failed to setup team');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const finishCoachSetup = async () => {
    if (!createdTeam) return;
    setLoading(true);
    try {
      await updateProfile({ 
        role: 'coach', 
        teamId: createdTeam.id,
        joinedTeams: [{ teamId: createdTeam.id, role: 'coach', teamName: teamName }]
      });
    } catch (err: any) {
      try {
        const parsed = JSON.parse(err.message);
        setError(parsed.error || 'Failed to update profile');
      } catch {
        setError(err.message || 'Failed to update profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleParentSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setError('Please enter a valid invite code');
      return;
    }
    setLoading(true);
    setError('');

    try {
      if (code.startsWith('P-')) {
        // Player Invite Code
        const playersRef = collection(db, 'players');
        const q = query(playersRef, where('inviteCode', '==', code));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setError('Invalid player invite code. Please check with your coach.');
          setLoading(false);
          return;
        }

        const playerDoc = querySnapshot.docs[0];
        const playerData = playerDoc.data();
        
        if (playerData.parentIds && playerData.parentIds.length >= 3) {
          setError('This player already has the maximum number of parents/managers (3).');
          setLoading(false);
          return;
        }

        // Get team name for joinedTeams
        const teamSnap = await getDocs(query(collection(db, 'teams'), where('__name__', '==', playerData.teamId)));
        const teamName = !teamSnap.empty ? teamSnap.docs[0].data().name : 'Unknown Team';

        // Add user to player's parentIds
        await updateDoc(doc(db, 'players', playerDoc.id), {
          parentIds: arrayUnion(user?.uid)
        });

        await updateProfile({ 
          role: 'parent', 
          teamId: playerData.teamId,
          joinedTeams: [{ teamId: playerData.teamId, role: 'parent', teamName }]
        });
      } else {
        // Legacy Team Code (6 digits)
        const teamsRef = collection(db, 'teams');
        const q = query(teamsRef, where('code', '==', code));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setError('Invalid team code. Please check with your coach.');
          setLoading(false);
          return;
        }

        const teamDoc = querySnapshot.docs[0];
        const teamData = teamDoc.data();
        await updateProfile({ 
          role: 'parent', 
          teamId: teamDoc.id,
          joinedTeams: [{ teamId: teamDoc.id, role: 'parent', teamName: teamData.name }]
        });
      }
    } catch (err: any) {
      try {
        handleFirestoreError(err, OperationType.GET, 'teams/players');
      } catch (e: any) {
        try {
          const parsed = JSON.parse(e.message);
          setError(parsed.error || 'Failed to join team');
        } catch {
          setError(e.message || 'Failed to join team');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (createdTeam) {
    return (
      <div className="min-h-screen bg-pitch-dark flex flex-col items-center justify-center p-4 relative font-sans overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-pitch-green/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-pitch-accent/10 rounded-full blur-3xl" />
        
        <div className="absolute top-4 right-4 flex items-center gap-4 z-20">
          <button
            onClick={signOut}
            className="text-chalk-white/40 hover:text-pitch-green transition-colors flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
            title="Sign Out"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-turf-surface/40 backdrop-blur-xl p-8 rounded-[2rem] border border-chalk-white/10 shadow-2xl text-center relative z-10"
        >
          <div className="w-20 h-20 bg-pitch-green/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-pitch-green/30">
            <svg className="w-10 h-10 text-pitch-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-display italic uppercase font-black text-chalk-white mb-2">Team Created!</h2>
          <p className="text-chalk-white/60 text-sm mb-8">Share this 6-digit code with your players and parents so they can join your team.</p>
          
          <div className="bg-pitch-dark/50 border border-chalk-white/10 rounded-2xl p-8 mb-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-pitch-green/5 opacity-50" />
            <div className="text-5xl font-mono font-black text-pitch-green tracking-[0.25em] relative z-10">
              {createdTeam.code}
            </div>
          </div>

          <button
            onClick={finishCoachSetup}
            disabled={loading}
            className="w-full bg-pitch-green hover:bg-pitch-accent text-pitch-dark py-4 rounded-xl font-display italic uppercase font-black transition-all disabled:opacity-50 shadow-lg shadow-pitch-green/20"
          >
            {loading ? 'Continuing...' : 'Continue to Dashboard'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pitch-dark flex flex-col items-center justify-center p-4 relative font-sans overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-pitch-green/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-pitch-accent/10 rounded-full blur-3xl" />
      
      <div className="absolute top-4 right-4 flex items-center gap-4 z-20">
        <button
          onClick={signOut}
          className="text-chalk-white/40 hover:text-pitch-green transition-colors flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
          title="Sign Out"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-turf-surface/40 backdrop-blur-xl p-8 rounded-[2rem] border border-chalk-white/10 shadow-2xl relative z-10"
      >
        <div className="text-center mb-10">
          <div className="w-1/2 mx-auto mb-6 flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Touchline Hub Logo" 
              className="w-full h-auto object-contain drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden w-20 h-20 bg-gradient-to-br from-pitch-green to-pitch-accent rounded-2xl flex items-center justify-center shadow-lg shadow-pitch-green/20 transform -rotate-6 border-2 border-chalk-white/20">
              <span className="text-pitch-dark font-black text-4xl tracking-tighter font-display italic">TH</span>
            </div>
          </div>
          <h1 className="text-3xl font-display italic uppercase font-black text-chalk-white mb-2 tracking-tight leading-tight">Welcome to<br/>The Touchline Hub</h1>
          <p className="text-chalk-white/60 text-[10px] font-bold uppercase tracking-widest">Let's get you set up.</p>
        </div>

        {!role ? (
          <div className="space-y-4">
            <div className="bg-pitch-dark/80 border border-chalk-white/5 rounded-2xl p-6 text-center">
              <p className="text-sm text-chalk-white font-medium mb-4">
                Are you a parent or player?
              </p>
              <button
                onClick={() => setRole('parent')}
                className="w-full bg-pitch-green hover:bg-pitch-accent text-pitch-dark py-4 rounded-xl font-display italic uppercase font-black transition-all flex items-center justify-center gap-2"
              >
                Join Team with Code
              </button>
            </div>
            
            <div className="mt-8 pt-8 border-t border-chalk-white/5 text-center">
              <p className="text-xs text-chalk-white/40 mb-3">
                Are you a coach looking to setup a new team?
              </p>
              <a 
                href="https://touchlinehub.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-pitch-green hover:underline uppercase tracking-widest"
              >
                Sign up at touchlinehub.com
              </a>
            </div>
          </div>
        ) : role === 'coach' ? (
          <form onSubmit={handleCoachSetup} className="space-y-6">
            <div className="space-y-5">
              <div className="flex p-1 bg-pitch-dark/80 rounded-xl border border-chalk-white/10">
                <button
                  type="button"
                  onClick={() => { setTeamName(''); setInviteCode(''); setError(''); }}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all font-display italic ${!inviteCode && teamName === '' ? 'bg-pitch-green text-pitch-dark shadow-md' : 'text-chalk-white/40'}`}
                >
                  Create New
                </button>
                <button
                  type="button"
                  onClick={() => { setTeamName(''); setInviteCode(' '); setError(''); }}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all font-display italic ${inviteCode ? 'bg-pitch-green text-pitch-dark shadow-md' : 'text-chalk-white/40'}`}
                >
                  Join Existing
                </button>
              </div>

              {!inviteCode ? (
                <div>
                  <label className="block text-[10px] font-bold text-chalk-white/50 uppercase tracking-widest mb-1.5 ml-1">Team Name</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white focus:outline-none focus:border-pitch-green focus:ring-1 focus:ring-pitch-green transition-all placeholder:text-chalk-white/20"
                    placeholder="e.g. Astley & Buckshaw U10s"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-chalk-white/50 uppercase tracking-widest mb-1.5 ml-1">Team Code</label>
                  <input
                    type="text"
                    value={inviteCode.trim()}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white text-center text-3xl font-mono font-black tracking-[0.2em] focus:outline-none focus:border-pitch-green focus:ring-1 focus:ring-pitch-green transition-all uppercase placeholder:text-chalk-white/10"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                  <p className="text-[10px] font-bold text-chalk-white/20 mt-3 text-center uppercase tracking-widest">Enter the 6-digit team code provided by the head coach.</p>
                </div>
              )}

              {!inviteCode && (
                <div className="space-y-4 pt-2">
                  <div className="bg-pitch-green/5 border border-pitch-green/20 rounded-xl p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={startTrial}
                        onChange={(e) => setStartTrial(e.target.checked)}
                        className="w-5 h-5 rounded border-chalk-white/10 bg-pitch-dark/50 text-pitch-green focus:ring-pitch-green focus:ring-offset-pitch-dark"
                      />
                      <div className="flex-1">
                        <div className="text-xs font-bold text-chalk-white uppercase tracking-wider">Start 3-Month Free Trial</div>
                        <div className="text-[10px] text-chalk-white/40 font-medium">Full access to all features, no credit card required.</div>
                      </div>
                    </label>
                  </div>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowCodeInput(!showCodeInput)}
                      className="text-[10px] font-bold text-chalk-white/30 hover:text-pitch-green transition-colors uppercase tracking-widest"
                    >
                      {showCodeInput ? "I don't have a code" : "Have a promo code?"}
                    </button>
                  </div>

                  {showCodeInput && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2"
                    >
                      <label className="block text-[10px] font-bold text-chalk-white/50 uppercase tracking-widest mb-1.5 ml-1">Promo Code</label>
                      <input
                        type="text"
                        value={coachCode}
                        onChange={(e) => setCoachCode(e.target.value.toUpperCase())}
                        className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3 text-chalk-white font-mono tracking-wider focus:outline-none focus:border-pitch-green focus:ring-1 focus:ring-pitch-green transition-all placeholder:text-chalk-white/10"
                        placeholder="ENTER CODE"
                      />
                    </motion.div>
                  )}
                </div>
              )}
            </div>
            {error && <div className="text-red-400 text-[10px] font-bold uppercase tracking-widest text-center bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setRole(null); setError(''); setInviteCode(''); setTeamName(''); }}
                className="flex-1 bg-pitch-dark/50 hover:bg-pitch-dark text-chalk-white/60 py-4 rounded-xl font-display italic uppercase font-black transition-all border border-chalk-white/5"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-pitch-green hover:bg-pitch-accent text-pitch-dark py-4 rounded-xl font-display italic uppercase font-black transition-all disabled:opacity-50 shadow-lg shadow-pitch-green/20"
              >
                {loading ? 'Processing...' : (inviteCode ? 'Join Team' : 'Create Team')}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleParentSetup} className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-chalk-white/50 uppercase tracking-widest mb-1.5 ml-1">Invite Code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white text-center text-2xl font-mono font-black tracking-[0.1em] focus:outline-none focus:border-pitch-green focus:ring-1 focus:ring-pitch-green transition-all uppercase placeholder:text-chalk-white/10"
                placeholder="P-XXXXXX or 000000"
                maxLength={8}
                required
              />
              <p className="text-[10px] font-bold text-chalk-white/20 mt-3 text-center uppercase tracking-widest">Enter your Player Invite Code or Team Code.</p>
            </div>
            {error && <div className="text-red-400 text-[10px] font-bold uppercase tracking-widest text-center bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setRole(null); setError(''); }}
                className="flex-1 bg-pitch-dark/50 hover:bg-pitch-dark text-chalk-white/60 py-4 rounded-xl font-display italic uppercase font-black transition-all border border-chalk-white/5"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-pitch-green hover:bg-pitch-accent text-pitch-dark py-4 rounded-xl font-display italic uppercase font-black transition-all disabled:opacity-50 shadow-lg shadow-pitch-green/20"
              >
                {loading ? 'Joining...' : 'Join Team'}
              </button>
            </div>
          </form>
        )}
      </motion.div>

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
