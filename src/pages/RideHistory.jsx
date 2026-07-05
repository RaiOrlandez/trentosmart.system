import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    ChevronRight,
    Search,
    Filter,
    ArrowLeft,
    Trash2,
    Download,
    TrendingUp,
    DollarSign,
    Navigation2,
    Wallet,
    CreditCard,
    Banknote,
    Clock,
    User,
    Car,
    Phone,
    MapPin,
    AlertCircle,
    Award
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ensureImageUrl } from '../utils/url';
import ReceiptModal from '../components/ReceiptModal';

const RideHistory = () => {
    const { user } = useContext(AuthContext);
    const isDriver = user?.role === 'driver';

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

    const deleteRideFromHistory = async (e, rideId) => {
        e.stopPropagation(); // Prevent opening receipt modal
        const confirmDelete = window.confirm("Are you sure you want to remove this ride from your history? (This will not delete the record for LGU administration)");
        if (!confirmDelete) return;

        try {
            await api.post(`/rides/${rideId}/hide_from_history/`);
            setRides(prev => prev.filter(r => r.id !== rideId));
        } catch (err) {
            console.error('Failed to hide ride from history', err);
            alert('Failed to delete history item. Please try again.');
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
            case 'gcash': return <CreditCard size={16} className="text-blue-600 dark:text-blue-400" />;
            case 'wallet': return <Wallet size={16} className="text-primary" />;
            default: return <Banknote size={16} className="text-green-600 dark:text-green-400" />;
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

    // Filtering logic
    const filteredRides = (Array.isArray(rides) ? rides : []).filter(r => {
        if (filter !== 'all' && r.status !== filter) return false;

        // Search query: filters addresses, driver username, vehicle details or passenger username
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesPickup = r.pickup_address?.toLowerCase().includes(query);
            const matchesDest = r.dest_address?.toLowerCase().includes(query);
            
            let matchesUser = false;
            if (isDriver) {
                // If user is driver, filter by passenger name
                const passengerName = typeof r.passenger === 'object' ? r.passenger.username : r.passenger;
                matchesUser = passengerName?.toLowerCase().includes(query);
            } else {
                // If user is passenger, filter by driver name or vehicle details
                const driverObj = typeof r.driver === 'object' ? r.driver : null;
                const driverName = driverObj ? driverObj.username : r.driver;
                matchesUser = 
                    driverName?.toLowerCase().includes(query) ||
                    driverObj?.vehicle_plate?.toLowerCase().includes(query) ||
                    driverObj?.vehicle_model?.toLowerCase().includes(query) ||
                    driverObj?.body_number?.toLowerCase().includes(query);
            }

            if (!matchesPickup && !matchesDest && !matchesUser) return false;
        }

        if (dateRange.start && new Date(r.requested_at) < new Date(dateRange.start)) return false;
        if (dateRange.end && new Date(r.requested_at) > new Date(dateRange.end + 'T23:59:59')) return false;

        if (paymentFilter !== 'all' && r.payment_method !== paymentFilter) return false;

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

    const exportToCSV = () => {
        const headers = isDriver 
            ? ['Date', 'Time', 'Passenger Name', 'Pickup', 'Destination', 'Fare', 'Payment Method', 'Status']
            : ['Date', 'Time', 'Driver Name', 'Vehicle Details', 'Pickup', 'Destination', 'Fare', 'Payment Method', 'Status'];
        
        const rows = filteredRides.map(r => {
            const date = formatDate(r.requested_at);
            const time = formatTime(r.requested_at);
            const pickup = r.pickup_address;
            const dest = r.dest_address;
            const fare = `₱${parseFloat(r.fare || 0).toFixed(2)}`;
            const payment = r.payment_method || 'cash';
            const status = r.status;

            if (isDriver) {
                const passengerName = typeof r.passenger === 'object' ? r.passenger.username : r.passenger;
                return [date, time, passengerName, pickup, dest, fare, payment, status];
            } else {
                const driverObj = typeof r.driver === 'object' ? r.driver : null;
                const driverName = driverObj ? driverObj.username : r.driver || 'N/A';
                const vehicle = driverObj ? `${driverObj.vehicle_model} (${driverObj.vehicle_plate})` : 'N/A';
                return [date, time, driverName, vehicle, pickup, dest, fare, payment, status];
            }
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trento-history-${isDriver ? 'driver' : 'passenger'}-${new Date().toISOString().split('T')[0]}.csv`;
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
        <div className="min-h-screen pt-24 pb-12 bg-slate-50 dark:bg-slate-950 px-4 md:px-6 transition-colors duration-500">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <Link to={isDriver ? "/driver" : "/passenger"} className="flex items-center gap-2 text-slate-400 hover:text-secondary dark:hover:text-white transition-colors mb-4 group">
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="text-xs font-black uppercase tracking-widest">Back to Dashboard</span>
                        </Link>
                        <h1 className="text-4xl font-black text-secondary dark:text-white uppercase tracking-tight">
                            {isDriver ? 'Driver Job History' : 'Ride History'}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                            {isDriver 
                              ? 'Your complete record of passengers served and total earnings in Trento' 
                              : 'Complete record of your journeys in Trento'}
                        </p>
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
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
                                <Navigation2 className="text-primary" size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isDriver ? 'Total Trips' : 'Total Rides'}</p>
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
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center shrink-0">
                                <DollarSign className="text-green-600 dark:text-green-400" size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isDriver ? 'Total Earnings' : 'Total Spent'}</p>
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
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center shrink-0">
                                <TrendingUp className="text-blue-600 dark:text-blue-400" size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isDriver ? 'Average Earned' : 'Avg Fare'}</p>
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
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center shrink-0">
                                <Award className="text-orange-600 dark:text-orange-400" size={24} />
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
                            placeholder={isDriver ? "Search by passenger name, pickup, or destination..." : "Search by driver, plate, body number, pickup, or destination..."}
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
                            <Clock size={40} />
                        </div>
                        <h3 className="text-xl font-black text-secondary dark:text-white mb-2">No trips found</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mb-8 font-medium">
                            {searchQuery || showFilters ? 'Try adjusting your filters' : 'No trip records found.'}
                        </p>
                        {!isDriver && (
                            <Link to="/passenger" className="bg-primary text-secondary font-black px-8 py-4 rounded-2xl hover:bg-slate-800 hover:text-white transition-all shadow-lg inline-block">
                                Book a Ride Now
                            </Link>
                        )}
                    </motion.div>
                ) : (
                    <div className="space-y-4">
                        {filteredRides.map((ride, index) => {
                            const passengerObj = typeof ride.passenger === 'object' ? ride.passenger : null;
                            const passengerName = passengerObj ? passengerObj.username : ride.passenger;

                            const driverObj = typeof ride.driver === 'object' ? ride.driver : null;
                            const driverName = driverObj ? driverObj.username : ride.driver || 'Deleted User';

                            return (
                                <motion.div
                                    key={ride.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    onClick={() => setSelectedRide(ride)}
                                    className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm hover:shadow-xl border border-slate-100 dark:border-white/5 group transition-all cursor-pointer relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[5rem] -z-0 group-hover:scale-110 transition-transform"></div>

                                    <div className="flex flex-col lg:flex-row gap-6 relative z-10">
                                        {/* Date Section */}
                                        <div className="flex lg:flex-col items-center justify-between lg:justify-center lg:w-28 gap-2 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-white/5 pb-4 lg:pb-0 lg:pr-6">
                                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-secondary transition-colors">
                                                <Calendar size={20} />
                                            </div>
                                            <div className="text-right lg:text-center shrink-0">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDate(ride.requested_at).split(' ')[0]}</p>
                                                <p className="text-base font-black text-secondary dark:text-white leading-none mt-0.5">{formatDate(ride.requested_at).split(' ')[1].replace(',', '')}</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-1">{formatTime(ride.requested_at)}</p>
                                            </div>
                                        </div>

                                        {/* Role Specific Content */}
                                        <div className="flex-1 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                            {/* Person Detail (Driver or Passenger) */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-white/5">
                                                    {isDriver ? (
                                                        <img
                                                            src={ensureImageUrl(passengerObj?.profile_picture, passengerName)}
                                                            alt="Passenger"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <img
                                                            src={ensureImageUrl(driverObj?.profile_picture, driverName)}
                                                            alt="Driver"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                        {isDriver ? 'Passenger' : 'Driver Partner'}
                                                    </p>
                                                    <p className="text-sm font-black text-secondary dark:text-white truncate">
                                                        {isDriver ? passengerName : driverName}
                                                    </p>
                                                    
                                                    {/* Contact & Unit Info */}
                                                    {isDriver ? (
                                                        passengerObj?.phone_number && (
                                                            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold mt-0.5">
                                                                <Phone size={10} /> {passengerObj.phone_number}
                                                            </span>
                                                        )
                                                    ) : (
                                                        driverObj ? (
                                                            <div className="flex flex-col gap-0.5 mt-0.5">
                                                                <p className="text-[10px] font-bold text-slate-400">
                                                                    🛺 Plate: <span className="text-secondary dark:text-white font-black">{driverObj.vehicle_plate || 'N/A'}</span> • Unit: <span className="text-primary font-black">{driverObj.body_number || 'N/A'}</span>
                                                                </p>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                    Model: {driverObj.vehicle_model || 'N/A'} • Color: {driverObj.vehicle_color || 'N/A'} • {driverObj.sidecar_type || 'Standard'}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[9px] font-black text-red-500 uppercase">Driver info unavailable</span>
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            {/* Route Info */}
                                            <div className="flex-1 space-y-2 md:max-w-md w-full">
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={12} className="text-primary shrink-0" />
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                                                        <span className="font-bold">Pickup: </span>{ride.pickup_address}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={12} className="text-accent shrink-0" />
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                                                        <span className="font-bold">Dropoff: </span>{ride.dest_address}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status, Price, Actions */}
                                        <div className="flex items-center justify-between lg:flex-col lg:items-end lg:justify-center lg:w-44 gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-white/5 lg:pl-6 shrink-0">
                                            <div className="flex items-center gap-1.5">
                                                {getPaymentIcon(ride.payment_method || 'cash')}
                                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">{ride.payment_method || 'Cash'}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-black text-secondary dark:text-white leading-none">₱{parseFloat(ride.fare || 0).toFixed(2)}</p>
                                                {isDriver && (
                                                    <p className="text-[8px] text-green-500 font-bold uppercase tracking-wider mt-0.5">
                                                        Earned: ₱{(parseFloat(ride.fare || 0) - parseFloat(ride.lgu_commission || 0)).toFixed(2)}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${getStatusColor(ride.status)}`}>
                                                    {ride.status}
                                                </span>
                                                <button
                                                    onClick={(e) => deleteRideFromHistory(e, ride.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                                                    title="Remove from history"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* View Details Arrow */}
                                        <div className="hidden lg:flex items-center justify-center w-6 text-slate-300 group-hover:text-primary transition-colors">
                                            <ChevronRight size={18} />
                                        </div>
                                    </div>

                                    {/* Security Note for Driver */}
                                    {isDriver && ride.status === 'completed' && (
                                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center gap-2 text-[9px] text-slate-400 font-bold">
                                            <AlertCircle size={10} className="text-primary" />
                                            <span>In case of passenger left items, report to LGU system with Ride ID #{ride.id}</span>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
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
