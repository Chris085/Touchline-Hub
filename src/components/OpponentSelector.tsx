import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Activity, MapPin, Phone, User, Calendar, Plus, X, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

interface Match {
  id: string;
  teamId: string;
  type: 'match' | 'training';
  matchCategory?: 'league' | 'cup' | 'friendly';
  opponent?: string;
  date: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'postponed';
  scoreUs?: number;
  scoreThem?: number;
}

interface Note {
  id: string;
  teamId: string;
  authorId: string;
  content: string;
  type: 'match' | 'training' | 'general';
  relatedId?: string;
  createdAt: any;
}

interface Opponent {
  id: string;
  teamId: string;
  name: string;
  homeGround?: string;
  coachName?: string;
  coachPhone?: string;
}

interface OpponentSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function OpponentSelector({ value, onChange }: OpponentSelectorProps) {
  const { profile } = useAuth();
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // New opponent form
  const [newName, setNewName] = useState('');
  const [homeGround, setHomeGround] = useState('');
  const [coachName, setCoachName] = useState('');
  const [coachPhone, setCoachPhone] = useState('');
  
  // History
  const [historyMatches, setHistoryMatches] = useState<Match[]>([]);
  const [historyNotes, setHistoryNotes] = useState<Note[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!profile?.teamId) return;
    
    const fetchOpponents = async () => {
      const q = query(collection(db, 'opponents'), where('teamId', '==', profile.teamId));
      const snap = await getDocs(q);
      const opps = snap.docs.map(d => ({ id: d.id, ...d.data() } as Opponent));
      setOpponents(opps.sort((a, b) => a.name.localeCompare(b.name)));
    };
    
    fetchOpponents();
  }, [profile?.teamId]);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    if (!value || !profile?.teamId) {
      setHistoryMatches([]);
      setHistoryNotes([]);
      return;
    }

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        // Fetch matches against this opponent
        const matchesQ = query(
          collection(db, 'matches'), 
          where('teamId', '==', profile.teamId),
          where('opponent', '==', value)
        );
        const matchesSnap = await getDocs(matchesQ);
        const matches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
        const pastMatches = matches.filter(m => m.status === 'completed').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHistoryMatches(pastMatches);

        if (pastMatches.length > 0) {
          const matchIds = pastMatches.map(m => m.id);
          // Split into chunks of 10 for 'in' query
          const notes: Note[] = [];
          for (let i = 0; i < matchIds.length; i += 10) {
            const chunk = matchIds.slice(i, i + 10);
            const notesQ = query(
              collection(db, 'notes'),
              where('teamId', '==', profile.teamId),
              where('relatedId', 'in', chunk)
            );
            const notesSnap = await getDocs(notesQ);
            notes.push(...notesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Note)));
          }
          setHistoryNotes(notes);
        } else {
          setHistoryNotes([]);
        }
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [value, profile?.teamId]);

  const handleAddOpponent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile?.teamId || !newName.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'opponents'), {
        teamId: profile.teamId,
        name: newName.trim(),
        homeGround: homeGround.trim(),
        coachName: coachName.trim(),
        coachPhone: coachPhone.trim(),
        createdAt: serverTimestamp()
      });

      const newOpp: Opponent = {
        id: docRef.id,
        teamId: profile.teamId,
        name: newName.trim(),
        homeGround: homeGround.trim(),
        coachName: coachName.trim(),
        coachPhone: coachPhone.trim()
      };

      setOpponents(prev => [...prev, newOpp].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(newName.trim());
      setShowAddModal(false);
      setNewName('');
      setHomeGround('');
      setCoachName('');
      setCoachPhone('');
      setIsOpen(false);
    } catch (error) {
      console.error("Error adding opponent:", error);
    }
  };

  const filteredOpponents = opponents.filter(o => o.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const matchesSearch = opponents.some(o => o.name.toLowerCase() === searchTerm.toLowerCase());

  const selectedOpponent = opponents.find(o => o.name === value);

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 pr-10 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors placeholder:text-chalk-white/10"
          placeholder="Team Name"
          required
        />
        <div 
          className="absolute right-3 top-1/2 -translate-y-1/2 text-chalk-white/40 cursor-pointer p-1"
          onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronDown size={20} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-60 w-full mt-2 bg-pitch-dark border border-chalk-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 flex flex-col">
          <div className="overflow-y-auto w-full">
            {filteredOpponents.map(opp => (
              <button
                key={opp.id}
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-chalk-white/5 border-b border-chalk-white/5 last:border-0 transition-colors"
                onClick={() => {
                  onChange(opp.name);
                  setSearchTerm(opp.name);
                  setIsOpen(false);
                }}
              >
                <div className="font-bold text-chalk-white italic font-display">{opp.name}</div>
                {(opp.homeGround || opp.coachName) && (
                  <div className="text-[10px] text-chalk-white/40 uppercase tracking-widest mt-1">
                    {opp.coachName && <span>Coach: {opp.coachName} </span>}
                    {opp.homeGround && <span>@ {opp.homeGround}</span>}
                  </div>
                )}
              </button>
            ))}
          </div>

          {!matchesSearch && searchTerm.trim() && (
            <button
              type="button"
              className="w-full text-left px-4 py-3 bg-pitch-green/10 text-pitch-green font-bold text-sm flex items-center gap-2 hover:bg-pitch-green/20 transition-colors border-t border-pitch-green/20"
              onClick={() => {
                setNewName(searchTerm);
                setShowAddModal(true);
                setIsOpen(false);
              }}
            >
              <Plus size={16} />
              Add "{searchTerm}" as new opponent
            </button>
          )}
        </div>
      )}

      {/* Selected Opponent Details */}
      {selectedOpponent && (selectedOpponent.homeGround || selectedOpponent.coachName || selectedOpponent.coachPhone) && (
        <div className="mt-4 p-4 rounded-xl bg-chalk-white/5 border border-chalk-white/10 space-y-3">
          <h4 className="text-[10px] font-black text-chalk-white/40 uppercase tracking-widest font-display italic mb-2">Opponent Details</h4>
          {selectedOpponent.homeGround && (
            <div className="flex items-center gap-2 text-sm text-chalk-white/70">
              <MapPin size={14} className="text-pitch-green" />
              <span>{selectedOpponent.homeGround}</span>
            </div>
          )}
          {selectedOpponent.coachName && (
            <div className="flex items-center gap-2 text-sm text-chalk-white/70">
              <User size={14} className="text-pitch-green" />
              <span>Coach: {selectedOpponent.coachName}</span>
            </div>
          )}
          {selectedOpponent.coachPhone && (
            <div className="flex items-center gap-2 text-sm text-chalk-white/70">
              <Phone size={14} className="text-pitch-green" />
              <a href={`tel:${selectedOpponent.coachPhone}`} className="hover:text-chalk-white transition-colors">
                {selectedOpponent.coachPhone}
              </a>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {value && !loadingHistory && historyMatches.length > 0 && (
        <div className="mt-4 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-4">
          <h4 className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest font-display italic">
            <Activity size={14} />
            Match History
          </h4>
          <div className="space-y-4">
            {historyMatches.map(match => {
              const us = match.scoreUs ?? 0;
              const them = match.scoreThem ?? 0;
              const result = us > them ? 'W' : us < them ? 'L' : 'D';
              const resultColor = result === 'W' ? 'text-pitch-green' : result === 'L' ? 'text-red-500' : 'text-yellow-500';
              const bgResult = result === 'W' ? 'bg-pitch-green/10 border-pitch-green/20' : result === 'L' ? 'bg-red-500/10 border-red-500/20' : 'bg-yellow-500/10 border-yellow-500/20';
              
              const matchNotes = historyNotes.filter(n => n.relatedId === match.id);

              return (
                <div key={match.id} className="space-y-2 border-b border-chalk-white/5 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${bgResult} border`}>
                        <span className={resultColor}>{result}</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-chalk-white">{match.date ? format(new Date(match.date), 'MMM d, yyyy') : 'Unknown Date'}</div>
                        <div className="text-[10px] text-chalk-white/40 uppercase font-display italic tracking-wider">{match.matchCategory || 'friendly'}</div>
                      </div>
                    </div>
                    <div className="text-lg font-black text-chalk-white font-display italic tracking-tight">
                      {us} - {them}
                    </div>
                  </div>
                  
                  {matchNotes.length > 0 && (
                    <div className="mt-2 pl-11">
                      {matchNotes.map(n => (
                        <div key={n.id} className="text-sm text-chalk-white/60 italic border-l-2 border-chalk-white/10 pl-3 py-1 text-wrap break-words">
                          "{n.content}"
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-pitch-dark/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-pitch-dark border border-chalk-white/10 rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-chalk-white/10 flex items-center justify-between shrink-0">
              <h3 className="font-black text-chalk-white uppercase italic font-display text-xl tracking-tight">Add Opponent</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-2 hover:bg-chalk-white/5 rounded-full transition-colors text-chalk-white/60 hover:text-chalk-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Opponent Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors"
                  required
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Home Ground (Optional)</label>
                <input
                  type="text"
                  value={homeGround}
                  onChange={(e) => setHomeGround(e.target.value)}
                  className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors"
                  placeholder="e.g. Emirates Stadium"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Coach Name (Optional)</label>
                <input
                  type="text"
                  value={coachName}
                  onChange={(e) => setCoachName(e.target.value)}
                  className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-chalk-white/40 mb-2 uppercase tracking-widest font-display italic">Coach Phone (Optional)</label>
                <input
                  type="tel"
                  value={coachPhone}
                  onChange={(e) => setCoachPhone(e.target.value)}
                  className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3 text-chalk-white font-bold focus:outline-none focus:border-pitch-green transition-colors"
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold uppercase tracking-tight transition-all font-display italic text-chalk-white/60 hover:bg-chalk-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAddOpponent()}
                  className="flex-1 py-3 bg-pitch-green text-pitch-dark rounded-xl font-black uppercase tracking-tight hover:bg-pitch-green/90 transition-all font-display italic"
                >
                  Save Opponent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
