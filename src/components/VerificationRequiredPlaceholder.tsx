import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function VerificationRequiredPlaceholder({ featureName }: { featureName: string }) {
  const { sendVerificationEmail } = useAuth();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    try {
      await sendVerificationEmail();
      setSent(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-yellow-500" />
      <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-yellow-500/20">
        <ShieldAlert className="w-8 h-8 text-yellow-500" />
      </div>
      <h3 className="text-xl font-display italic uppercase font-black text-slate-50 mb-3">Verification Required</h3>
      <p className="text-slate-400 text-sm mb-6 leading-relaxed">
        To access <strong className="text-slate-200">{featureName}</strong>, you must verify your email address. This is a higher-risk action requiring verification to protect your team and account security.
      </p>
      <div className="space-y-3">
        {sent ? (
          <p className="text-xs text-green-400 font-bold bg-green-500/10 py-2.5 rounded-xl border border-green-500/20 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Verification email sent successfully!
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={loading}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl font-display italic transition-all disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Resend Verification Email'}
          </button>
        )}
      </div>
    </div>
  );
}
