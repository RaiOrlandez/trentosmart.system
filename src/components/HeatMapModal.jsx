import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    MapPin,
    TrendingUp,
    Clock,
    Zap,
    Calendar,
    AlertCircle,
    Navigation,
    Flame
} from 'lucide-react';

const HeatMapModal = ({ isOpen, onClose }) => {
    const [selectedTime, setSelectedTime] = useState('now');
    const [demandZones, setDemandZones] = useState([]);
    const [events, setEvents] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchDemandData();
        }
    }, [isOpen, selectedTime]);

    const fetchDemandData = () => {
        // Simulated demand zones - replace with actual API
        const zones = [
            {
                id: 1,
                name: 'Trento Public Market',
                lat: 8.050,
                lng: 126.062,
                demand: 'high',
                activeRequests: 12,
                avgWaitTime: '2 min',
                surgeMultiplier: 1.5,
                peakHours: '7-9 AM, 4-6 PM',
                description: 'Morning rush & afternoon shopping peak'
            },
            {
                id: 2,
                name: 'Municipal Hall Area',
                lat: 8.052,
                lng: 126.064,
                demand: 'medium',
                activeRequests: 5,
                avgWaitTime: '5 min',
                surgeMultiplier: 1.0,
                peakHours: '8-11 AM',
                description: 'Government workers commute'
            },
            {
                id: 3,
                name: 'Trento High School',
                lat: 8.054,
                lng: 126.066,
                demand: 'high',
                activeRequests: 18,
                avgWaitTime: '1 min',
                surgeMultiplier: 1.8,
                peakHours: '6-7 AM, 5-6 PM',
                description: 'Student pickup/dropoff times'
            },
            {
                id: 4,
                name: 'Poblacion Center',
                lat: 8.048,
                lng: 126.060,
                demand: 'low',
                activeRequests: 2,
                avgWaitTime: '12 min',
                surgeMultiplier: 1.0,
                peakHours: '12-1 PM',
                description: 'Lunch hour activity'
            },
            {
                id: 5,
                name: 'Riverside Homes',
                lat: 8.056,
                lng: 126.068,
                demand: 'medium',
                activeRequests: 7,
                avgWaitTime: '4 min',
                surgeMultiplier: 1.2,
                peakHours: '7-9 AM',
                description: 'Residential morning commute'
            }
        ];

        const upcomingEvents = [
            {
                id: 1,
                name: 'Trento Town Fiesta',
                location: 'Town Plaza',
                date: '2025-12-25',
                time: '6:00 AM - 10:00 PM',
                expectedDemand: 'Very High',
                icon: '🎉'
            },
            {
                id: 2,
                name: 'Sunday Market',
                location: 'Public Market',
                date: 'Every Sunday',
                time: '5:00 AM - 12:00 PM',
                expectedDemand: 'High',
                icon: '🛒'
            },
            {
                id: 3,
                name: 'Basketball Tournament',
                location: 'Sports Complex',
                date: '2025-12-22',
                time: '2:00 PM - 8:00 PM',
                expectedDemand: 'Medium',
                icon: '🏀'
            }
        ];

        setDemandZones(zones);
        setEvents(upcomingEvents);
    };

    const getDemandColor = (demand) => {
        switch (demand) {
            case 'high': return 'bg-red-500';
            case 'medium': return 'bg-orange-500';
            case 'low': return 'bg-green-500';
            default: return 'bg-slate-500';
        }
    };

    const getDemandBgColor = (demand) => {
        switch (demand) {
            case 'high': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
            case 'medium': return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
            case 'low': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
            default: return 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
        }
    };

    const getDemandTextColor = (demand) => {
        switch (demand) {
            case 'high': return 'text-red-600 dark:text-red-400';
            case 'medium': return 'text-orange-600 dark:text-orange-400';
            case 'low': return 'text-green-600 dark:text-green-400';
            default: return 'text-slate-600 dark:text-slate-400';
        }
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
                        onClick={onClose}
                        className="absolute inset-0 bg-secondary/80 backdrop-blur-xl"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 50 }}
                        className="w-full max-w-6xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden relative z-10 max-h-[90vh] flex flex-col"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-br from-primary via-orange-400 to-red-500 p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 opacity-10">
                                <Flame size={150} className="text-white" />
                            </div>
                            <div className="relative z-10">
                                <button
                                    onClick={onClose}
                                    className="absolute top-0 right-0 p-2 hover:bg-white/10 rounded-full transition-all"
                                >
                                    <X size={24} className="text-white" />
                                </button>
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                        <MapPin size={32} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-white tracking-tight">Demand Heat Map</h2>
                                        <p className="text-white/80 text-sm font-medium">Position yourself in high-demand zones for more rides</p>
                                    </div>
                                </div>

                                {/* Time Selector */}
                                <div className="flex gap-2 mt-6">
                                    {['now', 'morning', 'afternoon', 'evening'].map(time => (
                                        <button
                                            key={time}
                                            onClick={() => setSelectedTime(time)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${selectedTime === time
                                                ? 'bg-white text-secondary shadow-lg'
                                                : 'bg-white/20 text-white hover:bg-white/30'
                                                }`}
                                        >
                                            {time === 'now' ? 'Right Now' : time}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8">
                            {/* Legend */}
                            <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700">
                                <h3 className="text-sm font-black text-secondary dark:text-white uppercase tracking-widest mb-4">Demand Levels</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                                        <div>
                                            <p className="text-xs font-black text-secondary dark:text-white">High Demand</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Surge pricing active</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                                        <div>
                                            <p className="text-xs font-black text-secondary dark:text-white">Medium Demand</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Steady ride flow</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                                        <div>
                                            <p className="text-xs font-black text-secondary dark:text-white">Low Demand</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Longer wait times</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Demand Zones */}
                            <div className="mb-8">
                                <h3 className="text-xl font-black text-secondary dark:text-white mb-6 flex items-center gap-2">
                                    <TrendingUp className="text-primary" size={24} /> Live Demand Zones
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {demandZones.map((zone, idx) => (
                                        <motion.div
                                            key={zone.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className={`p-6 rounded-3xl border-2 ${getDemandBgColor(zone.demand)}`}
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-3 h-3 ${getDemandColor(zone.demand)} rounded-full mt-1 animate-pulse`}></div>
                                                    <div>
                                                        <h4 className="text-lg font-black text-secondary dark:text-white">{zone.name}</h4>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{zone.description}</p>
                                                    </div>
                                                </div>
                                                {zone.surgeMultiplier > 1 && (
                                                    <div className="px-3 py-1 bg-primary text-secondary rounded-full text-xs font-black">
                                                        {zone.surgeMultiplier}x
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-3 gap-4 mb-4">
                                                <div>
                                                    <p className="text-xs text-slate-400 font-bold mb-1">Active Requests</p>
                                                    <p className={`text-2xl font-black ${getDemandTextColor(zone.demand)}`}>{zone.activeRequests}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 font-bold mb-1">Avg Wait</p>
                                                    <p className="text-lg font-black text-secondary dark:text-white">{zone.avgWaitTime}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 font-bold mb-1">Demand</p>
                                                    <p className={`text-sm font-black uppercase ${getDemandTextColor(zone.demand)}`}>{zone.demand}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-4">
                                                <Clock size={12} />
                                                <span className="font-bold">Peak: {zone.peakHours}</span>
                                            </div>

                                            <button className="w-full py-3 bg-secondary dark:bg-white text-white dark:text-secondary font-bold rounded-2xl hover:bg-slate-800 dark:hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                                                <Navigation size={16} />
                                                Navigate Here
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Upcoming Events */}
                            <div>
                                <h3 className="text-xl font-black text-secondary dark:text-white mb-6 flex items-center gap-2">
                                    <Calendar className="text-primary" size={24} /> Upcoming High-Demand Events
                                </h3>
                                <div className="space-y-4">
                                    {events.map((event, idx) => (
                                        <motion.div
                                            key={event.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className="p-6 bg-gradient-to-r from-primary/10 to-orange-500/10 dark:from-primary/20 dark:to-orange-500/20 rounded-3xl border-2 border-primary/20 dark:border-primary/30"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="text-4xl">{event.icon}</div>
                                                <div className="flex-1">
                                                    <h4 className="text-lg font-black text-secondary dark:text-white mb-1">{event.name}</h4>
                                                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300 font-bold mb-3">
                                                        <span className="flex items-center gap-1">
                                                            <MapPin size={12} /> {event.location}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar size={12} /> {event.date}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={12} /> {event.time}
                                                        </span>
                                                    </div>
                                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-xs font-black">
                                                        <Zap size={12} /> {event.expectedDemand} Demand Expected
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Pro Tip */}
                            <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-3xl">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center shrink-0">
                                        <AlertCircle size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-secondary dark:text-white mb-2">💡 Pro Driver Tip</h4>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                            Position yourself near high-demand zones <strong>15 minutes before peak hours</strong> to maximize your ride acceptance rate.
                                            During surge pricing, you can earn up to <strong className="text-primary">1.8x more per trip!</strong>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default HeatMapModal;
