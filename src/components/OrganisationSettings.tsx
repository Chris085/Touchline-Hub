import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface Props {
  orgData: any;
  onUpdate: () => void;
}

export function OrganisationSettings({ orgData, onUpdate }: Props) {
  const [data, setData] = useState({
    ...orgData,
    name: orgData?.name || '',
    logoUrl: orgData?.logoUrl || '',
    settings: orgData?.settings || { subTeamsEnabled: false }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.id) return;
    const orgRef = doc(db, 'organisations', data.id);
    await updateDoc(orgRef, {
      name: data.name || null,
      logoUrl: data.logoUrl || null,
      settings: data.settings || {}
    });
    alert('Organisation updated!');
    onUpdate();
  };

  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
      <h3 className="text-lg font-bold text-slate-50 mb-6">Organisation Settings</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Organisation Name</label>
          <input
            type="text"
            value={data.name || ''}
            onChange={(e) => setData({...data, name: e.target.value})}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-50 mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Logo URL</label>
          <input
            type="url"
            value={data.logoUrl || ''}
            onChange={(e) => setData({...data, logoUrl: e.target.value})}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-50 mt-1"
            placeholder="https://example.com/logo.png"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.settings?.subTeamsEnabled || false}
            onChange={(e) => setData({...data, settings: {...data.settings, subTeamsEnabled: e.target.checked}})}
            className="w-4 h-4 bg-slate-800 border-slate-700 rounded"
          />
          <span className="text-sm text-slate-300">Enable Sub-teams (Club Mode)</span>
        </label>
        <button type="submit" className="w-full py-3 bg-green-500 hover:bg-green-400 text-slate-950 font-bold rounded-xl transition-all">Save Changes</button>
      </form>
      
      <div className="pt-6 border-t border-slate-800 space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Invitation Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={data.invitationCode || 'Not generated'}
              readOnly
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 font-mono"
            />
            <button
              type="button"
              onClick={async () => {
                if (!data.id) return;
                const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                const orgRef = doc(db, 'organisations', data.id);
                await updateDoc(orgRef, { invitationCode: code });
                setData({...data, invitationCode: code});
              }}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-50 rounded-xl font-bold transition-all"
            >
              Generate
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Transfer Ownership</label>
          <button
            type="button"
            onClick={async () => {
              if (!data.id) return;
              const code = Math.random().toString(36).substring(2, 12);
              const orgRef = doc(db, 'organisations', data.id);
              await updateDoc(orgRef, { transferOwnershipCode: code });
              setData({...data, transferOwnershipCode: code});
              alert('Transfer code generated! Share this with the new owner: ' + code);
            }}
            className="w-full py-3 bg-red-900/50 hover:bg-red-900 border border-red-900 text-red-300 font-bold rounded-xl transition-all"
          >
            Generate Transfer Code
          </button>
        </div>
      </div>
    </div>
  );
}
