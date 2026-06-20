import React, { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, query, orderBy, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Loader2, Users, Users as UsersIcon, Shield, Trash2, Activity, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { ConfirmModal } from '../components/ConfirmModal';
import { AdminTeamDetailsModal } from './AdminTeamDetailsModal';

export function AdminOverview() {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'team' | 'user' | 'player', name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teamsSnap, usersSnap, playersSnap] = await Promise.all([
        getDocs(collection(db, 'teams')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'players'))
      ]);

      const fetchedTeams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const fetchedUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const fetchedPlayers = playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setTeams(fetchedTeams);
      setUsers(fetchedUsers);
      setPlayers(fetchedPlayers);
    } catch (error) {
      console.error('Error fetching admin overview data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      let collectionName = '';
      if (deleteTarget.type === 'team') collectionName = 'teams';
      else if (deleteTarget.type === 'user') collectionName = 'users';
      else if (deleteTarget.type === 'player') collectionName = 'players';
      
      await deleteDoc(doc(db, collectionName, deleteTarget.id));
      
      if (deleteTarget.type === 'team') setTeams(teams.filter(t => t.id !== deleteTarget.id));
      else if (deleteTarget.type === 'user') setUsers(users.filter(u => u.id !== deleteTarget.id));
      else if (deleteTarget.type === 'player') setPlayers(players.filter(p => p.id !== deleteTarget.id));
      
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('Error deleting', err);
      setDeleteError(err?.message || 'Unknown error occurred while deleting.');
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      if (newRole === 'coach') {
        const userObj = users.find(u => u.id === userId);
        if (userObj && userObj.teamId) {
          const coachesQuery = query(
            collection(db, 'users'),
            where('teamId', '==', userObj.teamId),
            where('role', '==', 'coach')
          );
          const coachesSnapshot = await getDocs(coachesQuery);
          if (coachesSnapshot.size >= 3) {
            alert('This team already has the maximum number of coaches/managers (3).');
            return;
          }
        }
      }
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role');
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  // Calculate some stats
  const totalTeams = teams.length;
  const totalUsers = users.length;
  // User is orphaned if they are NOT a coach AND they either have no teamId, OR the teamId they have doesn't exist anymore
  const orphanedUsers = users.filter(u => u.role !== 'coach' && (!u.teamId || !teams.some(t => t.id === u.teamId)));
  const orphanedTeams = teams.filter(t => !users.some(u => u.uid === t.coachId || u.id === t.coachId));
  
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2 text-slate-400">
            <Shield className="w-5 h-5 text-blue-500" />
            <h3 className="font-medium">Total Teams</h3>
          </div>
          <div className="text-3xl font-bold text-slate-50">{totalTeams}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2 text-slate-400">
            <Shield className="w-5 h-5 text-yellow-500" />
            <h3 className="font-medium">Orphaned Teams</h3>
          </div>
          <div className="text-3xl font-bold text-slate-50">{orphanedTeams.length}</div>
          <p className="text-xs text-slate-500 mt-1">Teams with no valid coach</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2 text-slate-400">
            <Users className="w-5 h-5 text-green-500" />
            <h3 className="font-medium">Total Users</h3>
          </div>
          <div className="text-3xl font-bold text-slate-50">{totalUsers}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2 text-slate-400">
            <UsersIcon className="w-5 h-5 text-red-500" />
            <h3 className="font-medium">Orphaned Users</h3>
          </div>
          <div className="text-3xl font-bold text-slate-50">{orphanedUsers.length}</div>
          <p className="text-xs text-slate-500 mt-1">Users without a team</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Shield className="w-4 h-4" />
            Teams & Subscriptions
          </div>
        </div>
        <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
          {teams.map(team => {
            const coach = users.find(u => u.uid === team.coachId || u.id === team.coachId);
            const teamPlayers = players.filter(p => p.teamId === team.id);
            const teamParents = users.filter(u => u.teamId === team.id && u.role === 'parent');

            return (
              <div key={team.id} className={`p-4 flex justify-between items-start gap-4 hover:bg-slate-800/30 transition-colors ${!coach ? 'bg-yellow-900/10' : ''}`}>
                <div className="flex-1">
                  <h4 className="font-bold text-lg text-slate-50">{team.name} {!coach && <span className="text-yellow-500 text-xs ml-2 tracking-wide font-normal uppercase">(Orphaned)</span>}</h4>
                  <p className="text-xs text-slate-500 font-mono mt-1">Code: {team.code} | ID: {team.id}</p>
                  
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div className="bg-slate-800/50 rounded px-3 py-2">
                      <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Coach</span>
                      <span className="text-slate-300 truncate block" title={coach?.email}>{coach?.email || 'Unknown'}</span>
                    </div>
                    <div className="bg-slate-800/50 rounded px-3 py-2">
                      <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Subscription</span>
                      <span className={`capitalize font-medium ${coach?.subscriptionStatus === 'active' ? 'text-green-500' : 'text-yellow-500'}`}>
                        {coach?.subscriptionStatus || 'None'}
                      </span>
                    </div>
                    <div className="bg-slate-800/50 rounded px-3 py-2">
                      <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Players</span>
                      <span className="text-slate-300">{teamPlayers.length}</span>
                    </div>
                    <div className="bg-slate-800/50 rounded px-3 py-2">
                      <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Parents</span>
                      <span className="text-slate-300">{teamParents.length}</span>
                    </div>
                  </div>
                </div>
                <div className="flex bg-slate-800/20 px-2 py-1 gap-1 rounded-xl">
                  <button
                    onClick={() => setEditingTeam(team)}
                    className="p-2 text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                    title="Edit Team"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: team.id, type: 'team', name: team.name })}
                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete Team"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
          {teams.length === 0 && (
            <div className="p-8 text-center text-slate-500 italic">No teams found</div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl mt-8">
        <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Users className="w-4 h-4" />
            All Users
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs text-slate-500 uppercase bg-slate-800/50 sticky top-0">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Sub Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map(user => {
                const team = teams.find(t => t.id === user.teamId);
                const isOrphan = user.role !== 'coach' && (!user.teamId || !team);
                
                return (
                  <tr key={user.id} className={`hover:bg-slate-800/30 ${isOrphan ? 'bg-red-900/10' : ''}`}>
                    <td className="px-4 py-3 truncate max-w-[200px]" title={user.email}>{user.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role || ''}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                        className="bg-slate-800 border-none rounded text-xs text-slate-300 py-1 px-2 cursor-pointer focus:ring-1 focus:ring-green-500"
                      >
                        <option value="">None</option>
                        <option value="coach">Coach</option>
                        <option value="parent">Parent</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {team ? (
                        <div className="text-slate-300 truncate max-w-[150px]" title={team.name}>{team.name}</div>
                      ) : (
                        <span className="text-slate-600 italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.role === 'coach' ? (
                        <span className={`px-2 py-1 rounded text-xs ${user.subscriptionStatus === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                          {user.subscriptionStatus || 'inactive'}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeleteTarget({ id: user.id, type: 'user', name: user.email })}
                        className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors inline-block"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl mt-8">
        <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Activity className="w-4 h-4" />
            All Players
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs text-slate-500 uppercase bg-slate-800/50 sticky top-0">
              <tr>
                <th className="px-4 py-3">Player Name</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {players.map(player => {
                const team = teams.find(t => t.id === player.teamId);
                const isOrphan = !player.teamId || !team;
                
                return (
                  <tr key={player.id} className={`hover:bg-slate-800/30 ${isOrphan ? 'bg-yellow-900/10' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-300">{player.name}</td>
                    <td className="px-4 py-3">
                      {team ? (
                        <div className="text-slate-300 truncate max-w-[200px]" title={team.name}>{team.name}</div>
                      ) : (
                        <span className="text-slate-600 italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${player.active !== false ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-500'}`}>
                        {player.active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeleteTarget({ id: player.id, type: 'player', name: player.name })}
                        className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors inline-block"
                        title="Delete Player"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {players.length === 0 && (
            <div className="p-8 text-center text-slate-500 italic">No players found</div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={`Delete ${deleteTarget?.type}`}
        message={deleteError ? `Error: ${deleteError}` : `Are you sure you want to delete ${deleteTarget?.type} "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />

      <AdminTeamDetailsModal
        isOpen={editingTeam !== null}
        team={editingTeam}
        coach={editingTeam ? users.find(u => u.uid === editingTeam.coachId || u.id === editingTeam.coachId) : null}
        parents={editingTeam ? users.filter(u => u.teamId === editingTeam.id && u.role === 'parent') : []}
        onClose={() => setEditingTeam(null)}
        onRefresh={fetchData}
      />
    </div>
  );
}
