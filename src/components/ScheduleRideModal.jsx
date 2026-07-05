import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Calendar,
    MapPin,
    CheckCircle,
    AlertCircle,
    Repeat,
    Bell
} from 'lucide-react';
import api from '../api/axios';

const ScheduleRideModal = ({ isOpen, onClose, onSuccess, editingSchedule = null }) => {
    const [step, setStep] = useState(1); // 1: Details, 2: Date/Time, 3: Confirm
    const [formData, setFormData] = useState({
        pickup: '',
        destination: '',
        date: '',
        time: '',
        recurring: 'none', // none, daily, weekly
        notes: '',
        payment_method: 'cash',
        passenger_count: 1
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (editingSchedule) {
            setFormData({
                pickup: editingSchedule.pickup_address || '',
                destination: editingSchedule.dest_address || '',
                date: editingSchedule.scheduled_date?.split('T')[0] || '',
                time: editingSchedule.scheduled_time || '',
                recurring: editingSchedule.recurring || 'none',
                notes: editingSchedule.notes || '',
                payment_method: editingSchedule.payment_method || 'cash',
                passenger_count: editingSchedule.passenger_count || 1
            });
        }
    }, [editingSchedule]);

    const handleSubmit = async () => {
        setLoading(true);
        setError('');

        try {
            const payload = {
                pickup_address: formData.pickup,
                dest_address: formData.destination,
                scheduled_date: formData.date,
                scheduled_time: formData.time,
                recurring: formData.recurring,
                notes: formData.notes,
                payment_method: formData.payment_method,
                passenger_count: formData.passenger_count
            };

            if (editingSchedule) {
                await api.patch(`/rides/scheduled/${editingSchedule.id}/`, payload);
            } else {
                await api.post('/rides/schedule/', payload);
            }

            onSuccess();
            onClose();
            resetForm();
        } catch (err) {
            const detailMsg = err.response?.data?.detail;
            const serverErr = err.response?.data?.server_error;
            setError(serverErr ? `${detailMsg} (Server Error: ${serverErr})` : (detailMsg || 'Failed to schedule ride'));
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            pickup: '',
            destination: '',
            date: '',
            time: '',
            recurring: 'none',
            notes: '',
            payment_method: 'cash',
            passenger_count: 1
        });
        setStep(1);
        setError('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const getMinDate = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    };

    const getMaxDate = () => {
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 30); // 30 days ahead
        return maxDate.toISOString().split('T')[0];
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-secondary/80 backdrop-blur-xl"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 50 }}
                        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden relative z-10"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-br from-primary via-orange-400 to-secondary p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 opacity-10">
                                <Calendar size={150} className="text-white" />
                            </div>
                            <div className="relative z-10">
                                <button
                                    onClick={handleClose}
                                    className="absolute top-0 right-0 p-2 hover:bg-white/10 rounded-full transition-all"
                                >
                                    <X size={24} className="text-white" />
                                </button>
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                        <Calendar size={32} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-white tracking-tight">
                                            {editingSchedule ? 'Edit Scheduled Ride' : 'Schedule a Ride'}
                                        </h2>
                                        <p className="text-white/80 text-sm font-medium">Book your trip in advance</p>
                                    </div>
                                </div>

                                {/* Progress Steps */}
                                <div className="flex items-center gap-2 mt-6">
                                    {[1, 2, 3].map((s) => (
                                        <div key={s} className="flex items-center flex-1">
                                            <div className={`h-1 flex-1 rounded-full ${step >= s ? 'bg-white' : 'bg-white/30'}`}></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-8">
                            {error && (
                                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-3">
                                    <AlertCircle className="text-red-600 dark:text-red-400" size={20} />
                                    <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
                                </div>
                            )}

                            {/* Step 1: Route Details */}
                            {step === 1 && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-6"
                                >
                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                            Pickup Location
                                        </label>
                                        <div className="relative">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} />
                                            <input
                                                type="text"
                                                value={formData.pickup}
                                                onChange={(e) => setFormData({ ...formData, pickup: e.target.value })}
                                                placeholder="Enter pickup address"
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-6 text-secondary dark:text-white font-bold outline-none focus:border-primary transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                            Destination
                                        </label>
                                        <div className="relative">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary dark:text-white" size={20} />
                                            <input
                                                type="text"
                                                value={formData.destination}
                                                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                                                placeholder="Enter destination"
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-6 text-secondary dark:text-white font-bold outline-none focus:border-primary transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                            Notes (Optional)
                                        </label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            placeholder="Any special instructions? (e.g., Wait at gate 2)"
                                            rows={3}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-white/10 rounded-2xl py-4 px-6 text-secondary dark:text-white font-medium outline-none focus:border-primary transition-all resize-none"
                                        />
                                    </div>

                                    <button
                                        onClick={() => setStep(2)}
                                        disabled={!formData.pickup || !formData.destination}
                                        className="w-full bg-secondary dark:bg-primary text-white dark:text-secondary font-black py-4 rounded-2xl hover:bg-slate-800 dark:hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next: Choose Date & Time
                                    </button>
                                </motion.div>
                            )}

                            {/* Step 2: Date & Time */}
                            {step === 2 && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-6"
                                >
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                                Date
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.date}
                                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                                min={getMinDate()}
                                                max={getMaxDate()}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-white/10 rounded-2xl py-4 px-6 text-secondary dark:text-white font-bold outline-none focus:border-primary transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                                Time
                                            </label>
                                            <input
                                                type="time"
                                                value={formData.time}
                                                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-white/10 rounded-2xl py-4 px-6 text-secondary dark:text-white font-bold outline-none focus:border-primary transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                                            Passenger Count (Capacity: Max 5)
                                        </label>
                                        <div className="flex gap-2">
                                            {[1, 2, 3, 4, 5].map((num) => (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, passenger_count: num })}
                                                    className={`w-12 h-12 rounded-xl text-sm font-black transition-all border-2 ${
                                                        formData.passenger_count === num
                                                            ? 'bg-primary text-secondary border-primary shadow-md'
                                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-primary'
                                                    }`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                                            <Repeat size={14} /> Recurring Ride
                                        </label>
                                        <select
                                            value={formData.recurring}
                                            onChange={(e) => setFormData({ ...formData, recurring: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-white/10 rounded-2xl py-4 px-6 text-secondary dark:text-white font-bold outline-none focus:border-primary transition-all"
                                        >
                                            <option value="none">One-time ride</option>
                                            <option value="daily">Daily (same time every day)</option>
                                            <option value="weekly">Weekly (same day & time)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                            Payment Method
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {['cash', 'gcash', 'wallet'].map((method) => (
                                                <button
                                                    key={method}
                                                    onClick={() => setFormData({ ...formData, payment_method: method })}
                                                    className={`py-3 px-4 rounded-xl text-xs font-black uppercase border-2 transition-all ${formData.payment_method === method
                                                        ? 'bg-primary text-secondary border-primary shadow-lg'
                                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-primary'
                                                        }`}
                                                >
                                                    {method}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setStep(1)}
                                            className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={() => setStep(3)}
                                            disabled={!formData.date || !formData.time}
                                            className="flex-1 py-4 bg-secondary dark:bg-primary text-white dark:text-secondary font-black rounded-2xl hover:bg-slate-800 dark:hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Review & Confirm
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 3: Confirmation */}
                            {step === 3 && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-6"
                                >
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-6 space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-3 h-3 rounded-full bg-primary mt-1.5"></div>
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pickup</p>
                                                <p className="text-sm font-bold text-secondary dark:text-white">{formData.pickup}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="w-3 h-3 rounded-full bg-secondary dark:bg-white mt-1.5"></div>
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Destination</p>
                                                <p className="text-sm font-bold text-secondary dark:text-white">{formData.destination}</p>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Date</p>
                                                    <p className="text-lg font-black text-secondary dark:text-white">
                                                        {new Date(formData.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Time</p>
                                                    <p className="text-lg font-black text-secondary dark:text-white">{formData.time}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {formData.recurring !== 'none' && (
                                            <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Recurring</p>
                                                <p className="text-sm font-bold text-primary capitalize">{formData.recurring}</p>
                                            </div>
                                        )}

                                        <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Passengers</p>
                                            <p className="text-sm font-bold text-secondary dark:text-white">{formData.passenger_count} Passenger(s)</p>
                                        </div>

                                        {formData.notes && (
                                            <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Notes</p>
                                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{formData.notes}</p>
                                            </div>
                                        )}

                                        <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Payment</p>
                                            <p className="text-sm font-bold text-secondary dark:text-white capitalize">{formData.payment_method}</p>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-start gap-3">
                                        <Bell className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
                                        <div>
                                            <p className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">Reminder Notification</p>
                                            <p className="text-xs text-blue-600 dark:text-blue-400">You'll receive a notification 30 minutes before your scheduled pickup time.</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setStep(2)}
                                            className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={loading}
                                            className="flex-1 py-4 bg-secondary dark:bg-primary text-white dark:text-secondary font-black rounded-2xl hover:bg-slate-800 dark:hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {loading ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    Scheduling...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle size={20} />
                                                    Confirm Schedule
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ScheduleRideModal;
