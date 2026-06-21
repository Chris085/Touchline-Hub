import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Dumbbell, Plus, Trash2, Pencil, Link as LinkIcon, Video, Check, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

export interface Drill {
  id: string;
  teamId: string;
  title: string;
  description: string;
  url?: string;
  trainedCount: number;
  trainedDates: string[];
}

export function TrainingLibrary() {
  const { profile, isAdmin, isAppReadOnly } = useAuth();
  const [drills, setDrills] = useState<Drill[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isCoach = profile?.role === 'coach' || isAdmin;

  useEffect(() => {
    if (!profile?.teamId) return;

    const qDrills = query(
      collection(db, 'drills'),
      where('teamId', '==', profile.teamId)
    );

    const unsubDrills = onSnapshot(qDrills, (snapshot) => {
      const drillsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Drill[];
      setDrills(drillsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'drills');
      setLoading(false);
    });

    const qMatches = query(
      collection(db, 'matches'),
      where('teamId', '==', profile.teamId),
      where('type', '==', 'training')
    );

    const unsubMatches = onSnapshot(qMatches, (snapshot) => {
      const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMatches(matchesData);
    });

    return () => {
      unsubDrills();
      unsubMatches();
    };
  }, [profile?.teamId]);

  const getDrillStats = (drillId: string) => {
    const drillMatches = matches
      .filter(m => m.drillIds?.includes(drillId) && m.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return {
      trainedCount: drillMatches.length,
      trainedDates: drillMatches.map(m => m.date)
    };
  };

  const handleAddDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.teamId || !title.trim() || !description.trim()) return;

    setSaving(true);
    try {
      await addDoc(collection(db, 'drills'), {
        teamId: profile.teamId,
        title: title.trim(),
        description: description.trim(),
        url: url.trim(),
        trainedCount: 0,
        trainedDates: []
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setShowAddModal(false);
        setTitle('');
        setDescription('');
        setUrl('');
      }, 1000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'drills');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDrill || !title.trim() || !description.trim()) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'drills', selectedDrill.id), {
        title: title.trim(),
        description: description.trim(),
        url: url.trim()
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setShowEditModal(false);
        setSelectedDrill(null);
        setTitle('');
        setDescription('');
        setUrl('');
      }, 1000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drills/${selectedDrill.id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDrill = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this drill?')) return;
    
    try {
      await deleteDoc(doc(db, 'drills', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `drills/${id}`);
    }
  };

  const openEditModal = (drill: Drill) => {
    setSelectedDrill(drill);
    setTitle(drill.title);
    setDescription(drill.description);
    setUrl(drill.url || '');
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-pitch-green border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const sortedDrills = [...drills].sort((a, b) => {
    return getDrillStats(b.id).trainedCount - getDrillStats(a.id).trainedCount;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-pitch-green/20 rounded-2xl flex items-center justify-center border border-pitch-green/30">
            <Dumbbell className="text-pitch-green" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-50 uppercase tracking-tight italic font-display">Training Library</h1>
            <p className="text-sm text-chalk-white/40">Manage your team's drills and training materials</p>
          </div>
        </div>
        
        {isCoach && (
          <button
            onClick={() => {
              if (isAppReadOnly) {
                alert('This team is currently in Read-Only mode. Please verify your email address to unlock access.');
                return;
              }
              setTitle('');
              setDescription('');
              setUrl('');
              setShowAddModal(true);
            }}
            disabled={isAppReadOnly}
            className={`w-12 h-12 sm:w-auto sm:h-auto sm:px-6 sm:py-3 bg-pitch-green hover:bg-pitch-accent text-pitch-dark rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(22,163,74,0.3)] font-display italic ${isAppReadOnly ? 'opacity-50 cursor-not-allowed filter grayscale bg-slate-700/50 shadow-none text-chalk-white/40' : ''}`}
          >
            <Plus size={20} strokeWidth={3} />
            <span className="hidden sm:inline">Add Drill</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedDrills.map((drill) => {
          const stats = getDrillStats(drill.id);
          const hasBeenTrained = stats.trainedCount > 0;
          return (
            <motion.div
              key={drill.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-pitch-dark/50 border border-chalk-white/10 rounded-2xl overflow-hidden shadow-lg p-5 flex flex-col relative group"
            >
              <div className="mb-2">
                <h3 className="text-lg font-black text-slate-50 uppercase tracking-tight italic font-display">{drill.title}</h3>
                <p className="text-xs text-chalk-white/60 line-clamp-3 mt-2" title={drill.description}>{drill.description}</p>
              </div>
              
              {drill.url && (
                <a 
                  href={drill.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-2 hover:underline self-start"
                >
                  <Video size={14} />
                  Watch Video
                </a>
              )}

              <div className="mt-auto pt-4 border-t border-chalk-white/10 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-chalk-white/40 uppercase tracking-widest">Times Trained</span>
                    <span className="text-sm font-black text-pitch-green">{stats.trainedCount}</span>
                  </div>
                  {hasBeenTrained && (
                    <div className="text-[9px] text-chalk-white/40 uppercase tracking-widest font-display italic flex items-center gap-1">
                      <Calendar size={10} />
                      Last: {format(new Date(stats.trainedDates[0]), 'MMM d, yy')}
                    </div>
                  )}
                </div>
                
                {isCoach && (
                  <div className="flex gap-2 self-end">
                    <button 
                      onClick={() => {
                        if (isAppReadOnly) {
                          alert('This team is currently in Read-Only mode. Please verify your email address to unlock access.');
                          return;
                        }
                        openEditModal(drill);
                      }}
                      disabled={isAppReadOnly}
                      className={`w-8 h-8 flex items-center justify-center bg-chalk-white/5 hover:bg-chalk-white/10 text-chalk-white/60 rounded-lg transition-colors ${isAppReadOnly ? 'opacity-50 cursor-not-allowed filter grayscale' : ''}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button 
                      onClick={() => {
                        if (isAppReadOnly) {
                          alert('This team is currently in Read-Only mode. Please verify your email address to unlock access.');
                          return;
                        }
                        handleDeleteDrill(drill.id);
                      }}
                      disabled={isAppReadOnly}
                      className={`w-8 h-8 flex items-center justify-center bg-chalk-white/5 hover:bg-red-500/20 text-chalk-white/60 hover:text-red-400 rounded-lg transition-colors ${isAppReadOnly ? 'opacity-50 cursor-not-allowed filter grayscale' : ''}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {drills.length === 0 && (
          <div className="col-span-full py-12 text-center rounded-2xl border-2 border-dashed border-chalk-white/10 bg-pitch-dark/20 text-chalk-white/40 font-bold uppercase tracking-widest text-xs italic font-display">
            No drills found. Start building your training library!
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10">
                <h2 className="text-lg font-black text-slate-50 uppercase tracking-tight italic font-display">
                  {showAddModal ? 'Add New Drill' : 'Edit Drill'}
                </h2>
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setSelectedDrill(null);
                  }} 
                  className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-50 rounded-full transition-colors"
                >
                  <Plus className="rotate-45" size={20} strokeWidth={2.5} />
                </button>
              </div>

              <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                <form onSubmit={showAddModal ? handleAddDrill : handleUpdateDrill} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest italic font-display">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-pitch-green text-slate-50 transition-colors"
                      placeholder="e.g., Triangle Passing"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest italic font-display">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-pitch-green text-slate-50 transition-colors min-h-[100px]"
                      placeholder="Explain how the drill works..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest italic font-display">Video URL (Optional)</label>
                    <div className="relative">
                      <LinkIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-pitch-green text-slate-50 transition-colors"
                        placeholder="https://youtube.com/..."
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="submit"
                      disabled={saving || saveSuccess || !title.trim() || !description.trim()}
                      className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] shadow-lg disabled:opacity-50 transition-all font-display italic ${saveSuccess ? 'bg-pitch-green text-pitch-dark' : 'bg-pitch-green hover:bg-pitch-accent text-pitch-dark'}`}
                    >
                      {saveSuccess ? <><Check size={16} strokeWidth={3} /> Saved</> : saving ? 'Saving...' : showAddModal ? 'Add Drill' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
