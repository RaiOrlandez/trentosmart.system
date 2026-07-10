import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Bell, Zap, MapPin, Save, CheckCircle2 } from 'lucide-react';
import api from '../api/axios';

const DriverSettingsModal = ({ isOpen, onClose, user, onRefresh }) => {
    const [settings, setSettings] = useState({
        auto_accept_rides: false,
        receive_notifications: true,
        search_radius_km: 5
    });
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (user) {
            setSettings({
                auto_accept_rides: user.auto_accept_rides || false,
                receive_notifications: user.receive_notifications !== undefined ? user.receive_notifications : true,
                search_radius_km: user.search_radius_km || 5
            });
        }
    }, [user]);

    const handleSave = async () => {
        setSaving(true);
        setSuccessMsg('');
        try {
            await api.patch('/user/profile/', settings);
            setSuccessMsg('Settings saved successfully!');
            setTimeout(() => {
                setSuccessMsg('');
                if (onRefresh) onRefresh();
                onClose();
            }, 1500);
        } catch (err) {
            console.error('Failed to save settings', err);
            alert('Failed to save settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-secondary/80 backdrop-blur-xl"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 50 }}
                        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden relative z-10"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-br from-primary via-secondary to-slate-900 p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 opacity-10">
                                <Settings size={120} className="text-white" />
                            </div>
                            <div className="relative z-10">
                                <button
                                    onClick={onClose}
                                    className="absolute top-0 right-0 p-2 hover:bg-white/10 rounded-full transition-all"
                                >
                                    <X size={24} className="text-white" />
                                </button>
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                        <Settings size={32} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-white tracking-tight">Driver Settings</h2>
                                        <p className="text-white/70 text-sm font-medium">Customize your operational preferences</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-8 space-y-6">
                            {/* Success Message */}
                            <AnimatePresence>
                                {successMsg && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-2xl flex items-center gap-3"
                                    >
                                        <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
                                        <p className="text-sm font-bold text-green-700 dark:text-green-300">{successMsg}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Auto Accept Rides */}
                            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-2xl flex items-center justify-center shrink-0">
                                            <Zap className="text-primary" size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-black text-secondary dark:text-white mb-1">Auto-Accept Rides</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                                Automatically accept incoming ride requests within your search radius. Perfect for busy hours.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSettings({ ...settings, auto_accept_rides: !settings.auto_accept_rides })}
                                        className={`relative w-14 h-8 rounded-full transition-colors duration-300 shrink-0 ${settings.auto_accept_rides ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                                    >
                                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-lg ${settings.auto_accept_rides ? 'left-7' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            </div>

                            {/* Notifications */}
                            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center shrink-0">
                                            <Bell className="text-blue-600 dark:text-blue-400" size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-black text-secondary dark:text-white mb-1">Push Notifications</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                                Receive instant alerts for new ride requests, system announcements, and important updates.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSettings({ ...settings, receive_notifications: !settings.receive_notifications })}
                                        className={`relative w-14 h-8 rounded-full transition-colors duration-300 shrink-0 ${settings.receive_notifications ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                                    >
                                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-lg ${settings.receive_notifications ? 'left-7' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            </div>

                            {/* Search Radius */}
                            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700">
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center shrink-0">
                                        <MapPin className="text-green-600 dark:text-green-400" size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-black text-secondary dark:text-white mb-1">Search Radius</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                            Set how far you're willing to travel to pick up passengers. Larger radius = more opportunities.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Current Radius</span>
                                        <span className="text-2xl font-black text-primary">{settings.search_radius_km} km</span>
                                    </div>

                                    <input
                                        type="range"
                                        min="1"
                                        max="20"
                                        value={settings.search_radius_km}
                                        onChange={(e) => setSettings({ ...settings, search_radius_km: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer slider"
                                        style={{
                                            background: `linear-gradient(to right, #FFD700 0%, #FFD700 ${(settings.search_radius_km / 20) * 100}%, #e2e8f0 ${(settings.search_radius_km / 20) * 100}%, #e2e8f0 100%)`
                                        }}
                                    />

                                    <div className="flex justify-between text-xs font-bold text-slate-400">
                                        <span>1 km</span>
                                        <span>10 km</span>
                                        <span>20 km</span>
                                    </div>
                                </div>
                            </div>

                            {/* Save Button */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 py-4 bg-secondary dark:bg-primary text-white dark:text-secondary font-black rounded-2xl hover:bg-slate-800 dark:hover:bg-yellow-500 transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={20} />
                                            Save Settings
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default DriverSettingsModal;
