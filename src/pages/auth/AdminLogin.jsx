import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import jwtDecode from 'jwt-decode';
import { motion } from 'framer-motion';
import { ShieldAlert, Lock, Mail, Eye, EyeOff, Loader2, Zap, ArrowLeft } from 'lucide-react';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true });
      return;
    }
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.role === 'admin') navigate('/admin', { replace: true });
      } catch {
        /* ignore invalid token */
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login({ email, password });
      
      // Enforce Admin-only access
      if (user.role !== 'admin') {
        logout();
        setError('Access denied. This portal is strictly restricted to System Administrators.');
        return;
      }
      
      navigate('/admin');
    } catch (err) {
      const data = err.response?.data;
      const msg =
        (typeof data?.detail === 'string' && data.detail) ||
        data?.non_field_errors?.[0] ||
        (err.response?.status === 429
          ? 'Too many login attempts. Wait a minute and try again.'
          : null) ||
        err.message ||
        'Authentication failed. Use email admin@transmart.com or username admin.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden font-sans">
      {/* Background Tech Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_rgba(255,215,0,0.03)_0%,_transparent_70%)]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px] translate-x-1/4 translate-y-1/4" />
        <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-red-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back Link */}
        <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-primary transition-colors text-sm font-bold mb-8 group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Public Site</span>
        </Link>

        {/* Outer Glowing Card */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden shadow-primary/5 relative"
        >
          {/* Top Decorative Alert Bar */}
          <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-3 flex items-center gap-2.5">
            <ShieldAlert size={14} className="text-red-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
              LGU Secured Admin Portal
            </span>
          </div>

          <div className="p-8 sm:p-10">
            {/* Header / Brand */}
            <div className="text-center mb-8">
              <div className="inline-flex w-14 h-14 bg-primary/10 rounded-2xl items-center justify-center border border-primary/20 mb-4 shadow-lg shadow-primary/5">
                <Zap size={28} className="text-primary" />
              </div>
              <h1 className="text-2xl font-black text-white uppercase tracking-widest leading-none">
                Trento <span className="text-primary">Smart</span>
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mt-1.5">
                System Administration
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-950/40 border border-red-900/30 text-red-400 p-4 rounded-2xl text-xs font-semibold mb-6 flex items-start gap-3"
              >
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block ml-1">
                  Administrator Email or Username
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@transmart.com"
                    className="w-full bg-slate-950/60 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
                  />
                </div>
                <p className="text-[9px] text-slate-500 ml-1 mt-1">
                  Default: <span className="text-slate-400">admin@transmart.com</span> or username{' '}
                  <span className="text-slate-400">admin</span> — password set on server deploy
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block ml-1">
                  Security Password
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950/60 border border-white/5 rounded-2xl py-3.5 pl-12 pr-12 text-sm text-white focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary text-secondary font-black rounded-2xl uppercase tracking-widest hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2 shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.01]"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>Secure Sign In</span>
                )}
              </button>
            </form>

            {/* Warn Label */}
            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-[9px] font-bold text-slate-500 leading-relaxed uppercase tracking-wider">
                Unauthorized access attempts are legally prohibited. <br />
                All transactions & logins are digitally signed and LGU auditable.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminLogin;
