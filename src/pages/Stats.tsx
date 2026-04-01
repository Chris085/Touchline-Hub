import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  Trophy, 
  Target, 
  Shield, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Award,
  Calendar,
  Star,
  CheckCircle2,
  XCircle,
  MinusCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { format } from 'date-fns';

export function Stats() {
  const { profile } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.teamId) return;

    const unsubMatches = onSnapshot(
      query(collection(db, 'matches'), where('teamId', '==', profile.teamId), orderBy('date', 'asc')),
      (snapshot) => {
        setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'matches')
    );

    const unsubPlayers = onSnapshot(
      query(collection(db, 'players'), where('teamId', '==', profile.teamId)),
      (snapshot) => setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'players')
    );

    const unsubVotes = onSnapshot(
      query(collection(db, 'motmVotes'), where('teamId', '==', profile.teamId)),
      (snapshot) => setVotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'motmVotes')
    );

    const unsubAttendances = onSnapshot(
      query(collection(db, 'attendances'), where('teamId', '==', profile.teamId)),
      (snapshot) => setAttendances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'attendances')
    );

    return () => {
      unsubMatches();
      unsubPlayers();
      unsubVotes();
      unsubAttendances();
    };
  }, [profile?.teamId]);

  const stats = useMemo(() => {
    const completedMatches = matches.filter(m => m.status === 'completed' && m.type === 'match');
    const totalMatches = completedMatches.length;
    
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsScored = 0;
    let goalsConceded = 0;
    let cleanSheets = 0;

    const scorers: Record<string, number> = {};
    const assists: Record<string, number> = {};
    const potmCounts: Record<string, number> = {};

    completedMatches.forEach(m => {
      if (m.scoreUs > m.scoreThem) wins++;
      else if (m.scoreUs === m.scoreThem) draws++;
      else losses++;

      goalsScored += m.scoreUs || 0;
      goalsConceded += m.scoreThem || 0;
      if (m.scoreThem === 0) cleanSheets++;

      // Process events for scorers and assists
      (m.events || []).forEach((event: any) => {
        if (event.type === 'goal') {
          scorers[event.playerId] = (scorers[event.playerId] || 0) + 1;
          if (event.assistId) {
            assists[event.assistId] = (assists[event.assistId] || 0) + 1;
          }
        }
      });
    });

    // Process POTM votes
    votes.forEach(v => {
      potmCounts[v.playerId] = (potmCounts[v.playerId] || 0) + 1;
    });

    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    // Performance Trend Data
    const trendData = completedMatches.map(m => ({
      date: format(new Date(m.date), 'MMM d'),
      scored: m.scoreUs,
      conceded: m.scoreThem,
      result: m.scoreUs > m.scoreThem ? 'W' : m.scoreUs === m.scoreThem ? 'D' : 'L'
    }));

    // Win/Loss/Draw Data for Pie Chart
    const resultData = [
      { name: 'Wins', value: wins, color: '#22c55e' },
      { name: 'Draws', value: draws, color: '#eab308' },
      { name: 'Losses', value: losses, color: '#ef4444' }
    ].filter(d => d.value > 0);

    // Leaderboards
    const topScorers = Object.entries(scorers)
      .map(([id, count]) => ({ name: players.find(p => p.id === id)?.name || 'Unknown', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topAssists = Object.entries(assists)
      .map(([id, count]) => ({ name: players.find(p => p.id === id)?.name || 'Unknown', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topPotm = Object.entries(potmCounts)
      .map(([id, count]) => ({ name: players.find(p => p.id === id)?.name || 'Unknown', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Attendance Stats
    const trainingMatches = matches.filter(m => m.type === 'training');
    const totalTraining = trainingMatches.length;
    const totalAttendanceRecords = attendances.length;
    const presentCount = attendances.filter(a => a.status === 'present').length;
    const attendanceRate = totalAttendanceRecords > 0 ? Math.round((presentCount / totalAttendanceRecords) * 100) : 0;

    return {
      totalMatches,
      wins,
      draws,
      losses,
      winRate,
      goalsScored,
      goalsConceded,
      cleanSheets,
      trendData,
      resultData,
      topScorers,
      topAssists,
      topPotm,
      attendanceRate,
      totalTraining
    };
  }, [matches, players, votes, attendances]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-white uppercase italic font-display tracking-tight">Team Statistics</h1>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Season Performance Overview</p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Win Rate" 
          value={`${stats.winRate}%`} 
          icon={<Trophy className="text-green-500" />} 
          trend={stats.winRate > 50 ? 'up' : 'down'}
        />
        <StatCard 
          label="Goals Scored" 
          value={stats.goalsScored} 
          icon={<Target className="text-blue-500" />} 
        />
        <StatCard 
          label="Clean Sheets" 
          value={stats.cleanSheets} 
          icon={<Shield className="text-yellow-500" />} 
        />
        <StatCard 
          label="Attendance" 
          value={`${stats.attendanceRate}%`} 
          icon={<Users className="text-purple-500" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Match Results Distribution */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8"
        >
          <h2 className="text-xl font-black text-white uppercase italic font-display tracking-tight mb-6 flex items-center gap-3">
            <Activity size={24} className="text-green-500" />
            Match Results
          </h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.resultData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.resultData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Goals Trend */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8"
        >
          <h2 className="text-xl font-black text-white uppercase italic font-display tracking-tight mb-6 flex items-center gap-3">
            <TrendingUp size={24} className="text-blue-500" />
            Scoring Trend
          </h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="scored" stroke="#22c55e" strokeWidth={3} dot={{ fill: '#22c55e' }} />
                <Line type="monotone" dataKey="conceded" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Leaderboard 
          title="Top Scorers" 
          data={stats.topScorers} 
          icon={<Target size={20} className="text-blue-500" />} 
          unit="Goals"
        />
        <Leaderboard 
          title="Top Assists" 
          data={stats.topAssists} 
          icon={<TrendingUp size={20} className="text-green-500" />} 
          unit="Assists"
        />
        <Leaderboard 
          title="POTM Awards" 
          data={stats.topPotm} 
          icon={<Award size={20} className="text-yellow-500" />} 
          unit="Awards"
        />
      </div>

      {/* Recent Form */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8"
      >
        <h2 className="text-xl font-black text-white uppercase italic font-display tracking-tight mb-6 flex items-center gap-3">
          <Calendar size={24} className="text-purple-500" />
          Recent Form
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {stats.trendData.slice(-10).reverse().map((match, i) => (
            <div key={i} className="flex flex-col items-center gap-2 shrink-0">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl italic font-display ${
                match.result === 'W' ? 'bg-green-500 text-slate-950 shadow-[0_0_15px_rgba(34,197,94,0.3)]' :
                match.result === 'D' ? 'bg-yellow-500 text-slate-950 shadow-[0_0_15px_rgba(234,179,8,0.3)]' :
                'bg-red-500 text-slate-950 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
              }`}>
                {match.result}
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{match.date}</span>
            </div>
          ))}
          {stats.trendData.length === 0 && (
            <p className="text-slate-500 text-sm italic">No completed matches yet.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ label, value, icon, trend }: { label: string, value: string | number, icon: React.ReactNode, trend?: 'up' | 'down' }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-black text-white italic font-display">{value}</span>
          {trend && (
            <div className={trend === 'up' ? 'text-green-500' : 'text-red-500'}>
              {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Leaderboard({ title, data, icon, unit }: { title: string, data: any[], icon: React.ReactNode, unit: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        {icon}
        <h3 className="text-sm font-black text-white uppercase italic font-display tracking-tight">{title}</h3>
      </div>
      <div className="space-y-4">
        {data.map((item, i) => (
          <div key={i} className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-black w-5 h-5 rounded flex items-center justify-center italic font-display ${
                i === 0 ? 'bg-yellow-500 text-slate-950' :
                i === 1 ? 'bg-slate-300 text-slate-950' :
                i === 2 ? 'bg-amber-600 text-slate-950' :
                'bg-slate-800 text-slate-400'
              }`}>
                {i + 1}
              </span>
              <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{item.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black text-white italic font-display">{item.count}</span>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{unit}</span>
            </div>
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-slate-500 text-xs italic py-4 text-center">No data recorded yet.</p>
        )}
      </div>
    </motion.div>
  );
}
