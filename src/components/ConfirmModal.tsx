import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-pitch-dark/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-turf-surface/60 border border-chalk-white/10 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50" />
        
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-4 bg-red-500/10 rounded-2xl mb-4 border border-red-500/20">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-display italic uppercase font-black text-chalk-white tracking-tight">{title}</h2>
        </div>
        
        <p className="text-chalk-white/60 text-center mb-8 text-sm font-medium leading-relaxed">{message}</p>
        
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-4 rounded-xl font-display italic uppercase font-black text-chalk-white/60 bg-pitch-dark/50 hover:bg-pitch-dark transition-all border border-chalk-white/5 text-xs"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="flex-1 px-4 py-4 rounded-xl font-display italic uppercase font-black text-slate-50 bg-red-500 hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 text-xs"
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
