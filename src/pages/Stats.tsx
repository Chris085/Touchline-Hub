import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
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
  MinusCircle,
  ChevronRight,
  Share2,
  X,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
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

import { SeasonSummaryModal } from '../components/SeasonSummaryModal';
import { FormationAnalyticsModal } from '../components/FormationAnalyticsModal';
import { InsightViewerModal } from '../components/InsightViewerModal';

export function Stats() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [availabilities, setAvailabilities] = useState<any[]>([]);
  const [seasonSummaries, setSeasonSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<any | null>(null);
  const [activePieIndex, setActivePieIndex] = useState<number | undefined>(undefined);
  const [teamName, setTeamName] = useState<string>(profile?.joinedTeams?.find(t => t.teamId === profile?.teamId)?.teamName || 'Your Team');


  const [seasonId, setSeasonId] = useState<string>('');

  useEffect(() => {
    if (!profile?.teamId) return;

    // Fetch Team Name
    const unsubTeam = onSnapshot(doc(db, 'teams', profile.teamId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.name) setTeamName(data.name);
        if (data.seasonTag) setSeasonId(data.seasonTag);
      }
    });

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

    const unsubAvailabilities = onSnapshot(
      query(collection(db, 'availabilities'), where('teamId', '==', profile.teamId)),
      (snapshot) => setAvailabilities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'availabilities')
    );

    const unsubSummaries = onSnapshot(
      query(collection(db, 'seasonSummaries'), where('teamId', '==', profile.teamId), orderBy('createdAt', 'desc')),
      (snapshot) => setSeasonSummaries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'seasonSummaries')
    );

    return () => {
      unsubTeam();
      unsubMatches();
      unsubPlayers();
      unsubVotes();
      unsubAttendances();
      unsubAvailabilities();
      unsubSummaries();
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
    const coachPotmCounts: Record<string, number> = {};
    const parentPotmCounts: Record<string, number> = {};

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
          const assistId = event.assistPlayerId || event.assistId;
          if (assistId && assistId !== 'none') {
            assists[assistId] = (assists[assistId] || 0) + 1;
          }
        }
      });
    });

    // Process POTM awards (both finalized and raw votes)
    completedMatches.forEach(m => {
      if (m.coachPotmId) {
        coachPotmCounts[m.coachPotmId] = (coachPotmCounts[m.coachPotmId] || 0) + 1;
      }
      // Use finalized parent POTM if available, otherwise raw votes are handled below
      if (m.parentPotmId || m.parentsPotmId) {
        const pId = m.parentPotmId || m.parentsPotmId;
        parentPotmCounts[pId] = (parentPotmCounts[pId] || 0) + 1;
      }
    });

    // Also include raw votes for matches that might not be finalized yet
    votes.forEach(v => {
      // Only count votes if the match isn't already finalized for parents
      const match = matches.find(m => m.id === v.matchId);
      if (match && !match.parentPotmId && !match.parentsPotmId) {
        parentPotmCounts[v.playerId] = (parentPotmCounts[v.playerId] || 0) + 1;
      }
    });

    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    // Performance Trend Data
    const trendData = completedMatches
      .filter(m => m.date)
      .map(m => ({
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

    const topCoachPotm = Object.entries(coachPotmCounts)
      .map(([id, count]) => ({ name: players.find(p => p.id === id)?.name || 'Unknown', count: Math.floor(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topParentPotm = Object.entries(parentPotmCounts)
      .map(([id, count]) => ({ name: players.find(p => p.id === id)?.name || 'Unknown', count: Math.floor(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Attendance Stats
    const trainingMatches = matches.filter(m => m.type === 'training');
    const totalTraining = trainingMatches.length;
    
    // Calculate combined attendance (both coach attendances and parent availabilities)
    const allSessionRecords = new Set([
      ...attendances.map(a => `${a.matchId}_${a.playerId}`),
      ...availabilities.map(a => `${a.matchId}_${a.playerId}`)
    ]);

    let presentCount = 0;
    
    allSessionRecords.forEach(recordId => {
      const [matchId, playerId] = recordId.split('_');
      const att = attendances.find(a => a.matchId === matchId && a.playerId === playerId);
      const avail = availabilities.find(a => a.matchId === matchId && a.playerId === playerId);
      
      if (att) {
        if (att.status === 'present' || att.status === 'late') presentCount++;
      } else if (avail) {
        if (avail.status === 'going') presentCount++;
      }
    });

    const totalAttendanceRecords = allSessionRecords.size;
    const attendanceRate = totalAttendanceRecords > 0 ? Math.round((presentCount / totalAttendanceRecords) * 100) : 0;

    const playerAttendanceStats = players.map(p => {
      let matchPresentCount = 0;
      let matchTotalCount = 0;
      let trainingPresentCount = 0;
      let trainingTotalCount = 0;

      allSessionRecords.forEach(recordId => {
        const [matchId, playerId] = recordId.split('_');
        if (playerId !== p.id) return;
        
        const match = matches.find(m => m.id === matchId);
        if (!match) return;

        const att = attendances.find(a => a.matchId === matchId && a.playerId === playerId);
        const avail = availabilities.find(a => a.matchId === matchId && a.playerId === playerId);
        
        let isPresent = false;
        if (att) {
          if (att.status === 'present' || att.status === 'late') isPresent = true;
        } else if (avail) {
          if (avail.status === 'going') isPresent = true;
        }

        if (match.type === 'match') {
          matchTotalCount++;
          if (isPresent) matchPresentCount++;
        } else if (match.type === 'training') {
          trainingTotalCount++;
          if (isPresent) trainingPresentCount++;
        }
      });

      return {
        id: p.id,
        name: p.name,
        matchRate: matchTotalCount > 0 ? Math.round((matchPresentCount / matchTotalCount) * 100) : 0,
        trainingRate: trainingTotalCount > 0 ? Math.round((trainingPresentCount / trainingTotalCount) * 100) : 0,
        overallRate: (matchTotalCount + trainingTotalCount) > 0 ? Math.round(((matchPresentCount + trainingPresentCount) / (matchTotalCount + trainingTotalCount)) * 100) : 0,
        matchPresentCount,
        matchTotalCount,
        trainingPresentCount,
        trainingTotalCount
      };
    }).sort((a, b) => b.overallRate - a.overallRate);

    // Season Match History
    const seasonAwards = completedMatches.map(m => {
      // Parent's POTM calculation
      const matchVotes = votes.filter(v => v.matchId === m.id);
      const voteCounts: Record<string, number> = {};
      matchVotes.forEach(v => {
        voteCounts[v.playerId] = (voteCounts[v.playerId] || 0) + 1;
      });
      
      let parentPotmId = null;
      let maxVotes = 0;
      Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          parentPotmId = id;
        }
      });

      const scoreUs = m.scoreUs || 0;
      const scoreThem = m.scoreThem || 0;
      const result = scoreUs > scoreThem ? 'W' : scoreUs === scoreThem ? 'D' : 'L';
      const goalDiff = scoreUs - scoreThem;

      return {
        matchId: m.id,
        opponent: m.opponent,
        result,
        score: `${scoreUs} - ${scoreThem}`,
        goalDiff: goalDiff > 0 ? `+${goalDiff}` : goalDiff,
        date: m.date,
        coachPotm: m.coachPotmName || 'Not Selected',
        parentPotm: parentPotmId ? (players.find(p => p.id === parentPotmId)?.name) : (m.parentPotmName || m.parentsPotmName || 'No Votes'),
        notes: m.trainingNotes || ''
      };
    }).sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

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
      topCoachPotm,
      topParentPotm,
      attendanceRate,
      totalTraining,
      seasonAwards,
      playerAttendanceStats
    };
  }, [matches, players, votes, attendances, availabilities]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-slate-50 uppercase italic font-display tracking-tight">Team Statistics</h1>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Season Performance Overview</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setShowAnalyticsModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-400 text-slate-950 rounded-2xl font-bold transition-all shadow-lg shadow-purple-500/20 w-full sm:w-auto"
          >
            <Sparkles size={18} />
            AI Tactics
          </button>
          <button 
            onClick={() => setShowShareModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-400 text-slate-950 rounded-2xl font-bold transition-all shadow-lg shadow-green-500/20 w-full sm:w-auto"
          >
            <Share2 size={18} />
            Share Summary
          </button>
        </div>
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
          onClick={() => setShowAttendanceModal(true)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Match Results Distribution */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8"
        >
          <h2 className="text-xl font-black text-slate-50 uppercase italic font-display tracking-tight mb-6 flex items-center gap-3">
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
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  onMouseEnter={(_, index) => setActivePieIndex(index)}
                  onMouseLeave={() => setActivePieIndex(undefined)}
                  style={{ outline: 'none' }}
                >
                  {stats.resultData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      style={{ outline: 'none' }}
                    />
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
          <h2 className="text-xl font-black text-slate-50 uppercase italic font-display tracking-tight mb-6 flex items-center gap-3">
            <TrendingUp size={24} className="text-blue-500" />
            Scoring Trend
          </h2>
          <div className="h-[300px] w-full -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={30} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="scored" stroke="#22c55e" strokeWidth={3} dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="conceded" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
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
          title="Coach POTM" 
          data={stats.topCoachPotm} 
          icon={<Award size={20} className="text-yellow-500" />} 
          unit="Awards"
        />
        <Leaderboard 
          title="Parents POTM" 
          data={stats.topParentPotm} 
          icon={<Star size={20} className="text-purple-500" />} 
          unit="Awards"
        />
      </div>

      {/* Recent Form */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8"
      >
        <h2 className="text-xl font-black text-slate-50 uppercase italic font-display tracking-tight mb-6 flex items-center gap-3">
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

      {/* Season Match History */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8 overflow-hidden"
      >
        <h2 className="text-xl font-black text-slate-50 uppercase italic font-display tracking-tight mb-6 flex items-center gap-3">
          <Trophy size={24} className="text-yellow-500" />
          Season Match History
        </h2>
        
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto -mx-8 px-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Opponent</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Result</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Score</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">GD</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">MOTM (Coach/Parent)</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Notes</th>
              </tr>
            </thead>
            <tbody>
              {stats.seasonAwards.map((match, i) => (
                <tr 
                  key={i} 
                  onClick={() => navigate(`/schedule/${match.matchId}`)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group cursor-pointer"
                >
                  <td className="py-4 px-4">
                    <span className="text-xs font-bold text-slate-400">{match.date ? format(new Date(match.date), 'MMM d, yyyy') : 'Postponed TBA'}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm font-black text-slate-50 uppercase italic font-display break-words">vs {match.opponent}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-xs italic font-display ${
                      match.result === 'W' ? 'bg-green-500/20 text-green-500' :
                      match.result === 'D' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-red-500/20 text-red-500'
                    }`}>
                      {match.result}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-sm font-black text-slate-50 italic font-display">{match.score}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`text-xs font-bold ${
                      (typeof match.goalDiff === 'string' && match.goalDiff.startsWith('+')) || (typeof match.goalDiff === 'number' && match.goalDiff > 0) ? 'text-green-500' : 
                      (typeof match.goalDiff === 'string' && match.goalDiff.startsWith('-')) || (typeof match.goalDiff === 'number' && match.goalDiff < 0) ? 'text-red-500' : 
                      'text-slate-500'
                    }`}>
                      {match.goalDiff}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-400 font-medium"><span className="text-yellow-500/70 font-bold uppercase">C:</span> {match.coachPotm}</span>
                      <span className="text-[10px] text-slate-400 font-medium"><span className="text-blue-500/70 font-bold uppercase">P:</span> {match.parentPotm}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-[10px] text-slate-500 italic max-w-[200px] truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all">
                      {match.notes || 'No notes recorded'}
                    </p>
                  </td>
                </tr>
              ))}
              {stats.seasonAwards.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-sm italic">
                    No match history recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Condensed View */}
        <div className="sm:hidden space-y-4">
          {stats.seasonAwards.map((match, i) => (
            <div 
              key={i}
              onClick={() => navigate(`/schedule/${match.matchId}`)}
              className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-800/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{match.date ? format(new Date(match.date), 'MMM d, yyyy') : 'Postponed TBA'}</span>
                  <span className="text-sm font-black text-slate-50 uppercase italic font-display break-words">vs {match.opponent}</span>
                </div>
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-xs italic font-display ${
                  match.result === 'W' ? 'bg-green-500/20 text-green-500' :
                  match.result === 'D' ? 'bg-yellow-500/20 text-yellow-500' :
                  'bg-red-500/20 text-red-500'
                }`}>
                  {match.result}
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-y border-slate-800/50">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Score</span>
                  <span className="text-sm font-black text-slate-50 italic font-display">{match.score}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Goal Diff</span>
                  <span className={`text-xs font-bold ${
                    (typeof match.goalDiff === 'string' && match.goalDiff.startsWith('+')) || (typeof match.goalDiff === 'number' && match.goalDiff > 0) ? 'text-green-500' : 
                    (typeof match.goalDiff === 'string' && match.goalDiff.startsWith('-')) || (typeof match.goalDiff === 'number' && match.goalDiff < 0) ? 'text-red-500' : 
                    'text-slate-500'
                  }`}>
                    {match.goalDiff}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">MOTM</span>
                  <div className="flex gap-2">
                    <span className="text-[10px] text-slate-400 font-medium"><span className="text-yellow-500/70 font-bold uppercase">C:</span> {match.coachPotm}</span>
                    <span className="text-[10px] text-slate-400 font-medium"><span className="text-blue-500/70 font-bold uppercase">P:</span> {match.parentPotm}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-600" />
              </div>
            </div>
          ))}
          {stats.seasonAwards.length === 0 && (
            <p className="text-slate-500 text-sm italic text-center py-8">No match history recorded yet.</p>
          )}
        </div>
      </motion.div>

      {/* Saved AI Insights */}
      {seasonSummaries.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8 overflow-hidden"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-50 uppercase italic font-display tracking-tight flex items-center gap-3">
              <Sparkles size={24} className="text-purple-500" />
              Saved AI Tactics
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {seasonSummaries.map((summary) => (
              <div 
                key={summary.id}
                onClick={() => setSelectedInsight(summary)}
                className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 cursor-pointer hover:bg-slate-800/50 hover:border-purple-500/30 transition-all flex flex-col gap-4 group"
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      {summary.createdAt?.seconds ? format(new Date(summary.createdAt.seconds * 1000), 'MMM d, yyyy') : 'Unknown Date'}
                    </span>
                    <h3 className="text-lg font-black text-slate-50 uppercase italic font-display flex items-center gap-2 group-hover:text-purple-400 transition-colors">
                      AI Insight
                      <ChevronRight size={16} className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                    </h3>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                    <Sparkles size={14} />
                  </div>
                </div>
                <p className="text-sm text-slate-400 font-medium line-clamp-3">
                  {summary.content.substring(0, 150)}...
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <SeasonSummaryModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        teamName={teamName}
        stats={{
          totalMatches: stats.totalMatches,
          wins: stats.wins,
          draws: stats.draws,
          losses: stats.losses,
          goalsScored: stats.goalsScored,
          goalsConceded: stats.goalsConceded,
          cleanSheets: stats.cleanSheets,
          winRate: stats.winRate,
          topScorers: stats.topScorers,
          topCoachPotm: stats.topCoachPotm,
          topParentPotm: stats.topParentPotm,
          matchHistory: stats.seasonAwards
        }}
      />

      <AttendanceModal 
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
        stats={{
          totalMatches: stats.totalMatches,
          totalTraining: stats.totalTraining
        }}
        playersData={stats.playerAttendanceStats}
      />

      <FormationAnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        seasonId={seasonId}
        teamId={profile?.teamId || ''}
        matches={matches}
        players={players}
        stats={stats}
      />

      <InsightViewerModal
        isOpen={!!selectedInsight}
        onClose={() => setSelectedInsight(null)}
        insight={selectedInsight}
      />
    </div>
  );
}

function StatCard({ label, value, icon, trend, onClick }: { label: string, value: string | number, icon: React.ReactNode, trend?: 'up' | 'down', onClick?: () => void }) {
  return (
    <motion.div 
      whileHover={onClick ? { y: -5 } : undefined}
      onClick={onClick}
      className={`bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group ${onClick ? 'cursor-pointer hover:border-green-500/30' : ''}`}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-black text-slate-50 italic font-display">{value}</span>
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
        <h3 className="text-sm font-black text-slate-50 uppercase italic font-display tracking-tight">{title}</h3>
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
              <span className="text-sm font-bold text-slate-300 group-hover:text-slate-50 transition-colors">{item.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black text-slate-50 italic font-display">{item.count}</span>
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

function AttendanceModal({ isOpen, onClose, stats, playersData }: { 
  isOpen: boolean, 
  onClose: () => void, 
  stats: { totalTraining: number, totalMatches: number },
  playersData: any[] 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col relative z-10 shadow-2xl"
      >
        <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-900/50">
          <div>
            <h2 className="text-2xl font-black text-slate-50 uppercase italic font-display tracking-tight flex items-center gap-3">
              <Users size={28} className="text-purple-500" />
              Detailed Attendance
            </h2>
            <p className="text-slate-400 text-sm font-medium mt-1">Individual player breakdown for matches and training sessions.</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex flex-col items-center justify-center hover:bg-slate-700 hover:text-slate-50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1 space-y-6 custom-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
             <div className="bg-slate-800/50 rounded-2xl p-4 flex flex-col items-center text-center justify-center">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Matches</span>
                 <span className="text-3xl font-black text-slate-50 font-display italic">{stats.totalMatches}</span>
             </div>
             <div className="bg-slate-800/50 rounded-2xl p-4 flex flex-col items-center text-center justify-center">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Training</span>
                 <span className="text-3xl font-black text-slate-50 font-display italic">{stats.totalTraining}</span>
             </div>
          </div>

          <div className="overflow-x-auto w-full custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-800/50">
                  <th className="py-4 px-4 text-[10px] uppercase tracking-widest font-bold text-slate-500 w-1/4">Player</th>
                  <th className="py-4 px-4 text-[10px] uppercase tracking-widest font-bold text-slate-500 w-1/4">Overall Rate</th>
                  <th className="py-4 px-4 text-[10px] uppercase tracking-widest font-bold text-slate-500 w-1/4">Matches <span className="text-slate-600 block sm:inline">(Going/Total)</span></th>
                  <th className="py-4 px-4 text-[10px] uppercase tracking-widest font-bold text-slate-500 w-1/4">Training <span className="text-slate-600 block sm:inline">(Going/Total)</span></th>
                </tr>
              </thead>
              <tbody>
                {playersData.map((p, i) => (
                  <motion.tr 
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-4 px-4 font-bold text-slate-200">{p.name}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-black text-slate-50 font-display italic w-10">{p.overallRate}%</div>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden w-24">
                          <div 
                            className="h-full rounded-full transition-all duration-1000 bg-purple-500" 
                            style={{ width: `${p.overallRate}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                       <div className="flex flex-col gap-0.5">
                         <span className="text-sm font-bold text-slate-300">{p.matchRate}% <span className="text-xs text-slate-500 font-medium">({p.matchPresentCount} / {Math.max(stats.totalMatches, p.matchTotalCount)})</span></span>
                       </div>
                    </td>
                    <td className="py-4 px-4">
                       <div className="flex flex-col gap-0.5">
                         <span className="text-sm font-bold text-slate-300">{p.trainingRate}% <span className="text-xs text-slate-500 font-medium">({p.trainingPresentCount} / {Math.max(stats.totalTraining, p.trainingTotalCount)})</span></span>
                       </div>
                    </td>
                  </motion.tr>
                ))}
                {playersData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 text-sm italic">
                      No appearance data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
