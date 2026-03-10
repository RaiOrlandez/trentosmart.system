import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, CheckCircle, AlertCircle, Smartphone, Lock, ArrowLeft, CreditCard, RefreshCcw, Download, Share2, Wifi, Battery, Signal, Check } from 'lucide-react';

const GCashPaymentModal = ({ isOpen, onClose, amount, onSuccess, rideId }) => {
    const [step, setStep] = useState('intro'); // intro, login, pin, processing, success
    const [phoneNumber, setPhoneNumber] = useState('');
    const [pin, setPin] = useState(['', '', '', '']);
    const [transactionRef, setTransactionRef] = useState('');
    const [processingMsg, setProcessingMsg] = useState('Connecting to GCash...');
    const [currentTime, setCurrentTime] = useState('9:41');

    useEffect(() => {
        if (isOpen && (step === 'intro' || step === 'success')) {
            if (!transactionRef) {
                const ref = `${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`;
                setTransactionRef(ref);
            }

            // Set current time for mobile UI simulation
            const now = new Date();
            setCurrentTime(`${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`);
        }
    }, [isOpen, step]);

    const handlePinChange = (index, value) => {
        if (value.length <= 1 && /^\d*$/.test(value)) {
            const newPin = [...pin];
            newPin[index] = value;
            setPin(newPin);
            if (value && index < 3) {
                document.getElementById(`pin-${index + 1}`)?.focus();
            }
        }
    };

    const handlePay = () => {
        setStep('processing');
        const msgs = [
            'Securing Connection...',
            'Encrypting Transaction...',
            'Verifying MPIN...',
            'Finalizing Payment...'
        ];

        msgs.forEach((m, i) => {
            setTimeout(() => setProcessingMsg(m), i * 600);
        });

        setTimeout(() => {
            setStep('success');
            setTimeout(() => {
                if (onSuccess) onSuccess(transactionRef);
            }, 6000); // Give user time to see the beautiful receipt
        }, 2500);
    };

    if (!isOpen) return null;

    // Authentic GCash 'G' Logo Component
    const GCashLogo = ({ size = "lg" }) => (
        <div className={`relative ${size === "lg" ? "w-16 h-16" : "w-10 h-10"} bg-white rounded-full flex items-center justify-center shadow-xl`}>
            <svg viewBox="0 0 100 100" className={`${size === "lg" ? "w-10 h-10" : "w-6 h-6"}`}>
                <circle cx="50" cy="50" r="45" fill="#007DFE" />
                <path
                    d="M50,20 C33.4,20 20,33.4 20,50 C20,66.6 33.4,80 50,80 C66.6,80 80,66.6 80,50 C80,33.4 66.6,20 50,20 Z M65,48 L45,48 L45,65 L35,65 L35,35 L65,35 L65,48 Z"
                    fill="white"
                />
            </svg>
        </div>
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-secondary/95 backdrop-blur-2xl"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 100 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 100 }}
                        className="w-full max-w-[360px] bg-white rounded-[3rem] shadow-[0_32px_80px_rgba(0,0,0,0.5)] overflow-hidden relative z-10 font-sans border border-white/20"
                    >
                        {/* Simulated Mobile Status Bar */}
                        <div className="bg-[#007DFE] px-6 pt-3 flex items-center justify-between text-white/90">
                            <span className="text-[10px] font-black">{currentTime}</span>
                            <div className="flex items-center gap-1.5">
                                <Signal size={10} />
                                <Wifi size={10} />
                                <Battery size={12} className="rotate-0" />
                            </div>
                        </div>

                        {/* GCash Premium Header */}
                        <div className="bg-gradient-to-b from-[#007DFE] to-[#005ECB] px-8 pt-8 pb-10 relative overflow-hidden text-center">
                            <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/5 rounded-full blur-3xl" />
                            <div className="absolute bottom-[-20%] left-[-10%] w-40 h-40 bg-blue-300/10 rounded-full blur-2xl" />

                            <motion.div
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="relative z-10 flex flex-col items-center"
                            >
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl">
                                    <svg viewBox="0 0 100 100" className="w-10 h-10">
                                        <circle cx="50" cy="50" r="48" fill="#007DFE" />
                                        <text x="50" y="65" textAnchor="middle" fill="white" fontSize="45" fontWeight="900" fontStyle="italic">G</text>
                                    </svg>
                                </div>
                                <h1 className="text-white text-2xl font-black tracking-[-0.02em] mt-3">GCash</h1>
                                <div className="flex items-center gap-1.5 mt-2 bg-white/10 px-3 py-1 rounded-full backdrop-blur-md">
                                    <Lock size={10} className="text-blue-200" />
                                    <span className="text-[8px] text-blue-100 font-black uppercase tracking-[0.1em]">Secure Transaction</span>
                                </div>
                            </motion.div>

                            {/* Step Indicator */}
                            <div className="absolute bottom-4 left-0 w-full flex justify-center gap-1.5">
                                {['intro', 'login', 'pin'].map((s, i) => {
                                    const steps = ['intro', 'login', 'pin', 'processing', 'success'];
                                    const currentIdx = steps.indexOf(step);
                                    const stepIdx = steps.indexOf(s);
                                    return (
                                        <div key={s} className={`h-1 rounded-full transition-all duration-500 ${step === s ? "w-6 bg-white" :
                                                currentIdx > stepIdx ? "w-2 bg-blue-400" : "w-2 bg-white/20"
                                            }`} />
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-8 pb-10">
                            {step === 'intro' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-8">
                                    <div>
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Merchant</p>
                                            <div className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                                                <Check size={8} strokeWidth={4} />
                                                <span className="text-[8px] font-black uppercase tracking-tighter">Verified Merchant</span>
                                            </div>
                                        </div>
                                        <h3 className="text-2xl font-black text-secondary tracking-tight">TransMart Trento</h3>
                                        <p className="text-xs text-slate-500 font-medium mt-1">LGU Official Partner Portal</p>
                                    </div>

                                    <div className="bg-slate-50/80 rounded-[2.5rem] p-10 border border-slate-100 relative group">
                                        <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-blue-500/20" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Checkout Amount</p>
                                        <h4 className="text-6xl font-black text-[#007DFE] tracking-tighter">₱{amount}<span className="text-2xl opacity-40 ml-1">.00</span></h4>
                                    </div>

                                    <button
                                        onClick={() => setStep('login')}
                                        className="w-full bg-[#007DFE] text-white font-black py-5 rounded-[1.5rem] shadow-[0_15px_30px_rgba(0,125,254,0.3)] hover:translate-y-[-2px] hover:shadow-[0_20px_40px_rgba(0,125,254,0.4)] transition-all flex items-center justify-center gap-3 active:scale-95"
                                    >
                                        <Shield size={20} />
                                        <span>Log in with GCash</span>
                                    </button>
                                </motion.div>
                            )}

                            {step === 'login' && (
                                <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-8">
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setStep('intro')} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-secondary hover:bg-slate-100 transition-colors">
                                            <ArrowLeft size={18} />
                                        </button>
                                        <h3 className="text-2xl font-black text-secondary tracking-tight">Login Credentials</h3>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Mobile Number</p>
                                            <div className="relative group">
                                                <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-3 border-r border-slate-200">
                                                    <img src="https://flagcdn.com/w20/ph.png" className="w-4 h-3 rounded-sm shadow-sm" alt="PH" />
                                                    <span className="text-slate-600 font-extrabold text-sm">+63</span>
                                                </div>
                                                <input
                                                    type="tel"
                                                    placeholder="9XX XXX XXXX"
                                                    autoFocus
                                                    className="w-full pl-24 pr-6 py-5 bg-slate-50 border-2 border-slate-50 rounded-[1.25rem] font-black text-secondary text-lg focus:border-[#007DFE] focus:bg-white transition-all outline-none"
                                                    value={phoneNumber}
                                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setStep('pin')}
                                            disabled={phoneNumber.length < 10}
                                            className="w-full bg-[#007DFE] text-white font-black py-5 rounded-[1.5rem] shadow-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:shadow-blue-200 active:scale-95"
                                        >
                                            <span>Next</span>
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-center text-slate-400 font-black px-4 leading-relaxed uppercase tracking-tighter">
                                        Your session is protected by <span className="text-[#007DFE]">GCash Trust</span>
                                    </p>
                                </motion.div>
                            )}

                            {step === 'pin' && (
                                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-10 text-center">
                                    <div>
                                        <h3 className="text-3xl font-black text-secondary tracking-tight mb-2">Enter MPIN</h3>
                                        <p className="text-xs text-slate-500 font-bold bg-slate-100 py-1.5 px-4 rounded-full inline-block italic">Verification for Mobile +63-{phoneNumber.slice(0, 3)} ••• {phoneNumber.slice(-4)}</p>
                                    </div>

                                    <div className="flex justify-center gap-3">
                                        {pin.map((digit, idx) => (
                                            <input
                                                key={idx} id={`pin-${idx}`} type="password" maxLength={1}
                                                className="w-14 h-18 text-center text-4xl font-black border-2 border-slate-100 bg-slate-50 rounded-[1.25rem] focus:border-[#007DFE] focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all shadow-sm"
                                                value={digit} onChange={(e) => handlePinChange(idx, e.target.value)}
                                            />
                                        ))}
                                    </div>

                                    <button
                                        onClick={handlePay}
                                        disabled={pin.join('').length < 4}
                                        className="w-full bg-secondary text-white font-black py-6 rounded-[1.5rem] shadow-2xl disabled:opacity-50 hover:bg-slate-800 transition-all active:scale-95 text-lg"
                                    >
                                        Confirm & Pay ₱{amount}.00
                                    </button>
                                </motion.div>
                            )}

                            {step === 'processing' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-12 space-y-10">
                                    <div className="relative">
                                        <div className="w-32 h-32 border-[6px] border-slate-50 rounded-full shadow-inner" />
                                        <div className="absolute inset-0 border-[6px] border-[#007DFE] rounded-full border-t-transparent animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center text-[#007DFE]">
                                            <RefreshCcw size={48} className="animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-2xl font-black text-secondary tracking-tight mb-2">{processingMsg}</h3>
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {step === 'success' && (
                                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-8 -mt-2">
                                    <div className="flex flex-col items-center text-center">
                                        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-[0_15px_40px_rgba(34,197,94,0.4)] mb-6 ring-8 ring-green-50">
                                            <CheckCircle size={56} className="text-white" />
                                        </div>
                                        <h3 className="text-3xl font-black text-secondary tracking-tight">Payment Successful!</h3>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">Ref: {transactionRef}</p>
                                    </div>

                                    {/* High Fidelity Receipt Slip */}
                                    <div className="bg-slate-50 rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-5 flex justify-between items-center text-white">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                                    <span className="text-[#007DFE] text-[10px] font-black italic">G</span>
                                                </div>
                                                <span className="text-[9px] font-black uppercase tracking-wider">GCash Receipt</span>
                                            </div>
                                            <Shield size={14} className="text-blue-100" />
                                        </div>
                                        <div className="p-8 space-y-6">
                                            <div className="flex justify-between items-start">
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Paid</span>
                                                <span className="text-3xl font-black text-green-600 tracking-tight leading-none">₱{amount}.00</span>
                                            </div>
                                            <div className="w-full h-px bg-slate-200 border-dashed border-t" />
                                            <div className="flex justify-between items-start">
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Merchant</span>
                                                <span className="text-xs font-black text-secondary text-right">TransMart Transportation<br /><span className="text-[9px] text-blue-500 font-bold uppercase">Official LGU Partner</span></span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Transaction</span>
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full">
                                                    <span className="text-[10px] font-black uppercase tracking-tighter">Completed</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-white px-8 py-6 flex justify-between gap-3 border-t border-slate-200">
                                            <button className="flex-1 py-4 bg-slate-50 border border-slate-100 rounded-[1rem] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors">
                                                <Download size={14} />
                                                <span>Save Picture</span>
                                            </button>
                                            <button className="flex-1 py-4 bg-[#007DFE] text-white rounded-[1rem] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200">
                                                <Share2 size={14} />
                                                <span>Send Receipt</span>
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Professional Home Indicator */}
                        <div className="h-4 bg-white flex items-center justify-center pb-2">
                            <div className="w-20 h-1.5 bg-slate-100 rounded-full" />
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default GCashPaymentModal;
