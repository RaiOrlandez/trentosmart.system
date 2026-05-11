import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Lock, CheckCircle, ChevronRight, Zap, Phone, Home, Calendar, Loader2, XCircle, Check, Eye, EyeOff } from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Availability states
  const [emailStatus, setEmailStatus] = useState('idle'); // idle, checking, available, taken, invalid
  const [usernameStatus, setUsernameStatus] = useState('idle'); // idle, checking, available, taken
  const [dobStatus, setDobStatus] = useState('idle'); // idle, valid, invalid
  const [dobErrorMsg, setDobErrorMsg] = useState('');

  const navigate = useNavigate();

  // Real-time Email Check
  useEffect(() => {
    if (!email) {
      setEmailStatus('idle');
      return;
    }

    // Basic regex check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus('invalid');
      return;
    }

    const timer = setTimeout(async () => {
      setEmailStatus('checking');
      try {
        const res = await api.get(`/auth/check-email/?email=${email}`);
        setEmailStatus(res.data.available ? 'available' : 'taken');
      } catch (err) {
        setEmailStatus('idle');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [email]);

  // Real-time Username Check
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus('checking');
      try {
        const res = await api.get(`/auth/check-username/?username=${username}`);
        setUsernameStatus(res.data.available ? 'available' : 'taken');
      } catch (err) {
        setUsernameStatus('idle');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [username]);

  // Auto-format dd/mm/yyyy and validate
  useEffect(() => {
    if (!dateOfBirth || dateOfBirth.length < 10) {
      setDobStatus('idle');
      setDobErrorMsg('');
      return;
    }

    const parts = dateOfBirth.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);

      const currentYear = new Date().getFullYear();

      if (d === 0 || d > 31 || m === 0 || m > 12 || y < 1920 || y > currentYear) {
        setDobStatus('invalid');
        setDobErrorMsg('Invalid date format');
        return;
      }

      // Check age specifically if role is driver
      const dobDate = new Date(y, m - 1, d);
      const ageDiffMs = Date.now() - dobDate.getTime();
      const ageDate = new Date(ageDiffMs);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);

      if (role === 'driver' && age < 18) {
        setDobStatus('invalid');
        setDobErrorMsg('Drivers must be at least 18 years old');
        return;
      }

      setDobStatus('valid');
      setDobErrorMsg('');
    } else {
      setDobStatus('invalid');
      setDobErrorMsg('Invalid format');
    }
  }, [dateOfBirth, role]);

  const handleDateChange = (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length > 8) value = value.slice(0, 8); // Max 8 digits

    let formatted = '';
    if (value.length > 0) formatted += value.slice(0, 2);
    if (value.length > 2) formatted += '/' + value.slice(2, 4);
    if (value.length > 4) formatted += '/' + value.slice(4, 8);

    setDateOfBirth(formatted);
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (usernameStatus === 'taken') {
      setError('This username is already taken');
      return;
    }

    if (emailStatus === 'taken') {
      setError('This email address is already in use');
      return;
    }

    if (emailStatus === 'invalid') {
      setError('Please enter a valid email address');
      return;
    }

    if (dobStatus === 'invalid') {
      setError(dobErrorMsg || 'Please enter a valid Date of Birth');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Convert DD/MM/YYYY to YYYY-MM-DD for backend
    let finalDob = dateOfBirth;
    if (dateOfBirth && dateOfBirth.includes('/')) {
      const parts = dateOfBirth.split('/');
      if (parts.length === 3) {
        finalDob = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
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
        date_of_birth: finalDob,
        gender: gender,
        emergency_contact_name: emergencyContactName
      });
      setMessage('Registration successful! Please check your email for the verification code.');
      setTimeout(() => navigate(`/verify-email?email=${email}`), 1500);
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
                className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-2xl py-4 pl-12 pr-12 outline-none transition-all font-medium text-slate-900 dark:text-white ${usernameStatus === 'taken' ? 'border-red-400 bg-red-50/10' : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/50'}`}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                {usernameStatus === 'available' && <Check className="w-4 h-4 text-green-500" />}
                {usernameStatus === 'taken' && <XCircle className="w-4 h-4 text-red-500" />}
              </div>
              {usernameStatus === 'taken' && <p className="text-[10px] text-red-500 font-bold mt-1 ml-2">Username taken</p>}
            </div>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="Email Address"
                className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-2xl py-4 pl-12 pr-12 outline-none transition-all font-medium text-slate-900 dark:text-white ${emailStatus === 'taken' || emailStatus === 'invalid' ? 'border-red-400 bg-red-50/10' : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/50'}`}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                {emailStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                {emailStatus === 'available' && <Check className="w-4 h-4 text-green-500" />}
                {emailStatus === 'taken' && <XCircle className="w-4 h-4 text-red-500" />}
                {emailStatus === 'invalid' && <span className="text-[9px] font-black text-red-400 uppercase tracking-tighter">Format!</span>}
              </div>
              {emailStatus === 'taken' && <p className="text-[10px] text-red-500 font-bold mt-1 ml-2">Email already exists</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder="Password"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-12 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                placeholder="Confirm"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-12 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
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
                type="text" value={dateOfBirth} onChange={handleDateChange} required
                placeholder="DD / MM / YYYY" maxLength="10"
                className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-2xl py-4 pl-12 pr-12 outline-none transition-all font-bold text-slate-900 dark:text-white ${dobStatus === 'invalid' ? 'border-red-400 bg-red-50/10' : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/50'}`}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                {dobStatus === 'valid' && <Check className="w-4 h-4 text-green-500" />}
                {dobStatus === 'invalid' && <XCircle className="w-4 h-4 text-red-500" />}
              </div>
              {dobStatus === 'invalid' && <p className="text-[10px] text-red-500 font-bold mt-1 ml-2">{dobErrorMsg}</p>}
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
