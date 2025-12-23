import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Lock, UserPlus, Car, Phone, MapPin, Calendar } from 'lucide-react';
import api from '../api/axios';

const CreateUserModal = ({ isOpen, onClose, onRefresh }) => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'passenger',
        phone_number: '',
        address: '',
        date_of_birth: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await api.post('/auth/register/', formData);
            onRefresh();
            onClose();
            setFormData({ username: '', email: '', password: '', role: 'passenger', phone_number: '', address: '', date_of_birth: '' });
        } catch (err) {
            setError(err.response?.data?.detail || err.response?.data?.username?.[0] || 'Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-secondary/80 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 p-8 md:p-10"
                    >
                        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-primary/20 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <UserPlus size={32} />
                            </div>
                            <h2 className="text-2xl font-black text-secondary dark:text-white uppercase tracking-tight">Manual Provision</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Direct User Registration</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Account Role</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: 'passenger' })}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold text-xs ${formData.role === 'passenger' ? 'border-secondary bg-secondary text-white' : 'border-slate-100 dark:border-white/5 text-slate-400'}`}
                                    >
                                        <User size={14} /> Passenger
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: 'driver' })}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold text-xs ${formData.role === 'driver' ? 'border-primary bg-primary text-secondary' : 'border-slate-100 dark:border-white/5 text-slate-400'}`}
                                    >
                                        <Car size={14} /> Driver
                                    </button>
                                </div>
                            </div>

                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Official Username"
                                    className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-bold outline-none focus:border-primary transition-all"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-bold outline-none focus:border-primary transition-all"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="password"
                                    placeholder="Secure Password"
                                    className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-bold outline-none focus:border-primary transition-all"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="tel"
                                        placeholder="Phone"
                                        className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-bold outline-none focus:border-primary transition-all"
                                        value={formData.phone_number}
                                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                    />
                                </div>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-[10px] font-bold outline-none focus:border-primary transition-all"
                                        value={formData.date_of_birth}
                                        onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Resident Address"
                                    className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-bold outline-none focus:border-primary transition-all"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase italic border border-red-100">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-secondary text-white font-black py-4 rounded-xl shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                            >
                                {loading ? 'Provisioning...' : 'Create Account'}
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CreateUserModal;
