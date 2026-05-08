import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wallet as WalletIcon,
    Plus,
    ArrowUpRight,
    ArrowDownLeft,
    History,
    CreditCard,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import GCashPaymentModal from '../components/GCashPaymentModal';

const Wallet = () => {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [showTopUp, setShowTopUp] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showGCashTopUp, setShowGCashTopUp] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchWalletData();
    }, []);

    const fetchWalletData = async () => {
        try {
            const res = await api.get('/wallet/');
            setBalance(res.data.balance);
            setTransactions(Array.isArray(res.data.transactions) ? res.data.transactions : []);
        } catch (err) {
            console.error('Failed to fetch wallet', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTopUp = async (e) => {
        e.preventDefault();
        if (!topUpAmount || parseFloat(topUpAmount) <= 0) return;

        // Show GCash payment modal instead of direct top-up
        setShowTopUp(false);
        setShowGCashTopUp(true);
    };

    const handleGCashTopUpSuccess = async (transactionRef) => {
        console.log('GCash payment successful, processing top-up...', {
            transactionRef,
            topUpAmount,
            parsedAmount: parseFloat(topUpAmount)
        });

        setIsProcessing(true);
        setMsg({ type: '', text: '' });

        try {
            const amountToSend = parseFloat(topUpAmount);

            if (isNaN(amountToSend) || amountToSend <= 0) {
                throw new Error('Invalid amount');
            }

            console.log('Calling API with amount:', amountToSend);

            // Call the standard wallet top-up endpoint
            const res = await api.post('/wallet/topup/', {
                amount: amountToSend
            });

            console.log('API response:', res.data);

            setBalance(res.data.balance);
            setShowGCashTopUp(false);
            setTopUpAmount('');
            setMsg({
                type: 'success',
                text: `Successfully added ₱${amountToSend} to your wallet via GCash! Ref: ${transactionRef}`
            });

            // Refresh transaction history
            setTimeout(() => {
                fetchWalletData();
            }, 500);
        } catch (err) {
            console.error('Top-up error details:', {
                error: err,
                response: err.response?.data,
                status: err.response?.status,
                message: err.message
            });

            setShowGCashTopUp(false);
            setMsg({
                type: 'error',
                text: `Failed to top-up wallet. Please try again or contact support. Error: ${err.message}`
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 bg-slate-50 px-6">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Profile/Wallet Header */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-secondary uppercase tracking-tight">Smart Wallet</h1>
                        <p className="text-slate-500 font-medium">Manage your funds for seamless tricycle rides</p>
                    </div>
                    <button
                        onClick={() => setShowTopUp(true)}
                        className="flex items-center gap-2 bg-primary text-secondary font-black px-8 py-4 rounded-[2rem] hover:bg-secondary hover:text-white transition-all shadow-xl shadow-primary/20"
                    >
                        <Plus size={20} />
                        <span>Add Funds</span>
                    </button>
                </div>

                {/* Message Alert */}
                <AnimatePresence>
                    {msg.text && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}
                        >
                            {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            {msg.text}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Card */}
                    <div className="lg:col-span-1">
                        <motion.div
                            whileHover={{ y: -5 }}
                            className="bg-secondary p-8 rounded-[3rem] text-white relative overflow-hidden shadow-2xl"
                        >
                            <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                                    <WalletIcon size={24} className="text-primary" />
                                </div>
                                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Available Balance</p>
                                <p className="text-5xl font-black italic">₱{parseFloat(balance).toLocaleString()}</p>
                                <div className="mt-8 pt-8 border-t border-white/10">
                                    <div className="flex items-center justify-between opacity-60">
                                        <span className="text-xs font-bold uppercase">Account Status</span>
                                        <span className="text-xs font-black text-primary">ACTIVE</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Transactions List */}
                    <div className="lg:col-span-2">
                        <div className="glass-card p-8 rounded-[3rem]">
                            <div className="flex items-center gap-2 mb-8">
                                <History size={20} className="text-slate-400" />
                                <h2 className="text-lg font-black text-secondary tracking-tight uppercase">Recent Activity</h2>
                            </div>

                            <div className="space-y-4">
                                {(!Array.isArray(transactions) || transactions.length === 0) ? (
                                    <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                        <History size={40} className="mx-auto text-slate-200 mb-2" />
                                        <p className="text-slate-400 font-medium italic">No transactions yet</p>
                                    </div>
                                ) : (
                                    transactions.map(txn => (
                                        <div key={txn.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-primary/30 transition-all shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${txn.transaction_type === 'topup' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    {txn.transaction_type === 'topup' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                                </div>
                                                <div>
                                                    <p className="font-black text-secondary text-sm">{txn.description || txn.transaction_type.toUpperCase()}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(txn.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <p className={`font-black italic ${txn.transaction_type === 'topup' ? 'text-green-600' : 'text-secondary'}`}>
                                                {txn.transaction_type === 'topup' ? '+' : '-'} ₱{parseFloat(txn.amount).toFixed(2)}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Up Modal */}
            <AnimatePresence>
                {showTopUp && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowTopUp(false)}
                            className="absolute inset-0 bg-secondary/80 backdrop-blur-md"
                        ></motion.div>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="w-full max-w-md bg-white rounded-[3rem] p-10 relative z-10 shadow-2xl"
                        >
                            <h2 className="text-2xl font-black text-secondary uppercase tracking-tight mb-2 text-center">Add Funds</h2>
                            <p className="text-slate-500 text-center text-sm font-medium mb-8 text-center">Enter the amount you wish to add to your Smart Wallet</p>

                            <form onSubmit={handleTopUp} className="space-y-6">
                                <div className="relative">
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300 italic">₱</span>
                                    <input
                                        type="number"
                                        value={topUpAmount}
                                        onChange={(e) => setTopUpAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] py-5 pl-12 pr-6 text-3xl font-black text-secondary italic focus:border-primary outline-none transition-all placeholder:text-slate-200"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button type="button" onClick={() => setTopUpAmount('100')} className="py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all">₱100</button>
                                    <button type="button" onClick={() => setTopUpAmount('500')} className="py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all">₱500</button>
                                </div>

                                <div className="pt-4 space-y-3">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">Payment Method</p>
                                    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <CreditCard className="text-blue-600" size={20} />
                                            <span className="font-bold text-sm text-secondary">GCash / PayMaya</span>
                                        </div>
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isProcessing || !topUpAmount}
                                    className="w-full bg-primary text-secondary font-black py-5 rounded-[2rem] hover:bg-secondary hover:text-white transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 group"
                                >
                                    {isProcessing ? (
                                        <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <span>Securely Add Funds</span>
                                            <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <GCashPaymentModal
                isOpen={showGCashTopUp}
                onClose={() => {
                    setShowGCashTopUp(false);
                    setShowTopUp(true);
                }}
                amount={parseFloat(topUpAmount) || 0}
                onSuccess={handleGCashTopUpSuccess}
                rideId={null}
            />

        </div>
    );
};

export default Wallet;
