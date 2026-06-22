import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { motion } from 'motion/react';
import { 
  CreditCard, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  HelpCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { ContactUsModal } from '../components/ContactUsModal';

export function Subscription() {
  const { user, profile } = useAuth();
  const { subscription, daysRemaining, status, isTrial, isActive, isExpired } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isContactOpen, setIsContactOpen] = useState(false);

  const handleStartSubscription = async () => {
    if (!user) return;
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
      setError(err.message || 'Error redirecting to checkout');
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/create-customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create customer portal session');
      }
    } catch (err: any) {
      setError(err.message || 'Error redirecting to portal');
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-50 uppercase italic tracking-tight font-display">
            Subscription & Trial
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            Manage your Touchline Hub club plan
          </p>
        </div>
        
        {/* Status Badge */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Status:</span>
          {isExpired() && (
            <span className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-black uppercase px-3 py-1 rounded-xl flex items-center gap-1.5">
              <AlertTriangle size={12} />
              Expired
            </span>
          )}
          {isTrial() && (
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-black uppercase px-3 py-1 rounded-xl flex items-center gap-1.5">
              <Clock size={12} />
              Free Trial
            </span>
          )}
          {isActive() && (
            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase px-3 py-1 rounded-xl flex items-center gap-1.5">
              <CheckCircle2 size={12} />
              Active
            </span>
          )}
          {status === 'cancelled' && (
            <span className="bg-slate-800 border border-slate-700 text-slate-400 text-xs font-black uppercase px-3 py-1 rounded-xl flex items-center gap-1.5">
              <AlertTriangle size={12} />
              Cancelled
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold uppercase text-xs tracking-wider">Payment Action Required</h4>
            <p className="text-xs text-red-400/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Main Grid Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Detail overview column */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-8 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
              <Sparkles className="text-indigo-400" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-50">Premium Plan Details</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Affordable grassroots club management</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Current Plan</span>
              <p className="text-xl font-bold text-slate-50 mt-2 uppercase italic tracking-tight">
                {isActive() ? 'Team Premium' : isTrial() ? 'Trial License' : 'Inactive'}
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Pricing</span>
              <div>
                <span className="text-xl font-bold text-slate-50 block mt-2">£4.99 <span className="text-xs text-slate-500 font-medium">/ month</span></span>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Covers 3 coaches per team</span>
              </div>
            </div>

            {isTrial() && (
              <>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">Days Remaining</span>
                  <p className="text-4xl font-extrabold text-amber-500 mt-2 font-display italic">
                    {daysRemaining} <span className="text-xs font-normal text-slate-400">days</span>
                  </p>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">Trial Term</span>
                  <div className="mt-3 text-xs space-y-1">
                    <p className="text-slate-400 flex justify-between">
                      <span>Started:</span>
                      <span className="font-semibold text-slate-200">{formatDate(subscription?.trialStartDate)}</span>
                    </p>
                    <p className="text-slate-400 flex justify-between">
                      <span>Ends:</span>
                      <span className="font-semibold text-slate-200">{formatDate(subscription?.trialEndDate)}</span>
                    </p>
                  </div>
                </div>
              </>
            )}

            {isActive() && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl sm:col-span-2">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">Renewal Term</span>
                <div className="mt-2 text-xs flex justify-between items-center">
                  <div>
                    <span className="text-slate-400">Next billing date: </span>
                    <span className="font-bold text-slate-100">{formatDate(subscription?.currentPeriodEnd || subscription?.trialEndDate)}</span>
                  </div>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg">Auto-Renewing</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-4">
            {(isTrial() || isExpired() || status === 'cancelled') ? (
              <button
                onClick={handleStartSubscription}
                disabled={loading}
                className="flex-1 min-w-[200px] py-4 bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-800 text-slate-50 font-black uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Start Subscription'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleManageBilling}
                  disabled={loading}
                  className="flex-1 min-w-[150px] py-3.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-slate-50 font-black uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : (
                    <>
                      <ExternalLink size={14} />
                      Manage Subscription
                    </>
                  )}
                </button>
                <button
                  onClick={handleManageBilling}
                  disabled={loading}
                  className="flex-1 min-w-[150px] py-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-black uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Update Payment Method'}
                </button>
              </>
            )}
            
            <button
              onClick={() => setIsContactOpen(true)}
              className="px-5 py-3.5 border border-slate-800 hover:bg-slate-800/50 text-slate-400 hover:text-slate-100 font-bold uppercase text-[10px] tracking-widest rounded-xl transition-all"
            >
              Contact Support
            </button>
          </div>
        </div>

        {/* Informative Side Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
          <div className="space-y-6">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">Why Upgrade?</h4>
            
            <ul className="space-y-4">
              {[
                { title: "Schedules & Match logs", desc: "Never lose record of full stats" },
                { title: "Full Squad profiles", desc: "Player medical details & parent invites" },
                { title: "Parent voting room", desc: "Collect easy feedback & MOTM winners" },
                { title: "Live visual stats board", desc: "Real-time clock tracking & live events" },
                { title: "No credit cards up front", desc: "Simple cancels, no lock-in terms" }
              ].map((item, id) => (
                <li key={id} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 text-xs font-bold font-mono">
                    ✓
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-200 leading-tight">{item.title}</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 p-4 bg-slate-950/60 border border-slate-800/50 rounded-2xl text-center">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Customer Support</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Having problems? Our team resolves any bug report or request immediately.</p>
          </div>
        </div>
      </div>

      <ContactUsModal 
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />
    </div>
  );
}
