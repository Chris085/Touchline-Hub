import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
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

  const handleDeleteProfile = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Profile',
      message: 'Are you sure you want to delete your profile and start over? This cannot be undone.',
      onConfirm: async () => {
        await deleteProfile();
        setRole(null);
        setTeamName('');
        setInviteCode('');
        setCreatedTeam(null);
      }
    });
  };

  const handleCoachSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName && !inviteCode) return;
    setLoading(true);
    setError('');

    try {
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
        await updateProfile({ role: 'coach', teamId: teamDoc.id });
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
          matchDuration: 45
        });

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
      await updateProfile({ role: 'coach', teamId: createdTeam.id });
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

        // Add user to player's parentIds
        await updateDoc(doc(db, 'players', playerDoc.id), {
          parentIds: arrayUnion(user?.uid)
        });

        await updateProfile({ role: 'parent', teamId: playerData.teamId });
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
        await updateProfile({ role: 'parent', teamId: teamDoc.id });
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4 flex items-center gap-4">
          <button
            onClick={handleDeleteProfile}
            className="text-slate-400 hover:text-red-400 transition-colors flex items-center gap-2 text-sm"
            title="Reset Profile"
          >
            <UserX size={16} />
            <span className="hidden sm:inline">Reset Profile</span>
          </button>
          <button
            onClick={signOut}
            className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
            title="Sign Out"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl text-center"
        >
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Team Created!</h2>
          <p className="text-slate-400 mb-6">Share this 6-digit code with your players and parents so they can join your team.</p>
          
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 mb-8">
            <div className="text-4xl font-mono font-bold text-green-400 tracking-[0.25em] ml-2">
              {createdTeam.code}
            </div>
          </div>

          <button
            onClick={finishCoachSetup}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 text-slate-950 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            {loading ? 'Continuing...' : 'Continue to Dashboard'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        <button
          onClick={handleDeleteProfile}
          className="text-slate-400 hover:text-red-400 transition-colors flex items-center gap-2 text-sm"
          title="Reset Profile"
        >
          <UserX size={16} />
          <span className="hidden sm:inline">Reset Profile</span>
        </button>
        <button
          onClick={signOut}
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
          title="Sign Out"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-slate-950 font-bold text-2xl">TH</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to The Touchline Hub</h1>
          <p className="text-slate-400">Let's get you set up.</p>
        </div>

        {!role ? (
          <div className="space-y-4">
            <button
              onClick={() => setRole('coach')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-xl font-medium transition-colors flex items-center justify-between group"
            >
              <div className="text-left">
                <div className="text-lg">I'm a Coach</div>
                <div className="text-sm text-slate-400 font-normal">Create a new team and manage matches</div>
              </div>
              <div className="text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">→</div>
            </button>
            <button
              onClick={() => setRole('parent')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-xl font-medium transition-colors flex items-center justify-between group"
            >
              <div className="text-left">
                <div className="text-lg">I'm a Player / Parent</div>
                <div className="text-sm text-slate-400 font-normal">Join an existing team with a code</div>
              </div>
              <div className="text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">→</div>
            </button>
          </div>
        ) : role === 'coach' ? (
          <form onSubmit={handleCoachSetup} className="space-y-4">
            <div className="space-y-4">
              <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => { setTeamName(''); setInviteCode(''); setError(''); }}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${!inviteCode && teamName === '' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                >
                  Create New
                </button>
                <button
                  type="button"
                  onClick={() => { setTeamName(''); setInviteCode(' '); setError(''); }}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${inviteCode ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                >
                  Join Existing
                </button>
              </div>

              {!inviteCode ? (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Team Name</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                    placeholder="e.g. Astley & Buckshaw U10s"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Team Code</label>
                  <input
                    type="text"
                    value={inviteCode.trim()}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all uppercase"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-2 text-center">Enter the 6-digit team code provided by the head coach.</p>
                </div>
              )}
            </div>
            {error && <div className="text-red-400 text-sm text-center">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setRole(null); setError(''); setInviteCode(''); setTeamName(''); }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-500 hover:bg-green-400 text-slate-950 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                {loading ? 'Processing...' : (inviteCode ? 'Join Team' : 'Create Team')}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleParentSetup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Invite Code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all uppercase"
                placeholder="P-XXXXXX or 000000"
                maxLength={8}
                required
              />
              <p className="text-xs text-slate-500 mt-2 text-center">Enter your Player Invite Code or Team Code.</p>
            </div>
            {error && <div className="text-red-400 text-sm text-center">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setRole(null); setError(''); }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-500 hover:bg-green-400 text-slate-950 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
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
