import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { FileText, Plus, Trash2, Tag, Calendar, Activity, Users, Filter, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface Note {
  id: string;
  teamId: string;
  authorId: string;
  content: string;
  type: 'match' | 'training' | 'general';
  relatedId?: string;
  playerIds?: string[];
  createdAt: any;
}

import { ConfirmModal } from '../components/ConfirmModal';

export function Notes() {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNote, setNewNote] = useState({
    content: '',
    type: 'general' as const,
    playerIds: [] as string[]
  });
  const [filterType, setFilterType] = useState<'all' | 'match' | 'training' | 'general'>('all');
  const [filterPlayer, setFilterPlayer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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

    const isAdmin = profile?.email === 'chrisjeal9@gmail.com';
    if (profile.role !== 'coach' && !isAdmin) {
      setLoading(false);
      return;
    }

    const notesRef = collection(db, 'notes');
    const q = query(
      notesRef, 
      where('teamId', '==', profile.teamId),
      where('organisationId', '==', profile.organisationId || 'default-org'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Note[];
      setNotes(notesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notes');
      setLoading(false);
    });

    // Fetch players for tagging
    const playersRef = collection(db, 'players');
    const qPlayers = query(playersRef, where('teamId', '==', profile.teamId));
    getDocs(qPlayers).then(snapshot => {
      setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch matches/training for context
    const matchesRef = collection(db, 'matches');
    const qMatches = query(matchesRef, where('teamId', '==', profile.teamId));
    getDocs(qMatches).then(snapshot => {
      setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [profile?.teamId]);

  const handleAddNote = async () => {
    if (!profile?.teamId || !newNote.content.trim()) return;

    try {
      await addDoc(collection(db, 'notes'), {
        teamId: profile.teamId,
        organisationId: profile.organisationId || 'default-org',
        authorId: profile.uid,
        content: newNote.content.trim(),
        type: newNote.type,
        playerIds: newNote.playerIds,
        createdAt: serverTimestamp()
      });
      setNewNote({ content: '', type: 'general', playerIds: [] });
      setShowAddModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notes');
    }
  };

  const handleDeleteNote = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Note',
      message: 'Are you sure you want to delete this note?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'notes', id));
          closeConfirmModal();
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `notes/${id}`);
        }
      }
    });
  };

  const togglePlayerTag = (playerId: string) => {
    setNewNote(prev => ({
      ...prev,
      playerIds: prev.playerIds.includes(playerId)
        ? prev.playerIds.filter(id => id !== playerId)
        : [...prev.playerIds, playerId]
    }));
  };

  const filteredNotes = notes.filter(note => {
    const matchesType = filterType === 'all' || note.type === filterType;
    const matchesPlayer = !filterPlayer || note.playerIds?.includes(filterPlayer);
    const matchesSearch = note.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesPlayer && matchesSearch;
  });

  const getRelatedName = (note: Note) => {
    if (!note.relatedId) return null;
    const related = matches.find(m => m.id === note.relatedId);
    if (!related) return null;
    if (related.type === 'match') return `vs ${related.opponent}`;
    return format(new Date(related.date), 'MMM d') + ' Training';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (profile?.role !== 'coach' && profile?.email !== 'chrisjeal9@gmail.com') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <FileText className="mx-auto text-slate-700" size={48} />
          <h2 className="text-xl font-bold text-slate-50">Access Denied</h2>
          <p className="text-slate-400">Only coaches can view and manage team notes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Team Notes</h1>
          <p className="text-slate-400 text-sm">Track performance, tactics, and observations</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-green-500 hover:bg-green-400 text-slate-950 p-3 rounded-full shadow-lg shadow-green-500/20 transition-all active:scale-95"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['all', 'match', 'training', 'general'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                filterType === type 
                  ? 'bg-green-500 text-slate-950' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
          </div>
          
          <select
            value={filterPlayer || ''}
            onChange={(e) => setFilterPlayer(e.target.value || null)}
            className="bg-slate-800 border border-slate-700 rounded-xl py-2 px-4 text-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/50"
          >
            <option value="">All Players</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes List */}
      <div className="space-y-4">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl">
            <FileText className="mx-auto text-slate-700 mb-4" size={48} />
            <p className="text-slate-500">No notes found matching your filters.</p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={note.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 relative group"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    note.type === 'match' ? 'bg-green-500/10 text-green-400' :
                    note.type === 'training' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {note.type === 'match' ? <Activity size={18} /> :
                     note.type === 'training' ? <Calendar size={18} /> :
                     <FileText size={18} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                        {note.type}
                      </span>
                      {note.relatedId && (
                        <span className="text-xs font-medium text-slate-400">
                          • {getRelatedName(note)}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-600 font-mono">
                      {note.createdAt?.toDate ? format(note.createdAt.toDate(), 'MMM d, yyyy • HH:mm') : 'Just now'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                {note.content}
              </p>

              {note.playerIds && note.playerIds.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {note.playerIds.map(pid => {
                    const player = players.find(p => p.id === pid);
                    return (
                      <span key={pid} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 text-slate-300 rounded-lg text-[10px] font-bold border border-slate-700">
                        <Tag size={10} className="text-green-500" />
                        {player?.name || 'Unknown Player'}
                      </span>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Add Note Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-50">New General Note</h2>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-50">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Content</label>
                  <textarea
                    value={newNote.content}
                    onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Write your observations here..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 min-h-[150px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tag Players</label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2">
                    {players.map(player => (
                      <button
                        key={player.id}
                        onClick={() => togglePlayerTag(player.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          newNote.playerIds.includes(player.id)
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
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 rounded-2xl bg-slate-800 text-slate-50 font-bold hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.content.trim()}
                  className="flex-1 px-6 py-3 rounded-2xl bg-green-500 text-slate-950 font-bold hover:bg-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Note
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
