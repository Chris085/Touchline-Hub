import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { Check, CreditCard, Key, Loader2, AlertCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Paywall() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubscribe = async () => {
    if (!user) return;
    
    const paymentLink = (import.meta as any).env.VITE_STRIPE_PAYMENT_LINK;
    if (paymentLink) {
      try {
        // Use Stripe Payment Link with client_reference_id for automatic user matching
        const url = new URL(paymentLink);
        url.searchParams.set('client_reference_id', user.uid);
        url.searchParams.set('prefilled_email', user.email || '');
        window.location.href = url.toString();
        return;
      } catch (urlErr) {
        console.error("Invalid Stripe Payment Link:", urlErr);
        setError("The payment link is misconfigured. Please contact support.");
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, email: user.email }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !code.trim()) return;
    setCodeLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/validate-coach-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), userId: user.uid }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        // Refresh page after a short delay to trigger subscription check
        setTimeout(() => window.location.reload(), 2000);
      } else {
        throw new Error(data.error || 'Invalid code');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative">
      <button 
        onClick={() => navigate(-1)}
        className="absolute top-8 right-8 p-3 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all z-50"
        title="Close"
      >
        <X size={24} />
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
      >
        <div className="space-y-6">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-sm font-medium border border-green-500/20">
            Premium Access
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Unlock the Full <span className="text-green-500">Touchline Hub</span> Experience
          </h1>
          <p className="text-slate-400 text-lg">
            Get unlimited access to coaching tools, live match stats, player performance tracking, and team communication.
          </p>
          
          <ul className="space-y-4">
            {[
              "Live Match Stats & Timer",
              "Squad Management & Attendance",
              "Player Performance Notes & Ratings",
              "Team Chat & News Feed",
              "MOTM Voting System",
              "Unlimited Teams & Players"
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-slate-300">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-500" />
                </div>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-8">
          <div className="text-center space-y-2">
            <div className="text-slate-400 font-medium">Premium Plan</div>
            <div className="text-5xl font-bold">£4.99<span className="text-xl text-slate-500 font-normal">/mo</span></div>
            <p className="text-slate-500 text-sm italic">Affordable for every grassroots coach</p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {success ? (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-center font-medium">
              Code applied successfully! Redirecting...
            </div>
          ) : (
            <>
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg shadow-lg shadow-green-500/20"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Subscribe Now
                  </>
                )}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900 px-2 text-slate-500">Or use a coach code</span>
                </div>
              </div>

              <form onSubmit={handleApplyCode} className="space-y-3">
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Enter Coach Code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={codeLoading || !code.trim()}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {codeLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Apply Code'}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-slate-500 text-xs">
            Secure payment powered by Stripe. Cancel anytime.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
