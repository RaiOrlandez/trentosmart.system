import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../../api/axios';
import { motion } from 'framer-motion';
import { User, Mail, Lock, CheckCircle, ChevronRight, Zap, Phone, Home, Calendar } from 'lucide-react';

const Register = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialRole = queryParams.get('role') || 'passenger';

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [role, setRole] = useState(initialRole);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/register/', {
        username,
        email,
        password,
        role,
        phone_number: phoneNumber,
        address: address,
        date_of_birth: dateOfBirth,
        gender: gender,
        emergency_contact_name: emergencyContactName
      });
      setMessage('Registration successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      console.warn('Register failed', err);
      let errorMessage = 'Registration failed. Please try again.';

      if (!err.response) {
        errorMessage = 'Network Error: Unable to connect to server. Please ensure the backend is running.';
      } else if (err.response.data) {
        // Handle field-specific errors
        const data = err.response.data;
        if (data.username) errorMessage = `Username: ${data.username[0]}`;
        else if (data.email) errorMessage = `Email: ${data.email[0]}`;
        else if (data.password) errorMessage = `Password: ${data.password[0]}`;
        else if (data.detail) errorMessage = data.detail;
        // Fallback for other validation errors
        else {
          const firstKey = Object.keys(data)[0];
          if (firstKey && Array.isArray(data[firstKey])) {
            errorMessage = `${firstKey}: ${data[firstKey][0]}`;
          }
        }
      }
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
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 md:p-12 relative overflow-hidden border border-slate-100 dark:border-slate-800"
      >
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Zap size={120} />
        </div>

        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl rotate-3">
            <Zap size={32} className="text-secondary" />
          </div>
          <h2 className="text-3xl font-black text-secondary dark:text-white tracking-tight">Join the Network</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Create your Trento Smart account</p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text" value={username} onChange={(e) => setUsername(e.target.value)} required
                placeholder="Username"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
              />
            </div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="Email Address"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder="Password"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                placeholder="Confirm"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Phone Number"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
                placeholder="Date of Birth"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="relative">
            <Home className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text" value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="Residential House/Street Address"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="Emergency Contact Name"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
              />
            </div>
            <div className="relative">
              <select
                value={gender} onChange={(e) => setGender(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white appearance-none"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block pl-1">I want to register as</label>
            <div className="flex gap-3">
              <button
                type="button" onClick={() => setRole('passenger')}
                className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold text-sm ${role === 'passenger' ? 'border-secondary bg-secondary text-white' : 'border-white dark:border-white/5 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 shadow-sm'}`}
              >
                Passenger
              </button>
              <button
                type="button" onClick={() => setRole('driver')}
                className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold text-sm ${role === 'driver' ? 'border-primary bg-primary text-secondary' : 'border-white dark:border-white/5 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 shadow-sm'}`}
              >
                Tricycle Driver
              </button>
            </div>
          </div>

          {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100 italic">{error}</motion.div>}
          {message && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-green-50 text-green-600 rounded-2xl text-sm font-bold border border-green-100 flex items-center gap-2"><CheckCircle size={16} /> {message}</motion.div>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-secondary text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2 group"
          >
            {loading ? 'Creating Account...' : 'Continue to Dashboard'}
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>


        <div className="mt-8 text-center pt-8 border-t border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
            Already part of Trento Smart? <Link to="/login" className="text-secondary dark:text-primary font-black hover:underline ml-1">Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div >
  );
};

export default Register;
