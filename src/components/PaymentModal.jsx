import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, CheckCircle, X, ShieldCheck, Wallet, AlertCircle } from 'lucide-react';
import api from '../api/axios';

const PaymentModal = ({ isOpen, onClose, amount, method, onComplete }) => {
    const [step, setStep] = useState('confirm'); // confirm, pin, processing, success, error
    const [errorMsg, setErrorMsg] = useState('');
    const [pin, setPin] = useState('');

    const startPayment = () => {
        if (method === 'wallet') {
            setStep('pin');
        } else {
            handlePay();
        }
    };

    const handlePay = async () => {
        setStep('processing');

        if (method === 'wallet') {
            try {
                // In a real flow, we would hit a specific payment endpoint
                // For this simulation, we'll hit topup with a negative value or a new payment endpoint
                // Let's assume we have /wallet/pay/ 
                await api.post('/wallet/pay/', { amount, pin_code: pin });
                setStep('success');
            } catch (err) {
                setStep('error');
                setErrorMsg(err.response?.data?.detail || 'Incorrect PIN or Insufficient balance in your Smart Wallet.');
            }
        } else {
            // Simulate external gateway
            setTimeout(() => {
                setStep('success');
            }, 2000);
        }
    };

    const handleFinish = () => {
        onComplete();
        setStep('confirm');
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-secondary/80 backdrop-blur-sm">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-8 relative"
                >
                    <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>

                    {step === 'confirm' && (
                        <div className="text-center">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${method === 'gcash' ? 'bg-blue-600 text-white' :
                                method === 'wallet' ? 'bg-primary text-secondary' :
                                    'bg-secondary text-white'
                                }`}>
                                {method === 'wallet' ? <Wallet size={32} /> : <CreditCard size={32} />}
                            </div>
                            <h2 className="text-2xl font-black text-secondary mb-2 uppercase tracking-tight">Confirm Payment</h2>
                            <p className="text-slate-500 mb-8 font-medium">You are about to pay for your ride in Trento.</p>

                            <div className="bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100">
                                <div className="flex justify-between items-center mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <span>Fare Amount</span>
                                    <span>Service Fee</span>
                                </div>
                                <div className="flex justify-between items-center mb-4 font-bold text-secondary">
                                    <span>₱{amount}.00</span>
                                    <span>₱0.00</span>
                                </div>
                                <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
                                    <span className="font-bold text-slate-600">Total</span>
                                    <span className="text-2xl font-black text-primary-dark">₱{amount}.00</span>
                                </div>
                            </div>

                            <button
                                onClick={startPayment}
                                className={`w-full py-4 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 ${method === 'gcash' ? 'bg-blue-600 hover:bg-blue-700' :
                                    method === 'wallet' ? 'bg-primary text-secondary hover:bg-white border-2 border-primary' :
                                        'bg-secondary hover:bg-slate-800'
                                    }`}
                            >
                                {method === 'wallet' ? 'Pay with Smart Wallet' : `Simulate ${method.toUpperCase()} Payment`}
                            </button>
                            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <ShieldCheck size={14} className="text-green-500" /> Secure Encryption Active
                            </div>
                        </div>
                    )}

                    {step === 'pin' && (
                        <div className="text-center">
                            <h2 className="text-xl font-black text-secondary uppercase mb-6">Security Check</h2>
                            <p className="text-slate-500 font-bold text-sm mb-4">Enter your 6-digit Wallet PIN</p>

                            <input
                                type="password"
                                value={pin}
                                onChange={(e) => setPin(e.target.value.slice(0, 6))}
                                placeholder="• • • • • •"
                                className="w-full text-center text-4xl tracking-[1em] font-black bg-slate-50 border-2 border-slate-100 rounded-2xl py-6 focus:border-primary outline-none transition-all mb-6"
                                maxLength="6"
                                autoFocus
                            />

                            <button
                                onClick={handlePay}
                                disabled={pin.length !== 6}
                                className="w-full bg-secondary text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all disabled:opacity-50"
                            >
                                Verify & Pay
                            </button>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 border-4 border-slate-100 border-t-primary rounded-full animate-spin mx-auto mb-8"></div>
                            <h2 className="text-xl font-bold text-secondary mb-2">Processing Payment...</h2>
                            <p className="text-slate-500">Contacting {
                                method === 'gcash' ? 'GCash' :
                                    method === 'wallet' ? 'Smart Wallet' :
                                        'payment gateway'
                            } network</p>
                        </div>
                    )}

                    {step === 'error' && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertCircle size={40} />
                            </div>
                            <h2 className="text-2xl font-black text-red-600 mb-2 uppercase tracking-tight">Payment Failed</h2>
                            <p className="text-slate-500 mb-8 font-medium">{errorMsg}</p>

                            <button
                                onClick={() => setStep('confirm')}
                                className="w-full bg-secondary text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="text-center">
                            <motion.div
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200"
                            >
                                <CheckCircle size={40} />
                            </motion.div>
                            <h2 className="text-2xl font-black text-secondary mb-2 uppercase tracking-tight">Payment Success!</h2>
                            <p className="text-slate-500 mb-8 font-medium">Your ride has been paid successfully. Receipt sent to your email.</p>

                            <button
                                onClick={handleFinish}
                                className="w-full bg-secondary text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PaymentModal;
