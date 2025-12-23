import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { Mail, Lock, ChevronRight, Zap, AlertCircle } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

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
      const errorMessage = err.response?.data?.detail || err.message || 'Login failed. Check your credentials.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-10 flex items-center justify-center px-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-slate-50 to-slate-100 dark:from-slate-900/50 dark:via-slate-950 dark:to-slate-950 transition-colors duration-500">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 md:p-12 border border-slate-100 dark:border-slate-800"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl rotate-3">
            <Zap size={32} className="text-secondary" />
          </div>
          <h2 className="text-3xl font-black text-secondary dark:text-white tracking-tight uppercase">Welcome Back</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Safe travels start here</p>
        </div>

        <form onSubmit={submit} className="space-y-6">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder="Username or Email"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              placeholder="Password"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
            />
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-100 dark:border-red-900/30 flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </motion.div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-secondary dark:bg-primary text-white dark:text-secondary font-black py-4 rounded-2xl hover:opacity-90 transition-all shadow-xl flex items-center justify-center gap-2 group"
          >
            {loading ? 'Authenticating...' : 'Sign In Now'}
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-8 text-center pt-8 border-t border-slate-100">
          <p className="text-slate-500 font-medium text-sm">
            New to Trento Smart? <Link to="/register" className="text-secondary font-black hover:underline ml-1">Create Account</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
