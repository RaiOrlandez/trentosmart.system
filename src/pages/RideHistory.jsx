import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    ChevronRight,
    Search,
    Filter,
    ArrowLeft,
    Car,
    FileText,
    Download,
    TrendingUp,
    DollarSign,
    Navigation2,
    Wallet,
    CreditCard,
    Banknote
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ReceiptModal from '../components/ReceiptModal';

const RideHistory = () => {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRide, setSelectedRide] = useState(null);
    const [filter, setFilter] = useState('all'); // all, completed, cancelled
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [priceRange, setPriceRange] = useState({ min: '', max: '' });

    useEffect(() => {
        fetchRides();
    }, []);

    const fetchRides = async () => {
        try {
            const res = await api.get('/rides/my_rides/');
            setRides(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch rides', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
            case 'cancelled': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
        }
    };

    const getPaymentIcon = (method) => {
        switch (method) {
            case 'gcash': return <CreditCard size={16} className="text-blue-600" />;
            case 'wallet': return <Wallet size={16} className="text-primary" />;
            default: return <Banknote size={16} className="text-green-600" />;
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    };

    // Advanced filtering
    const filteredRides = (Array.isArray(rides) ? rides : []).filter(r => {
        // Status filter
        if (filter !== 'all' && r.status !== filter) return false;

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesPickup = r.pickup_address?.toLowerCase().includes(query);
            const matchesDest = r.dest_address?.toLowerCase().includes(query);
            if (!matchesPickup && !matchesDest) return false;
        }

        // Date range filter
        if (dateRange.start && new Date(r.requested_at) < new Date(dateRange.start)) return false;
        if (dateRange.end && new Date(r.requested_at) > new Date(dateRange.end)) return false;

        // Payment method filter
        if (paymentFilter !== 'all' && r.payment_method !== paymentFilter) return false;

        // Price range filter
        if (priceRange.min && parseFloat(r.fare) < parseFloat(priceRange.min)) return false;
        if (priceRange.max && parseFloat(r.fare) > parseFloat(priceRange.max)) return false;

        return true;
    });

    // Statistics
    const stats = {
        totalRides: filteredRides.length,
        totalSpent: filteredRides.reduce((sum, r) => sum + parseFloat(r.fare || 0), 0),
        avgFare: filteredRides.length > 0 ? filteredRides.reduce((sum, r) => sum + parseFloat(r.fare || 0), 0) / filteredRides.length : 0,
        completedRides: filteredRides.filter(r => r.status === 'completed').length
    };

    // Export to CSV
    const exportToCSV = () => {
        const headers = ['Date', 'Time', 'Pickup', 'Destination', 'Fare', 'Payment Method', 'Status'];
        const rows = filteredRides.map(r => [
            formatDate(r.requested_at),
            formatTime(r.requested_at),
            r.pickup_address,
            r.dest_address,
            `₱${parseFloat(r.fare || 0).toFixed(2)}`,
            r.payment_method || 'cash',
            r.status
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trento-rides-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const clearFilters = () => {
        setSearchQuery('');
        setDateRange({ start: '', end: '' });
        setPaymentFilter('all');
        setPriceRange({ min: '', max: '' });
        setFilter('all');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 bg-slate-50 dark:bg-slate-950 px-6 transition-colors duration-500">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <Link to="/passenger" className="flex items-center gap-2 text-slate-400 hover:text-secondary dark:hover:text-white transition-colors mb-4 group">
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="text-xs font-black uppercase tracking-widest">Back to Dashboard</span>
                        </Link>
                        <h1 className="text-4xl font-black text-secondary dark:text-white uppercase tracking-tight">Ride History</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">Complete record of your journeys in Trento</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={exportToCSV}
                            disabled={filteredRides.length === 0}
                            className="flex items-center gap-2 bg-green-600 text-white font-bold px-6 py-3 rounded-2xl hover:bg-green-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download size={18} />
                            <span className="hidden md:inline">Export CSV</span>
                        </button>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-2 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-white/10 text-secondary dark:text-white font-bold px-6 py-3 rounded-2xl hover:border-primary transition-all shadow-sm"
                        >
                            <Filter size={18} />
                            <span className="hidden md:inline">Filters</span>
                        </button>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                                <Navigation2 className="text-primary" size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Rides</p>
                                <p className="text-3xl font-black text-secondary dark:text-white">{stats.totalRides}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center">
                                <DollarSign className="text-green-600 dark:text-green-400" size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Spent</p>
                                <p className="text-3xl font-black text-secondary dark:text-white">₱{stats.totalSpent.toFixed(2)}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                                <TrendingUp className="text-blue-600 dark:text-blue-400" size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Avg Fare</p>
                                <p className="text-3xl font-black text-secondary dark:text-white">₱{stats.avgFare.toFixed(2)}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center">
                                <FileText className="text-orange-600 dark:text-orange-400" size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Completed</p>
                                <p className="text-3xl font-black text-secondary dark:text-white">{stats.completedRides}</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Advanced Filters */}
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-white/5 p-6 mb-8 shadow-sm overflow-hidden"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-black text-secondary dark:text-white">Advanced Filters</h3>
                                <button
                                    onClick={clearFilters}
                                    className="text-xs font-bold text-primary hover:underline"
                                >
                                    Clear All
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Date Range */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Start Date</label>
                                    <input
                                        type="date"
                                        value={dateRange.start}
                                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl py-2 px-4 text-sm font-bold text-secondary dark:text-white outline-none focus:border-primary"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">End Date</label>
                                    <input
                                        type="date"
                                        value={dateRange.end}
                                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl py-2 px-4 text-sm font-bold text-secondary dark:text-white outline-none focus:border-primary"
                                    />
                                </div>

                                {/* Payment Method */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Payment Method</label>
                                    <select
                                        value={paymentFilter}
                                        onChange={(e) => setPaymentFilter(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl py-2 px-4 text-sm font-bold text-secondary dark:text-white outline-none focus:border-primary"
                                    >
                                        <option value="all">All Methods</option>
                                        <option value="cash">Cash</option>
                                        <option value="gcash">GCash</option>
                                        <option value="wallet">Smart Wallet</option>
                                    </select>
                                </div>

                                {/* Status */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Status</label>
                                    <select
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl py-2 px-4 text-sm font-bold text-secondary dark:text-white outline-none focus:border-primary"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>

                                {/* Price Range */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Min Price</label>
                                    <input
                                        type="number"
                                        placeholder="₱0"
                                        value={priceRange.min}
                                        onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl py-2 px-4 text-sm font-bold text-secondary dark:text-white outline-none focus:border-primary"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Max Price</label>
                                    <input
                                        type="number"
                                        placeholder="₱999"
                                        value={priceRange.max}
                                        onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl py-2 px-4 text-sm font-bold text-secondary dark:text-white outline-none focus:border-primary"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Search Bar */}
                <div className="mb-8">
                    <div className="relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by pickup or destination..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-white/10 rounded-3xl py-4 pl-14 pr-6 text-secondary dark:text-white font-bold outline-none focus:border-primary transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Rides List */}
                {filteredRides.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-20 bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border border-slate-100 dark:border-white/5"
                    >
                        <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                            <Car size={40} />
                        </div>
                        <h3 className="text-xl font-black text-secondary dark:text-white mb-2">No trips found</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mb-8 font-medium">
                            {searchQuery || showFilters ? 'Try adjusting your filters' : 'Your ride history will appear here once you\'ve taken your first trip in Trento.'}
                        </p>
                        <Link to="/passenger" className="bg-primary text-secondary font-black px-8 py-4 rounded-2xl hover:bg-slate-800 hover:text-white transition-all shadow-lg inline-block">
                            Book a Ride Now
                        </Link>
                    </motion.div>
                ) : (
                    <div className="space-y-4">
                        {filteredRides.map((ride, index) => (
                            <motion.div
                                key={ride.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => setSelectedRide(ride)}
                                className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm hover:shadow-xl border border-slate-100 dark:border-white/5 group transition-all cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[5rem] -z-0 group-hover:scale-110 transition-transform"></div>

                                <div className="flex flex-col md:flex-row gap-6 relative z-10">
                                    {/* Date & Icon */}
                                    <div className="flex md:flex-col items-center justify-between md:justify-center md:w-24 gap-2 border-b md:border-b-0 md:border-r border-slate-100 dark:border-white/5 pb-4 md:pb-0 md:pr-6">
                                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-secondary transition-colors">
                                            <Calendar size={20} />
                                        </div>
                                        <div className="text-right md:text-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDate(ride.requested_at).split(' ')[0]}</p>
                                            <p className="text-lg font-black text-secondary dark:text-white leading-none">{formatDate(ride.requested_at).split(' ')[1].replace(',', '')}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-1">{formatTime(ride.requested_at)}</p>
                                        </div>
                                    </div>

                                    {/* Route Info */}
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-2.5 h-2.5 rounded-full bg-primary border-4 border-white dark:border-slate-900 shadow-sm shrink-0"></div>
                                            <p className="text-sm font-bold text-secondary dark:text-white truncate">{ride.pickup_address}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-2.5 h-2.5 rounded-full bg-secondary dark:bg-white border-4 border-white dark:border-slate-900 shadow-sm shrink-0"></div>
                                            <p className="text-sm font-bold text-secondary dark:text-white truncate">{ride.dest_address}</p>
                                        </div>
                                    </div>

                                    {/* Payment & Fare */}
                                    <div className="flex items-center justify-between md:flex-col md:items-end md:justify-center md:w-40 gap-3 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 dark:border-white/5 md:pl-6">
                                        <div className="flex items-center gap-2">
                                            {getPaymentIcon(ride.payment_method || 'cash')}
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 capitalize">{ride.payment_method || 'Cash'}</span>
                                        </div>
                                        <p className="text-3xl font-black text-secondary dark:text-white">₱{parseFloat(ride.fare || 0).toFixed(2)}</p>
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(ride.status)}`}>
                                            {ride.status}
                                        </span>
                                    </div>

                                    {/* Arrow */}
                                    <div className="hidden md:flex items-center justify-center w-10 text-slate-300 group-hover:text-primary transition-colors">
                                        <ChevronRight size={24} />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            <ReceiptModal
                isOpen={!!selectedRide}
                onClose={() => setSelectedRide(null)}
                ride={selectedRide}
            />
        </div>
    );
};

export default RideHistory;
