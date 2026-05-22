import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, MapPin, TrendingUp, Clock, Zap, Calendar,
    AlertCircle, Navigation, Flame, RefreshCw, BarChart2
} from 'lucide-react';
import api from '../api/axios';

const HeatMapModal = ({ isOpen, onClose }) => {
    const [selectedDays, setSelectedDays] = useState(30);
    const [heatmapData, setHeatmapData] = useState({ points: [], total_rides: 0, days: 30 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Static demand zones (landmarks for Trento) — shown alongside API data
    const demandZones = [
        { id: 1, name: 'Trento Public Market', demand: 'high', activeRequests: 12, avgWaitTime: '2 min', surgeMultiplier: 1.5, peakHours: '7-9 AM, 4-6 PM', description: 'Morning rush & afternoon shopping peak' },
        { id: 2, name: 'Municipal Hall Area', demand: 'medium', activeRequests: 5, avgWaitTime: '5 min', surgeMultiplier: 1.0, peakHours: '8-11 AM', description: 'Government workers commute' },
        { id: 3, name: 'Trento High School', demand: 'high', activeRequests: 18, avgWaitTime: '1 min', surgeMultiplier: 1.8, peakHours: '6-7 AM, 5-6 PM', description: 'Student pickup/dropoff times' },
        { id: 4, name: 'Poblacion Center', demand: 'low', activeRequests: 2, avgWaitTime: '12 min', surgeMultiplier: 1.0, peakHours: '12-1 PM', description: 'Lunch hour activity' },
        { id: 5, name: 'Riverside Homes', demand: 'medium', activeRequests: 7, avgWaitTime: '4 min', surgeMultiplier: 1.2, peakHours: '7-9 AM', description: 'Residential morning commute' },
    ];

    const upcomingEvents = [
        { id: 1, name: 'Trento Town Fiesta', location: 'Town Plaza', date: '2025-12-25', time: '6:00 AM - 10:00 PM', expectedDemand: 'Very High', icon: '🎉' },
        { id: 2, name: 'Sunday Market', location: 'Public Market', date: 'Every Sunday', time: '5:00 AM - 12:00 PM', expectedDemand: 'High', icon: '🛒' },
        { id: 3, name: 'Basketball Tournament', location: 'Sports Complex', date: '2025-12-22', time: '2:00 PM - 8:00 PM', expectedDemand: 'Medium', icon: '🏀' },
    ];

    const fetchHeatmapData = useCallback(async () => {
        if (!isOpen) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/reports/heatmap/?days=${selectedDays}`);
            setHeatmapData(res.data);
        } catch (err) {
            console.error('Failed to fetch heatmap data', err);
            setError('Could not load heatmap data. Showing cached zone information.');
        } finally {
            setLoading(false);
        }
    }, [isOpen, selectedDays]);

    useEffect(() => {
        fetchHeatmapData();
    }, [fetchHeatmapData]);

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

    // Convert heatmap points into top hotspot zones for display
    const topHotspots = [...heatmapData.points]
        .sort((a, b) => b[2] - a[2])
        .slice(0, 5)
        .map((pt, i) => ({
            rank: i + 1,
            lat: pt[0].toFixed(4),
            lng: pt[1].toFixed(4),
            intensity: Math.round(pt[2] * 100),
        }));

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
                        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                        className="w-full max-w-6xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden relative z-10 max-h-[90vh] flex flex-col"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-br from-primary via-orange-400 to-red-500 p-8 relative overflow-hidden flex-shrink-0">
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
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                        <MapPin size={32} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-white tracking-tight">Ride Density Heatmap</h2>
                                        <p className="text-white/80 text-sm font-medium">Live data — where rides are actually requested in Trento</p>
                                    </div>
                                </div>

                                {/* Live Stats Bar */}
                                <div className="grid grid-cols-3 gap-4 mt-2">
                                    <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center">
                                        <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-1">Total Rides</p>
                                        <p className="text-2xl font-black text-white">{heatmapData.total_rides.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center">
                                        <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-1">Period</p>
                                        <p className="text-2xl font-black text-white">{heatmapData.days}d</p>
                                    </div>
                                    <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center">
                                        <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-1">Hotspots</p>
                                        <p className="text-2xl font-black text-white">{heatmapData.points.length}</p>
                                    </div>
                                </div>

                                {/* Period Selector */}
                                <div className="flex gap-2 mt-4">
                                    {[7, 14, 30, 90].map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setSelectedDays(d)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${selectedDays === d
                                                ? 'bg-white text-secondary shadow-lg'
                                                : 'bg-white/20 text-white hover:bg-white/30'
                                                }`}
                                        >
                                            {d === 7 ? 'Last Week' : d === 14 ? '2 Weeks' : d === 30 ? 'Last Month' : '3 Months'}
                                        </button>
                                    ))}
                                    <button
                                        onClick={fetchHeatmapData}
                                        disabled={loading}
                                        className="ml-auto px-4 py-2 rounded-xl text-xs font-bold bg-white/20 text-white hover:bg-white/30 transition-all flex items-center gap-2"
                                    >
                                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                                        {loading ? 'Loading...' : 'Refresh'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8">

                            {/* Error Banner */}
                            {error && (
                                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700 rounded-2xl flex items-center gap-3">
                                    <AlertCircle size={20} className="text-amber-600 shrink-0" />
                                    <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{error}</p>
                                </div>
                            )}

                            {/* Top Hotspots from Real API Data */}
                            {topHotspots.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-xl font-black text-secondary dark:text-white mb-4 flex items-center gap-2">
                                        <BarChart2 className="text-primary" size={24} /> Top Ride Hotspots
                                        <span className="text-xs font-bold text-slate-400 ml-2">— from {heatmapData.total_rides} actual rides</span>
                                    </h3>
                                    <div className="space-y-3">
                                        {topHotspots.map((spot) => (
                                            <motion.div
                                                key={spot.rank}
                                                initial={{ opacity: 0, x: -16 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: spot.rank * 0.08 }}
                                                className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 rounded-2xl p-4"
                                            >
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 ${spot.rank === 1 ? 'bg-red-500' : spot.rank === 2 ? 'bg-orange-500' : spot.rank === 3 ? 'bg-yellow-500' : 'bg-slate-400'}`}>
                                                    {spot.rank}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-black text-secondary dark:text-white">
                                                        {spot.lat}°N, {spot.lng}°E
                                                    </p>
                                                    <div className="mt-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${spot.intensity}%` }}
                                                            transition={{ delay: spot.rank * 0.1, duration: 0.6, ease: 'easeOut' }}
                                                            className={`h-full rounded-full ${spot.rank === 1 ? 'bg-red-500' : spot.rank === 2 ? 'bg-orange-500' : spot.rank === 3 ? 'bg-yellow-500' : 'bg-primary'}`}
                                                        />
                                                    </div>
                                                </div>
                                                <span className={`text-sm font-black tabular-nums ${spot.rank <= 2 ? 'text-red-500' : 'text-primary'}`}>
                                                    {spot.intensity}% density
                                                </span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Legend */}
                            <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700">
                                <h3 className="text-sm font-black text-secondary dark:text-white uppercase tracking-widest mb-4">Demand Levels</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[
                                        { color: 'bg-red-500', label: 'High Demand', sub: 'Surge pricing active' },
                                        { color: 'bg-orange-500', label: 'Medium Demand', sub: 'Steady ride flow' },
                                        { color: 'bg-green-500', label: 'Low Demand', sub: 'Longer wait times' },
                                    ].map((item) => (
                                        <div key={item.label} className="flex items-center gap-3">
                                            <div className={`w-4 h-4 ${item.color} rounded-full shrink-0`}></div>
                                            <div>
                                                <p className="text-xs font-black text-secondary dark:text-white">{item.label}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{item.sub}</p>
                                            </div>
                                        </div>
                                    ))}
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
                            <div className="mb-8">
                                <h3 className="text-xl font-black text-secondary dark:text-white mb-6 flex items-center gap-2">
                                    <Calendar className="text-primary" size={24} /> Upcoming High-Demand Events
                                </h3>
                                <div className="space-y-4">
                                    {upcomingEvents.map((event, idx) => (
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
                                                        <span className="flex items-center gap-1"><MapPin size={12} /> {event.location}</span>
                                                        <span className="flex items-center gap-1"><Calendar size={12} /> {event.date}</span>
                                                        <span className="flex items-center gap-1"><Clock size={12} /> {event.time}</span>
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
                            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-3xl">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center shrink-0">
                                        <AlertCircle size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-secondary dark:text-white mb-2">💡 LGU Insight</h4>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                            The heatmap above is generated from <strong>{heatmapData.total_rides} real rides</strong> over the last {heatmapData.days} days.
                                            Use this to deploy drivers to underserved areas and reduce wait times. High-density zones may need additional tricycle unit allocations.
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
