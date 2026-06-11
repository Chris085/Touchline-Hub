import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const modules = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Your central hub for team activities, upcoming matches, and quick actions.',
    content: 'The dashboard gives you a quick overview of your team. You can see the next upcoming match, recent news, and quick stats. Coaches can also manage team settings from here.',
    features: [
      'View the next upcoming match or training session',
      'Read the latest team news and announcements',
      'Quick access to team overview statistics',
      'Manage team settings and profile (Coaches)'
    ]
  },
  {
    id: 'squad',
    title: 'Squad Management',
    description: 'Manage your players, view their profiles, and organize your team.',
    content: 'In the Squad section, coaches can add new players, edit existing player details, and view player stats. Parents and players can view the team roster and access individual profiles.',
    features: [
      'Add, edit, and remove player profiles',
      'View the complete team roster',
      'Access individual player statistics and details',
      'Manage parent-player connections'
    ]
  },
  {
    id: 'schedule',
    title: 'Schedule & Availability',
    description: 'Keep track of upcoming matches and training sessions.',
    content: 'View the team calendar. Coaches can create new events (matches or training). Parents and players can mark their availability (Going, Maybe, Not Going) so the coach knows who will be there.',
    features: [
      'View the full team calendar of events',
      'Create new matches and training sessions (Coaches)',
      'Set player availability (Going, Maybe, Not Going)',
      'Track attendance and squad selection for upcoming events'
    ]
  },
  {
    id: 'live-match',
    title: 'Live Match Controller',
    description: 'Track live games, record events, and manage substitutions.',
    content: 'During a game, coaches use the Live Match Controller to start the timer, record goals, track substitutions, and issue cards. Parents can follow along in real-time to see live score updates and events.',
    features: [
      'Start, pause, and track the match timer',
      'Record goals, assists, and own goals',
      'Track player substitutions in real-time',
      'Issue yellow and red cards',
      'Take private match notes (Coaches)'
    ]
  },
  {
    id: 'motm',
    title: 'Player of the Match (MOTM)',
    description: 'Vote for the best player after a match.',
    content: 'Once a match is completed, the coach can open MOTM voting. Everyone on the team can cast their vote for the player they think performed best. Results are revealed when the coach closes the voting.',
    features: [
      'Open and close voting sessions (Coaches)',
      'Cast votes for the best performing player',
      'View MOTM results once voting is closed',
      'Track historical MOTM awards in player profiles'
    ]
  },
  {
    id: 'payments',
    title: 'Payments & Subs',
    description: 'Manage team finances and track individual payments.',
    content: 'Coaches can set up monthly subscriptions or one-off match fees. Parents can view what they owe and make payments directly through the app. The system tracks who has paid and who is outstanding.',
    features: [
      'Set up monthly subscriptions and one-off fees (Coaches)',
      'View outstanding balances and payment history',
      'Make payments directly through the app',
      'Track who has paid and who is outstanding'
    ]
  },
  {
    id: 'chat',
    title: 'Team Chat',
    description: 'Communicate with the whole team in one place.',
    content: 'A dedicated space for team discussions. Share updates, ask questions, and coordinate logistics without needing a separate messaging app.',
    features: [
      'Communicate with the entire team in real-time',
      'Share updates, announcements, and links',
      'Coordinate logistics and travel arrangements',
      'Centralized team communication'
    ]
  }
];

export function Learning() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center border border-green-500/30">
          <BookOpen className="text-green-500" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-50 uppercase tracking-tight italic font-display">Learning Center</h1>
          <p className="text-sm text-slate-400">Master every feature of The Touchline Hub</p>
        </div>
      </div>

      <div className="space-y-4">
        {modules.map((mod) => (
          <div key={mod.id} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === mod.id ? null : mod.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
            >
              <div className="text-left">
                <h3 className="text-lg font-bold text-slate-50">{mod.title}</h3>
                <p className="text-sm text-slate-400">{mod.description}</p>
              </div>
              {expandedId === mod.id ? (
                <ChevronUp className="text-slate-500 shrink-0" />
              ) : (
                <ChevronDown className="text-slate-500 shrink-0" />
              )}
            </button>

            <AnimatePresence>
              {expandedId === mod.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-800"
                >
                  <div className="p-6 space-y-6">
                    <div className="prose prose-invert max-w-none">
                      <p className="text-slate-300 leading-relaxed">{mod.content}</p>
                      
                      <div className="mt-6">
                        <h4 className="text-sm font-bold text-slate-50 uppercase tracking-widest mb-3">Key Features</h4>
                        <ul className="space-y-2">
                          {mod.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-slate-300">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0" />
                              <span className="text-sm">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
