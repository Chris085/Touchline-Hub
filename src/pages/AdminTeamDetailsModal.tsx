import React, { useState } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Loader2, X, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminTeamDetailsModalProps {
  team: any;
  coach: any;
  parents: any[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function AdminTeamDetailsModal({ team, coach, parents, isOpen, onClose, onRefresh }: AdminTeamDetailsModalProps) {
  const [teamName, setTeamName] = useState(team?.name || '');
  const [promoCode, setPromoCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [applyingCode, setApplyingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    if (team) {
      setTeamName(team.name);
      setPromoCode('');
      setError(null);
      setSuccess(null);
    }
  }, [team, isOpen]);

  if (!isOpen || !team) return null;

  const handleSaveName = async () => {
    if (!teamName.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateDoc(doc(db, 'teams', team.id), {
        name: teamName.trim()
      });
      setSuccess('Team name updated successfully.');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update team name');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) return;
    setApplyingCode(true);
    setError(null);
    setSuccess(null);
    
    try {
      const q = query(
        collection(db, 'coachCodes'), 
        where('code', '==', promoCode.toUpperCase().trim()),
        where('isUsed', '==', false),
        limit(1)
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        throw new Error('Code is invalid or has already been used.');
      }
      
      const codeDoc = snap.docs[0];
      const codeData = codeDoc.data();
      
      if (!coach) {
        throw new Error('This team does not have a valid coach assigned.');
      }

      // Update the coach user document with new subscription details
      const userRef = doc(db, 'users', coach.id || coach.uid);
      const userUpdate: any = {};
      
      if (codeData.type === 'trial') {
        const durationMonths = codeData.durationMonths || 3;
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + durationMonths);
        userUpdate.trialEndDate = endDate.toISOString();
        userUpdate.subscriptionStatus = 'inactive';
      } else if (codeData.type === 'full') {
        userUpdate.trialEndDate = null;
        userUpdate.subscriptionStatus = 'active';
      }
      
      await updateDoc(userRef, userUpdate);
      
      // Mark code as used
      await updateDoc(codeDoc.ref, {
        isUsed: true,
        usedBy: coach.id || coach.uid,
        usedByEmail: coach.email,
        usedAt: new Date().toISOString()
      });
      
      setSuccess(`Successfully applied ${codeData.type === 'trial' ? '3 Month Trial' : 'Full Access'} code!`);
      setPromoCode('');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to apply promo code');
    } finally {
      setApplyingCode(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 py-8 md:py-12 pointer-events-none overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl pointer-events-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <h2 className="text-xl font-bold text-slate-50 flex items-center gap-2">
                  Edit Team Details
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-50 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-8">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm">
                    {error}
                  </div>
                )}
                
                {success && (
                  <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-4 rounded-xl text-sm">
                    {success}
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-50">Team Information</h3>
                  
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">
                        Team Name
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                          className="flex-1 bg-slate-800 border border-slate-700 text-slate-50 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <button
                          onClick={handleSaveName}
                          disabled={saving || teamName === team.name || !teamName.trim()}
                          className="bg-green-500 text-slate-950 px-4 py-2 rounded-xl font-bold hover:bg-green-400 transition-colors disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save'}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">
                        Join Code
                      </label>
                      <div className="font-mono text-lg font-bold tracking-wider text-slate-300 bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/50 inline-block">
                        {team.code}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-t border-slate-800 pt-6">
                  <h3 className="text-lg font-bold text-slate-50">Coach Subscription</h3>
                  
                  <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-800/50">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="block text-slate-400 mb-1">Coach Name</span>
                        <span className="font-medium text-slate-200">{coach?.name || 'Unknown'}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 mb-1">Coach Email</span>
                        <span className="font-medium text-slate-200">{coach?.email || 'Unknown'}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 mb-1">Status</span>
                        <span className={`capitalize font-medium ${coach?.subscriptionStatus === 'active' ? 'text-green-500' : 'text-yellow-500'}`}>
                          {coach?.subscriptionStatus || 'None'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-2 flex items-end">
                        Trial End Date: {coach?.trialEndDate ? new Date(coach.trialEndDate).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2">
                      <Tag className="w-4 h-4" /> Apply Promo Code to Coach
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        placeholder="Enter Code (e.g. 5VFD..."
                        className="flex-1 bg-slate-800 border border-slate-700 text-slate-50 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                      />
                      <button
                        onClick={handleApplyPromoCode}
                        disabled={applyingCode || !promoCode.trim()}
                        className="bg-blue-600 text-slate-50 px-4 py-2 rounded-xl font-bold hover:bg-blue-500 transition-colors disabled:opacity-50"
                      >
                        {applyingCode ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Apply'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Applying a code will update the coach's subscription status immediately. It will be marked as used by this coach.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 border-t border-slate-800 pt-6">
                  <h3 className="text-lg font-bold text-slate-50">Parents ({parents?.length || 0})</h3>
                  
                  <div className="bg-slate-800/30 rounded-xl border border-slate-800/50 max-h-48 overflow-y-auto">
                    {parents && parents.length > 0 ? (
                      <ul className="divide-y divide-slate-800/50">
                        {parents.map((parent) => (
                          <li key={parent.id} className="p-3 text-sm flex flex-col">
                            <span className="font-medium text-slate-200">{parent.name || 'Unknown'}</span>
                            <span className="text-slate-500">{parent.email || 'No email provided'}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-4 text-sm text-slate-500 italic text-center">
                        No parents have joined this team yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
