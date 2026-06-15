import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { LogIn, UserPlus } from 'lucide-react';

export function Login() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      if (isSignUp) {
        if (!name.trim()) {
          throw new Error('Name is required for sign up');
        }
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pitch-dark flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background decorative elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-pitch-green/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-pitch-accent/10 rounded-full blur-3xl" />
      
      {/* Pitch lines for background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-chalk-white" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-chalk-white rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-turf-surface/40 backdrop-blur-xl p-8 rounded-[2rem] border border-chalk-white/10 shadow-2xl relative z-10"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-pitch-green to-pitch-accent rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-pitch-green/20 transform -rotate-6 border-2 border-chalk-white/20">
            <span className="text-pitch-dark font-black text-4xl tracking-tighter font-display italic">TH</span>
          </div>
          <h1 className="text-3xl font-display italic uppercase font-black text-chalk-white mb-2 tracking-tight">The Touchline Hub</h1>
          <p className="text-chalk-white/60 text-xs font-medium tracking-wide uppercase">Professional management for youth football.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm text-center mb-6 w-full">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignUp && (
            <div>
              <label className="block text-[10px] font-bold text-chalk-white/50 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white focus:outline-none focus:border-pitch-green focus:ring-1 focus:ring-pitch-green transition-all placeholder:text-chalk-white/20"
                placeholder="John Doe"
                required={isSignUp}
              />
            </div>
          )}
          
          <div>
            <label className="block text-[10px] font-bold text-chalk-white/50 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white focus:outline-none focus:border-pitch-green focus:ring-1 focus:ring-pitch-green transition-all placeholder:text-chalk-white/20"
              placeholder="coach@example.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-chalk-white/50 uppercase tracking-widest mb-1.5 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-pitch-dark/50 border border-chalk-white/10 rounded-xl px-4 py-3.5 text-chalk-white focus:outline-none focus:border-pitch-green focus:ring-1 focus:ring-pitch-green transition-all placeholder:text-chalk-white/20"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pitch-green hover:bg-pitch-accent text-pitch-dark py-4 px-4 rounded-xl font-display italic uppercase font-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-pitch-green/20 mt-8"
          >
            {isSignUp ? <UserPlus size={20} strokeWidth={3} /> : <LogIn size={20} strokeWidth={3} />}
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-8 text-center flex flex-col items-center gap-5">
          <div className="w-full flex items-center gap-4">
            <div className="h-px flex-1 bg-chalk-white/10" />
            <span className="text-[10px] font-bold text-chalk-white/20 uppercase tracking-widest">Or continue with</span>
            <div className="h-px flex-1 bg-chalk-white/10" />
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex items-center justify-center gap-3 px-8 py-3 bg-chalk-white hover:bg-pitch-green text-pitch-dark rounded-xl transition-all duration-300 shadow-xl disabled:opacity-50 text-xs font-black uppercase italic font-display w-full"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-pitch-dark border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Google Account</span>
              </>
            )}
          </button>
        </div>
        
        <p className="text-center text-[9px] font-bold text-chalk-white/20 mt-10 uppercase tracking-widest">
          By continuing, you agree to our Terms and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
