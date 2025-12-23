import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Save, Home, Briefcase, GraduationCap, Store, Star } from 'lucide-react';
import api from '../api/axios';

const SavedPlaceModal = ({ isOpen, onClose, onRefresh, place = null }) => {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [category, setCategory] = useState('other');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (place) {
            setName(place.name || '');
            setAddress(place.address || '');
            setCategory(place.category || 'other');
        } else {
            setName('');
            setAddress('');
            setCategory('other');
        }
    }, [place, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = { name, address, category };
            if (place) {
                await api.patch(`/saved-places/${place.id}/`, payload);
            } else {
                await api.post('/saved-places/', payload);
            }
            onRefresh();
            onClose();
        } catch (err) {
            console.error('Failed to save place', err);
            alert('Failed to save place');
        } finally {
            setLoading(false);
        }
    };

    const categories = [
        { id: 'home', icon: Home, label: 'Home' },
        { id: 'work', icon: Briefcase, label: 'Work' },
        { id: 'school', icon: GraduationCap, label: 'School' },
        { id: 'market', icon: Store, label: 'Market' },
        { id: 'other', icon: Star, label: 'Other' },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
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
                        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 relative z-10 shadow-2xl overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-8">
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-secondary">
                                <MapPin size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-secondary dark:text-white uppercase tracking-tight">
                                    {place ? 'Edit Place' : 'Save New Place'}
                                </h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">For quicker ride requests</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Place Name</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. My Favorite Cafe"
                                    className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary transition-all dark:text-white"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Full Address</label>
                                <input
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Enter specific address in Trento"
                                    className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary transition-all dark:text-white"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block ml-1">Category</label>
                                <div className="flex justify-between gap-2">
                                    {categories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setCategory(cat.id)}
                                            className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${category === cat.id ? 'bg-primary border-primary text-secondary' : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-400 hover:border-slate-200'}`}
                                        >
                                            <cat.icon size={18} />
                                            <span className="text-[8px] font-extrabold uppercase">{cat.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-5 bg-secondary text-white font-black uppercase tracking-widest rounded-2xl hover:bg-primary hover:text-secondary hover:shadow-2xl transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Save size={18} />
                                        {place ? 'Update Place' : 'Save Place Now'}
                                    </>
                                )}
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default SavedPlaceModal;
