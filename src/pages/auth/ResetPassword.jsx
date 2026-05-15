import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../../api/axios';
import { motion } from 'framer-motion';
import { Lock, ChevronRight, Zap, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [message, setMessage] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing password reset token. Please request a new link.');
    }
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setStatus('error');
      setMessage('Password must be at least 8 characters long');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      // Assuming backend endpoint is /auth/password-reset-confirm/
      await api.post('/auth/password-reset-confirm/', { token, new_password: password });
      setStatus('success');
      setMessage('Your password has been successfully updated. You can now login with your new credentials.');
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.detail || 'Failed to reset password. The link may have expired or is invalid.');
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-10 flex items-center justify-center px-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-slate-50 to-slate-100 dark:from-slate-900/50 dark:via-slate-950 dark:to-slate-950 transition-colors duration-500">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 md:p-12 border border-slate-100 dark:border-slate-800 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Zap size={120} />
        </div>

        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl rotate-3">
            <Lock size={32} className="text-secondary" />
          </div>
          <h2 className="text-3xl font-black text-secondary dark:text-white tracking-tight uppercase mb-2">Create New Password</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Please enter a strong new password below.</p>
        </div>

        {status === 'success' ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-6 space-y-6">
            <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto text-green-500">
              <CheckCircle size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">Password Updated</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{message}</p>
            <Link to="/login" className="mt-8 inline-flex items-center justify-center w-full bg-secondary dark:bg-primary text-white dark:text-secondary font-black py-4 rounded-2xl hover:opacity-90 transition-all shadow-xl">
              Proceed to Login
            </Link>
          </motion.div>
        ) : (
          <form onSubmit={submit} className="space-y-6 relative z-10">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required disabled={!token || status === 'loading'}
                placeholder="New Password"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-12 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white disabled:opacity-50"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" disabled={!token || status === 'loading'}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={!token || status === 'loading'}
                placeholder="Confirm New Password"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-12 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white disabled:opacity-50"
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" disabled={!token || status === 'loading'}>
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {status === 'error' && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-100 dark:border-red-900/30 flex items-start gap-2">
                <AlertCircle size={18} className="shrink-0 mt-0.5" /> <span className="leading-tight">{message}</span>
              </motion.div>
            )}

            <button
              type="submit" disabled={status === 'loading' || !token}
              className="w-full bg-secondary dark:bg-primary text-white dark:text-secondary font-black py-4 rounded-2xl hover:opacity-90 transition-all shadow-xl flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'Saving...' : 'Save New Password'}
              {status !== 'loading' && <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />}
            </button>
            
            {!token && (
              <div className="mt-4 text-center">
                 <Link to="/forgot-password" className="text-secondary dark:text-primary text-sm font-bold hover:underline">Request a new link</Link>
              </div>
            )}
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
