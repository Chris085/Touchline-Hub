import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { sendEmailVerification } from 'firebase/auth';
import { Mail, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const COOLDOWN_KEY = 'touchlinehub_verification_cooldown';
const COOLDOWN_SECONDS = 60;

export function EmailVerificationBanner() {
  const { user, emailVerified, reloadUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Verification reminder displayed log
  useEffect(() => {
    if (user && !emailVerified) {
      console.log('[Analytics] Verification Reminder Displayed', {
        userId: user.uid,
        email: user.email,
        timestamp: new Date().toISOString()
      });
    }
  }, [user?.uid, emailVerified]);

  // Handle active cooldown timers
  useEffect(() => {
    const checkCooldown = () => {
      const lastSentStr = localStorage.getItem(COOLDOWN_KEY);
      if (lastSentStr) {
        const lastSent = parseInt(lastSentStr, 10);
        const elapsed = Math.floor((Date.now() - lastSent) / 1000);
        if (elapsed < COOLDOWN_SECONDS) {
          setCooldown(COOLDOWN_SECONDS - elapsed);
        } else {
          setCooldown(0);
          localStorage.removeItem(COOLDOWN_KEY);
        }
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!user || emailVerified) {
    return null;
  }

  const handleSendVerificationEmail = async () => {
    console.log('[EmailVerificationBanner] Send verification button clicked.');
    if (cooldown > 0 || loading) {
      console.log('[EmailVerificationBanner] Blocked from sending: cooldown active or already loading.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log('[EmailVerificationBanner] Checking if auth.currentUser exists.');
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('[EmailVerificationBanner] auth.currentUser is null. User not logged in.');
        throw new Error('User not logged in');
      }

      console.log('[EmailVerificationBanner] Before sending email via sendEmailVerification client SDK...');
      await sendEmailVerification(currentUser);
      console.log('[EmailVerificationBanner] Send verification email success: call resolved successfully.');
      
      setSuccess(true);
      localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
      setCooldown(COOLDOWN_SECONDS);

      console.log('[Analytics] Verification Email Sent', {
        userId: currentUser.uid,
        email: currentUser.email,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('[EmailVerificationBanner] Error sending verification email:', err);
      setError(err?.message || 'Failed to send verification email. Please try again.');
    } finally {
      setLoading(false);
      console.log('[EmailVerificationBanner] Loading state reset.');
    }
  };

  const handleVerifyCheck = async () => {
    console.log('[EmailVerificationBanner] Verify My Email button clicked.');
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not logged in');
      }

      console.log('[EmailVerificationBanner] Reloading auth.currentUser to fetch fresh verified status...');
      await currentUser.reload();
      console.log('[EmailVerificationBanner] Reload complete. fresh emailVerified status:', currentUser.emailVerified);

      // Call reloadUser of custom AuthContext as well to update React state
      await reloadUser();
      
      if (currentUser.emailVerified) {
        console.log('[Analytics] Verification Completed', {
          userId: currentUser.uid,
          email: currentUser.email,
          timestamp: new Date().toISOString()
        });
      } else {
        console.warn('[EmailVerificationBanner] Email address is still unverified after reload.');
        setError('Email address is still not verified. Please check your inbox and click the verification link.');
      }
    } catch (err: any) {
      console.error('[EmailVerificationBanner] Error checking verification status:', err);
      setError(err?.message || 'Failed to check verification status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-250 py-3 sm:py-4 px-4 sm:px-6 relative z-50 overflow-hidden shadow-md no-print"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-yellow-500/20 rounded-lg text-yellow-400 mt-0.5">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display italic uppercase font-black tracking-wide text-xs sm:text-sm text-yellow-300">
                Verify Your Email Address
              </h4>
              <p className="text-[10px] sm:text-xs text-yellow-100/70 mt-0.5 leading-relaxed max-w-2xl">
                Please verify your email address to unlock all Touchline Hub features and secure your account.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-start md:self-auto pl-8 md:pl-0">
            {success ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Email Sent!
              </span>
            ) : (
              <button
                onClick={handleSendVerificationEmail}
                disabled={cooldown > 0 || loading}
                className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest font-display italic px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 border border-yellow-500/20 ${
                  cooldown > 0 || loading
                    ? 'bg-yellow-500/5 text-yellow-500/50 cursor-not-allowed'
                    : 'bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-300'
                }`}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Verification Email'}
              </button>
            )}

            <button
              onClick={handleVerifyCheck}
              disabled={loading}
              className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-[9px] sm:text-[10px] font-black uppercase tracking-widest font-display italic px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              I've Verified My Email
            </button>
          </div>
        </div>

        {error && (
          <div className="max-w-7xl mx-auto mt-2.5 sm:mt-3 pl-8 text-[9px] sm:text-[10px] text-red-400 font-extrabold flex items-center gap-1.5 uppercase font-display italic">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
