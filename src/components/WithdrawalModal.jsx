import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, CheckCircle2, AlertCircle, Smartphone, Banknote, ShieldCheck } from 'lucide-react';
import api from '../api/axios';

const WithdrawalModal = ({ isOpen, onClose, balance, onWithdrawalSuccess }) => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('GCash');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [step, setStep] = useState(1); // 1: Form, 1.5: PIN, 2: Processing, 3: Success
    const [pin, setPin] = useState('');

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (parseFloat(amount) > balance) {
            setError("Insufficient balance.");
            return;
        }
        setStep(1.5); // Move to PIN step
    };

    const handlePinSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await api.post('/withdrawals/', {
                amount: parseFloat(amount),
                method,
                account_number: accountNumber,
                account_name: accountName,
                pin_code: pin // Include PIN
            });
            setStep(3);
            if (onWithdrawalSuccess) onWithdrawalSuccess();
        } catch (err) {
            setError(err.response?.data?.detail || "Invalid Security PIN or Failed Request.");
            setStep(1); // Reset to form on error so they can try again or fix amount
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-secondary/80 backdrop-blur-xl"
                />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 50 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 50 }}
                    className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden relative z-10"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-br from-primary via-orange-400 to-secondary p-8 text-white relative overflow-hidden">
                        <div className="relative z-10 flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tight">Withdraw Earnings</h3>
                                <p className="text-white/80 text-sm font-bold">Transfer funds to your e-wallet</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        <Wallet size={120} className="absolute -right-8 -bottom-8 text-white/10 rotate-12" />
                    </div>

                    <div className="p-8">
                        {step === 1 && (
                            <form onSubmit={handleFormSubmit} className="space-y-6">
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Withdrawable Balance</p>
                                    <p className="text-2xl font-black text-secondary dark:text-white">₱{balance.toLocaleString()}</p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Amount to Withdraw (₱)</label>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="Enter amount"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-white/5 rounded-2xl px-6 py-4 font-bold focus:border-primary outline-none transition-all dark:text-white"
                                            required
                                            min="100"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Transfer Method</label>
                                            <select
                                                value={method}
                                                onChange={(e) => setMethod(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-white/5 rounded-2xl px-6 py-4 font-bold focus:border-primary outline-none transition-all dark:text-white"
                                            >
                                                <option value="GCash">GCash</option>
                                                <option value="PayMaya">PayMaya</option>
                                                <option value="Bank Transfer">Bank Transfer</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Account Name</label>
                                            <input
                                                type="text"
                                                value={accountName}
                                                onChange={(e) => setAccountName(e.target.value)}
                                                placeholder="Juan Dela Cruz"
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-white/5 rounded-2xl px-6 py-4 font-bold focus:border-primary outline-none transition-all dark:text-white"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Account Number / Phone</label>
                                        <div className="relative">
                                            <Smartphone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                value={accountNumber}
                                                onChange={(e) => setAccountNumber(e.target.value)}
                                                placeholder="0917 XXX XXXX"
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-white/5 rounded-2xl pl-14 pr-6 py-4 font-bold focus:border-primary outline-none transition-all dark:text-white"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-bold border border-red-100 dark:border-red-900/30">
                                        <AlertCircle size={18} />
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-secondary dark:bg-primary text-white dark:text-secondary py-4 rounded-xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50 mt-4"
                                >
                                    Proceed to Security Check
                                </button>


                                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    <ShieldCheck size={12} />
                                    <span>Secure 256-bit Encrypted Transaction</span>
                                </div>
                            </form>
                        )}

                        {step === 1.5 && (
                            <form onSubmit={handlePinSubmit} className="space-y-6">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                                        <ShieldCheck size={32} />
                                    </div>
                                    <h3 className="text-xl font-black text-secondary dark:text-white uppercase">Security Verification</h3>
                                    <p className="text-slate-500 text-sm font-bold mt-2">Enter your 6-digit transaction PIN</p>
                                </div>

                                <input
                                    type="password"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.slice(0, 6))}
                                    placeholder="• • • • • •"
                                    className="w-full text-center text-4xl tracking-[1em] font-black bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-white/5 rounded-2xl py-6 focus:border-primary outline-none transition-all dark:text-white"
                                    maxLength="6"
                                    required
                                    autoFocus
                                />

                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || pin.length !== 6}
                                        className="flex-1 bg-secondary dark:bg-primary text-white dark:text-secondary py-4 rounded-xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? 'Verifying...' : 'Confirm Withdrawal'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {step === 3 && (
                            <div className="text-center py-10">
                                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle2 size={40} />
                                </div>
                                <h4 className="text-2xl font-black text-secondary dark:text-white mb-2">Request Received!</h4>
                                <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
                                    Your withdrawal of ₱{parseFloat(amount).toLocaleString()} is being processed.
                                    It will be credited to your account within 24 hours.
                                </p>
                                <button
                                    onClick={onClose}
                                    className="btn-secondary w-full py-4 rounded-2xl font-black"
                                >
                                    Back to Dashboard
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default WithdrawalModal;
