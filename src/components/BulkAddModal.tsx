import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, Trophy, Calendar, Users, Save, Shield, Goal } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';

interface Player {
  id: string;
  name: string;
}

interface BulkMatch {
  id: string;
  date: string;
  opponent: string;
  scoreUs: number;
  scoreThem: number;
  coachPotmId: string;
  coachPotmName: string;
  parentPotmId: string;
  parentPotmName: string;
  scorers: string[]; // Array of player IDs for each goal scored by "Us"
}

interface BulkAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  players: Player[];
  onSuccess: () => void;
}

export const BulkAddModal: React.FC<BulkAddModalProps> = ({ isOpen, onClose, teamId, players, onSuccess }) => {
  const [matches, setMatches] = useState<BulkMatch[]>([
    {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().slice(0, 16),
      opponent: '',
      scoreUs: 0,
      scoreThem: 0,
      coachPotmId: '',
      coachPotmName: '',
      parentPotmId: '',
      parentPotmName: '',
      scorers: []
    }
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const addRow = () => {
    setMatches([
      ...matches,
      {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString().slice(0, 16),
        opponent: '',
        scoreUs: 0,
        scoreThem: 0,
        coachPotmId: '',
        coachPotmName: '',
        parentPotmId: '',
        parentPotmName: '',
        scorers: []
      }
    ]);
  };

  const removeRow = (id: string) => {
    if (matches.length > 1) {
      setMatches(matches.filter(m => m.id !== id));
    }
  };

  const updateMatch = (id: string, updates: Partial<BulkMatch>) => {
    setMatches(matches.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const handleSave = async () => {
    if (!teamId) return;
    setIsSaving(true);
    try {
      const promises = matches.map(match => {
        const events = match.scorers.map(playerId => ({
          type: 'goal',
          playerId,
          playerName: players.find(p => p.id === playerId)?.name || 'Unknown',
          timestamp: new Date(match.date).getTime(),
          minute: 0,
          isOwnGoal: false
        }));

        return addDoc(collection(db, 'matches'), {
          teamId,
          type: 'match',
          matchCategory: 'league',
          status: 'completed',
          date: match.date,
          opponent: match.opponent,
          scoreUs: match.scoreUs,
          scoreThem: match.scoreThem,
          coachPotmId: match.coachPotmId,
          coachPotmName: match.coachPotmName,
          parentPotmId: match.parentPotmId,
          parentPotmName: match.parentPotmName,
          events,
          onPitch: [],
          onBench: [],
          isPotmVotingOpen: false,
          createdAt: serverTimestamp()
        });
      });

      await Promise.all(promises);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error bulk adding matches:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-pitch-dark/95 backdrop-blur-xl z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-turf-surface/80 border border-chalk-white/10 rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative"
          >
            <div className="absolute inset-0 pitch-grid opacity-5 pointer-events-none" />
            
            {/* Header */}
            <div className="p-8 border-b border-chalk-white/5 flex items-center justify-between relative z-10">
              <div>
                <h2 className="text-3xl font-black text-chalk-white uppercase italic font-display tracking-tight leading-none mb-2">Bulk Add Results</h2>
                <p className="text-[10px] font-black text-chalk-white/40 uppercase tracking-widest font-display italic">Quickly backfill multiple match results and POTM awards</p>
              </div>
              <button 
                onClick={onClose}
                className="p-3 rounded-2xl bg-chalk-white/5 text-chalk-white/40 hover:text-chalk-white transition-all border border-chalk-white/5"
              >
                <X size={24} />
              </button>
            </div>

            {/* Table Header - Desktop */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_0.6fr_1fr_1fr_1fr_0.4fr] gap-4 px-8 py-4 bg-pitch-dark/40 border-b border-chalk-white/5 relative z-10">
              <div className="text-[10px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic">Date & Time</div>
              <div className="text-[10px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic">Opponent</div>
              <div className="text-[10px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic text-center">Score</div>
              <div className="text-[10px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic">Scorers</div>
              <div className="text-[10px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic">Coach POTM</div>
              <div className="text-[10px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic">Parents POTM</div>
              <div className="text-[10px] font-black text-chalk-white/20 uppercase tracking-widest font-display italic text-right">Action</div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 relative z-10 custom-scrollbar">
              {matches.map((match, index) => (
                <motion.div 
                  key={match.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="grid grid-cols-1 md:grid-cols-[1fr_1fr_0.6fr_1fr_1fr_1fr_0.4fr] gap-4 items-center bg-pitch-dark/20 p-4 md:p-0 md:bg-transparent rounded-2xl md:rounded-none border border-chalk-white/5 md:border-0"
                >
                  {/* Date */}
                  <div>
                    <label className="md:hidden block text-[9px] font-black text-chalk-white/20 mb-1 uppercase tracking-widest font-display italic">Date & Time</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-chalk-white/20" />
                      <input
                        type="datetime-local"
                        value={match.date}
                        onChange={(e) => updateMatch(match.id, { date: e.target.value })}
                        className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-chalk-white focus:outline-none focus:border-pitch-green transition-colors"
                      />
                    </div>
                  </div>

                  {/* Opponent */}
                  <div>
                    <label className="md:hidden block text-[9px] font-black text-chalk-white/20 mb-1 uppercase tracking-widest font-display italic">Opponent</label>
                    <input
                      type="text"
                      value={match.opponent}
                      onChange={(e) => updateMatch(match.id, { opponent: e.target.value })}
                      placeholder="Opponent Name"
                      className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3 text-sm font-bold text-chalk-white focus:outline-none focus:border-pitch-green transition-colors placeholder:text-chalk-white/10"
                    />
                  </div>

                  {/* Score */}
                  <div>
                    <label className="md:hidden block text-[9px] font-black text-chalk-white/20 mb-1 uppercase tracking-widest font-display italic text-center">Score</label>
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={match.scoreUs}
                        onChange={(e) => {
                          const newScore = parseInt(e.target.value) || 0;
                          const newScorers = [...match.scorers];
                          if (newScore > match.scorers.length) {
                            for (let i = match.scorers.length; i < newScore; i++) newScorers.push('');
                          } else {
                            newScorers.splice(newScore);
                          }
                          updateMatch(match.id, { scoreUs: newScore, scorers: newScorers });
                        }}
                        className="w-12 bg-pitch-dark/50 border border-chalk-white/10 rounded-xl py-3 text-center text-sm font-black text-pitch-green focus:outline-none focus:border-pitch-green transition-colors"
                      />
                      <span className="text-chalk-white/20 font-black">-</span>
                      <input
                        type="number"
                        min="0"
                        value={match.scoreThem}
                        onChange={(e) => updateMatch(match.id, { scoreThem: parseInt(e.target.value) || 0 })}
                        className="w-12 bg-pitch-dark/50 border border-chalk-white/10 rounded-xl py-3 text-center text-sm font-black text-chalk-white focus:outline-none focus:border-pitch-green transition-colors"
                      />
                    </div>
                  </div>

                  {/* Scorers */}
                  <div className="space-y-2">
                    <label className="md:hidden block text-[9px] font-black text-chalk-white/20 mb-1 uppercase tracking-widest font-display italic">Scorers</label>
                    {match.scorers.length > 0 ? (
                      <div className="space-y-2">
                        {match.scorers.map((scorerId, sIndex) => (
                          <div key={sIndex} className="relative">
                            <Goal size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-pitch-green/40" />
                            <select
                              value={scorerId}
                              onChange={(e) => {
                                const newScorers = [...match.scorers];
                                newScorers[sIndex] = e.target.value;
                                updateMatch(match.id, { scorers: newScorers });
                              }}
                              className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl pl-8 pr-4 py-2 text-[10px] font-bold text-chalk-white focus:outline-none focus:border-pitch-green transition-colors appearance-none"
                            >
                              <option value="">Select Scorer</option>
                              {players.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[9px] font-black text-chalk-white/10 uppercase tracking-widest text-center py-2 border border-dashed border-chalk-white/5 rounded-xl">
                        No Goals
                      </div>
                    )}
                  </div>

                  {/* Coach POTM */}
                  <div>
                    <label className="md:hidden block text-[9px] font-black text-chalk-white/20 mb-1 uppercase tracking-widest font-display italic">Coach POTM</label>
                    <div className="relative">
                      <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/40" />
                      <select
                        value={match.coachPotmId}
                        onChange={(e) => {
                          const player = players.find(p => p.id === e.target.value);
                          updateMatch(match.id, { 
                            coachPotmId: e.target.value,
                            coachPotmName: player ? player.name : ''
                          });
                        }}
                        className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-chalk-white focus:outline-none focus:border-pitch-green transition-colors appearance-none"
                      >
                        <option value="">Coach POTM</option>
                        {players.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Parents POTM */}
                  <div>
                    <label className="md:hidden block text-[9px] font-black text-chalk-white/20 mb-1 uppercase tracking-widest font-display italic">Parents POTM</label>
                    <div className="relative">
                      <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-500/40" />
                      <select
                        value={match.parentPotmId}
                        onChange={(e) => {
                          const player = players.find(p => p.id === e.target.value);
                          updateMatch(match.id, { 
                            parentPotmId: e.target.value,
                            parentPotmName: player ? player.name : ''
                          });
                        }}
                        className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-chalk-white focus:outline-none focus:border-pitch-green transition-colors appearance-none"
                      >
                        <option value="">Parents POTM</option>
                        {players.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => removeRow(match.id)}
                      disabled={matches.length === 1}
                      className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-20 transition-all border border-red-500/20"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))}

              <button
                onClick={addRow}
                className="w-full py-4 rounded-2xl border-2 border-dashed border-chalk-white/5 text-chalk-white/20 hover:border-pitch-green/30 hover:text-pitch-green transition-all flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] font-display italic group"
              >
                <div className="w-6 h-6 rounded-lg bg-chalk-white/5 flex items-center justify-center group-hover:bg-pitch-green/10 transition-colors">
                  <Plus size={14} strokeWidth={4} />
                </div>
                Add Another Match
              </button>
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-chalk-white/5 bg-pitch-dark/40 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pitch-green/10 rounded-xl flex items-center justify-center border border-pitch-green/20">
                  <Save size={20} className="text-pitch-green" />
                </div>
                <div>
                  <p className="text-xs font-black text-chalk-white uppercase italic font-display tracking-tight">Ready to Save</p>
                  <p className="text-[9px] font-black text-chalk-white/40 uppercase tracking-widest font-display italic">{matches.length} matches will be added</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <button
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] text-chalk-white/40 hover:text-chalk-white transition-all font-display italic"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || matches.some(m => !m.opponent)}
                  className="flex-1 sm:flex-none px-10 py-4 bg-pitch-green text-pitch-dark rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-[0_0_30px_rgba(22,163,74,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 font-display italic flex items-center justify-center gap-3"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-pitch-dark/30 border-t-pitch-dark rounded-full animate-spin" />
                  ) : (
                    <Save size={16} strokeWidth={3} />
                  )}
                  Save All Results
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
