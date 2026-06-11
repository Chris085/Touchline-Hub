import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Share2, Copy, Check, Trophy, Target, Shield, Users, Star, Award, Calendar } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

interface SeasonSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  stats: {
    totalMatches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsScored: number;
    goalsConceded: number;
    cleanSheets: number;
    winRate: number;
    topScorers: { name: string; count: number }[];
    topCoachPotm: { name: string; count: number }[];
    topParentPotm: { name: string; count: number }[];
    matchHistory: any[];
  };
}

const HEX_COLORS = {
  slate950: '#020617',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  green500: '#22c55e',
  yellow500: '#eab308',
  red500: '#ef4444',
  blue500: '#3b82f6',
  orange500: '#f97316',
  purple500: '#a855f7',
  white: '#ffffff',
  black: '#000000',
  pitchBlack: '#050505'
};

export const SeasonSummaryModal: React.FC<SeasonSummaryModalProps> = ({ isOpen, onClose, teamName, stats }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const downloadImage = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      // html-to-image is generally the most reliable for modern CSS
      const dataUrl = await htmlToImage.toPng(reportRef.current, {
        backgroundColor: HEX_COLORS.pitchBlack,
        quality: 1,
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      link.download = `${teamName.replace(/\s+/g, '_')}_Season_Summary.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const copyTextSummary = () => {
    const text = `
📊 ${teamName} - Season Summary
---------------------------
🏟️ Matches: ${stats.totalMatches}
✅ Wins: ${stats.wins}
🤝 Draws: ${stats.draws}
❌ Losses: ${stats.losses}
📈 Win Rate: ${Math.round(stats.winRate)}%

⚽ Goals Scored: ${stats.goalsScored}
🛡️ Goals Conceded: ${stats.goalsConceded}
🧤 Clean Sheets: ${stats.cleanSheets}

🏆 Top Scorers:
${stats.topScorers.map(s => `• ${s.name}: ${s.count}`).join('\n')}

🌟 Top Coach POTM:
${stats.topCoachPotm.map(s => `• ${s.name}: ${Math.round(s.count * 10) / 10}`).join('\n')}

🌟 Top Parent POTM:
${stats.topParentPotm.map(s => `• ${s.name}: ${Math.round(s.count * 10) / 10}`).join('\n')}

Shared via Pitch Dark App
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[100] flex items-start justify-center p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col my-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-sm z-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20">
                  <Share2 size={20} className="text-green-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-50">Share Season Summary</h2>
                  <p className="text-xs text-slate-400">Generate a report for your team</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-50 transition-colors bg-slate-800 rounded-full">
                <X size={24} />
              </button>
            </div>

            {/* Shareable Content Area */}
            <div className="p-4 sm:p-8 bg-slate-950/50 overflow-x-auto w-full">
              <div 
                ref={reportRef}
                style={{ 
                  backgroundColor: HEX_COLORS.pitchBlack, 
                  padding: '40px',
                  borderRadius: '32px',
                  width: '100%',
                  maxWidth: '600px',
                  margin: '0 auto',
                  fontFamily: 'sans-serif',
                  position: 'relative',
                  overflow: 'hidden',
                  boxSizing: 'border-box'
                }}
              >
                {/* Background Pattern */}
                <div style={{ position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                </div>

                <div style={{ position: 'relative', zIndex: 10 }}>
                  {/* Report Header */}
                  <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div 
                      style={{ 
                        display: 'inline-block', 
                        padding: '4px 16px', 
                        borderRadius: '9999px', 
                        fontSize: '10px', 
                        fontWeight: 'bold', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.2em',
                        backgroundColor: '#112211', 
                        border: `1px solid ${HEX_COLORS.green500}`, 
                        color: HEX_COLORS.green500 
                      }}
                    >
                      Season Report 2024/25
                    </div>
                    <h1 style={{ fontSize: '36px', fontWeight: '900', color: HEX_COLORS.white, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.025em', margin: '16px 0 0 0' }}>
                      {teamName}
                    </h1>
                  </div>

                  {/* Main Stats Grid */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                    {[
                      { label: 'Played', value: stats.totalMatches, color: HEX_COLORS.white },
                      { label: 'Wins', value: stats.wins, color: HEX_COLORS.green500 },
                      { label: 'Draws', value: stats.draws, color: HEX_COLORS.yellow500 },
                      { label: 'Losses', value: stats.losses, color: HEX_COLORS.red500 }
                    ].map((stat, i) => (
                      <div key={i} style={{ flex: 1, padding: '16px', borderRadius: '16px', textAlign: 'center', backgroundColor: HEX_COLORS.slate900, border: `1px solid ${HEX_COLORS.slate800}` }}>
                        <p style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: HEX_COLORS.slate500, margin: '0 0 4px 0' }}>{stat.label}</p>
                        <p style={{ fontSize: '24px', fontWeight: '900', color: stat.color, margin: 0 }}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Secondary Stats */}
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '32px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111122', margin: '0 auto 8px auto' }}>
                        <Target size={16} style={{ color: HEX_COLORS.blue500 }} />
                      </div>
                      <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: HEX_COLORS.slate500, margin: '0 0 4px 0' }}>Scored</p>
                      <p style={{ fontSize: '18px', fontWeight: '900', color: HEX_COLORS.white, margin: 0 }}>{stats.goalsScored}</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#221100', margin: '0 auto 8px auto' }}>
                        <Shield size={16} style={{ color: HEX_COLORS.orange500 }} />
                      </div>
                      <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: HEX_COLORS.slate500, margin: '0 0 4px 0' }}>Conceded</p>
                      <p style={{ fontSize: '18px', fontWeight: '900', color: HEX_COLORS.white, margin: 0 }}>{stats.goalsConceded}</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#110022', margin: '0 auto 8px auto' }}>
                        <Star size={16} style={{ color: HEX_COLORS.purple500 }} />
                      </div>
                      <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: HEX_COLORS.slate500, margin: '0 0 4px 0' }}>Clean Sheets</p>
                      <p style={{ fontSize: '18px', fontWeight: '900', color: HEX_COLORS.white, margin: 0 }}>{stats.cleanSheets}</p>
                    </div>
                  </div>

                  {/* Leaderboards */}
                  <div style={{ display: 'flex', gap: '32px', paddingTop: '16px', borderTop: `1px solid ${HEX_COLORS.slate800}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Trophy size={14} style={{ color: HEX_COLORS.yellow500 }} />
                        <h3 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', color: HEX_COLORS.slate400, margin: 0 }}>Top Scorers</h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {stats.topScorers.slice(0, 3).map((s, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: HEX_COLORS.white }}>{s.name}</span>
                            <span style={{ fontSize: '12px', fontWeight: '900', color: HEX_COLORS.green500 }}>{s.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Award size={14} style={{ color: HEX_COLORS.yellow500 }} />
                        <h3 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', color: HEX_COLORS.slate400, margin: 0 }}>Coach POTM</h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {stats.topCoachPotm.slice(0, 3).map((s, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: HEX_COLORS.white }}>{s.name}</span>
                            <span style={{ fontSize: '12px', fontWeight: '900', color: HEX_COLORS.yellow500 }}>{Math.round(s.count * 10) / 10}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Star size={14} style={{ color: HEX_COLORS.purple500 }} />
                        <h3 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', color: HEX_COLORS.slate400, margin: 0 }}>Parents POTM</h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {stats.topParentPotm.slice(0, 3).map((s, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: HEX_COLORS.white }}>{s.name}</span>
                            <span style={{ fontSize: '12px', fontWeight: '900', color: HEX_COLORS.purple500 }}>{Math.round(s.count * 10) / 10}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Match History */}
                  {stats.matchHistory && stats.matchHistory.length > 0 && (
                    <div style={{ paddingTop: '24px', borderTop: `1px solid ${HEX_COLORS.slate800}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Calendar size={14} style={{ color: HEX_COLORS.green500 }} />
                        <h3 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', color: HEX_COLORS.slate400, margin: 0 }}>Season Match History</h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {stats.matchHistory.map((match, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: HEX_COLORS.slate900, borderRadius: '12px', border: `1px solid ${HEX_COLORS.slate800}40` }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '8px', fontWeight: 'bold', color: HEX_COLORS.slate500, textTransform: 'uppercase' }}>
                                {match.date ? new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : 'TBA'}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: '900', color: HEX_COLORS.white, textTransform: 'uppercase', fontStyle: 'italic' }}>vs {match.opponent}</span>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '12px', fontWeight: '900', color: HEX_COLORS.white, fontStyle: 'italic' }}>{match.score}</div>
                                <div style={{ fontSize: '8px', fontWeight: 'bold', color: HEX_COLORS.slate500 }}>
                                  Coach POTM: <span style={{ color: HEX_COLORS.yellow500 }}>{match.coachPotm}</span>
                                </div>
                                <div style={{ fontSize: '8px', fontWeight: 'bold', color: HEX_COLORS.slate500 }}>
                                  Parents POTM: <span style={{ color: HEX_COLORS.purple500 }}>{match.parentPotm}</span>
                                </div>
                              </div>
                              <div style={{ 
                                width: '28px', 
                                height: '28px', 
                                borderRadius: '8px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontSize: '11px', 
                                fontWeight: '900',
                                backgroundColor: match.result === 'W' ? '#113311' : match.result === 'D' ? '#333311' : '#331111',
                                color: match.result === 'W' ? HEX_COLORS.green500 : match.result === 'D' ? HEX_COLORS.yellow500 : HEX_COLORS.red500,
                                border: `1px solid ${match.result === 'W' ? HEX_COLORS.green500 : match.result === 'D' ? HEX_COLORS.yellow500 : HEX_COLORS.red500}40`
                              }}>
                                {match.result}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ paddingTop: '24px', textAlign: 'center' }}>
                    <p style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.3em', color: HEX_COLORS.slate600, margin: 0 }}>Generated by Pitch Dark App</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
              <button
                onClick={copyTextSummary}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-50 rounded-2xl font-bold transition-all"
              >
                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy Text Summary'}
              </button>
              <button
                onClick={downloadImage}
                disabled={isDownloading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-400 text-slate-950 rounded-2xl font-bold transition-all disabled:opacity-50"
              >
                {isDownloading ? (
                  <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                {isDownloading ? 'Generating...' : 'Download Image'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
