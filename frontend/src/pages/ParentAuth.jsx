import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail, ChevronRight, LogIn, UserPlus, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ParentAuth() {
  const navigate = useNavigate();
  const { loginWithEmail, registerWithEmail, firebaseConfigured } = useAuth();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all details.');
      return;
    }

    if (isRegistering && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (isRegistering) {
        await registerWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-10 select-none">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/75 backdrop-blur-md p-8 rounded-4xl border-3 border-white/60 shadow-lg"
      >
        {/* Toggle between Register/Login Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex p-3 bg-curio-purple/10 rounded-full border-2 border-white mb-2 animate-bounce-slow">
            <Lock className="w-6 h-6 text-curio-purple" />
          </div>
          <h2 className="text-2xl font-black text-curio-slate tracking-tight">
            {isRegistering ? 'Create Parent Account' : 'Parent Lock Gate'}
          </h2>
          <p className="text-slate-500 font-bold text-xs">
            Review child learning heatmap logs, focus scores, and PDF exports.
          </p>
        </div>

        {/* Firebase indicator warning */}
        {!firebaseConfigured && (
          <div className="bg-amber-50 border-2 border-amber-200 p-3 rounded-2xl text-[10px] font-bold text-amber-800 mb-6 flex items-start gap-2">
            <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span>⚠️ Offline/Mock Dev Mode Active. </span>
              <p className="font-bold text-[9px] text-amber-700 mt-0.5 leading-tight">
                Enter any mock email & password to bypass parent login and explore the Command Station!
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-600 p-3 rounded-2xl text-xs font-bold mb-6 text-center animate-wiggle">
            ❌ {error}
          </div>
        )}

        {/* Auth form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Email field */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Parent Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-4 top-4 text-slate-400" />
              <input 
                type="email" 
                placeholder="parents@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-curio-purple focus:outline-none font-bold text-xs bg-white"
                required
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Security Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-4 top-4 text-slate-400" />
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-curio-purple focus:outline-none font-bold text-xs bg-white"
                required
              />
            </div>
          </div>

          {/* Confirm Password (if registering) */}
          {isRegistering && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Confirm Security Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-4 text-slate-400" />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-curio-purple focus:outline-none font-bold text-xs bg-white"
                  required
                />
              </div>
            </div>
          )}

          {/* Submit button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-curio-purple hover:bg-curio-purple-dark text-white font-black py-4 px-6 rounded-2xl border-4 border-curio-slate shadow-playful-purple hover:translate-y-0.5 hover:shadow-none transition duration-150 text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 text-xs uppercase tracking-wide"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : isRegistering ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Register Parent Profile</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Unlock Command Station</span>
              </>
            )}
            {!loading && <ChevronRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Toggle Auth mode */}
        <div className="mt-6 pt-5 border-t border-slate-100/50 text-center text-xs font-bold">
          {isRegistering ? (
            <p className="text-slate-500">
              Already have an account?{' '}
              <button 
                onClick={() => { setIsRegistering(false); setError(''); }}
                className="text-curio-purple hover:underline font-black cursor-pointer bg-transparent border-none p-0"
              >
                Log In
              </button>
            </p>
          ) : (
            <p className="text-slate-500">
              New to CurioKids AI?{' '}
              <button 
                onClick={() => { setIsRegistering(true); setError(''); }}
                className="text-curio-purple hover:underline font-black cursor-pointer bg-transparent border-none p-0"
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
