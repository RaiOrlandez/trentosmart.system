import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ChevronRight, Zap, AlertCircle, Eye, EyeOff, Shield, MapPin, Clock, CheckCircle, Users, Loader2, Star } from 'lucide-react';

// Rotating taglines for the left panel
const TAGLINES = [
  { text: "Safe travels start here.", icon: Shield },
  { text: "Real-time GPS tracking on every ride.", icon: MapPin },
  { text: "Instant dispatch in seconds.", icon: Clock },
  { text: "Trusted by the Trento community.", icon: Users },
  { text: "LGU-verified drivers you can count on.", icon: CheckCircle },
];

const FEATURES = [
  { icon: MapPin, label: "Live Tracking", desc: "GPS every 5s" },
  { icon: Shield, label: "Verified Drivers", desc: "LGU-approved" },
  { icon: Clock, label: "Instant Dispatch", desc: "< 30 seconds" },
  { icon: Star, label: "Rated Service", desc: "4.8★ average" },
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Check for session-expired redirect
  const searchParams = new URLSearchParams(location.search);
  const sessionExpired = searchParams.get('expired') === 'true';

  // Rotate taglines every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % TAGLINES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login({ email, password });
      if (user.role === 'driver') navigate('/driver');
      else if (user.role === 'admin') navigate('/admin');
      else navigate('/passenger');
    } catch (err) {
      if (err.response?.data?.email_not_verified) {
        navigate(`/verify-email?email=${email}`);
        return;
      }
      const errorMessage = err.response?.data?.detail || err.message || 'Login failed. Check your credentials.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-500">

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* LEFT PANEL — Brand Showcase (hidden on mobile, shown on lg+) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden">
        {/* Hero background image with overlay */}
        <div className="absolute inset-0">
          <img
            src="/hero.png"
            alt="Trento Smart Tricycle"
            className="w-full h-full object-cover"
          />
          {/* Dark gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/95 via-secondary/85 to-secondary/70"></div>
          {/* Gold accent glow */}
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] -translate-x-1/4 translate-y-1/4"></div>
          <div className="absolute top-20 right-10 w-[300px] h-[300px] bg-accent/10 rounded-full blur-[100px]"></div>
        </div>

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">

          {/* Top — Logo */}
          <div>
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 shadow-lg shadow-primary/30">
                <Zap size={26} className="text-secondary" />
              </div>
              <span className="text-white font-black text-2xl tracking-[0.15em] uppercase">
                TRENTO <span className="text-primary">SMART</span>
              </span>
            </Link>
          </div>

          {/* Center — Main messaging */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <motion.h1
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-4xl xl:text-5xl font-black text-white leading-tight mb-6"
            >
              Your Smart Ride
              <br />
              <span className="text-primary">Awaits You.</span>
            </motion.h1>

            {/* Animated tagline rotator */}
            <div className="h-14 relative mb-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={taglineIndex}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 flex items-center gap-3"
                >
                  {(() => {
                    const IconComp = TAGLINES[taglineIndex].icon;
                    return (
                      <>
                        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 shrink-0">
                          <IconComp size={18} className="text-primary" />
                        </div>
                        <p className="text-lg text-slate-300 font-medium leading-relaxed">
                          {TAGLINES[taglineIndex].text}
                        </p>
                      </>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>
              {/* Progress dots */}
              <div className="absolute -bottom-4 left-0 flex gap-1.5">
                {TAGLINES.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-500 ${i === taglineIndex ? 'w-6 bg-primary' : 'w-1.5 bg-white/20'}`}
                  />
                ))}
              </div>
            </div>

            {/* Feature pills grid */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="grid grid-cols-2 gap-3"
            >
              {FEATURES.map((feat, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <feat.icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm leading-tight">{feat.label}</p>
                    <p className="text-slate-400 text-[11px] font-medium">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Bottom — Trust footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-6 pt-8 border-t border-white/5"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
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
          </motion.div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* RIGHT PANEL — Login Form                                   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 pt-24 lg:pt-10 relative">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile-only brand showcase (shows below lg breakpoint) */}
          <div className="lg:hidden mb-8">
            {/* Mobile hero card with background image */}
            <div className="relative rounded-[2rem] overflow-hidden mb-6 shadow-xl">
              <img
                src="/hero.png"
                alt="Trento Smart Tricycle"
                className="w-full h-48 sm:h-56 object-cover"
              />
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-secondary/95 via-secondary/70 to-secondary/40"></div>
              
              {/* Content on top of image */}
              <div className="absolute inset-0 flex flex-col justify-end p-5">
                {/* Logo */}
                <Link to="/" className="flex items-center space-x-2 mb-3">
                  <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
                    <Zap size={18} className="text-secondary" />
                  </div>
                  <span className="text-white font-black text-lg tracking-[0.12em] uppercase">
                    TRENTO <span className="text-primary">SMART</span>
                  </span>
                </Link>
                
                {/* Headline */}
                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2">
                  Your Smart Ride <span className="text-primary">Awaits.</span>
                </h1>

                {/* Animated tagline */}
                <div className="h-8 relative">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={taglineIndex}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -12, opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      className="absolute inset-0 flex items-center gap-2"
                    >
                      {(() => {
                        const IconComp = TAGLINES[taglineIndex].icon;
                        return (
                          <>
                            <IconComp size={14} className="text-primary shrink-0" />
                            <p className="text-sm text-slate-300 font-medium truncate">
                              {TAGLINES[taglineIndex].text}
                            </p>
                          </>
                        );
                      })()}
                    </motion.div>
                  </AnimatePresence>
                </div>
                {/* Progress dots */}
                <div className="flex gap-1 mt-1">
                  {TAGLINES.map((_, i) => (
                    <div
                      key={i}
                      className={`h-0.5 rounded-full transition-all duration-500 ${i === taglineIndex ? 'w-5 bg-primary' : 'w-1.5 bg-white/20'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile feature pills — horizontal scroll */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {FEATURES.map((feat, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 shadow-sm shrink-0"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <feat.icon size={13} className="text-primary-dark dark:text-primary" />
                  </div>
                  <div>
                    <p className="text-secondary dark:text-white font-bold text-[11px] leading-tight">{feat.label}</p>
                    <p className="text-slate-400 text-[9px] font-medium">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-3xl lg:text-[2.5rem] font-black text-secondary dark:text-white tracking-tight leading-tight">
              Welcome back
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">
              Sign in to continue to your dashboard
            </p>
          </div>

          {/* Session expired notice */}
          {sessionExpired && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-2xl text-sm font-bold border border-amber-200 dark:border-amber-800/30 flex items-center gap-2"
            >
              <Clock size={16} className="shrink-0" />
              Your session has expired. Please sign in again.
            </motion.div>
          )}

          {/* Login form card */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none p-7 md:p-9 border border-slate-100 dark:border-slate-800">
            <form onSubmit={submit} className="space-y-5" aria-label="Sign in form">

              {/* Email / Username input */}
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
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    aria-label="Email or username"
                    aria-required="true"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Password input */}
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
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    aria-label="Password"
                    aria-required="true"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-12 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Forgot password link */}
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-black uppercase tracking-widest text-secondary dark:text-primary hover:underline transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>

              {/* Error display */}
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

              {/* Submit button */}
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
                    Sign In
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">or</span>
              <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
            </div>

            {/* Register CTA */}
            <Link
              to="/register"
              id="login-register-link"
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:border-primary/30 hover:bg-primary/5 dark:hover:border-primary/20 dark:hover:bg-primary/5 transition-all group"
            >
              Create a New Account
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform text-slate-400" />
            </Link>
          </div>

          {/* Mobile-only trust bar (visible below lg) */}
          <div className="lg:hidden flex items-center justify-center gap-5 mt-6 flex-wrap">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Shield size={12} /> SSL Encrypted
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <CheckCircle size={12} /> LGU Verified
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div> Online
            </span>
          </div>

          {/* Footer text */}
          <p className="text-center text-[11px] text-slate-400 mt-6 font-medium">
            By signing in, you agree to Trento Smart's Terms of Service and Privacy Policy.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
