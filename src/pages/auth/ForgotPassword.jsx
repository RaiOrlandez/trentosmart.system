import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { motion } from 'framer-motion';
import { Mail, ChevronRight, Zap, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [message, setMessage] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      // Assuming backend endpoint is /auth/password-reset-request/
      await api.post('/auth/password-reset-request/', { email });
      setStatus('success');
      setMessage('If an account exists for this email, we have sent a password reset link.');
    } catch (err) {
      setStatus('error');
      // For security, even on error we might want to just say "If an account exists..."
      // But we'll catch network errors here for easier debugging
      setMessage(err.response?.data?.detail || 'Unable to process request at this time. Please try again later.');
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

        <Link to="/login" className="inline-flex items-center gap-2 text-slate-400 hover:text-secondary dark:hover:text-primary transition-colors font-bold text-sm mb-8">
          <ArrowLeft size={16} /> Back to Login
        </Link>

        <div className="mb-8">
          <h2 className="text-3xl font-black text-secondary dark:text-white tracking-tight uppercase mb-2">Reset Password</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Enter your registered email address and we'll send you a link to reset your password.</p>
        </div>

        {status === 'success' ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-6 space-y-6">
            <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto text-green-500">
              <CheckCircle size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">Check Your Email</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{message}</p>
          </motion.div>
        ) : (
          <form onSubmit={submit} className="space-y-6 relative z-10">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value.toLowerCase())} required
                placeholder="Email Address"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
              />
            </div>

            {status === 'error' && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-100 dark:border-red-900/30 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" /> <span className="leading-tight">{message}</span>
              </motion.div>
            )}

            <button
              type="submit" disabled={status === 'loading' || !email}
              className="w-full bg-secondary dark:bg-primary text-white dark:text-secondary font-black py-4 rounded-2xl hover:opacity-90 transition-all shadow-xl flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'Sending Link...' : 'Send Recovery Link'}
              {status !== 'loading' && <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
