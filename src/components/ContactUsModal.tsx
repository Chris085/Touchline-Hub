import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, AlertTriangle, Lightbulb, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ContactUsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactUsModal({ isOpen, onClose }: ContactUsModalProps) {
  const { profile } = useAuth();
  const [type, setType] = useState<'bug' | 'suggestion' | 'other'>('bug');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile?.uid,
          userName: profile?.displayName || 'Unknown',
          userEmail: profile?.email || 'Unknown',
          type,
          message: message.trim()
        })
      });

      if (!res.ok) throw new Error('Failed to submit');

      alert('Your message has been sent. Thank you!');
      setMessage('');
      setType('bug');
      onClose();
    } catch (error) {
      console.error('Submission error:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pb-safe">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-slate-900 border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                  <Send className="text-indigo-400" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-50 uppercase tracking-tight">Contact Us</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">We'd love to hear from you</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-slate-50 hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto w-full">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">What is this regarding?</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setType('bug')}
                      className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                        type === 'bug' 
                          ? 'bg-red-500/10 border-red-500/50 text-red-400' 
                          : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <AlertTriangle size={20} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Report Bug</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('suggestion')}
                      className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                        type === 'suggestion' 
                          ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' 
                          : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Lightbulb size={20} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Suggestion</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('other')}
                      className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                        type === 'other' 
                          ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' 
                          : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <MessageSquare size={20} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Other</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what's on your mind..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-50 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors min-h-[150px] resize-y"
                    required
                  />
                </div>
                
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !message.trim()}
                    className="w-full bg-indigo-500 hover:bg-indigo-400 text-slate-50 font-black uppercase tracking-wider text-xs py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-slate-50/20 border-t-slate-50 rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={16} />
                        Send Message
                      </>
                    )}
                  </button>
                  <p className="text-center text-[10px] text-slate-500 mt-4 font-bold uppercase tracking-widest">
                    Your feedback will be sent directly to the team
                  </p>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
