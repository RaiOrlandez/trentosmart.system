import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Settings, RefreshCw, AlertTriangle } from 'lucide-react';

const LocationPermissionModal = ({ isOpen, onRetry, error }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
                />
                
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 text-center border border-slate-100 dark:border-white/10 overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-bl-[5rem] -z-0"></div>

                    <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mx-auto mb-6 relative z-10 shadow-inner">
                        <MapPin className="text-red-500" size={40} />
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-lg">
                            <AlertTriangle className="text-orange-500" size={16} />
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-secondary dark:text-white mb-3 relative z-10">
                        Location Access Required
                    </h2>
                    
                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-6 relative z-10 leading-relaxed">
                        Transmart relies on real-time GPS to connect you with nearby drivers and provide accurate fare estimates. 
                        <br/><br/>
                        <span className="text-red-500 font-bold text-sm">
                            {error || "Please allow location access in your browser or device settings."}
                        </span>
                    </p>

                    <div className="space-y-3 relative z-10">
                        <button
                            onClick={onRetry}
                            className="w-full flex items-center justify-center gap-2 bg-primary text-secondary font-black py-4 rounded-2xl hover:bg-yellow-500 transition-all shadow-lg shadow-primary/20"
                        >
                            <RefreshCw size={20} />
                            Try Again
                        </button>
                        
                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 mt-4">
                            <Settings size={14} />
                            You may need to update your device settings
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default LocationPermissionModal;
