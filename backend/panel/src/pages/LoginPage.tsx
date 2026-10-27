import React, { useState, useId } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Moon, TrendingUp, Lock, Mail, ArrowRight, Loader2, Eye, EyeOff, Sun, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { LoginLocationState } from '../types';
import { getApiErrorMessage } from '../utils/finance';

const inputClass =
  'w-full bg-slate-50 dark:bg-[#000000] border border-slate-300 dark:border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const { login } = useAuth();
  const { toast } = useToast();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Enter your email address and password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await login(cleanEmail, password);
      toast.success('You are signed in.', 'Welcome back');
      const from = (location.state as LoginLocationState | null)?.from;
      const target = from && from.pathname !== '/login' ? `${from.pathname}${from.search || ''}` : '/dashboard';
      navigate(target, { replace: true });
    } catch (err) {
      let fallback = 'Unable to sign in. Check your credentials and try again.';
      if (axios.isAxiosError(err) && !err.response) {
        fallback = 'Cannot reach the server. Check your connection and try again.';
      } else if (!axios.isAxiosError(err) && err instanceof Error && err.message) {
        fallback = err.message;
      }
      const msg = getApiErrorMessage(err, fallback);
      setError(msg);
      toast.error(msg, 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-brand-500 selection:text-white transition-colors duration-200">
      {/* Ambient background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-brand-600/20 via-blue-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="absolute top-4 right-4 p-2 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-blue-400 transition z-20"
      >
        {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-brand-600" />}
      </button>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-brand-600 to-blue-600 shadow-xl shadow-brand-500/25 mb-4 text-white">
            <TrendingUp className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            CLYVUS VENTURES
          </h1>
          <p className="text-xs uppercase tracking-widest text-brand-600 dark:text-brand-400 font-semibold mt-1">
            Investment Admin Panel
          </p>
        </div>

        <div className="bg-white dark:bg-[#000000]/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-900/10 dark:shadow-black/50">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sign in</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Use your staff account to continue</p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} noValidate className="space-y-4">
            <div>
              <label htmlFor={`${id}-email`} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id={`${id}-email`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="username"
                  autoFocus
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${id}-password`} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id={`${id}-password`}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-500 hover:to-blue-600 text-white font-semibold text-sm rounded-xl shadow-lg shadow-brand-500/25 transition duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-[11px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
            Access is limited to authorised staff. Every sign-in and admin action is recorded in the activity log.
          </p>
        </div>
      </div>
    </div>
  );
};
