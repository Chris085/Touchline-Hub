import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  setDoc,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  Settings, 
  Plus, 
  History, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  User,
  ChevronRight,
  Save,
  DollarSign,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isSameMonth } from 'date-fns';

interface PaymentSettings {
  collectMatchFees: boolean;
  matchFeeAmount: number;
  collectMonthlySubs: boolean;
  monthlySubAmount: number;
  currency: string;
}

interface PlayerPayment {
  id: string;
  playerId: string;
  teamId: string;
  totalPaid: number;
  matchesPlayed: number;
  lastPaymentDate?: string;
}

interface PaymentTransaction {
  id: string;
  playerId: string;
  teamId: string;
  amount: number;
  date: string;
  type: 'match' | 'monthly';
  note?: string;
}

interface MonthlySub {
  id: string;
  playerId: string;
  teamId: string;
  month: string;
  status: 'paid' | 'unpaid' | 'exempt';
  paidAt?: string;
}

interface Player {
  id: string;
  name: string;
}

export function Payments() {
  const { profile, isAdmin, isSubscribed } = useAuth();
  const [team, setTeam] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerPayments, setPlayerPayments] = useState<Record<string, PlayerPayment>>({});
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [monthlySubs, setMonthlySubs] = useState<Record<string, Record<string, MonthlySub>>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'history'>('overview');
  const [showAddPayment, setShowAddPayment] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'match' | 'monthly'>('match');
  const [paymentNote, setPaymentNote] = useState('');

  const isCoach = profile?.role === 'coach' || isAdmin;

  useEffect(() => {
    if (!profile?.teamId) return;

    // Fetch Team Settings
    const unsubTeam = onSnapshot(doc(db, 'teams', profile.teamId), (doc) => {
      if (doc.exists()) {
        setTeam({ id: doc.id, ...doc.data() });
      }
    });

    // Fetch Players
    const qPlayers = query(collection(db, 'players'), where('teamId', '==', profile.teamId));
    const unsubPlayers = onSnapshot(qPlayers, (snapshot) => {
      setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
    });

    // Fetch Player Payments (Balances)
    const qBalances = query(collection(db, 'playerPayments'), where('teamId', '==', profile.teamId));
    const unsubBalances = onSnapshot(qBalances, (snapshot) => {
      const balances: Record<string, PlayerPayment> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as PlayerPayment;
        balances[data.playerId] = { id: doc.id, ...data };
      });
      setPlayerPayments(balances);
    });

    // Fetch Transactions
    const qTransactions = query(
      collection(db, 'paymentTransactions'), 
      where('teamId', '==', profile.teamId),
      orderBy('date', 'desc'),
      limit(50)
    );
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentTransaction)));
    });

    // Fetch Monthly Subs
    const qSubs = query(collection(db, 'monthlySubs'), where('teamId', '==', profile.teamId));
    const unsubSubs = onSnapshot(qSubs, (snapshot) => {
      const subs: Record<string, Record<string, MonthlySub>> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as MonthlySub;
        if (!subs[data.playerId]) subs[data.playerId] = {};
        subs[data.playerId][data.month] = { id: doc.id, ...data };
      });
      setMonthlySubs(subs);
    });

    setLoading(false);

    return () => {
      unsubTeam();
      unsubPlayers();
      unsubBalances();
      unsubTransactions();
      unsubSubs();
    };
  }, [profile?.teamId]);

  const handleUpdateSettings = async (settings: Partial<PaymentSettings>) => {
    if (!team) return;
    try {
      await updateDoc(doc(db, 'teams', team.id), {
        paymentSettings: {
          ...(team.paymentSettings || {
            collectMatchFees: false,
            matchFeeAmount: 0,
            collectMonthlySubs: false,
            monthlySubAmount: 0,
            currency: '£'
          }),
          ...settings
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `teams/${team.id}`);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddPayment || !paymentAmount || !profile?.teamId) return;

    const amount = parseFloat(paymentAmount);
    const playerId = showAddPayment;

    try {
      // 1. Add Transaction
      await addDoc(collection(db, 'paymentTransactions'), {
        playerId,
        teamId: profile.teamId,
        amount,
        date: new Date().toISOString(),
        type: paymentType,
        note: paymentNote
      });

      // 2. Update Balance if it's a match fee
      if (paymentType === 'match') {
        const existingBalance = playerPayments[playerId];
        if (existingBalance) {
          await updateDoc(doc(db, 'playerPayments', existingBalance.id), {
            totalPaid: existingBalance.totalPaid + amount,
            lastPaymentDate: new Date().toISOString()
          });
        } else {
          await setDoc(doc(db, 'playerPayments', `${profile.teamId}_${playerId}`), {
            playerId,
            teamId: profile.teamId,
            totalPaid: amount,
            matchesPlayed: 0,
            lastPaymentDate: new Date().toISOString()
          });
        }
      }

      setShowAddPayment(null);
      setPaymentAmount('');
      setPaymentNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'paymentTransactions');
    }
  };

  const toggleMonthlySub = async (playerId: string, month: string) => {
    if (!profile?.teamId) return;
    const currentStatus = monthlySubs[playerId]?.[month]?.status || 'unpaid';
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    
    const subId = `${profile.teamId}_${playerId}_${month}`;
    try {
      await setDoc(doc(db, 'monthlySubs', subId), {
        playerId,
        teamId: profile.teamId,
        month,
        status: nextStatus,
        paidAt: nextStatus === 'paid' ? new Date().toISOString() : null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `monthlySubs/${subId}`);
    }
  };

  const updateMatchesPlayed = async (playerId: string, delta: number) => {
    if (!profile?.teamId) return;
    const balance = playerPayments[playerId];
    
    try {
      if (balance) {
        await updateDoc(doc(db, 'playerPayments', balance.id), {
          matchesPlayed: Math.max(0, balance.matchesPlayed + delta)
        });
      } else {
        // Create balance record if it doesn't exist
        await setDoc(doc(db, 'playerPayments', `${profile.teamId}_${playerId}`), {
          playerId,
          teamId: profile.teamId,
          totalPaid: 0,
          matchesPlayed: Math.max(0, delta)
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'playerPayments');
    }
  };

  const updateAllMatchesPlayed = async (delta: number) => {
    if (!profile?.teamId) return;
    try {
      const promises = players.map(async (player) => {
        const balance = playerPayments[player.id];
        if (balance) {
          await updateDoc(doc(db, 'playerPayments', balance.id), {
            matchesPlayed: Math.max(0, balance.matchesPlayed + delta)
          });
        } else {
          // Create balance record if it doesn't exist
          await setDoc(doc(db, 'playerPayments', `${profile.teamId}_${player.id}`), {
            playerId: player.id,
            teamId: profile.teamId,
            totalPaid: 0,
            matchesPlayed: Math.max(0, delta)
          });
        }
      });
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'playerPayments');
    }
  };

  const calculateMatchesRemaining = (playerId: string) => {
    const balance = playerPayments[playerId];
    const fee = team?.paymentSettings?.matchFeeAmount || 0;
    if (!balance || fee === 0) return 0;
    
    const totalMatchesCovered = Math.floor(balance.totalPaid / fee);
    return totalMatchesCovered - balance.matchesPlayed;
  };

  const calculateAmountOwed = (playerId: string) => {
    const balance = playerPayments[playerId];
    const fee = team?.paymentSettings?.matchFeeAmount || 0;
    if (!balance) return 0;
    
    const totalOwed = (balance.matchesPlayed * fee) - balance.totalPaid;
    return Math.max(0, totalOwed);
  };

  const getRemainingColor = (remaining: number) => {
    if (remaining <= 0) return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (remaining <= 2) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-green-500 bg-green-500/10 border-green-500/20';
  };

  const getOwedColor = (owed: number) => {
    if (owed > 0) return 'text-red-500 font-bold';
    return 'text-green-500';
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading payments...</div>;

  const currentMonths = eachMonthOfInterval({
    start: subMonths(new Date(), 3),
    end: new Date()
  }).reverse();

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 tracking-tight flex items-center gap-3">
            <Wallet className="text-green-500" size={32} />
            Payments & Subs
          </h1>
          <p className="text-slate-400">Manage team finances and player balances</p>
        </div>

        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            History
          </button>
          {isCoach && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-slate-800 text-slate-50 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      {activeTab === 'settings' && isCoach && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-8"
        >
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
                  <DollarSign className="text-green-500" size={20} />
                  Match Fees
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={team?.paymentSettings?.collectMatchFees}
                    onChange={(e) => handleUpdateSettings({ collectMatchFees: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
              <p className="text-sm text-slate-400">Collect fees per match (e.g., for referees or pitch hire)</p>
              <div className="flex items-center gap-3">
                <span className="text-xl text-slate-500">{team?.paymentSettings?.currency || '£'}</span>
                <input
                  type="number"
                  placeholder="Amount per match"
                  className="bg-slate-800 border-none rounded-lg px-4 py-2 text-slate-50 w-32 focus:ring-2 focus:ring-green-500"
                  value={team?.paymentSettings?.matchFeeAmount ?? ''}
                  onChange={(e) => handleUpdateSettings({ matchFeeAmount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
                  <Calendar className="text-blue-500" size={20} />
                  Monthly Subs
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={team?.paymentSettings?.collectMonthlySubs}
                    onChange={(e) => handleUpdateSettings({ collectMonthlySubs: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>
              <p className="text-sm text-slate-400">Collect a fixed monthly subscription fee from each player</p>
              <div className="flex items-center gap-3">
                <span className="text-xl text-slate-500">{team?.paymentSettings?.currency || '£'}</span>
                <input
                  type="number"
                  placeholder="Amount per month"
                  className="bg-slate-800 border-none rounded-lg px-4 py-2 text-slate-50 w-32 focus:ring-2 focus:ring-blue-500"
                  value={team?.paymentSettings?.monthlySubAmount ?? ''}
                  onChange={(e) => handleUpdateSettings({ monthlySubAmount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Match Fees Table */}
          {team?.paymentSettings?.collectMatchFees && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-50">Match Fees & Balances</h3>
                <div className="flex items-center gap-4">
                  {isCoach && (
                    <button
                      onClick={() => updateAllMatchesPlayed(1)}
                      className="text-blue-500 hover:text-blue-400 font-bold text-xs flex items-center gap-1"
                    >
                      <Plus size={14} />
                      Add Game for All
                    </button>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Good</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> Low</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Due</span>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-bold">Player</th>
                      <th className="px-6 py-4 font-bold text-center">Total Paid</th>
                      <th className="px-6 py-4 font-bold text-center">Played</th>
                      <th className="px-6 py-4 font-bold text-center">Owes</th>
                      <th className="px-6 py-4 font-bold text-center">Remaining</th>
                      <th className="px-6 py-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {players.map(player => {
                      const remaining = calculateMatchesRemaining(player.id);
                      const balance = playerPayments[player.id];
                      const owed = calculateAmountOwed(player.id);
                      
                      return (
                        <tr key={player.id} className="hover:bg-slate-800/30 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                                <User size={16} />
                              </div>
                              <span className="font-bold text-slate-50">{player.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-mono text-slate-300">
                            {team.paymentSettings.currency}{balance?.totalPaid || 0}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {isCoach && (
                                <button 
                                  onClick={() => updateMatchesPlayed(player.id, -1)}
                                  className="text-slate-600 hover:text-slate-50 transition-colors"
                                >
                                  -
                                </button>
                              )}
                              <span className="text-slate-300">{balance?.matchesPlayed || 0}</span>
                              {isCoach && (
                                <button 
                                  onClick={() => updateMatchesPlayed(player.id, 1)}
                                  className="text-slate-600 hover:text-slate-50 transition-colors"
                                >
                                  +
                                </button>
                              )}
                            </div>
                          </td>
                          <td className={`px-6 py-4 text-center font-mono ${getOwedColor(owed)}`}>
                            {team.paymentSettings.currency}{owed.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getRemainingColor(remaining)}`}>
                              {remaining} games
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {isCoach && (
                              <button
                                onClick={() => setShowAddPayment(player.id)}
                                className="text-green-500 hover:text-green-400 font-bold text-sm flex items-center gap-1 ml-auto"
                              >
                                <Plus size={16} />
                                Add Payment
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View for Match Fees */}
              <div className="sm:hidden divide-y divide-slate-800">
                {players.map(player => {
                  const remaining = calculateMatchesRemaining(player.id);
                  const balance = playerPayments[player.id];
                  
                  return (
                    <div key={player.id} className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                            <User size={16} />
                          </div>
                          <span className="font-bold text-slate-50">{player.name}</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getRemainingColor(remaining)}`}>
                          {remaining} games
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Total Paid</p>
                          <p className="text-lg font-black text-slate-50 italic font-display">
                            {team.paymentSettings.currency}{balance?.totalPaid || 0}
                          </p>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Owes</p>
                          <p className={`text-lg font-black italic font-display ${getOwedColor(calculateAmountOwed(player.id))}`}>
                            {team.paymentSettings.currency}{calculateAmountOwed(player.id).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Played</p>
                          <div className="flex items-center gap-3">
                            {isCoach && (
                              <button 
                                onClick={() => updateMatchesPlayed(player.id, -1)}
                                className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center text-slate-50"
                              >
                                -
                              </button>
                            )}
                            <span className="text-lg font-black text-slate-50 italic font-display">{balance?.matchesPlayed || 0}</span>
                            {isCoach && (
                              <button 
                                onClick={() => updateMatchesPlayed(player.id, 1)}
                                className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center text-slate-50"
                              >
                                +
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {isCoach && (
                        <button
                          onClick={() => setShowAddPayment(player.id)}
                          className="w-full py-3 bg-green-500/10 text-green-500 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-green-500/20"
                        >
                          <Plus size={16} />
                          Add Payment
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly Subs Table */}
          {team?.paymentSettings?.collectMonthlySubs && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h3 className="text-lg font-bold text-slate-50">Monthly Subscriptions</h3>
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-bold">Player</th>
                      {currentMonths.map(month => (
                        <th key={format(month, 'yyyy-MM')} className="px-6 py-4 font-bold text-center">
                          {format(month, 'MMM yy')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {players.map(player => (
                      <tr key={player.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-50">{player.name}</span>
                        </td>
                        {currentMonths.map(month => {
                          const monthStr = format(month, 'yyyy-MM');
                          const sub = monthlySubs[player.id]?.[monthStr];
                          const isPaid = sub?.status === 'paid';
                          
                          return (
                            <td key={monthStr} className="px-6 py-4 text-center">
                              <button
                                disabled={!isCoach}
                                onClick={() => toggleMonthlySub(player.id, monthStr)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all ${
                                  isPaid 
                                    ? 'bg-green-500 text-slate-950 shadow-lg shadow-green-500/20' 
                                    : 'bg-slate-800 text-slate-600 hover:bg-slate-700'
                                } ${!isCoach ? 'cursor-default' : ''}`}
                              >
                                {isPaid ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View for Monthly Subs */}
              <div className="sm:hidden divide-y divide-slate-800">
                {players.map(player => (
                  <div key={player.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-50">{player.name}</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                      {currentMonths.map(month => {
                        const monthStr = format(month, 'yyyy-MM');
                        const sub = monthlySubs[player.id]?.[monthStr];
                        const isPaid = sub?.status === 'paid';
                        
                        return (
                          <div key={monthStr} className="flex flex-col items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{format(month, 'MMM')}</span>
                            <button
                              disabled={!isCoach}
                              onClick={() => toggleMonthlySub(player.id, monthStr)}
                              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                                isPaid 
                                  ? 'bg-green-500 text-slate-950 shadow-lg shadow-green-500/20' 
                                  : 'bg-slate-800 text-slate-600 hover:bg-slate-700'
                              } ${!isCoach ? 'cursor-default' : ''}`}
                            >
                              {isPaid ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h3 className="text-lg font-bold text-slate-50">Recent Transactions</h3>
          </div>
          <div className="divide-y divide-slate-800">
            {transactions.map(tx => {
              const player = players.find(p => p.id === tx.playerId);
              return (
                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'match' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {tx.type === 'match' ? <DollarSign size={20} /> : <Calendar size={20} />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-50">{player?.name || 'Unknown Player'}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{format(new Date(tx.date), 'MMM d, yyyy HH:mm')}</span>
                        {tx.note && <span>• {tx.note}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-slate-50">
                    {team?.paymentSettings?.currency || '£'}{tx.amount}
                  </div>
                </div>
              );
            })}
            {transactions.length === 0 && (
              <div className="p-12 text-center text-slate-500 italic">No transactions found</div>
            )}
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      <AnimatePresence>
        {showAddPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-50">Add Payment</h2>
                <button onClick={() => setShowAddPayment(null)} className="text-slate-400 hover:text-slate-50">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              <form onSubmit={handleAddPayment} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Player</label>
                  <div className="p-3 bg-slate-800 rounded-xl text-slate-50 font-bold">
                    {players.find(p => p.id === showAddPayment)?.name}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPaymentType('match')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      paymentType === 'match' ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-slate-800 text-slate-500'
                    }`}
                  >
                    <DollarSign size={24} />
                    <span className="font-bold text-xs uppercase">Match Fee</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('monthly')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      paymentType === 'monthly' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-800 text-slate-500'
                    }`}
                  >
                    <Calendar size={24} />
                    <span className="font-bold text-xs uppercase">Monthly Sub</span>
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Amount ({team?.paymentSettings?.currency || '£'})</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    className="w-full bg-slate-800 border-none rounded-xl p-4 text-slate-50 placeholder-slate-500 focus:ring-2 focus:ring-green-500 text-2xl font-bold"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Note (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Paid for 5 matches"
                    className="w-full bg-slate-800 border-none rounded-xl p-4 text-slate-50 placeholder-slate-500 focus:ring-2 focus:ring-green-500"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-green-500 hover:bg-green-400 text-slate-950 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-green-500/20"
                >
                  <Save size={20} />
                  Record Payment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
