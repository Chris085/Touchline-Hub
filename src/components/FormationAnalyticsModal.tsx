import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Save, Check } from 'lucide-react';
import { getFormationAnalytics } from '../services/analyticsService';
import Markdown from 'react-markdown';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';

interface FormationAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  seasonId: string;
  teamId: string;
  matches: any[];
  players: any[];
  stats: any;
}

export function FormationAnalyticsModal({ isOpen, onClose, seasonId, teamId, matches, players, stats }: FormationAnalyticsModalProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen && seasonId && teamId && !analysis && !isLoading) {
      generateAnalysis();
    }
  }, [isOpen, seasonId, teamId]);

  const generateAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    setIsSaved(false);
    try {
      const analyticsData = await getFormationAnalytics(seasonId, teamId);

      const prompt = `
You are an advanced football (soccer) performance analyst.
You are NOT a commentator. You are a data-driven coach assistant.
Your task is to analyze structured season data and produce clear, actionable coaching insights.

INPUT DATA:
Formations Analytics:
${JSON.stringify({ formations: Object.values(analyticsData.raw) }, null, 2)}

Match Data (Scores, Summaries, Opponents):
${JSON.stringify({ matches: matches.map(m => ({ score: m.score, result: m.result, summary: m.summary, opponent: m.opponent, date: m.date })) }, null, 2)}

Player Data (Positions, Awards):
${JSON.stringify({ players: players.map(p => ({ name: p.name, position: p.position, motms: p.motmAwards })) }, null, 2)}

Team Stats (Top Scorers, POTMs, Win Rate):
${JSON.stringify({
  winRate: stats.winRate,
  topScorers: stats.topScorers,
  topCoachPotm: stats.topCoachPotm,
  topParentPotm: stats.topParentPotm
}, null, 2)}

OBJECTIVE:
Produce:
- Honest performance evaluation
- Identify what is working and not working
- Provide specific tactical recommendations
Do NOT be generic. Do NOT repeat the data. Interpret it.

ANALYSIS RULES (CRITICAL):
1. Compare formations against each other
2. Identify Best performing formation and Worst performing formation
3. Highlight Defensive weaknesses (high goalsAgainst) and Attacking strengths (high goalsFor)
4. Detect patterns (e.g., High scoring but also high conceding = unstable)
5. Integrate Player Performances: Mention which players excel, who is scoring the most, who is winning POTM. Connect player success to team performance if possible.
6. Reference Match Context: If there are specific match summaries or results that stand out, mention them briefly.

OUTPUT STRUCTURE (MANDATORY):
Return in this exact structure:

1. Top Performing Formation
- Name
- Why it performs well (based on stats)
- When it should be used

2. Underperforming Formation
- Name
- What is going wrong
- Likely tactical issue

3. Player Impact & Team Stats
- Key players driving the team forward (Top Scorers, POTMs)
- How player performance aligns with tactical setup

4. Tactical Patterns Identified
- Bullet points
- Must reference data trends (including relevant match moments or summaries)

5. Coaching Recommendations
Provide 3–5 specific actions:
- Formation changes
- Tactical adjustments
- Situational advice

6. Risk Areas
- Where the team is vulnerable
- Based on goalsAgainst / trends

TONE:
- Direct, Practical, No fluff
- No vague phrases

CONSTRAINTS:
- Base ALL insights on provided numbers and match data
- Format result as nice Markdown
      `;

      const response = await fetch('/api/generate-formation-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setAnalysis(data.text || 'No analysis generated.');
    } catch (err: any) {
      console.error('Failed to generate analysis:', err);
      setError(err.message || 'Failed to generate analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToSeason = async () => {
    if (!analysis) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'seasonSummaries'), {
        teamId,
        seasonId,
        content: analysis,
        createdAt: serverTimestamp()
      });
      setIsSaved(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'seasonSummaries');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col relative z-10 shadow-2xl"
        >
          <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-900/50">
            <div>
              <h2 className="text-2xl font-black text-slate-50 uppercase italic font-display tracking-tight flex items-center gap-3">
                <Sparkles size={28} className="text-purple-500" />
                AI Tactical Analysis
              </h2>
              <p className="text-slate-400 text-sm font-medium mt-1">Data-driven coaching insights based on formation performance.</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex flex-col items-center justify-center hover:bg-slate-700 hover:text-slate-50 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-medium">Crunching formation data...</p>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                <p className="text-red-400">{error}</p>
                <button
                  onClick={generateAnalysis}
                  className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-50 rounded-xl text-sm font-bold transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : analysis ? (
              <div className="flex flex-col gap-6">
                <div className="prose prose-invert prose-slate max-w-none prose-headings:font-display prose-headings:italic prose-headings:uppercase prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-a:text-purple-400">
                  <Markdown>{analysis}</Markdown>
                </div>
                <div className="pt-6 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={handleSaveToSeason}
                    disabled={isSaving || isSaved}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-purple-500/20"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-5 h-5 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : isSaved ? (
                      <>
                        <Check size={18} />
                        Saved to Season
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Save to Season
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
