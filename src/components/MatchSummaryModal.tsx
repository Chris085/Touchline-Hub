import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Share2, Copy, Check, Goal, Award, Clock, Users, Star, ArrowLeftRight, Sparkles } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { format } from 'date-fns';
import { GoogleGenAI } from '@google/genai';

interface MatchSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  match: any;
  presentPlayers: number;
  parentsPotmName?: string;
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

export const MatchSummaryModal: React.FC<MatchSummaryModalProps> = ({ 
  isOpen, 
  onClose, 
  teamName, 
  match,
  presentPlayers,
  parentsPotmName 
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  useEffect(() => {
    if (isOpen && match && process.env.GEMINI_API_KEY && !aiSummary) {
      const goals = (match.events || []).filter((e: any) => e.type === 'goal').sort((a: any, b: any) => (parseInt(a.time) || 0) - (parseInt(b.time) || 0));
      const subs = (match.events || []).filter((e: any) => e.type === 'sub').sort((a: any, b: any) => (parseInt(a.time) || 0) - (parseInt(b.time) || 0));
      
      const generateSummary = async () => {
        setIsGeneratingAi(true);
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
          
          let timeline = '';
          const allEvents = [...goals, ...subs].sort((a: any, b: any) => (parseInt(a.time) || 0) - (parseInt(b.time) || 0));
          allEvents.forEach(e => {
              if (e.type === 'goal') {
                  timeline += `Minute ${e.time}: GOAL by ${e.playerName} (Assist: ${e.assistPlayerName || 'None'})\n`;
              } else if (e.type === 'sub') {
                  timeline += `Minute ${e.time}: SUB - ${e.subPlayerName} comes on for ${e.playerName}\n`;
              }
          });
  
          const prompt = `Write a short, exciting 2-sentence match recap for a youth football game.
Our team (${teamName}) played against ${match.opponent}.
Final score: Us ${match.scoreUs || 0} - ${match.scoreThem || 0} Them.
Match events timeline:
${timeline || 'No goals or events recorded.'}
Make it sound like an encouraging, passionate sports commentator, keeping it strictly to 2 short sentences. Do not use hashtags.`;
          
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
          });
          
          setAiSummary(response.text?.trim() || '');
        } catch (err) {
           console.error('Failed to generate AI summary', err);
        } finally {
          setIsGeneratingAi(false);
        }
      };
      generateSummary();
    }
  }, [isOpen, match, teamName]);

  if (!match) return null;

  const scoreUs = match.scoreUs || 0;
  const scoreThem = match.scoreThem || 0;
  const result = scoreUs > scoreThem ? 'W' : scoreUs < scoreThem ? 'L' : 'D';
  const resultColor = result === 'W' ? HEX_COLORS.green500 : result === 'D' ? HEX_COLORS.yellow500 : HEX_COLORS.red500;
  const resultBg = result === 'W' ? '#113311' : result === 'D' ? '#333311' : '#331111';

  const goals = (match.events || [])
    .filter((e: any) => e.type === 'goal')
    .sort((a: any, b: any) => (parseInt(a.time) || 0) - (parseInt(b.time) || 0));

  const subs = (match.events || [])
    .filter((e: any) => e.type === 'sub')
    .sort((a: any, b: any) => (parseInt(a.time) || 0) - (parseInt(b.time) || 0));

  
  const downloadImage = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const dataUrl = await htmlToImage.toPng(reportRef.current, {
        backgroundColor: HEX_COLORS.pitchBlack,
        quality: 1,
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      const dateStr = match.date ? format(new Date(match.date), 'yyyy-MM-dd') : 'Match';
      link.download = `${teamName.replace(/\s+/g, '_')}_vs_${match.opponent?.replace(/\s+/g, '_')}_${dateStr}.png`;
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
🏆 Match Summary: ${teamName} vs ${match.opponent}
---------------------------
📅 Date: ${match.date ? format(new Date(match.date), 'MMM do, yyyy') : 'TBA'}
📍 Location: ${match.location || 'Home'}
📊 Result: ${scoreUs} - ${scoreThem} (${result})

📢 Match Report:
${aiSummary || 'Summary not generated.'}

⚽ Goals:
${goals.length > 0 ? goals.map((g: any) => `[${g.time || '?'}] ${g.playerName}` + (g.assistPlayerName ? ` (ast: ${g.assistPlayerName})` : '')).join('\n') : 'None'}

🔄 Substitutions:
${subs.length > 0 ? subs.map((s: any) => `[${s.time || '?'}] ⬆️ ${s.subPlayerName} ⬇️ ${s.playerName}`).join('\n') : 'None'}

🌟 Coach's POTM: ${match.coachPotmName || 'TBD'}
⭐ Parents' POTM: ${parentsPotmName || match.parentPotmName || match.parentsPotmName || 'TBD'}

Shared via The Touchline Hub
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
            className="w-full max-w-[440px] bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col my-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-sm z-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20">
                  <Share2 size={20} className="text-green-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-50">Share Match Summary</h2>
                  <p className="text-xs text-slate-400">Generate a report card for this match</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-50 transition-colors bg-slate-800 rounded-full flex-shrink-0">
                <X size={24} />
              </button>
            </div>

            {/* Shareable Content Area */}
            <div className="p-4 sm:p-6 bg-slate-950/50 overflow-x-auto w-full flex justify-center">
              <div 
                ref={reportRef}
                style={{ 
                  backgroundColor: HEX_COLORS.pitchBlack, 
                  padding: '32px 24px',
                  borderRadius: '32px',
                  width: '100%',
                  maxWidth: '380px',
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
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
                      Full Time Report
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '24px' }}>
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: '9px', color: HEX_COLORS.slate400, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '4px' }}>Us</div>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: HEX_COLORS.white, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
                          {teamName}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '36px', fontWeight: '900', color: HEX_COLORS.white, fontStyle: 'italic', lineHeight: 1 }}>{scoreUs}</div>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: HEX_COLORS.slate600 }}>-</div>
                        <div style={{ fontSize: '36px', fontWeight: '900', color: HEX_COLORS.white, fontStyle: 'italic', lineHeight: 1 }}>{scoreThem}</div>
                      </div>
                      
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: '9px', color: HEX_COLORS.slate400, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '4px' }}>Them</div>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: HEX_COLORS.white, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
                          {match.opponent}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '9px', color: HEX_COLORS.slate400, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {match.date ? format(new Date(match.date), 'MMM do, yyyy') : 'TBA'}
                      </span>
                      <span style={{ fontSize: '9px', color: HEX_COLORS.slate400, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={12} /> Squad: {presentPlayers}
                      </span>
                    </div>
                  </div>

                  {/* Highlights Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                    
                    {/* Match Report (AI) */}
                    {(aiSummary || isGeneratingAi) && (
                      <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: HEX_COLORS.slate900, border: `1px solid ${HEX_COLORS.slate800}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <Sparkles size={16} style={{ color: HEX_COLORS.orange500 }} />
                          <h3 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', color: HEX_COLORS.slate400, margin: 0 }}>Match Report</h3>
                        </div>
                        {isGeneratingAi ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                            <span style={{ fontSize: '12px', color: HEX_COLORS.slate500, fontStyle: 'italic' }}>Drafting report...</span>
                          </div>
                        ) : (
                          <p style={{ fontSize: '12px', color: HEX_COLORS.white, margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
                            "{aiSummary}"
                          </p>
                        )}
                      </div>
                    )}

                    {/* Goals */}
                    <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: HEX_COLORS.slate900, border: `1px solid ${HEX_COLORS.slate800}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Goal size={16} style={{ color: HEX_COLORS.green500 }} />
                        <h3 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', color: HEX_COLORS.slate400, margin: 0 }}>Goals ({(match.events || []).filter((e: any) => e.type === 'goal').length})</h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {goals.length > 0 ? goals.map((g: any, i: number) => (
                           <div key={i} style={{ fontSize: '12px', fontWeight: 'bold', color: HEX_COLORS.white, display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <span style={{ color: HEX_COLORS.green500, fontSize: '10px', width: '24px', flexShrink: 0 }}>{g.time || '?'}</span>
                             <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.playerName}</span>
                             {g.assistPlayerName && <span style={{ color: HEX_COLORS.slate500, fontSize: '10px', fontWeight: 'normal', whiteSpace: 'nowrap' }}>ast: {g.assistPlayerName}</span>}
                           </div>
                        )) : (
                          <div style={{ fontSize: '12px', color: HEX_COLORS.slate500, fontStyle: 'italic' }}>No goals recorded</div>
                        )}
                      </div>
                    </div>

                    {/* Subs */}
                    {subs.length > 0 && (
                      <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: HEX_COLORS.slate900, border: `1px solid ${HEX_COLORS.slate800}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <ArrowLeftRight size={16} style={{ color: HEX_COLORS.blue500 }} />
                          <h3 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', color: HEX_COLORS.slate400, margin: 0 }}>Substitutions</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {subs.map((s: any, i: number) => (
                             <div key={i} style={{ fontSize: '12px', fontWeight: 'bold', color: HEX_COLORS.white, display: 'flex', alignItems: 'center', gap: '8px' }}>
                               <span style={{ color: HEX_COLORS.blue500, fontSize: '10px', width: '24px', flexShrink: 0 }}>{s.time || '?'}</span>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, overflow: 'hidden' }}>
                                 <span style={{ color: HEX_COLORS.green500, fontSize: '10px' }}>⬆️</span>
                                 <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.subPlayerName}</span>
                                 <span style={{ color: HEX_COLORS.red500, fontSize: '10px', marginLeft: 'auto' }}>⬇️</span>
                                 <span style={{ color: HEX_COLORS.slate400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.playerName}</span>
                               </div>
                             </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* POTM Grid */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: HEX_COLORS.slate900, border: `1px solid ${HEX_COLORS.slate800}`, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#332200' }}>
                          <Award size={16} style={{ color: HEX_COLORS.yellow500 }} />
                        </div>
                        <div>
                          <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: HEX_COLORS.slate500, margin: '0 0 4px 0' }}>Coach's POTM</p>
                          <p style={{ fontSize: '12px', fontWeight: '900', color: HEX_COLORS.white, margin: 0, textTransform: 'uppercase' }}>{match.coachPotmName || 'TBA'}</p>
                        </div>
                      </div>
                      
                      <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: HEX_COLORS.slate900, border: `1px solid ${HEX_COLORS.slate800}`, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#221144' }}>
                          <Star size={16} style={{ color: HEX_COLORS.purple500 }} />
                        </div>
                        <div>
                          <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: HEX_COLORS.slate500, margin: '0 0 4px 0' }}>Parents' POTM</p>
                          <p style={{ fontSize: '12px', fontWeight: '900', color: HEX_COLORS.white, margin: 0, textTransform: 'uppercase' }}>{parentsPotmName || match.parentPotmName || match.parentsPotmName || 'TBA'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ paddingTop: '24px', textAlign: 'center', borderTop: `1px solid ${HEX_COLORS.slate800}` }}>
                     <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '8px', backgroundColor: resultBg, border: `1px solid ${resultColor}40` }}>
                       <span style={{ fontSize: '14px', fontWeight: '900', color: resultColor }}>{result === 'W' ? 'VICTORY' : result === 'L' ? 'DEFEAT' : 'DRAW'}</span>
                     </div>
                    <p style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.3em', color: HEX_COLORS.slate600, margin: '16px 0 0 0' }}>Generated by The Touchline Hub</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-slate-900 border-t border-slate-800 flex flex-col gap-3">
              <button
                onClick={copyTextSummary}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-50 rounded-2xl font-bold transition-all"
              >
                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                {copied ? 'Copied to Clipboard!' : 'Copy Text (For WhatsApp)'}
              </button>
              <button
                onClick={downloadImage}
                disabled={isDownloading}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-500 hover:bg-green-400 text-slate-950 rounded-2xl font-bold transition-all disabled:opacity-50"
              >
                {isDownloading ? (
                  <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                {isDownloading ? 'Generating...' : 'Save as Image (For Socials)'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
