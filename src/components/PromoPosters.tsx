import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Printer, 
  Sparkles, 
  CheckCircle2, 
  Smartphone, 
  Layout, 
  Calendar, 
  Users, 
  Dribbble, 
  Trophy, 
  MessageSquare, 
  Clock, 
  Sliders, 
  RotateCcw,
  Check,
  AlertTriangle,
  Goal,
  ArrowLeftRight,
  TrendingUp,
  Award
} from 'lucide-react';

interface PromoPostersProps {
  teamName?: string;
  currentUserId?: string;
}

export function PromoPosters({ teamName = "Astley Buckshaw U10s", currentUserId }: PromoPostersProps) {
  const [activePoster, setActivePoster] = useState<'value' | 'pain'>('value');
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  };

  const qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https%3A%2F%2Ftouchlinehub.com";

  return (
    <div className="space-y-8 no-print">
      <style>{`
        @media print {
          body, html {
            background-color: #020617 !important;
            color: #f1f5f9 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Hide all surrounding interface components completely */
          #root > div, main, nav, header, footer, sidebar, aside, button, .no-print {
            display: none !important;
          }

          /* Reinstate the custom print target container */
          #root {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
          }

          #printable-poster-target {
            display: flex !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 12mm !important;
            box-sizing: border-box !important;
            background-color: #020617 !important;
            background-image: radial-gradient(circle at 50% 50%, rgba(22, 163, 74, 0.04) 0%, transparent 60%) !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: hidden !important;
            z-index: 9999999 !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
          }

          #printable-poster-target * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #printable-poster-target .grid {
            display: grid !important;
          }

          #printable-poster-target .flex {
            display: flex !important;
          }

          #printable-poster-target .hidden {
            display: none !important;
          }
        }
      `}</style>
      {/* Informational Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Printer size={120} className="text-green-500" />
        </div>
        
        <div className="max-w-2xl">
          <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-black uppercase tracking-widest font-display italic">
            Marketing Toolkit
          </span>
          <h2 className="text-2xl font-black text-slate-50 mt-3 uppercase tracking-tight font-display italic">
            Coach Recruitment & Club Posters (A4)
          </h2>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">
            Generate high-resolution, print-ready marketing flyers directly in your administrative deck. 
            Share these with grassroots coaches to encourage them to spend less time on administration 
            and more time on player development.
          </p>
          
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/50">📄 Output: <strong>A4 Portrait</strong></span>
            <span className="bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/50">💎 Format: <strong>Vector-Crisp HTML</strong></span>
            <span className="bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/50">📲 QR Destination: <strong>touchlinehub.com</strong></span>
          </div>
        </div>
      </div>

      {/* Selector & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 w-full sm:w-auto">
          <button
            onClick={() => setActivePoster('value')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-black uppercase tracking-wider font-display italic transition-all ${
              activePoster === 'value' 
                ? 'bg-green-500 text-slate-950 shadow-md shadow-green-500/15' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Concept 1: Value-First
          </button>
          <button
            onClick={() => setActivePoster('pain')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-black uppercase tracking-wider font-display italic transition-all ${
              activePoster === 'pain' 
                ? 'bg-green-500 text-slate-950 shadow-md shadow-green-500/15' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Concept 2: Pain-Point Focus
          </button>
        </div>

        <button
          onClick={handlePrint}
          className="bg-green-500 hover:bg-green-400 text-slate-950 font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-green-500/10 font-display italic"
        >
          <Printer size={16} />
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {/* Printing Tips */}
      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 flex gap-3 text-xs text-blue-400">
        <span className="text-base">💡</span>
        <div>
          <strong className="block text-blue-200 font-bold mb-0.5">Printing instructions for perfect A4 layout:</strong>
          <p className="leading-relaxed">
            When the printer window opens, select <strong>Save as PDF</strong> or your printer. 
            Set <strong>Layout</strong> to Portrait, <strong>Paper Size</strong> to A4, 
            <strong>Margins</strong> to None (or Minimum), and check <strong>Background graphics</strong> to preserve the premium colors and background.
          </p>
        </div>
      </div>

      {/* Live Preview Wrapper */}
      <div className="flex justify-center p-2 sm:p-6 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative group">
        <div className="scale-[0.55] xs:scale-[0.65] sm:scale-75 md:scale-90 lg:scale-100 origin-top transition-transform duration-300">
          
          {/* Printable Container (Matches target A4 Print Exactly) */}
          <div 
            id="printable-poster-target" 
            className="w-[210mm] h-[297mm] bg-slate-950 text-slate-100 flex flex-col justify-between p-12 overflow-hidden relative shadow-2xl rounded-2xl md:rounded-none border-4 border-slate-800/60 print:border-0 print:rounded-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(22, 163, 74, 0.04) 0%, transparent 60%)',
              colorAdjust: 'exact',
              WebkitPrintColorAdjust: 'exact'
            }}
          >
            {/* Subtle soccer field grid background lines to convey sport instantly */}
            <div className="absolute inset-x-0 -top-24 h-[500px] border-b border-white/[0.015] rounded-full pointer-events-none"></div>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

            {/* Poster Header */}
            <div className="flex justify-between items-center z-10">
              {/* Brand Logo Markup */}
              <div className="flex items-center gap-2.5 bg-slate-900/60 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/25">
                  <span className="font-display font-black text-slate-950 text-lg italic mt-[-2px]">T</span>
                </div>
                <div>
                  <h3 className="font-display font-black text-sm uppercase tracking-wider text-slate-50 italic">
                    Touchline <span className="text-green-500">Hub</span>
                  </h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-[-2px]">Grassroots Football Only</p>
                </div>
              </div>

              {/* Tag */}
              <div className="bg-green-500 text-slate-950 font-black text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-xl shadow-green-500/10 font-display italic">
                Grassroots Standard
              </div>
            </div>

            {/* CONCEPT A: VALUE FIRST */}
            {activePoster === 'value' && (
              <>
                {/* Headline Section */}
                <div className="text-center mt-12 max-w-4xl mx-auto space-y-4 z-10">
                  <h1 className="text-5xl font-black text-slate-50 tracking-tight leading-[1.05] uppercase font-display italic">
                    Spend Less Time Managing.<br />
                    <span className="text-green-500">More Time Coaching.</span>
                  </h1>
                  <p className="text-lg text-slate-300 font-medium max-w-2xl mx-auto tracking-wide">
                    The intuitive, all-in-one football coaching platform built exclusively to manage grassroots teams.
                  </p>
                </div>

                {/* Center Content: Phone mockups fanned over custom background */}
                <div className="relative h-[480px] w-full flex items-center justify-center mt-6 z-10">
                  {/* Left Mockup (Dashboard) */}
                  <div className="absolute left-[3%] scale-[0.8] rotate-[-7deg] opacity-75 transform transition-transform duration-300 hover:rotate-0 hover:scale-95 hover:z-30 hover:opacity-100">
                    <MockupPhone screen="dashboard" teamName={teamName} />
                  </div>

                  {/* Right Mockup (Squad) */}
                  <div className="absolute right-[3%] scale-[0.8] rotate-[7deg] opacity-75 transform transition-transform duration-300 hover:rotate-0 hover:scale-95 hover:z-30 hover:opacity-100">
                    <MockupPhone screen="squad" teamName={teamName} />
                  </div>

                  {/* Center Mockup (Live Pitch Matchday) */}
                  <div className="absolute z-20 scale-[0.98] rotate-0 shadow-2xl transform transition-transform duration-300 hover:scale-[1.05]">
                    <MockupPhone screen="matchday" teamName={teamName} />
                  </div>
                </div>

                {/* Features Highlights Row */}
                <div className="grid grid-cols-5 gap-3 mt-4 mx-auto w-full z-10 bg-slate-900/40 border border-slate-900 rounded-2xl p-4 backdrop-blur-md">
                  <div className="flex flex-col items-center text-center p-1.5 rounded-xl">
                    <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center mb-2 shadow-lg shadow-green-500/5">
                      <Users size={16} />
                    </div>
                    <h4 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-100">Squad Engine</h4>
                    <span className="text-[8px] text-slate-400 mt-0.5 line-clamp-1">Profiles & registration</span>
                  </div>

                  <div className="flex flex-col items-center text-center p-1.5 rounded-xl">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-2 shadow-lg shadow-blue-500/5">
                      <Calendar size={16} />
                    </div>
                    <h4 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-100">Live Schedulers</h4>
                    <span className="text-[8px] text-slate-400 mt-0.5 mt-0.5 line-clamp-1">Training & attendance</span>
                  </div>

                  <div className="flex flex-col items-center text-center p-1.5 rounded-xl">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-2 shadow-lg shadow-orange-500/5">
                      <Goal size={16} />
                    </div>
                    <h4 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-100">Matchday Live</h4>
                    <span className="text-[8px] text-slate-400 mt-0.5 line-clamp-1">Direct stats logging</span>
                  </div>

                  <div className="flex flex-col items-center text-center p-1.5 rounded-xl">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-2 shadow-lg shadow-purple-500/5">
                      <TrendingUp size={16} />
                    </div>
                    <h4 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-100">Development</h4>
                    <span className="text-[8px] text-slate-400 mt-0.5 line-clamp-1">Metrics & progress charts</span>
                  </div>

                  <div className="flex flex-col items-center text-center p-1.5 rounded-xl">
                    <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex items-center justify-center mb-2 shadow-lg shadow-yellow-500/5">
                      <Smartphone size={16} />
                    </div>
                    <h4 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-100">Cross Access</h4>
                    <span className="text-[8px] text-slate-400 mt-0.5 line-clamp-1">Mobile & Desktop sync</span>
                  </div>
                </div>
              </>
            )}

            {/* CONCEPT B: PAIN POINT COMPARISON */}
            {activePoster === 'pain' && (
              <>
                {/* Headline Section */}
                <div className="text-center mt-12 max-w-4xl mx-auto space-y-4 z-10">
                  <h1 className="text-4xl font-black text-slate-50 tracking-tight leading-[1.1] uppercase font-display italic">
                    Still Managing Your Team Through<br />
                    <span className="text-red-500">WhatsApp and Spreadsheets?</span>
                  </h1>
                  <p className="text-base text-slate-300 font-medium max-w-xl mx-auto tracking-wide">
                    Grassroots coaches deserve better. Cut out the Tuesday night administrative chaos and bring everything together.
                  </p>
                </div>

                {/* Center Content: Side-by-side comparison (Messy spreadsheets vs Touchline Hub) */}
                <div className="grid grid-cols-2 gap-8 items-center mt-6 z-10 px-4">
                  
                  {/* Left Side: Pain point visualization */}
                  <div className="bg-slate-950/80 border-2 border-dashed border-red-500/20 hover:border-red-500/40 rounded-3xl p-6 relative space-y-6 flex flex-col justify-center h-[460px] transform hover:scale-[1.02] transition-transform duration-300">
                    <div className="absolute top-4 right-4 bg-red-500/10 text-red-500 text-[9px] font-black uppercase px-2.5 py-1 rounded border border-red-500/20 font-display italic">
                      Chaotic Mess
                    </div>

                    <div className="space-y-4">
                      {/* Simulated messy messages */}
                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl rounded-tl-sm max-w-[90%] space-y-1">
                        <span className="text-[8px] font-black text-rose-400 uppercase tracking-wide">Parent Chat</span>
                        <p className="text-[10px] text-slate-300">Is training at 6 PM or 7 PM tonight or is it cancelled? 🤷🏆</p>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl rounded-tl-sm max-w-[90%] space-y-1 ml-auto rounded-tr-sm rounded-tl-2xl">
                        <span className="text-[8px] font-black text-rose-400 uppercase tracking-wide">Coach Reply</span>
                        <p className="text-[10px] text-slate-300">Wait, checking the spreadsheet, forgot who RSVP'd. Give me 30 mins...</p>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl rounded-tl-sm max-w-[95%]">
                        <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-red-500 uppercase font-display italic mb-1.5">
                          <span>❌ Lost Attendance Spreadsheet v2.xlsx</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1 text-[7px] text-slate-500 font-mono">
                          <div className="bg-slate-950 p-1 border border-slate-800">NAME</div>
                          <div className="bg-slate-950 p-1 border border-slate-800">JAN 4</div>
                          <div className="bg-slate-950 p-1 border border-slate-800">JAN 11</div>
                          <div className="bg-slate-950 p-1 border border-slate-800">JAN 18</div>
                          <div className="bg-slate-950 p-1 text-red-400 border border-slate-800">Alex M.</div>
                          <div className="bg-slate-950 p-1 border border-slate-800 text-yellow-500">MISSING?</div>
                          <div className="bg-slate-950 p-1 border border-slate-800">YES</div>
                          <div className="bg-slate-950 p-1 text-red-400 border border-slate-800">LOST RECORD</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 text-center">
                      <span className="text-red-400 text-[11px] font-black uppercase tracking-wider block font-display italic">
                        🚫 Frustrated Parents & Stressed Coaches
                      </span>
                      <p className="text-[9px] text-slate-500 mt-1 max-w-sm mx-auto">
                        Time-wasting back-and-forth threads, outdated files, lost logs, and split information.
                      </p>
                    </div>
                  </div>

                  {/* Right Side: The Touchline Hub solution */}
                  <div className="flex justify-center flex-col items-center space-y-3 relative h-[460px]">
                    <div className="absolute top-4 bg-green-500/10 text-green-500 text-[9px] font-black uppercase px-2.5 py-1 rounded border border-green-500/20 font-display italic z-30">
                      The One App Solution
                    </div>
                    
                    <div className="scale-[0.9] origin-center z-10 shadow-2xl">
                      <MockupPhone screen="dashboard" teamName={teamName} />
                    </div>
                  </div>

                </div>

                {/* Unified Checklist */}
                <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 backdrop-blur-md z-10 w-full mt-4 flex items-center justify-around">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="font-extrabold text-xs uppercase tracking-wide text-slate-100">Manage Players</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="font-extrabold text-xs uppercase tracking-wide text-slate-100">Track Attendance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="font-extrabold text-xs uppercase tracking-wide text-slate-100">Organise Matches</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="font-extrabold text-xs uppercase tracking-wide text-slate-100">Monitor Progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="font-extrabold text-xs uppercase tracking-wide text-slate-100">One Unified Spot</span>
                  </div>
                </div>
              </>
            )}

            {/* Poster Footer: Structured call to action requested */}
            <div className="border-t border-slate-800/80 pt-8 mt-5 flex items-center justify-between z-10 bg-slate-950/90 rounded-2xl p-4">
              <div className="space-y-2">
                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest block font-display italic">
                  💥 TRIAL PROMOTION
                </span>
                <h2 className="text-3xl font-black uppercase text-slate-100 font-display italic leading-tight">
                  3 Months Free
                </h2>
                <p className="text-[10px] text-slate-400 font-medium max-w-sm uppercase tracking-wide">
                  Start your platform trial today. Absolute zero payment options or credit card credentials required to launch your grassroots hub.
                </p>
                <div className="pt-1.5 flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Ready? Run on:</span>
                  <span className="text-slate-100 bg-slate-900 border border-slate-800 font-mono text-[11px] px-2.5 py-1 rounded font-bold uppercase tracking-wider block">
                    touchlinehub.com
                  </span>
                </div>
              </div>

              {/* QR Code Column */}
              <div className="flex flex-col items-center gap-2.5">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xl transition-transform hover:scale-105 duration-300">
                  <img 
                    src={qrCodeUrl} 
                    alt="Touchline Hub QR Code Link" 
                    className="w-24 h-24"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">
                  SCAN TO GET TRIAL
                </span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

/* 
  Phone mockups rendered on-the-fly dynamically in vector HTML/CSS!
  Prevents pixelation during printing/PDF saving.
*/
function MockupPhone({ screen, teamName }: { screen: 'dashboard' | 'matchday' | 'squad', teamName: string }) {
  return (
    <div className="w-[240px] h-[480px] bg-slate-950 rounded-[38px] border-8 border-slate-800 p-2.5 relative flex flex-col justify-between shadow-2xl overflow-hidden text-left ring-1 ring-slate-700/50">
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-4.5 bg-slate-800 rounded-b-xl z-50 flex items-center justify-around px-4">
        {/* Camera and sensors */}
        <div className="w-2 h-2 rounded-full bg-slate-950"></div>
        <div className="w-8 h-1 rounded-full bg-slate-950"></div>
      </div>

      {/* Battery / Wifi header */}
      <div className="flex justify-between items-center text-[8px] font-black tracking-wider text-slate-400 px-3 pt-1 z-45 font-mono">
        <span>16:09</span>
        <div className="flex items-center gap-1">
          <span>📶</span>
          <span>🔋 98%</span>
        </div>
      </div>

      {/* Screen Inner View */}
      <div className="flex-1 flex flex-col justify-between mt-2.5 bg-slate-900/90 rounded-[28px] p-3 text-slate-200 border border-slate-800/80 overflow-hidden relative">
        {/* Background ambient mesh */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-950/20 via-slate-950 to-slate-950 pointer-events-none"></div>

        {/* Dynamic Screens based on Prop */}
        {screen === 'dashboard' && (
          <div className="space-y-3 flex-1 flex flex-col justify-between z-10 text-[10px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
              <span className="font-extrabold uppercase tracking-wide text-slate-400 text-[8px]">📊 Team Info</span>
              <span className="text-[7px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded font-black font-display italic">LIVE</span>
            </div>

            {/* Quick team banner */}
            <div>
              <h4 className="text-[11px] font-black uppercase text-slate-50 tracking-tight font-display italic truncate">{teamName}</h4>
              <p className="text-[7px] text-slate-500 mt-[-2px]">Active Squad Roster 2026/27</p>
            </div>

            {/* Stats grid widget */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-slate-950/80 border border-slate-800/80 p-1.5 rounded-lg">
                <span className="text-[6px] text-slate-500 font-extrabold uppercase block">Wins Rate</span>
                <span className="text-xs font-black text-green-400 font-display">29% 📉</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 p-1.5 rounded-lg">
                <span className="text-[6px] text-slate-500 font-extrabold uppercase block">Clean Sheets</span>
                <span className="text-xs font-black text-blue-400 font-display">2 Sheets</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 p-1.5 rounded-lg col-span-2">
                <span className="text-[6px] text-slate-500 font-extrabold uppercase block">Avg RSVP Attendance</span>
                <span className="text-xs font-black text-yellow-400 font-display">98% Weekly</span>
              </div>
            </div>

            {/* Render a miniature chart */}
            <div className="bg-slate-950/50 border border-slate-800 p-2 rounded-lg space-y-1.5">
              <span className="text-[6px] text-slate-500 font-extrabold uppercase block">Scoring Trend</span>
              <div className="flex items-end gap-1 h-14 pt-2">
                <div className="bg-green-500 w-full h-[15%] rounded-t-sm"></div>
                <div className="bg-green-500 w-full h-[45%] rounded-t-sm"></div>
                <div className="bg-green-500 w-full h-[25%] rounded-t-sm"></div>
                <div className="bg-green-500 w-full h-[65%] rounded-t-sm"></div>
                <div className="bg-green-500 w-full h-[35%] rounded-t-sm"></div>
                <div className="bg-green-600 w-full h-[95%] rounded-t-sm"></div>
                <div className="bg-green-500 w-full h-[40%] rounded-t-sm"></div>
              </div>
            </div>

            {/* Upcoming Event */}
            <div className="bg-green-500/10 border border-green-500/20 p-2 rounded-lg">
               <span className="text-[6px] text-green-400 font-extrabold uppercase block">Active Schedule</span>
               <p className="text-[8px] font-bold text-slate-100">VS Cadley Green</p>
               <span className="text-[6px] text-slate-400">Matchday, Sunday 10:30</span>
            </div>
          </div>
        )}

        {screen === 'matchday' && (
          <div className="space-y-2 flex-1 flex flex-col justify-between z-10 text-[10px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
              <span className="font-extrabold uppercase tracking-wide text-slate-400 text-[8px]">🏟️ Matchday Controller</span>
              <span className="text-[7px] text-white bg-blue-500 px-1.5 py-0.5 rounded font-black font-display italic">COACH</span>
            </div>

            {/* Tactical pitch visualization in miniature */}
            <div className="relative flex-1 bg-green-950/40 border border-green-500/20 rounded-xl overflow-hidden p-1 flex flex-col justify-between min-h-[160px]">
              {/* Tactical grid background lines */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none"></div>
              <div className="absolute inset-x-0 top-1/2 border-t border-white/5"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-white/5"></div>

              {/* Score header */}
              <div className="flex justify-between items-center bg-slate-950/80 p-1 px-2 rounded-lg border border-slate-800 z-10">
                <span className="text-[7px] font-black truncate max-w-[40%] uppercase">Leyland</span>
                <span className="font-mono text-[9px] font-extrabold text-green-400">2 - 1</span>
                <span className="text-[7px] font-black truncate max-w-[40%] uppercase">Cadley G</span>
              </div>

              {/* Pitch Players Nodes on Field */}
              <div className="relative w-full h-full flex flex-col justify-around py-1.5 z-10">
                {/* Forwards */}
                <div className="flex justify-around">
                  <div className="flex flex-col items-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-green-500 border border-slate-950 flex items-center justify-center text-[5px] font-bold text-slate-950">A</div>
                    <span className="text-[5px] scale-90 font-bold block text-slate-300">Martinez</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-green-500 border border-slate-950 flex items-center justify-center text-[5px] font-bold text-slate-950">H</div>
                    <span className="text-[5px] scale-90 font-bold block text-slate-300">Rodriguez</span>
                  </div>
                </div>

                {/* Midfielders */}
                <div className="flex justify-center">
                  <div className="flex flex-col items-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-green-500 border border-slate-950 flex items-center justify-center text-[5px] font-bold text-slate-950">B</div>
                    <span className="text-[5px] scale-90 font-bold block text-slate-300">Miller</span>
                  </div>
                </div>

                {/* Defenders */}
                <div className="flex justify-around">
                  <div className="flex flex-col items-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-green-500 border border-slate-950 flex items-center justify-center text-[5px] font-bold text-slate-950">E</div>
                    <span className="text-[5px] scale-90 font-bold block text-slate-300">Brown</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live action buttons in app */}
            <div className="grid grid-cols-2 gap-1">
              <div className="bg-green-500/25 border border-green-500/20 p-1 rounded text-center text-green-400 font-bold text-[7px] uppercase tracking-wider flex items-center justify-center gap-1 py-1.5">
                <Goal size={6} /> Our Goal
              </div>
              <div className="bg-slate-800 border border-slate-700 p-1 rounded text-center text-slate-300 font-bold text-[7px] uppercase tracking-wider flex items-center justify-center gap-1 py-1.5">
                <XRed size={6} /> Their Goal
              </div>
              <div className="bg-blue-500/20 border border-blue-500/20 p-1 col-span-2 rounded text-center text-blue-400 font-bold text-[7px] uppercase tracking-wider flex items-center justify-center gap-1 py-1">
                <ArrowLeftRight size={6} /> Drag & Drop Sub
              </div>
            </div>
          </div>
        )}

        {screen === 'squad' && (
          <div className="space-y-3 flex-1 flex flex-col justify-between z-10 text-[10px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
              <span className="font-extrabold uppercase tracking-wide text-slate-400 text-[8px]">⚽ Team Squad</span>
              <span className="text-[7px] text-green-500 font-bold">4 Players</span>
            </div>

            {/* Squad roster items exactly from mockups */}
            <div className="space-y-1.5 flex-1">
              <div className="bg-slate-950/80 border border-slate-800/80 p-2 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-green-500/10 text-green-400 flex items-center justify-center font-bold text-[9px]">A</div>
                  <div>
                    <h5 className="font-extrabold text-[8px] uppercase tracking-wide">Alexander Martinez</h5>
                    <span className="text-[6px] bg-green-500/10 text-green-400 px-1 py-0.2 rounded font-extrabold uppercase">FW</span>
                  </div>
                </div>
                <span className="text-[6px] text-green-400/85 bg-green-500/5 px-1 rounded flex items-center gap-0.5 font-bold"><Award size={6} /> MOTM</span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 p-2 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-[9px]">B</div>
                  <div>
                    <h5 className="font-extrabold text-[8px] uppercase tracking-wide">Benjamin Miller</h5>
                    <span className="text-[6px] bg-blue-500/10 text-blue-400 px-1 py-0.2 rounded font-extrabold uppercase">MF</span>
                  </div>
                </div>
                <span className="text-[6px] text-slate-500 font-medium">No Awards</span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 p-2 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-[9px]">E</div>
                  <div>
                    <h5 className="font-extrabold text-[8px] uppercase tracking-wide">Elijah Brown</h5>
                    <span className="text-[6px] bg-yellow-500/10 text-yellow-400 px-1 py-0.2 rounded font-extrabold uppercase">DF</span>
                  </div>
                </div>
                <span className="text-[6px] text-green-400/85 bg-green-500/5 px-1 rounded flex items-center gap-0.5 font-bold"><Award size={6} /> MOTM</span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 p-2 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-[9px]">H</div>
                  <div>
                    <h5 className="font-extrabold text-[8px] uppercase tracking-wide">Henry Rodriguez</h5>
                    <span className="text-[6px] bg-green-500/10 text-green-400 px-1 py-0.2 rounded font-extrabold uppercase">FW</span>
                  </div>
                </div>
                <span className="text-[6px] text-slate-500 font-medium">No Awards</span>
              </div>
            </div>

            {/* Bottom active notification badge */}
            <div className="bg-slate-950 text-[6px] p-1.5 rounded-lg text-slate-400 flex justify-between items-center">
              <span>Code: 295953</span>
              <span className="text-green-500 font-black">Active Registration</span>
            </div>
          </div>
        )}

        {/* Footer Home Indicator bar */}
        <div className="w-20 h-[3px] bg-slate-700/80 rounded-full mx-auto mt-2"></div>
      </div>
    </div>
  );
}

// Simple custom component to simulate X symbol without complex SVG
function XRed({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
