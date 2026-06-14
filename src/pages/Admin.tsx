import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, getDocs, addDoc, deleteDoc, doc, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'motion/react';
import { Plus, Trash2, Copy, Check, Loader2, Key, Database, Eraser } from 'lucide-react';
import { seedData, removeAllSeedData } from '../services/seedService';
import { ConfirmModal } from '../components/ConfirmModal';
import { OrganisationSettings } from '../components/OrganisationSettings';

export function Admin() {
  const { profile } = useAuth();
  const [codes, setCodes] = useState<any[]>([]);
  const [orgData, setOrgData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [populating, setPopulating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [codeType, setCodeType] = useState<'full' | 'trial'>('trial');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const handleSeedData = async () => {
    if (!profile?.teamId) return;
    setSeeding(true);
    try {
      await seedData(profile.teamId);
      alert('Data seeded successfully!');
    } catch (error: any) {
      console.error('Error seeding data:', error);
      alert('Failed to seed data: ' + error.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleRemoveAllData = async () => {
    if (!profile?.teamId) return;
    setRemoving(true);
    try {
      await removeAllSeedData(profile.teamId);
      alert('All team data removed successfully!');
      setConfirmDeleteAll(false);
    } catch (error: any) {
      console.error('Error removing data:', error);
      alert('Failed to remove data: ' + error.message);
    } finally {
      setRemoving(false);
    }
  };

  const populateDummyData = async () => {
    setPopulating(true);
    try {
      const response = await fetch('/api/populate-dummy-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile?.uid, email: profile?.email }),
      });
      const data = await response.json();
      if (data.success) {
        alert('Dummy data populated successfully!');
      } else {
        throw new Error(data.error || 'Failed to populate dummy data');
      }
    } catch (error: any) {
      console.error('Error populating dummy data:', error);
      alert(error.message);
    } finally {
      setPopulating(false);
    }
  };

  useEffect(() => {
    fetchCodes();
    
    const fetchOrg = async () => {
      if (!profile?.organisationId) return;
      
      const orgRef = doc(db, 'organisations', profile.organisationId);
      const orgSnap = await getDoc(orgRef);
      if (orgSnap.exists()) {
        setOrgData({ ...orgSnap.data(), id: orgSnap.id });
      }
    };
    fetchOrg();
  }, [profile?.organisationId]);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'coachCodes'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setCodes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCode = async () => {
    setCreating(true);
    try {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      await addDoc(collection(db, 'coachCodes'), {
        code,
        type: codeType,
        durationMonths: codeType === 'trial' ? 3 : null,
        isUsed: false,
        createdAt: new Date().toISOString(),
      });
      fetchCodes();
    } catch (error) {
      console.error('Error generating code:', error);
    } finally {
      setCreating(false);
    }
  };

  const deleteCode = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'coachCodes', id));
      fetchCodes();
    } catch (error) {
      console.error('Error deleting code:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  if (profile?.email !== 'chrisjeal9@gmail.com') {
    return <div className="p-8 text-center text-slate-500">Access Denied</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Admin Dashboard</h1>
          <p className="text-slate-400">Manage coach access codes</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 w-full sm:w-auto">
            <button
              onClick={() => setCodeType('trial')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                codeType === 'trial' ? 'bg-green-500 text-slate-950' : 'text-slate-400 hover:text-slate-50'
              }`}
            >
              3M Trial
            </button>
            <button
              onClick={() => setCodeType('full')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                codeType === 'full' ? 'bg-green-500 text-slate-950' : 'text-slate-400 hover:text-slate-50'
              }`}
            >
              Full Access
            </button>
          </div>
          <button
            onClick={generateCode}
            disabled={creating}
            className="bg-green-500 hover:bg-green-400 text-slate-950 px-6 py-3 sm:py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 w-full sm:w-auto"
          >
            {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Generate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={handleSeedData}
          disabled={seeding}
          className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20 px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50"
        >
          {seeding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
          Seed Team Data
        </button>
        <button
          onClick={() => setConfirmDeleteAll(true)}
          disabled={removing}
          className="bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50"
        >
          {removing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eraser className="w-5 h-5" />}
          Remove All Data
        </button>
        <button
          onClick={populateDummyData}
          disabled={populating}
          className="bg-slate-800 hover:bg-slate-700 text-slate-50 px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50"
        >
          {populating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          Populate Dummy Data
        </button>
      </div>

      {orgData && (
          <div className="mb-8">
            <OrganisationSettings orgData={orgData} onUpdate={() => {}} />
          </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex items-center gap-2 text-slate-300 font-medium">
          <Key className="w-4 h-4" />
          Active & Used Codes
        </div>
        <div className="divide-y divide-slate-800">
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
            </div>
          ) : codes.length === 0 ? (
            <div className="p-12 text-center text-slate-500 italic">No codes generated yet</div>
          ) : (
            codes.map((code) => (
              <div key={code.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="font-mono text-xl font-bold text-green-400 tracking-wider">
                    {code.code}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      code.type === 'trial' 
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                        : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    }`}>
                      {code.type === 'trial' ? '3M Trial' : 'Full Access'}
                    </span>
                    {code.isUsed ? (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 text-xs font-medium border border-slate-700">
                        Used by {code.usedByName || code.usedByEmail || code.usedBy?.substring(0, 8) + '...'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-medium border border-green-500/20">
                        Active
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-800/50 sm:border-0 pt-3 sm:pt-0">
                  <button
                    onClick={() => copyToClipboard(code.code)}
                    className="flex-1 sm:flex-none p-2.5 sm:p-2 bg-slate-800 sm:bg-transparent rounded-lg sm:rounded-none flex items-center justify-center text-slate-400 hover:text-slate-50 transition-colors"
                    title="Copy Code"
                  >
                    {copied === code.code ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                    <span className="sm:hidden ml-2 text-xs font-bold uppercase">Copy</span>
                  </button>
                  <button
                    onClick={() => deleteCode(code.id)}
                    className="flex-1 sm:flex-none p-2.5 sm:p-2 bg-slate-800 sm:bg-transparent rounded-lg sm:rounded-none flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                    title="Delete Code"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="sm:hidden ml-2 text-xs font-bold uppercase">Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <ConfirmModal
        isOpen={confirmDeleteAll}
        title="Remove All Team Data"
        message="Are you sure you want to remove all seeded data for this team? This action cannot be undone."
        onConfirm={handleRemoveAllData}
        onCancel={() => setConfirmDeleteAll(false)}
      />
    </div>
  );
}
