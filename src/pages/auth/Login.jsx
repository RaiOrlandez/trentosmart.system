import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, ChevronRight, Zap, AlertCircle, Eye, EyeOff,
  Shield, MapPin, Clock, CheckCircle, Users, Loader2, Star,
  Car, TrendingUp, Wallet, BarChart3
} from 'lucide-react';
import { signInWithGoogle } from '../../firebase';
import api from '../../api/axios';

// ─── Role Config ──────────────────────────────────────────────────────────────
const ROLES = {
  passenger: {
    label: 'Passenger',
    icon: Users,
    headline: 'Your Smart Ride',
    sub: 'Awaits You.',
    taglines: [
      { text: 'Safe travels, every trip.', icon: Shield },
      { text: 'Real-time GPS on every ride.', icon: MapPin },
      { text: 'Instant dispatch in seconds.', icon: Clock },
      { text: 'Trusted by the Trento community.', icon: Users },
      { text: 'LGU-verified drivers always.', icon: CheckCircle },
    ],
    features: [
      { icon: MapPin, label: 'Live Tracking', desc: 'GPS every 5s' },
      { icon: Shield, label: 'Verified Drivers', desc: 'LGU-approved' },
      { icon: Clock, label: 'Instant Dispatch', desc: '< 30 seconds' },
      { icon: Star, label: 'Rated Service', desc: '4.8★ average' },
    ],
    accentClass: 'from-[#0f172a] via-[#1e2d4d] to-[#0f172a]',
    showGoogle: true,
    placeholder: 'you@example.com',
  },
  driver: {
    label: 'Driver',
    icon: Car,
    headline: 'Earn on Your',
    sub: 'Own Schedule.',
    taglines: [
      { text: 'Track your earnings in real time.', icon: TrendingUp },
      { text: 'LGU-registered & protected.', icon: Shield },
      { text: 'Full ride & payment history.', icon: BarChart3 },
      { text: 'Instant wallet cash-out.', icon: Wallet },
      { text: 'Stay online, earn every hour.', icon: Clock },
    ],
    features: [
      { icon: TrendingUp, label: 'Live Earnings', desc: 'Updated per ride' },
      { icon: Shield, label: 'LGU Protected', desc: 'Fully insured' },
      { icon: Wallet, label: 'Fast Cash-out', desc: 'GCash ready' },
      { icon: BarChart3, label: 'Trip Analytics', desc: 'Full history' },
    ],
    accentClass: 'from-[#0a1628] via-[#0d2137] to-[#0a1628]',
    showGoogle: false,
    placeholder: 'driver@email.com',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
const Login = () => {
  const [activeRole, setActiveRole] = useState('passenger');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [taglineIdx, setTaglineIdx] = useState(0);

  const { login, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const sessionExpired = new URLSearchParams(location.search).get('expired') === 'true';

  const cfg = ROLES[activeRole];

  // Rotate taglines
  useEffect(() => {
    setTaglineIdx(0);
    const t = setInterval(() => setTaglineIdx(i => (i + 1) % cfg.taglines.length), 4000);
    return () => clearInterval(t);
  }, [activeRole]);

  // Clear fields & errors on tab switch
  const switchRole = (role) => {
    if (role === activeRole) return;
    setActiveRole(role);
    setEmail('');
    setPassword('');
    setError(null);
    setShowPassword(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login({ email, password });
      
      // Enforce Admin block on public page
      if (user.role === 'admin') {
        logout();
        setError('Please use the secure Admin portal to log in.');
        return;
      }
      
      // Enforce role match
      if (activeRole === 'driver' && user.role !== 'driver') {
        setError('This account is not a driver account. Please use the Passenger tab.');
        return;
      }
      if (activeRole === 'passenger' && user.role === 'driver') {
        setError('This is a driver account. Please switch to the Driver tab.');
        return;
      }
      if (user.role === 'driver') navigate('/driver');
      else navigate('/passenger');
    } catch (err) {
      if (err.response?.data?.email_not_verified) {
        navigate(`/verify-email?email=${email}`);
        return;
      }
      setError(err.response?.data?.detail || err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const res = await api.post('/auth/google-login/', { token: idToken });
      const { access, refresh } = res.data;
      localStorage.setItem('token', access);
      if (refresh) localStorage.setItem('refresh', refresh);
      window.location.href = '/';
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      setError(err.response?.data?.detail || err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeRole}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={`absolute inset-0 bg-gradient-to-br ${cfg.accentClass}`}
          />
        </AnimatePresence>

        {/* Background image */}
        <div className="absolute inset-0">
          <img src="/hero.png" alt="Trento Smart" className="w-full h-full object-cover opacity-20" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] -translate-x-1/4 translate-y-1/4" />
          <div className="absolute top-20 right-10 w-[300px] h-[300px] bg-accent/10 rounded-full blur-[100px]" />
        </div>

        {/* Left Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 shadow-lg shadow-primary/30">
              <Zap size={26} className="text-secondary" />
            </div>
            <span className="text-white font-black text-2xl tracking-[0.15em] uppercase">
              TRENTO <span className="text-primary">SMART</span>
            </span>
          </Link>

          {/* Headline */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <AnimatePresence mode="wait">
              <motion.div
                key={`headline-${activeRole}`}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-6">
                  {cfg.headline}
                  <br />
                  <span className="text-primary">{cfg.sub}</span>
                </h1>
              </motion.div>
            </AnimatePresence>

            {/* Tagline rotator */}
            <div className="h-14 relative mb-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeRole}-${taglineIdx}`}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 flex items-center gap-3"
                >
                  {(() => {
                    const Icon = cfg.taglines[taglineIdx].icon;
                    return (
                      <>
                        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 shrink-0">
                          <Icon size={18} className="text-primary" />
                        </div>
                        <p className="text-lg text-slate-300 font-medium">{cfg.taglines[taglineIdx].text}</p>
                      </>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>
              {/* Progress dots */}
              <div className="absolute -bottom-4 left-0 flex gap-1.5">
                {cfg.taglines.map((_, i) => (
                  <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === taglineIdx ? 'w-6 bg-primary' : 'w-1.5 bg-white/20'}`} />
                ))}
              </div>
            </div>

            {/* Features grid */}
            <motion.div
              key={`features-${activeRole}`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="grid grid-cols-2 gap-3"
            >
              {cfg.features.map((feat, i) => (
                <div key={i} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/5 hover:bg-white/10 transition-all duration-300 group">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <feat.icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{feat.label}</p>
                    <p className="text-slate-400 text-[11px] font-medium">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Trust footer */}
          <div className="flex items-center gap-6 pt-8 border-t border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-slate-400 text-xs font-bold">System Online</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield size={12} className="text-slate-500" />
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle size={12} className="text-slate-500" />
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">LGU Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 pt-24 lg:pt-10 relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3 pointer-events-none" />

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <div className="relative rounded-[2rem] overflow-hidden mb-6 shadow-xl">
              <img src="/hero.png" alt="Trento Smart" className="w-full h-48 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-secondary/95 via-secondary/70 to-secondary/40" />
              <div className="absolute inset-0 flex flex-col justify-end p-5">
                <Link to="/" className="flex items-center space-x-2 mb-3">
                  <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
                    <Zap size={18} className="text-secondary" />
                  </div>
                  <span className="text-white font-black text-lg tracking-[0.12em] uppercase">
                    TRENTO <span className="text-primary">SMART</span>
                  </span>
                </Link>
                <h1 className="text-2xl font-black text-white leading-tight">
                  {cfg.headline} <span className="text-primary">{cfg.sub}</span>
                </h1>
              </div>
            </div>
          </div>

          {/* Form header */}
          <div className="mb-6">
            <h2 className="text-3xl lg:text-[2.5rem] font-black text-secondary dark:text-white tracking-tight">
              Welcome back
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
              Sign in to continue to your dashboard
            </p>
          </div>

          {/* Session expired notice */}
          {sessionExpired && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-2xl text-sm font-bold border border-amber-200 dark:border-amber-800/30 flex items-center gap-2"
            >
              <Clock size={16} className="shrink-0" />
              Your session has expired. Please sign in again.
            </motion.div>
          )}

          {/* ── ROLE TABS ─────────────────────────────────────────────── */}
          <div className="relative flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 mb-7">
            {Object.entries(ROLES).map(([key, r]) => {
              const Icon = r.icon;
              const isActive = activeRole === key;
              return (
                <button
                  key={key}
                  id={`tab-${key}`}
                  onClick={() => switchRole(key)}
                  className="relative flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-colors duration-200 z-10"
                  style={{ color: isActive ? undefined : undefined }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white dark:bg-slate-700 rounded-xl shadow-md"
                      transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                    />
                  )}
                  <span className={`relative flex items-center gap-2 ${isActive ? 'text-secondary dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                    <Icon size={16} />
                    {r.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="tabAccent"
                      className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary"
                      transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── FORM CARD ──────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none p-7 md:p-9 border border-slate-100 dark:border-slate-800">
            <AnimatePresence mode="wait">
              <motion.form
                key={activeRole}
                initial={{ opacity: 0, x: activeRole === 'driver' ? 30 : -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: activeRole === 'driver' ? -30 : 30 }}
                transition={{ duration: 0.3 }}
                onSubmit={submit}
                className="space-y-5"
                aria-label={`${cfg.label} sign in form`}
              >
                {/* Email */}
                <div>
                  <label htmlFor="login-email" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5 block pl-1">
                    Email or Username
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      id="login-email"
                      type="text"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder={cfg.placeholder}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="login-password" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5 block pl-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="Enter your password"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-12 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Forgot password */}
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-[11px] font-black uppercase tracking-widest text-secondary dark:text-primary hover:underline transition-colors">
                    Forgot Password?
                  </Link>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-100 dark:border-red-900/30 flex items-center gap-2"
                    >
                      <AlertCircle size={16} className="shrink-0" /> {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  id="login-submit"
                  className="w-full bg-secondary dark:bg-primary text-white dark:text-secondary font-black py-4 rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-secondary/20 dark:shadow-primary/20 flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="animate-spin" size={20} />
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    <>
                      Sign In as {cfg.label}
                      <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </motion.form>
            </AnimatePresence>

            {/* Google Sign-In — Passenger only */}
            <AnimatePresence>
              {cfg.showGoogle && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">or continue with</span>
                    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={googleLoading || loading}
                    id="google-signin-btn"
                    className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {googleLoading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                    )}
                    {googleLoading ? 'Connecting...' : 'Continue with Google'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Driver note */}
            <AnimatePresence>
              {activeRole === 'driver' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30"
                >
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-bold text-center">
                    🚗 Driver accounts require LGU verification before login is enabled.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Divider + Register */}
            <div className="flex items-center gap-4 mt-6 mb-4">
              <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">new here?</span>
              <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
            </div>
            <Link
              to="/register"
              id="login-register-link"
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:border-primary/30 hover:bg-primary/5 dark:hover:border-primary/20 dark:hover:bg-primary/5 transition-all group"
            >
              Create a New Account
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform text-slate-400" />
            </Link>
          </div>

          {/* Footer */}
          <p className="text-center text-[11px] text-slate-400 mt-6 font-medium">
            By signing in, you agree to Trento Smart's Terms of Service and Privacy Policy.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
