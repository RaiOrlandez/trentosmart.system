import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Lock, ArrowLeft, Wifi, Battery, Signal,
  ExternalLink, Loader2, AlertCircle
} from 'lucide-react';
import api from '../api/axios';

/**
 * GCashPaymentModal
 * ────────────────────────────────────────────────────────────────────
 * Renders a premium GCash-styled checkout modal that:
 *   1. Validates user intent (intro screen)
 *   2. Calls the Django backend → PayMongo API to create a GCash source
 *   3. Redirects the browser to the real GCash checkout URL
 *
 * For wallet top-ups (rideId = null), wallet credit is handled on
 * return to /wallet?status=success&source_id=... via Wallet.jsx.
 *
 * For ride payments, onSuccess is called with the source_id so the
 * caller can record the transaction.
 * ────────────────────────────────────────────────────────────────────
 */
const GCashPaymentModal = ({ isOpen, onClose, amount, onSuccess, rideId }) => {
  const [step, setStep] = useState('intro'); // intro | redirecting | error
  const [errorMsg, setErrorMsg] = useState('');
  const [currentTime] = useState(() => {
    const now = new Date();
    return `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  // Reset to intro when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStep('intro');
      setErrorMsg('');
    }
  }, [isOpen]);

  const handleProceed = async () => {
    setStep('redirecting');
    setErrorMsg('');

    try {
      const res = await api.post('/payments/gcash/create-source/', {
        amount: parseFloat(amount),
        ride_id: rideId || null
      });

      const { checkout_url, source_id } = res.data;

      // Store source_id so we can verify on return
      sessionStorage.setItem('gcash_source_id', source_id);
      sessionStorage.setItem('gcash_amount', amount);
      if (rideId) sessionStorage.setItem('gcash_ride_id', rideId);

      // If caller wants to handle the source_id immediately (e.g. for ride payment)
      if (onSuccess && rideId) {
        onSuccess(source_id);
      }

      // Redirect to real GCash payment page
      window.location.href = checkout_url;

    } catch (err) {
      const detail = err.response?.data?.detail || 'Could not connect to GCash. Please try again.';
      setErrorMsg(detail);
      setStep('error');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={step === 'redirecting' ? undefined : onClose}
            className="absolute inset-0 bg-slate-900/95 backdrop-blur-2xl"
          />

          {/* Phone Frame */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 100 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full max-w-[360px] bg-white rounded-[3rem] shadow-[0_32px_80px_rgba(0,0,0,0.6)] overflow-hidden relative z-10 font-sans border border-white/20"
          >
            {/* Simulated Status Bar */}
            <div className="bg-[#007DFE] px-6 pt-3 pb-1 flex items-center justify-between text-white/90">
              <span className="text-[10px] font-black">{currentTime}</span>
              <div className="flex items-center gap-1.5">
                <Signal size={10} />
                <Wifi size={10} />
                <Battery size={12} />
              </div>
            </div>

            {/* GCash Header */}
            <div className="bg-gradient-to-b from-[#007DFE] to-[#005ECB] px-8 pt-8 pb-10 relative overflow-hidden text-center">
              <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/5 rounded-full blur-3xl" />
              <div className="absolute bottom-[-20%] left-[-10%] w-40 h-40 bg-blue-300/10 rounded-full blur-2xl" />

              <motion.div
                initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
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
                  <span className="text-[8px] text-blue-100 font-black uppercase tracking-[0.1em]">Powered by PayMongo</span>
                </div>
              </motion.div>

              {/* Progress dots */}
              <div className="absolute bottom-4 left-0 w-full flex justify-center gap-1.5">
                {['intro', 'redirecting'].map((s) => (
                  <div key={s} className={`h-1 rounded-full transition-all duration-500 ${step === s ? 'w-6 bg-white' : 'w-2 bg-white/30'}`} />
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="p-8 pb-10">

              {/* ─── INTRO STEP ─── */}
              {step === 'intro' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-8">
                  {/* Merchant info */}
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Merchant</p>
                      <div className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                        <span className="text-[8px] font-black uppercase tracking-tighter">✓ Verified</span>
                      </div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">TransMart Trento</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">LGU Official Partner Portal</p>
                  </div>

                  {/* Amount card */}
                  <div className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100 relative">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Checkout Amount</p>
                    <h4 className="text-6xl font-black text-[#007DFE] tracking-tighter">
                      ₱{parseFloat(amount).toLocaleString()}<span className="text-2xl opacity-40 ml-1">.00</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-3 font-medium">You will be redirected to the GCash secure payment page.</p>
                  </div>

                  {/* Pay button */}
                  <button
                    onClick={handleProceed}
                    className="w-full bg-[#007DFE] text-white font-black py-5 rounded-[1.5rem] shadow-[0_15px_30px_rgba(0,125,254,0.3)] hover:translate-y-[-2px] hover:shadow-[0_20px_40px_rgba(0,125,254,0.4)] transition-all flex items-center justify-center gap-3 active:scale-95"
                  >
                    <Shield size={20} />
                    <span>Pay with GCash</span>
                    <ExternalLink size={14} />
                  </button>

                  <button
                    onClick={onClose}
                    className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 font-bold py-2 hover:text-slate-600 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Choose different method
                  </button>
                </motion.div>
              )}

              {/* ─── REDIRECTING STEP ─── */}
              {step === 'redirecting' && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center py-12 space-y-8 text-center"
                >
                  <div className="relative">
                    <div className="w-24 h-24 border-[5px] border-slate-100 rounded-full" />
                    <div className="absolute inset-0 border-[5px] border-[#007DFE] rounded-full border-t-transparent animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 size={36} className="text-[#007DFE] animate-spin" style={{ animationDuration: '1.5s' }} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Redirecting to GCash</h3>
                    <p className="text-xs text-slate-400 mt-2 font-medium">Preparing a secure checkout session…</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-blue-600 bg-blue-50 px-4 py-2 rounded-full font-bold">
                    <Lock size={10} />
                    <span>256-bit encrypted via PayMongo</span>
                  </div>
                </motion.div>
              )}

              {/* ─── ERROR STEP ─── */}
              {step === 'error' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center py-8 space-y-6 text-center"
                >
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle size={40} className="text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">GCash Unavailable</h3>
                    <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">{errorMsg}</p>
                  </div>
                  <button
                    onClick={() => setStep('intro')}
                    className="w-full bg-[#007DFE] text-white font-black py-4 rounded-[1.5rem] transition-all active:scale-95"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={onClose}
                    className="text-sm text-slate-400 font-bold hover:text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </motion.div>
              )}

            </div>

            {/* Home Indicator */}
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
