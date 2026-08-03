import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Calendar,
    Clock,
    Plus,
    Trash2,
    Edit,
    ArrowLeft,
    Repeat
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { formatAddress } from '../utils/reverseGeocode';
import ScheduleRideModal from '../components/ScheduleRideModal';

const ScheduledRides = () => {
    const [scheduledRides, setScheduledRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [filter, setFilter] = useState('upcoming'); // upcoming, past, all

    useEffect(() => {
        fetchScheduledRides();
    }, []);

    const fetchScheduledRides = async () => {
        try {
            const res = await api.get('/rides/scheduled/');
            setScheduledRides(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch scheduled rides', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Cancel this scheduled ride?')) return;

        try {
            await api.delete(`/rides/scheduled/${id}/`);
            fetchScheduledRides();
        } catch (err) {
            alert('Failed to cancel ride');
        }
    };

    const handleEdit = (schedule) => {
        setEditingSchedule(schedule);
        setShowScheduleModal(true);
    };

    const handleModalClose = () => {
        setShowScheduleModal(false);
        setEditingSchedule(null);
    };

    const getStatusColor = (schedule) => {
        const scheduleDateTime = new Date(`${schedule.scheduled_date}T${schedule.scheduled_time}`);
        const now = new Date();

        if (scheduleDateTime < now) {
            return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
        }
        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
    };

    const getStatusText = (schedule) => {
        const scheduleDateTime = new Date(`${schedule.scheduled_date}T${schedule.scheduled_time}`);
        const now = new Date();

        if (scheduleDateTime < now) return 'Past';
        return 'Upcoming';
    };

    const filteredRides = scheduledRides.filter(ride => {
        const scheduleDateTime = new Date(`${ride.scheduled_date}T${ride.scheduled_time}`);
        const now = new Date();

        if (filter === 'upcoming') return scheduleDateTime >= now;
        if (filter === 'past') return scheduleDateTime < now;
        return true;
    });

    const upcomingCount = scheduledRides.filter(r => {
        const dt = new Date(`${r.scheduled_date}T${r.scheduled_time}`);
        return dt >= new Date();
    }).length;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 bg-slate-50 dark:bg-slate-950 px-6 transition-colors duration-500">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <Link to="/passenger" className="flex items-center gap-2 text-slate-400 hover:text-secondary dark:hover:text-white transition-colors mb-4 group">
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="text-xs font-black uppercase tracking-widest">Back to Dashboard</span>
                        </Link>
                        <h1 className="text-4xl font-black text-secondary dark:text-white uppercase tracking-tight">Scheduled Rides</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                            {upcomingCount} upcoming {upcomingCount === 1 ? 'ride' : 'rides'}
                        </p>
                    </div>

                    <button
                        onClick={() => setShowScheduleModal(true)}
                        className="flex items-center gap-2 bg-primary text-secondary font-black px-8 py-4 rounded-2xl hover:bg-secondary hover:text-white transition-all shadow-xl shadow-primary/20"
                    >
                        <Plus size={20} />
                        Schedule New Ride
                    </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-8 bg-white dark:bg-slate-900 p-1 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 w-fit">
                    {['upcoming', 'past', 'all'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-6 py-2 rounded-xl text-sm font-bold capitalize transition-all ${filter === f
                                ? 'bg-secondary text-white shadow-lg dark:bg-primary dark:text-secondary'
                                : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {/* Rides List */}
                {filteredRides.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-20 bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border border-slate-100 dark:border-white/5"
                    >
                        <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                            <Calendar size={40} />
                        </div>
                        <h3 className="text-xl font-black text-secondary dark:text-white mb-2">No scheduled rides</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mb-8 font-medium">
                            Plan ahead by scheduling your rides in advance
                        </p>
                        <button
                            onClick={() => setShowScheduleModal(true)}
                            className="bg-primary text-secondary font-black px-8 py-4 rounded-2xl hover:bg-slate-800 hover:text-white transition-all shadow-lg inline-block"
                        >
                            Schedule Your First Ride
                        </button>
                    </motion.div>
                ) : (
                    <div className="space-y-4">
                        {filteredRides.map((schedule, index) => (
                            <motion.div
                                key={schedule.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm hover:shadow-xl border border-slate-100 dark:border-white/5 group transition-all relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[5rem] -z-0 group-hover:scale-110 transition-transform"></div>

                                <div className="flex flex-col md:flex-row gap-6 relative z-10">
                                    {/* Date & Time */}
                                    <div className="flex md:flex-col items-center justify-between md:justify-center md:w-32 gap-2 border-b md:border-b-0 md:border-r border-slate-100 dark:border-white/5 pb-4 md:pb-0 md:pr-6">
                                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                                            <Calendar className="text-primary" size={24} />
                                        </div>
                                        <div className="text-right md:text-center">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                                                {new Date(schedule.scheduled_date).toLocaleDateString('en-PH', { month: 'short' })}
                                            </p>
                                            <p className="text-2xl font-black text-secondary dark:text-white leading-none mb-1">
                                                {new Date(schedule.scheduled_date).getDate()}
                                            </p>
                                            <div className="flex items-center justify-center gap-1 text-slate-500 dark:text-slate-400">
                                                <Clock size={12} />
                                                <span className="text-xs font-bold">{schedule.scheduled_time}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Route Info */}
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-3 h-3 rounded-full bg-primary mt-1.5 shrink-0"></div>
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pickup</p>
                                                <p className="text-sm font-bold text-secondary dark:text-white">{formatAddress(schedule.pickup_address, 'Pickup Location')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="w-3 h-3 rounded-full bg-secondary dark:bg-white mt-1.5 shrink-0"></div>
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Destination</p>
                                                <p className="text-sm font-bold text-secondary dark:text-white">{formatAddress(schedule.dest_address, 'Destination')}</p>
                                            </div>
                                        </div>

                                        {schedule.notes && (
                                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{schedule.notes}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status & Actions */}
                                    <div className="flex items-center justify-between md:flex-col md:items-end md:justify-between md:w-40 gap-3 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 dark:border-white/5 md:pl-6">
                                        <div className="space-y-2">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(schedule)}`}>
                                                {getStatusText(schedule)}
                                            </span>
                                            {schedule.recurring !== 'none' && (
                                                <div className="flex items-center gap-1 text-primary">
                                                    <Repeat size={12} />
                                                    <span className="text-xs font-bold capitalize">{schedule.recurring}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                                <span className="text-xs font-bold capitalize">{schedule.payment_method || 'Cash'}</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEdit(schedule)}
                                                className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all"
                                                title="Edit"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(schedule.id)}
                                                className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-all"
                                                title="Cancel"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            <ScheduleRideModal
                isOpen={showScheduleModal}
                onClose={handleModalClose}
                onSuccess={fetchScheduledRides}
                editingSchedule={editingSchedule}
            />
        </div>
    );
};

export default ScheduledRides;
