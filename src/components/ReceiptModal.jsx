import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    MapPin,
    Trophy,
    ShieldCheck,
    Star,
    Share2,
    Download,
    AlertCircle
} from 'lucide-react';

const ReceiptModal = ({ isOpen, onClose, ride }) => {
    if (!ride) return null;



    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center px-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl relative overflow-hidden"
                    >
                        {/* Cut corner receipt effect */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-[5rem] -z-0"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/5 rounded-tr-[5rem] -z-0"></div>

                        {/* Top Header */}
                        <div className="p-8 pb-4 relative z-10 flex justify-between items-start">
                            <div>
                                <h2 className="text-3xl font-black text-secondary dark:text-white mb-1 italic">Trip Receipt</h2>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Transaction ID: TXN-{ride.id}992</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X size={24} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="px-8 pb-8 relative z-10">
                            {/* Status Badge */}
                            <div className="mb-8">
                                <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${ride.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                    }`}>
                                    {ride.status}
                                </span>
                            </div>

                            {/* Main Fare Section */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 mb-8 border border-slate-100 dark:border-white/5">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Amount</p>
                                        <p className="text-4xl font-black text-secondary dark:text-white">₱{ride.fare || 0}.00</p>
                                    </div>
                                    <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-secondary shadow-lg shadow-primary/20 rotate-3">
                                        <Trophy size={28} />
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/5">
                                    <div className="flex justify-between text-xs font-bold text-slate-500">
                                        <span>Base Fare (Trento standard)</span>
                                        <span className="text-secondary dark:text-white">₱30.00</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold text-slate-500">
                                        <span>Distance Charges</span>
                                        <span className="text-secondary dark:text-white">₱{(ride.fare - 30) > 0 ? (ride.fare - 30).toFixed(2) : '0.00'}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold text-slate-500">
                                        <span>Service Fee</span>
                                        <span className="text-secondary dark:text-white">₱0.00</span>
                                    </div>
                                </div>
                            </div>

                            {/* Trip Timeline */}
                            <div className="space-y-6 mb-8 relative">
                                <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-slate-200 dark:bg-slate-800"></div>

                                <div className="flex gap-4 relative">
                                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
                                        <MapPin size={10} className="text-secondary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Pickup</p>
                                        <p className="text-sm font-bold text-secondary dark:text-white leading-tight">{ride.pickup_address}</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1">{formatTime(ride.requested_at)}</p>
                                    </div>
                                </div>

                                <div className="flex gap-4 relative">
                                    <div className="w-6 h-6 rounded-full bg-secondary dark:bg-white flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
                                        <MapPin size={10} className="text-white dark:text-secondary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Destination</p>
                                        <p className="text-sm font-bold text-secondary dark:text-white leading-tight">{ride.dest_address}</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1">{formatTime(ride.completed_at || ride.requested_at)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Driver/Partner Info */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[1.5rem] mb-8 border border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200">
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${ride.driver?.username || 'unknown'}`} alt="Driver" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Driver Partner</p>
                                        <p className="text-sm font-bold text-secondary dark:text-white">{ride.driver?.username || 'LGU Assigned'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-1 text-yellow-500 mb-0.5">
                                        <Star size={12} fill="currentColor" />
                                        <span className="text-xs font-black">4.9</span>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400">Standard Service</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <button className="flex items-center justify-center gap-2 py-3 bg-secondary text-white font-bold rounded-2xl hover:bg-slate-800 transition-colors">
                                    <Download size={18} /> Receipt
                                </button>
                                <button className="flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                    <Share2 size={18} /> Share
                                </button>
                            </div>

                            <button
                                onClick={() => window.location.href = `/passenger/support?ride=${ride.id}`}
                                className="w-full py-4 border-2 border-dashed border-red-500/30 text-red-500 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center justify-center gap-2"
                            >
                                <AlertCircle size={14} /> Report an issue with this trip
                            </button>
                        </div>

                        {/* Bottom Safety Footer */}
                        <div className="p-6 bg-slate-900 text-white flex items-center justify-center gap-2">
                            <ShieldCheck size={16} className="text-primary" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">Protected by Trento Smart Dispatch System</p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ReceiptModal;
