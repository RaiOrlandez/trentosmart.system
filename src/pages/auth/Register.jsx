import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Lock, CheckCircle, ChevronRight, Zap, Phone, Home, Calendar, Loader2, XCircle, Check, Eye, EyeOff, ArrowLeft } from 'lucide-react';

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
  const [step, setStep] = useState(1);

  // Availability states
  const [emailStatus, setEmailStatus] = useState('idle'); // idle, checking, available, taken, invalid, bad_domain
  const [emailErrorMsg, setEmailErrorMsg] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('idle'); // idle, checking, available, taken, invalid
  const [usernameErrorMsg, setUsernameErrorMsg] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0); // 0-4
  const [passwordErrorMsg, setPasswordErrorMsg] = useState('');
  const [dobStatus, setDobStatus] = useState('idle'); // idle, valid, invalid
  const [dobErrorMsg, setDobErrorMsg] = useState('');

  const canGoNextStep1 = username && usernameStatus === 'available' && email && emailStatus === 'available' && password && passwordStrength >= 3 && password === confirmPassword;
  const canGoNextStep2 = phoneNumber && dobStatus === 'valid' && gender;

  // Whitelist of trusted email domains
  const ALLOWED_EMAIL_DOMAINS = [
    // Google
    'gmail.com',
    // Yahoo
    'yahoo.com', 'yahoo.com.ph', 'yahoo.co.uk', 'yahoo.co.jp',
    'ymail.com', 'rocketmail.com',
    // Microsoft
    'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
    // Apple
    'icloud.com', 'me.com', 'mac.com',
    // Other major providers
    'protonmail.com', 'proton.me', 'zoho.com', 'aol.com',
    'mail.com', 'gmx.com', 'tutanota.com',
  ];

  // Also allow any .edu, .edu.ph, .gov, .gov.ph domain (institutional emails)
  const isAllowedDomain = (domain) => {
    const lower = domain.toLowerCase();
    if (ALLOWED_EMAIL_DOMAINS.includes(lower)) return true;
    if (lower.endsWith('.edu') || lower.endsWith('.edu.ph')) return true;
    if (lower.endsWith('.gov') || lower.endsWith('.gov.ph')) return true;
    return false;
  };

  const navigate = useNavigate();

  // Real-time Email Check
  useEffect(() => {
    if (!email) {
      setEmailStatus('idle');
      setEmailErrorMsg('');
      return;
    }

    // Basic regex check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus('invalid');
      setEmailErrorMsg('Invalid email format');
      return;
    }

    // Extract domain and validate against whitelist
    const domain = email.split('@')[1];
    if (!isAllowedDomain(domain)) {
      setEmailStatus('bad_domain');
      setEmailErrorMsg(`"@${domain}" is not accepted. Use Gmail, Yahoo, Outlook, or a school email.`);
      return;
    }

    const timer = setTimeout(async () => {
      setEmailStatus('checking');
      setEmailErrorMsg('');
      try {
        const res = await api.get(`/auth/check-email/?email=${email}`);
        setEmailStatus(res.data.available ? 'available' : 'taken');
        if (!res.data.available) setEmailErrorMsg('Email already exists');
      } catch (err) {
        setEmailStatus('idle');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [email]);

  // Real-time Username Check
  useEffect(() => {
    if (!username) {
      setUsernameStatus('idle');
      setUsernameErrorMsg('');
      return;
    }

    // Professional username validation
    // - Only alphanumeric characters and underscores
    // - 3-20 characters
    // - Must start with a letter
    // - No consecutive underscores
    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
    const consecutiveUnderscoreRegex = /__+/;

    if (username.length < 3) {
      setUsernameStatus('invalid');
      setUsernameErrorMsg('Username must be at least 3 characters');
      return;
    }

    if (username.length > 20) {
      setUsernameStatus('invalid');
      setUsernameErrorMsg('Username must be 20 characters or less');
      return;
    }

    if (!usernameRegex.test(username)) {
      setUsernameStatus('invalid');
      setUsernameErrorMsg('Username must start with a letter and contain only letters, numbers, and underscores');
      return;
    }

    if (consecutiveUnderscoreRegex.test(username)) {
      setUsernameStatus('invalid');
      setUsernameErrorMsg('Username cannot contain consecutive underscores');
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus('checking');
      setUsernameErrorMsg('');
      try {
        const res = await api.get(`/auth/check-username/?username=${username}`);
        if (res.data.available) {
          setUsernameStatus('available');
        } else {
          setUsernameStatus('taken');
          setUsernameErrorMsg('Username already taken');
        }
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

  // Password Strength Checker
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      setPasswordErrorMsg('');
      return;
    }

    let strength = 0;
    const errors = [];

    // Length check
    if (password.length >= 8) strength += 1;
    else errors.push('at least 8 characters');

    // Uppercase check
    if (/[A-Z]/.test(password)) strength += 1;
    else errors.push('one uppercase letter');

    // Lowercase check
    if (/[a-z]/.test(password)) strength += 1;
    else errors.push('one lowercase letter');

    // Number check
    if (/[0-9]/.test(password)) strength += 1;
    else errors.push('one number');

    // Special character check
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    else errors.push('one special character');

    setPasswordStrength(strength);
    
    if (strength < 3) {
      setPasswordErrorMsg(`Password must contain ${errors.slice(0, 2).join(', ')}${errors.length > 2 ? '...' : ''}`);
    } else {
      setPasswordErrorMsg('');
    }
  }, [password]);

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

    if (usernameStatus === 'taken' || usernameStatus === 'invalid') {
      setError(usernameErrorMsg || 'Invalid username');
      return;
    }

    if (emailStatus === 'taken') {
      setError('This email address is already in use');
      return;
    }

    if (emailStatus === 'invalid' || emailStatus === 'bad_domain') {
      setError(emailErrorMsg || 'Please enter a valid email address from a trusted provider (Gmail, Yahoo, Outlook, etc.)');
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
    <div className="min-h-screen pt-20 pb-10 flex items-center justify-center px-4 md:px-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-slate-50 to-slate-100 dark:from-slate-900/50 dark:via-slate-950 dark:to-slate-950 transition-colors duration-500">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-6 md:p-12 relative overflow-hidden border border-slate-100 dark:border-slate-800"
      >
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Zap size={120} />
        </div>

        {/* Progress Bar */}
        <div className="mb-8 relative mt-2 md:mt-0">
          <div className="flex justify-between mb-2 relative z-10 px-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${step >= i ? 'bg-primary text-secondary shadow-lg shadow-primary/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                {step > i ? <Check size={14} /> : i}
              </div>
            ))}
          </div>
          <div className="absolute top-4 left-6 right-6 h-1 bg-slate-100 dark:bg-slate-800 rounded-full -z-0 -translate-y-1/2">
            <motion.div 
              className="h-full bg-primary rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${(step - 1) * 50}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-secondary dark:text-white tracking-tight">
            {step === 1 ? 'Join the Network' : step === 2 ? 'Personal Details' : 'Safety & Compliance'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            {step === 1 ? 'Create your Trento Smart account' : step === 2 ? 'Tell us a bit about yourself' : 'Finalize your account setup'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-6 relative min-h-[340px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 50, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 absolute w-full"
              >
                {/* Role Selection */}
                <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded-[1.25rem] border border-slate-200 dark:border-slate-700 flex shadow-inner">
                  <button
                    type="button" onClick={() => setRole('passenger')}
                    className={`flex-1 py-3.5 rounded-xl transition-all font-black text-sm ${role === 'passenger' ? 'bg-secondary text-white shadow-md' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    Passenger
                  </button>
                  <button
                    type="button" onClick={() => setRole('driver')}
                    className={`flex-1 py-3.5 rounded-xl transition-all font-black text-sm ${role === 'driver' ? 'bg-primary text-secondary shadow-md' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    Driver
                  </button>
                </div>

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
                    {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <XCircle className="w-4 h-4 text-red-500" />}
                  </div>
                  {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <p className="text-[10px] text-red-500 font-bold mt-1 ml-2 absolute -bottom-5">{usernameErrorMsg}</p>}
                </div>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value.toLowerCase())} required
                    placeholder="Email Address"
                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-2xl py-4 pl-12 pr-12 outline-none transition-all font-medium text-slate-900 dark:text-white ${emailStatus === 'taken' || emailStatus === 'invalid' || emailStatus === 'bad_domain' ? 'border-red-400 bg-red-50/10' : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/50'}`}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                    {emailStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    {emailStatus === 'available' && <Check className="w-4 h-4 text-green-500" />}
                    {emailStatus === 'taken' && <XCircle className="w-4 h-4 text-red-500" />}
                    {emailStatus === 'invalid' && <span className="text-[9px] font-black text-red-400 uppercase tracking-tighter">Format!</span>}
                    {emailStatus === 'bad_domain' && <XCircle className="w-4 h-4 text-orange-500" />}
                  </div>
                  {(emailStatus === 'taken' || emailStatus === 'bad_domain') && <p className="text-[10px] text-red-500 font-bold mt-1 ml-2 absolute -bottom-5">{emailErrorMsg}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                      placeholder="Password"
                      className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-2xl py-4 pl-12 pr-12 outline-none transition-all font-medium text-slate-900 dark:text-white ${passwordStrength < 3 && password ? 'border-red-400 bg-red-50/10' : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/50'}`}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    {password && (
                      <div className="absolute -bottom-6 left-0 right-0 flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= passwordStrength ? (passwordStrength <= 2 ? 'bg-red-500' : passwordStrength <= 3 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-slate-200 dark:bg-slate-700'}`} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                      placeholder="Confirm"
                      className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-2xl py-4 pl-12 pr-12 outline-none transition-all font-medium text-slate-900 dark:text-white ${confirmPassword && password !== confirmPassword ? 'border-red-400 bg-red-50/10' : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/50'}`}
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    {confirmPassword && password !== confirmPassword && <p className="text-[10px] text-red-500 font-bold mt-1 ml-2 absolute -bottom-5">Passwords do not match</p>}
                  </div>
                </div>
                {password && passwordStrength < 3 && (
                  <p className="text-[10px] text-red-500 font-bold mt-6 ml-2">{passwordErrorMsg}</p>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 50, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 absolute w-full"
              >
                <div className="relative flex items-center">
                  <div className="absolute left-4 flex items-center gap-2 pointer-events-none text-slate-500 font-black">
                    🇵🇭 <span className="text-slate-300 ml-1">|</span> <span className="text-secondary dark:text-slate-300 ml-1">+63</span>
                  </div>
                  <input
                    type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="912 345 6789"
                    maxLength="10"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-28 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold text-slate-900 dark:text-white tracking-wider"
                  />
                </div>

                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text" value={dateOfBirth} onChange={handleDateChange} required
                    placeholder="Date of Birth (DD / MM / YYYY)" maxLength="10"
                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-2xl py-4 pl-12 pr-12 outline-none transition-all font-bold text-slate-900 dark:text-white ${dobStatus === 'invalid' ? 'border-red-400 bg-red-50/10' : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/50'}`}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                    {dobStatus === 'valid' && <Check className="w-4 h-4 text-green-500" />}
                    {dobStatus === 'invalid' && <XCircle className="w-4 h-4 text-red-500" />}
                  </div>
                  {dobStatus === 'invalid' && <p className="text-[10px] text-red-500 font-bold mt-1 ml-2 absolute -bottom-5">{dobErrorMsg}</p>}
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block pl-1">Gender Identity</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['male', 'female', 'other'].map(g => (
                      <button
                        key={g} type="button" onClick={() => setGender(g)}
                        className={`py-4 rounded-2xl border-2 transition-all font-bold text-sm capitalize flex flex-col items-center justify-center gap-1 ${gender === g ? 'border-primary bg-primary/10 text-primary-dark shadow-md' : 'border-slate-100 dark:border-slate-700 text-slate-500 bg-white dark:bg-slate-800 hover:border-primary/30 shadow-sm'}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 50, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 absolute w-full"
              >
                <div className="relative">
                  <Home className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text" value={address} onChange={(e) => setAddress(e.target.value)} required={role === 'driver'}
                    placeholder="Residential House/Street Address"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
                  />
                </div>

                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} required
                    placeholder="Emergency Contact Name"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-slate-900 dark:text-white"
                  />
                </div>

                {role === 'driver' && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-2xl border border-amber-200 dark:border-amber-700 mt-2 flex items-start gap-3">
                    <Zap size={20} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-200 leading-relaxed">
                      Note: Since you are registering as a Driver, you will be required to upload your LGU franchise and license documents after verifying your email.
                    </p>
                  </div>
                )}
                
                {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100 flex items-start gap-2"><XCircle size={18} className="shrink-0 mt-0.5" /> <span>{error}</span></motion.div>}
                {message && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-green-50 text-green-600 rounded-2xl text-sm font-bold border border-green-100 flex items-start gap-2"><CheckCircle size={18} className="shrink-0 mt-0.5" /> <span>{message}</span></motion.div>}
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        <div className="flex gap-4 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          {step > 1 && (
            <button
              type="button" onClick={() => setStep(step - 1)}
              className="w-14 h-14 bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 shadow-sm"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          
          {step < 3 ? (
            <button
              type="button" 
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !canGoNextStep1 : !canGoNextStep2}
              className="flex-1 bg-secondary text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              Next Step
              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <button
              type="submit" onClick={submit} disabled={loading}
              className="flex-1 bg-primary text-secondary font-black py-4 rounded-2xl hover:bg-primary-dark transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 group"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Complete Registration'}
              {!loading && <CheckCircle size={20} />}
            </button>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
            Already part of Trento Smart? <Link to="/login" className="text-secondary dark:text-primary font-black hover:underline ml-1">Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div >
  );
};

export default Register;
