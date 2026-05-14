import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock } from 'lucide-react';

const AdminActionPinModal = ({ isOpen, onClose, onConfirm, actionName }) => {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (pin.length !== 6) return;
        setLoading(true);
        try {
            await onConfirm(pin);
            setPin('');
            onClose(); // Close modal on success
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden relative"
                >
                    <div className="bg-red-600 p-6 text-white text-center">
                        <Lock size={40} className="mx-auto mb-2 opacity-80" />
                        <h2 className="text-xl font-black uppercase tracking-widest">Master Authorization</h2>
                        <p className="text-xs font-bold opacity-80">Action: {actionName}</p>
                    </div>

                    <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
                        <X size={24} />
                    </button>

                    <div className="p-8 space-y-6">
                        <div className="text-center mb-4">
                            <p className="text-slate-500 font-bold text-sm">Enter your 6-digit Security PIN to confirm this destructive action.</p>
                        </div>
                        <input
                            type="password"
                            maxLength="6"
                            autoFocus
                            placeholder="6-Digit PIN"
                            value={pin}
                            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-red-100 dark:border-red-900/50 focus:border-red-500 outline-none transition-all"
                        />
                        <button
                            onClick={handleSubmit}
                            disabled={loading || pin.length !== 6}
                            className="w-full py-4 bg-red-600 text-white font-black rounded-2xl uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50"
                        >
                            {loading ? 'Authorizing...' : 'Authorize Action'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AdminActionPinModal;
