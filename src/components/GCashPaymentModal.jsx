import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, CheckCircle, AlertCircle, Smartphone, Lock, ArrowLeft } from 'lucide-react';
import QRCode from 'react-qr-code';

const GCashPaymentModal = ({ isOpen, onClose, amount, onSuccess, rideId }) => {
    const [step, setStep] = useState('confirm'); // confirm, qr, pin, processing, success, error
    const [pin, setPin] = useState(['', '', '', '']);
    const [errorMsg, setErrorMsg] = useState('');
    const [transactionRef, setTransactionRef] = useState('');
    const [countdown, setCountdown] = useState(180); // 3 minutes

    useEffect(() => {
        if (isOpen && step === 'confirm') {
            // Generate transaction reference
            const ref = `GCS${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            setTransactionRef(ref);
        }
    }, [isOpen, step]);

    useEffect(() => {
        let timer;
        if (step === 'qr' && countdown > 0) {
            timer = setInterval(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [step, countdown]);

    const handlePinChange = (index, value) => {
        if (value.length <= 1 && /^\d*$/.test(value)) {
            const newPin = [...pin];
            newPin[index] = value;
            setPin(newPin);

            // Auto-focus next input
            if (value && index < 3) {
                document.getElementById(`pin-${index + 1}`)?.focus();
            }
        }
    };

    const handlePinSubmit = async () => {
        const fullPin = pin.join('');
        if (fullPin.length !== 4) {
            setErrorMsg('Please enter complete 4-digit PIN');
            return;
        }

        setStep('processing');
        setErrorMsg('');

        try {
            // Simulate GCash API call
            await new Promise(resolve => setTimeout(resolve, 2000));

            // In production, this would call your backend
            // await api.post('/payments/gcash/verify/', { 
            //     transaction_ref: transactionRef,
            //     pin: fullPin,
            //     amount: amount,
            //     ride_id: rideId
            // });

            setStep('success');

            // Call success callback after short delay
            setTimeout(() => {
                if (onSuccess) onSuccess(transactionRef);
            }, 2000);
        } catch (err) {
            setStep('error');
            setErrorMsg('Payment failed. Please try again.');
        }
    };

    const handleBack = () => {
        if (step === 'qr') setStep('confirm');
        else if (step === 'pin') setStep('qr');
        else if (step === 'error') setStep('pin');
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 50 }}
                        className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden relative z-10"
                    >
                        {/* GCash Header */}
                        <div className="bg-[#007DFF] p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 opacity-10">
                                <Smartphone size={120} className="text-white" />
                            </div>
                            <div className="relative z-10 flex items-center justify-between">
                                {step !== 'confirm' && step !== 'success' && step !== 'processing' && (
                                    <button onClick={handleBack} className="p-2 hover:bg-white/10 rounded-full transition-all">
                                        <ArrowLeft size={20} className="text-white" />
                                    </button>
                                )}
                                <div className="flex-1 text-center">
                                    <h2 className="text-2xl font-black text-white">GCash</h2>
                                    <p className="text-xs text-white/80 font-medium">Secure Payment</p>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
                                    <X size={20} className="text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {/* Step 1: Confirm Payment */}
                            {step === 'confirm' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-6"
                                >
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-[#007DFF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Smartphone size={40} className="text-[#007DFF]" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-800 mb-2">Confirm Payment</h3>
                                        <p className="text-sm text-slate-500">You are about to pay via GCash</p>
                                    </div>

                                    <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Merchant</span>
                                            <span className="text-sm font-black text-slate-800">Trento Smart</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Ride Fare</span>
                                            <span className="text-sm font-black text-slate-800">₱{amount}.00</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Service Fee</span>
                                            <span className="text-sm font-black text-slate-800">₱0.00</span>
                                        </div>
                                        <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
                                            <span className="text-sm font-bold text-slate-600">Total Amount</span>
                                            <span className="text-3xl font-black text-[#007DFF]">₱{amount}.00</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-green-50 p-3 rounded-xl">
                                        <Shield size={16} className="text-green-600" />
                                        <span className="font-medium">Secured by GCash 256-bit encryption</span>
                                    </div>

                                    <button
                                        onClick={() => setStep('qr')}
                                        className="w-full bg-[#007DFF] text-white font-black py-4 rounded-2xl hover:bg-[#0066CC] transition-all shadow-lg shadow-blue-500/20"
                                    >
                                        Proceed to Payment
                                    </button>
                                </motion.div>
                            )}

                            {/* Step 2: QR Code */}
                            {step === 'qr' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-6"
                                >
                                    <div className="text-center">
                                        <h3 className="text-xl font-black text-slate-800 mb-2">Scan QR Code</h3>
                                        <p className="text-sm text-slate-500">Open your GCash app and scan this code</p>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl border-4 border-[#007DFF]/20">
                                        <div className="bg-white p-4 rounded-xl">
                                            <QRCode
                                                value={`gcash://pay?merchant=TrentoSmart&amount=${amount}&ref=${transactionRef}`}
                                                size={200}
                                                className="mx-auto"
                                            />
                                        </div>
                                        <div className="mt-4 text-center">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Reference Number</p>
                                            <p className="text-sm font-black text-slate-800 tracking-wider">{transactionRef}</p>
                                        </div>
                                    </div>

                                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                                        <AlertCircle size={20} className="text-orange-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-orange-800 mb-1">Time Remaining</p>
                                            <p className="text-2xl font-black text-orange-600">{formatTime(countdown)}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <button
                                            onClick={() => setStep('pin')}
                                            className="w-full bg-[#007DFF] text-white font-black py-4 rounded-2xl hover:bg-[#0066CC] transition-all"
                                        >
                                            I've Scanned the QR Code
                                        </button>
                                        <p className="text-xs text-center text-slate-400 font-medium">
                                            Or enter your PIN manually below
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 3: PIN Entry */}
                            {step === 'pin' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-6"
                                >
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-[#007DFF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Lock size={40} className="text-[#007DFF]" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-800 mb-2">Enter Your PIN</h3>
                                        <p className="text-sm text-slate-500">Enter your 4-digit GCash MPIN</p>
                                    </div>

                                    <div className="flex justify-center gap-4">
                                        {pin.map((digit, index) => (
                                            <input
                                                key={index}
                                                id={`pin-${index}`}
                                                type="password"
                                                maxLength={1}
                                                value={digit}
                                                onChange={(e) => handlePinChange(index, e.target.value)}
                                                className="w-16 h-16 text-center text-2xl font-black border-2 border-slate-200 rounded-2xl focus:border-[#007DFF] focus:ring-4 focus:ring-[#007DFF]/20 outline-none transition-all"
                                            />
                                        ))}
                                    </div>

                                    {errorMsg && (
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                                            <AlertCircle size={16} className="text-red-600" />
                                            <p className="text-xs font-bold text-red-600">{errorMsg}</p>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 rounded-xl p-4">
                                        <p className="text-xs font-bold text-slate-600 mb-2">Amount to Pay</p>
                                        <p className="text-3xl font-black text-[#007DFF]">₱{amount}.00</p>
                                    </div>

                                    <button
                                        onClick={handlePinSubmit}
                                        disabled={pin.join('').length !== 4}
                                        className="w-full bg-[#007DFF] text-white font-black py-4 rounded-2xl hover:bg-[#0066CC] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Confirm Payment
                                    </button>

                                    <p className="text-xs text-center text-slate-400 font-medium">
                                        For demo: Use any 4-digit PIN
                                    </p>
                                </motion.div>
                            )}

                            {/* Step 4: Processing */}
                            {step === 'processing' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center py-12"
                                >
                                    <div className="w-20 h-20 border-4 border-slate-100 border-t-[#007DFF] rounded-full animate-spin mx-auto mb-6"></div>
                                    <h3 className="text-xl font-black text-slate-800 mb-2">Processing Payment</h3>
                                    <p className="text-sm text-slate-500">Please wait while we verify your transaction...</p>
                                    <div className="mt-6 flex items-center justify-center gap-2">
                                        <div className="w-2 h-2 bg-[#007DFF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-[#007DFF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-[#007DFF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 5: Success */}
                            {step === 'success' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-8"
                                >
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', delay: 0.2 }}
                                        className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30"
                                    >
                                        <CheckCircle size={48} className="text-white" />
                                    </motion.div>
                                    <h3 className="text-2xl font-black text-slate-800 mb-2">Payment Successful!</h3>
                                    <p className="text-sm text-slate-500 mb-6">Your ride has been paid via GCash</p>

                                    <div className="bg-slate-50 rounded-2xl p-6 space-y-3 mb-6">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Amount Paid</span>
                                            <span className="text-lg font-black text-green-600">₱{amount}.00</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Reference No.</span>
                                            <span className="text-sm font-black text-slate-800">{transactionRef}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Date & Time</span>
                                            <span className="text-sm font-black text-slate-800">{new Date().toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={onClose}
                                        className="w-full bg-[#007DFF] text-white font-black py-4 rounded-2xl hover:bg-[#0066CC] transition-all"
                                    >
                                        Done
                                    </button>
                                </motion.div>
                            )}

                            {/* Step 6: Error */}
                            {step === 'error' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center py-8"
                                >
                                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <AlertCircle size={40} className="text-red-600" />
                                    </div>
                                    <h3 className="text-xl font-black text-red-600 mb-2">Payment Failed</h3>
                                    <p className="text-sm text-slate-500 mb-6">{errorMsg}</p>

                                    <button
                                        onClick={() => {
                                            setStep('pin');
                                            setPin(['', '', '', '']);
                                            setErrorMsg('');
                                        }}
                                        className="w-full bg-[#007DFF] text-white font-black py-4 rounded-2xl hover:bg-[#0066CC] transition-all"
                                    >
                                        Try Again
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default GCashPaymentModal;
