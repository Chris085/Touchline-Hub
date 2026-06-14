import React, { useState } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (org: any) => void;
}

export function CreateOrganisationModal({ isOpen, onClose, onCreated }: Props) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !profile) return;
    
    setLoading(true);
    try {
      console.log('Attempting to create org with:', { name, uid: profile.uid });
      const orgRef = await addDoc(collection(db, 'organisations'), {
        name,
        ownerUserId: profile.uid,
        createdAt: new Date().toISOString(),
        settings: { subTeamsEnabled: false }
      });
      console.log('Org created with ID:', orgRef.id);
      
      // Update user profile
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, { organisationId: orgRef.id });

      // If user has a team, link organisation to team
      if (profile.teamId) {
        const teamRef = doc(db, 'teams', profile.teamId);
        await updateDoc(teamRef, { organisationId: orgRef.id });
      }

      alert('Organisation created successfully!');
      onCreated({ id: orgRef.id, name, ownerUserId: profile.uid });
      onClose();
    } catch (err) {
      console.error('Error creating org:', err);
      alert('Failed to create organisation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-slate-50 mb-4">Create Organisation</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Organisation Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-50"
            required
          />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-slate-800 rounded-xl font-bold">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-green-500 hover:bg-green-400 text-slate-950 rounded-xl font-bold">
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
