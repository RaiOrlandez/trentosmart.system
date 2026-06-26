import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../../api/axios';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail, ArrowRight, Loader2, CheckCircle, RefreshCcw } from 'lucide-react';

const VerifyEmail = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const emailFromQuery = queryParams.get('email') || '';

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [resending, setResending] = useState(false);
    const [resendMessage, setResendMessage] = useState(null);

    // Focus first input on mount
    useEffect(() => {
        const firstInput = document.getElementById('otp-0');
        if (firstInput) firstInput.focus();
    }, []);

    const handleChange = (index, value) => {
        if (isNaN(value)) return; // Only numbers
        
        const newOtp = [...otp];
        newOtp[index] = value.substring(value.length - 1);
        setOtp(newOtp);

        // Move to next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            if (prevInput) prevInput.focus();
        }
    };

    const handleVerify = async (e) => {
        if (e) e.preventDefault();
        const fullOtp = otp.join('');
        if (fullOtp.length !== 6) {
            setError('Please enter the full 6-digit code.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await api.post('/auth/verify-email/', {
                email: emailFromQuery,
                otp: fullOtp
            });
            setSuccess(true);
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Verification failed. Please check the code.');
        } finally {
            setLoading(false);
        }
    };

    const [resendCooldown, setResendCooldown] = useState(0);

    // Cooldown timer for resend button
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        if (!emailFromQuery) {
            setResendMessage('No email address found. Please register again.');
            return;
        }
        setResending(true);
        setResendMessage(null);
        try {
            const res = await api.post('/auth/resend-otp/', { email: emailFromQuery });
            setResendMessage(res.data.detail || 'A new code has been sent to your email.');
            setResendCooldown(60); // 60-second cooldown between resends
            setOtp(['', '', '', '', '', '']); // Clear old code
            document.getElementById('otp-0')?.focus();
        } catch (err) {
            if (err.response?.status === 429) {
                setResendMessage('Too many requests. Please wait a few minutes before trying again.');
            } else {
                setResendMessage(err.response?.data?.detail || 'Failed to resend code. Please try again.');
            }
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-slate-50 to-slate-100 dark:from-slate-900/50 dark:via-slate-950 dark:to-slate-950">
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 md:p-10 border border-slate-100 dark:border-slate-800 text-center"
            >
                <div className="w-16 h-16 bg-primary/20 text-primary-dark dark:text-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <ShieldCheck size={32} />
                </div>

                <h2 className="text-3xl font-black text-secondary dark:text-white mb-2 tracking-tight">Security Check</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
                    We've sent a 6-digit verification code to <br />
                    <span className="text-secondary dark:text-white font-bold">{emailFromQuery || 'your email'}</span>
                </p>

                {success ? (
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-8">
                        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-secondary dark:text-white">Email Verified!</h3>
                        <p className="text-slate-500 text-sm">Redirecting you to login...</p>
                    </motion.div>
                ) : (
                    <form onSubmit={handleVerify} className="space-y-8">
                        <div className="flex justify-between gap-2">
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    id={`otp-${index}`}
                                    type="text"
                                    maxLength="1"
                                    value={digit}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    className="w-12 h-14 md:w-14 md:h-16 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-center text-2xl font-black text-secondary dark:text-white focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none transition-all"
                                />
                            ))}
                        </div>

                        {error && (
                            <p className="text-sm font-bold text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl italic">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-secondary text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2 group disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Verify Account'}
                            {!loading && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
                        </button>

                        <div className="pt-4">
                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={resending || resendCooldown > 0}
                                className="text-sm font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw size={14} />}
                                {resendCooldown > 0
                                    ? `Resend available in ${resendCooldown}s`
                                    : 'Resend Verification Code'}
                            </button>
                            {resendMessage && <p className={`text-[10px] font-bold mt-2 ${resendMessage.includes('sent') ? 'text-primary' : 'text-red-500'}`}>{resendMessage}</p>}
                        </div>
                    </form>
                )}

                <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800">
                    <Link to="/login" className="text-sm font-bold text-slate-400 hover:text-secondary dark:hover:text-primary transition-colors">
                        Back to Sign In
                    </Link>
                </div>
            </motion.div>
        </div>
    );
};

export default VerifyEmail;
