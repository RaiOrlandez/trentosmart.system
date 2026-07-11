import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';
import api from '../api/axios';

const SecurityPINModal = ({ isOpen, onClose, onSuccess = null }) => {
    const [step, setStep] = useState('loading'); // loading, setup, verify_old, set_new, success
    const [hasPin, setHasPin] = useState(false);
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [oldPin, setOldPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) checkPinStatus();
    }, [isOpen]);

    const checkPinStatus = async () => {
        try {
            const res = await api.get('/security/pin/');
            setHasPin(res.data.has_pin);
            setStep(res.data.has_pin ? 'verify_old' : 'setup');
        } catch (err) {
            console.error(err);
            setError("Failed to verify security status.");
        }
    };

    const handleCreate = async () => {
        if (pin.length !== 6) {
            setError("PIN must be 6 digits.");
            return;
        }
        if (pin !== confirmPin) {
            setError("PINs do not match.");
            return;
        }

        setLoading(true);
        try {
            await api.post('/security/pin/', { pin });
            setStep('success');
            setHasPin(true);
            if (onSuccess) onSuccess();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to set PIN.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (pin.length !== 6) {
            setError("New PIN must be 6 digits.");
            return;
        }
        if (pin !== confirmPin) {
            setError("PINs do not match.");
            return;
        }

        setLoading(true);
        try {
            await api.put('/security/pin/', { old_pin: oldPin, new_pin: pin });
            setStep('success');
            if (onSuccess) onSuccess();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to update PIN. Check old PIN.");
        } finally {
            setLoading(false);
        }
    };

    const verifyOldPin = () => {
        // In a real app we might verify against API first, but PUT endpoint handles it. 
        // So here we just move to next step to let user enter new pin. 
        // Ideally we check old pin validity first if we want UX separation, but for now we bundle it.
        // Wait, let's keep it simple: "verify_old" just asks for old pin, then we move to "set_new"
        if (oldPin.length !== 6) {
            setError("Enter valid 6-digit old PIN");
            return;
        }
        setStep('set_new');
        setError('');
    };

    const resetState = () => {
        setPin('');
        setConfirmPin('');
        setOldPin('');
        setError('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden relative"
                >
                    <div className="bg-secondary p-6 text-white text-center">
                        <Lock size={40} className="mx-auto mb-2 opacity-80" />
                        <h2 className="text-xl font-black uppercase tracking-widest">Transaction Security</h2>
                        <p className="text-xs font-bold opacity-60">Protect your funds with a 6-digit PIN</p>
                    </div>

                    <button onClick={resetState} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
                        <X size={24} />
                    </button>

                    <div className="p-8">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-bold mb-6 text-center animate-pulse">
                                {error}
                            </div>
                        )}

                        {step === 'loading' && (
                            <div className="flex justify-center py-8">
                                <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}

                        {step === 'setup' && (
                            <div className="space-y-6">
                                <div className="text-center mb-4">
                                    <p className="text-slate-500 font-bold text-sm">Create your new PIN</p>
                                </div>
                                <input
                                    type="password"
                                    maxLength="6"
                                    placeholder="Enter 6-digit PIN"
                                    value={pin}
                                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-white/5 focus:border-secondary outline-none transition-all"
                                />
                                <input
                                    type="password"
                                    maxLength="6"
                                    placeholder="Confirm PIN"
                                    value={confirmPin}
                                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-white/5 focus:border-secondary outline-none transition-all"
                                />
                                <button
                                    onClick={handleCreate}
                                    disabled={loading || pin.length !== 6 || confirmPin.length !== 6}
                                    className="w-full py-4 bg-secondary text-white font-black rounded-2xl uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Securing Account...' : 'Set Security PIN'}
                                </button>
                            </div>
                        )}

                        {step === 'verify_old' && (
                            <div className="space-y-6">
                                <div className="text-center mb-4">
                                    <h3 className="text-lg font-bold text-secondary dark:text-white">Change Existing PIN</h3>
                                    <p className="text-slate-400 text-xs mt-1">Enter your current PIN to proceed</p>
                                </div>
                                <input
                                    type="password"
                                    maxLength="6"
                                    autoFocus
                                    value={oldPin}
                                    onChange={e => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-white/5 focus:border-secondary outline-none transition-all"
                                />
                                <button
                                    onClick={verifyOldPin}
                                    disabled={oldPin.length !== 6}
                                    className="w-full py-4 bg-secondary text-white font-black rounded-2xl uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
                                >
                                    Verify PIN
                                </button>
                            </div>
                        )}

                        {step === 'set_new' && (
                            <div className="space-y-6">
                                <div className="text-center mb-4">
                                    <h3 className="text-lg font-bold text-secondary dark:text-white">Set New PIN</h3>
                                    <p className="text-slate-400 text-xs mt-1">Enter your new 6-digit PIN</p>
                                </div>
                                <input
                                    type="password"
                                    maxLength="6"
                                    placeholder="New PIN"
                                    value={pin}
                                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-white/5 focus:border-secondary outline-none transition-all"
                                />
                                <input
                                    type="password"
                                    maxLength="6"
                                    placeholder="Confirm New PIN"
                                    value={confirmPin}
                                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-white/5 focus:border-secondary outline-none transition-all"
                                />
                                <button
                                    onClick={handleUpdate}
                                    disabled={loading || pin.length !== 6 || confirmPin.length !== 6}
                                    className="w-full py-4 bg-secondary text-white font-black rounded-2xl uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Updating...' : 'Update PIN'}
                                </button>
                                <button onClick={() => { setStep('verify_old'); setOldPin(''); }} className="w-full py-2 text-slate-400 font-bold text-xs uppercase hover:text-secondary">
                                    Cancel
                                </button>
                            </div>
                        )}

                        {step === 'success' && (
                            <div className="text-center py-8">
                                <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4 animate-bounce" />
                                <h3 className="text-2xl font-black text-secondary dark:text-white mb-2">Secure & Locked</h3>
                                <p className="text-slate-500 text-sm font-medium mb-8">Your Transaction PIN has been successfully updated.</p>
                                <button
                                    onClick={resetState}
                                    className="w-full py-4 bg-secondary text-white font-black rounded-2xl uppercase tracking-widest hover:bg-slate-800 transition-all"
                                >
                                    Close Security Settings
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default SecurityPINModal;
