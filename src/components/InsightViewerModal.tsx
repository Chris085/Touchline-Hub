import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';
import { format } from 'date-fns';

interface InsightViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  insight: any | null;
}

export function InsightViewerModal({ isOpen, onClose, insight }: InsightViewerModalProps) {
  if (!isOpen || !insight) return null;

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
                Saved AI Tactics
              </h2>
              <p className="text-slate-400 text-sm font-medium mt-1">
                Generated on {insight.createdAt?.seconds ? format(new Date(insight.createdAt.seconds * 1000), 'MMM d, yyyy h:mm a') : 'Unknown'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex flex-col items-center justify-center hover:bg-slate-700 hover:text-slate-50 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
            <div className="prose prose-invert prose-slate max-w-none prose-headings:font-display prose-headings:italic prose-headings:uppercase prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-a:text-purple-400">
              <Markdown>{insight.content}</Markdown>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
