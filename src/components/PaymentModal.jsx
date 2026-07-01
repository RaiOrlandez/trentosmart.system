import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, CheckCircle, X, ShieldCheck, Wallet, AlertCircle, Lock } from 'lucide-react';
import api from '../api/axios';

const PaymentModal = ({ isOpen, onClose, amount, method, onComplete, onGCashPayment }) => {
    const [step, setStep] = useState('confirm'); // confirm, pin, processing, success, error
    const [errorMsg, setErrorMsg] = useState('');
    const [pin, setPin] = useState('');

    const handlePay = async () => {
        if (method === 'gcash') {
            // Trigger GCash payment flow via parent component
            if (onGCashPayment) {
                onGCashPayment();
            }
            onClose();
            return;
        }

        if (method === 'wallet') {
            // Prompt for Smart Wallet transaction PIN
            setStep('pin');
            return;
        }

        // For cash payments, proceed directly
        setStep('processing');
        
        try {
            // Simulate processing time for cash payment
            await new Promise(resolve => setTimeout(resolve, 1500));
            setStep('success');
        } catch (err) {
            setErrorMsg('Payment processing failed. Please try again.');
            setStep('error');
        }
    };

    const handlePinSubmit = async (e) => {
        e.preventDefault();
        if (pin.length !== 6) {
            setErrorMsg('PIN must be 6 digits.');
            setStep('error');
            return;
        }
        
        setStep('processing');
        setErrorMsg('');
        
        try {
            await api.post('/wallet/pay/', {
                amount: parseFloat(amount),
                pin_code: pin
            });
            setStep('success');
        } catch (err) {
            setErrorMsg(err.response?.data?.detail || 'Wallet payment failed. Please check your PIN and balance.');
            setStep('error');
        }
    };

    const handleFinish = () => {
        onComplete();
        setStep('confirm');
        setPin('');
        onClose();
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
                                onClick={handlePay}
                                className={`w-full py-4 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 ${method === 'gcash' ? 'bg-[#007DFE] hover:bg-[#005ECB]' :
                                    'bg-secondary hover:bg-slate-800'
                                    }`}
                            >
                                {method === 'gcash' ? 'Continue to GCash' : method === 'wallet' ? 'Pay with Smart Wallet' : 'Confirm Cash Payment'}
                            </button>
                            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <ShieldCheck size={14} className="text-green-500" /> 
                                {method === 'gcash' ? '256-bit SSL Encrypted via PayMongo' : 'Secure Transaction'}
                            </div>
                        </div>
                    )}

                    {step === 'pin' && (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <Lock size={32} />
                            </div>
                            <h2 className="text-2xl font-black text-secondary mb-2 uppercase tracking-tight">Enter Wallet PIN</h2>
                            <p className="text-slate-500 mb-8 font-medium">Please verify your transaction with your 6-digit Security PIN.</p>
                            
                            <form onSubmit={handlePinSubmit} className="space-y-6">
                                <input
                                    type="password"
                                    maxLength="6"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                    placeholder="••••••"
                                    className="w-full text-center text-3xl tracking-[1em] font-black bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 outline-none focus:border-primary transition-all text-secondary"
                                    autoFocus
                                    required
                                />
                                
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPin('');
                                            setStep('confirm');
                                        }}
                                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={pin.length !== 6}
                                        className="flex-[2] py-4 bg-secondary hover:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg disabled:opacity-50"
                                    >
                                        Verify & Pay
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 border-4 border-slate-100 border-t-primary rounded-full animate-spin mx-auto mb-8"></div>
                            <h2 className="text-xl font-bold text-secondary mb-2">Processing Payment...</h2>
                            <p className="text-slate-500">Contacting {method === 'gcash' ? 'GCash' : 'payment gateway'} network</p>
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
