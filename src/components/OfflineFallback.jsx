import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, Zap } from 'lucide-react';

/**
 * OfflineBanner — shows a sticky banner at the top when the browser detects
 * it has gone offline. Disappears automatically when connection is restored.
 *
 * Add <OfflineBanner /> near the top of App.js (inside the Router).
 */
export const OfflineBanner = () => {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [justReconnected, setJustReconnected] = useState(false);

    useEffect(() => {
        const handleOffline = () => {
            setIsOffline(true);
            setJustReconnected(false);
        };
        const handleOnline = () => {
            setIsOffline(false);
            setJustReconnected(true);
            setTimeout(() => setJustReconnected(false), 3000);
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    return (
        <AnimatePresence>
            {isOffline && (
                <motion.div
                    initial={{ y: -60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -60, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    className="fixed top-16 left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none"
                >
                    <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto">
                        <WifiOff size={18} />
                        <span className="text-sm font-black">You're offline — some features may not work.</span>
                        <button
                            onClick={() => window.location.reload()}
                            className="ml-2 text-white/80 hover:text-white transition-colors"
                            title="Reload page"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </motion.div>
            )}
            {justReconnected && (
                <motion.div
                    initial={{ y: -60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -60, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    className="fixed top-16 left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none"
                >
                    <div className="bg-green-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
                        <Zap size={18} />
                        <span className="text-sm font-black">Back online! ✅</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

/**
 * OfflineFallback — full-page fallback for when the Railway backend is
 * unreachable (e.g. cold start / sleep). Use this inside ErrorBoundary
 * or as a component when API calls fail.
 */
export const OfflineFallback = ({ onRetry, message }) => {
    const [retrying, setRetrying] = useState(false);

    const handleRetry = async () => {
        setRetrying(true);
        if (onRetry) {
            await onRetry();
        } else {
            setTimeout(() => window.location.reload(), 800);
        }
        setRetrying(false);
    };

    return (
        <div className="min-h-[60vh] flex items-center justify-center px-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="text-center max-w-sm"
            >
                {/* Animated icon */}
                <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                    className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6"
                >
                    <WifiOff size={44} className="text-slate-400" />
                </motion.div>

                <h2 className="text-2xl font-black text-secondary dark:text-white mb-2">
                    Server Unreachable
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed mb-8">
                    {message || 'The backend server may be waking up from sleep (Railway free tier). This usually takes 30–60 seconds.'}
                </p>

                <button
                    onClick={handleRetry}
                    disabled={retrying}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-secondary font-black rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-60"
                >
                    <RefreshCw size={18} className={retrying ? 'animate-spin' : ''} />
                    {retrying ? 'Retrying...' : 'Retry Connection'}
                </button>
            </motion.div>
        </div>
    );
};

export default OfflineBanner;
