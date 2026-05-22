import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * ErrorBoundary — catches any unhandled rendering errors in the React tree.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 * Or wrap specific routes in App.js:
 *   <ErrorBoundary fallback={<SmallError />}>
 *     <Route ... />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            showDetails: false,
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        // In production you could log this to Sentry / Firebase Crashlytics here:
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    };

    render() {
        if (this.state.hasError) {
            // Allow a custom fallback to be passed in
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-6 py-12">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                        className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-white/10 overflow-hidden"
                    >
                        {/* Top gradient stripe */}
                        <div className="h-2 bg-gradient-to-r from-red-500 via-orange-500 to-primary" />

                        <div className="p-10">
                            {/* Icon */}
                            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle size={40} className="text-red-500" />
                            </div>

                            {/* Heading */}
                            <h1 className="text-2xl font-black text-secondary dark:text-white text-center mb-3">
                                Something went wrong
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 text-center text-sm font-medium leading-relaxed mb-8">
                                An unexpected error occurred in this part of the app.
                                You can try reloading the section or go back to the home page.
                            </p>

                            {/* Error message */}
                            {this.state.error?.message && (
                                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
                                    <p className="text-xs font-black text-red-700 dark:text-red-300 font-mono break-words">
                                        {this.state.error.message}
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                <button
                                    onClick={this.handleReset}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-secondary font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
                                >
                                    <RefreshCw size={18} /> Try Again
                                </button>
                                <button
                                    onClick={() => window.location.href = '/'}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-secondary dark:text-white font-black rounded-2xl hover:scale-105 active:scale-95 transition-all"
                                >
                                    <Home size={18} /> Go Home
                                </button>
                            </div>

                            {/* Collapsible stack trace (dev helper) */}
                            {this.state.errorInfo && (
                                <div>
                                    <button
                                        onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                                        className="w-full flex items-center justify-between text-xs font-black text-slate-400 uppercase tracking-widest py-2 hover:text-primary transition-colors"
                                    >
                                        <span>Developer Details</span>
                                        {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                    {this.state.showDetails && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            className="mt-2 overflow-hidden"
                                        >
                                            <pre className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-words font-mono leading-relaxed">
                                                {this.state.errorInfo.componentStack}
                                            </pre>
                                        </motion.div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
