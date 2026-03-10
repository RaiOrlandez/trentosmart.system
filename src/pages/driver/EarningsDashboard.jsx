import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { motion } from 'framer-motion';
import {
    TrendingUp,
    DollarSign,
    ArrowUpRight,
    Wallet,
    Navigation2,
    Download,
    Filter,
    Receipt,
    PieChart
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart as RechartsPieChart,
    Pie,
    Cell
} from 'recharts';
import WithdrawalModal from '../../components/WithdrawalModal';
import { useAuth } from '../../context/AuthContext.jsx';

const EarningsDashboard = () => {
    const [timeRange, setTimeRange] = useState('week'); // 'day', 'week', 'month'
    const [trips, setTrips] = useState([]);
    const [stats, setStats] = useState({
        today: 1250,
        week: 8750,
        month: 32400,
        total: 156800,
        trips_today: 14,
        trips_week: 87,
        trips_month: 324,
        avg_fare: 95,
        highest_fare: 450,
        commission_rate: 15
    });
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);
    const [balance, setBalance] = useState(0);

    useAuth();

    useEffect(() => {
        fetchEarningsData();
    }, [timeRange]);

    const fetchEarningsData = async () => {
        try {
            // Fetch actual balance
            const balanceRes = await api.get('/wallet/');
            setBalance(parseFloat(balanceRes.data.balance));

            // Fetch actual analytics
            const analyticsRes = await api.get('/driver/analytics/');
            const data = analyticsRes.data;

            setStats(prev => ({
                ...prev,
                today: data.today || 0,
                week: data.week || 0,
                total: data.total || 0,
                trips_today: data.trips_count || 0, // In real app, might want trips_today specifically
            }));

            if (data.chart_data) {
                setChartData(data.chart_data);
            }

            // Fetch actual trips (rides)
            const ridesRes = await api.get('/rides/my_rides/');
            // Format rides for the table
            const formattedTrips = ridesRes.data
                .filter(r => r.status === 'completed')
                .map(r => ({
                    id: r.id,
                    date: r.completed_at,
                    pickup: r.pickup_address,
                    dropoff: r.dest_address,
                    distance: 'N/A',
                    duration: 'N/A',
                    total: parseFloat(r.fare),
                    commission: parseFloat(r.lgu_commission || 0),
                    net: parseFloat(r.driver_earnings || 0),
                    status: 'completed'
                }));

            if (formattedTrips.length > 0) {
                setTrips(formattedTrips);
            }

        } catch (err) {
            console.error("Failed to load earnings", err);
        } finally {
            setLoading(false);
        }
    };

    const earningsBreakdown = [
        { name: 'Base Fares', value: stats.today * 0.35, color: '#FFD700' },
        { name: 'Distance Charges', value: stats.today * 0.50, color: '#1e293b' },
        { name: 'Surge Pricing', value: stats.today * 0.15, color: '#10b981' }
    ];

    const getCurrentEarnings = () => {
        switch (timeRange) {
            case 'day': return stats.today;
            case 'week': return stats.week;
            case 'month': return stats.month;
            default: return stats.week;
        }
    };

    const getCurrentTrips = () => {
        switch (timeRange) {
            case 'day': return stats.trips_today;
            case 'week': return stats.trips_week;
            case 'month': return stats.trips_month;
            default: return stats.trips_week;
        }
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
                <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-secondary dark:text-white uppercase tracking-tight flex items-center gap-3 mb-2">
                            <TrendingUp size={36} className="text-primary" /> Earnings Hub
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Complete transparency on your income and performance</p>
                    </div>

                    {/* Time Range Selector & Cashout */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex gap-2 bg-white dark:bg-slate-900 p-1 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10">
                            {['day', 'week', 'month'].map(range => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-6 py-2 rounded-xl text-sm font-bold capitalize transition-all ${timeRange === range
                                        ? 'bg-secondary text-white shadow-lg dark:bg-primary dark:text-secondary'
                                        : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5'
                                        }`}
                                >
                                    {range === 'day' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setIsWithdrawalOpen(true)}
                            className="bg-primary text-secondary font-black px-8 py-3 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <DollarSign size={20} />
                            Cash Out
                        </button>
                    </div>
                </div>

                {/* Hero Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="bg-gradient-to-br from-secondary via-slate-800 to-slate-900 text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl"
                    >
                        <div className="relative z-10">
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Available for Cashout</p>
                            <h2 className="text-5xl font-black mb-4">₱{balance.toLocaleString()}</h2>
                            <div className="inline-flex items-center gap-2 bg-green-500/20 px-3 py-1 rounded-full text-xs font-bold text-green-400">
                                <ArrowUpRight size={14} /> Ready to withdraw
                            </div>
                        </div>
                        <DollarSign size={180} className="absolute -right-8 -bottom-10 text-white/5 rotate-12" />
                    </motion.div>

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/10 shadow-sm"
                    >
                        <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                            <Navigation2 size={28} />
                        </div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">Total Trips</p>
                        <h2 className="text-4xl font-black text-secondary dark:text-white">{getCurrentTrips()}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">Avg ₱{stats.avg_fare} per trip</p>
                    </motion.div>

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/10 shadow-sm"
                    >
                        <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center mb-4">
                            <Wallet size={28} />
                        </div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">Net Income</p>
                        <h2 className="text-4xl font-black text-secondary dark:text-white">₱{(getCurrentEarnings() * 0.85).toLocaleString()}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">After {stats.commission_rate}% commission</p>
                    </motion.div>

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/10 shadow-sm"
                    >
                        <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center mb-4">
                            <TrendingUp size={28} />
                        </div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">Highest Fare</p>
                        <h2 className="text-4xl font-black text-secondary dark:text-white">₱{stats.highest_fare}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">Long-distance trip</p>
                    </motion.div>
                </div>

                {/* Chart & Breakdown Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    {/* Performance Chart */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/10"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-secondary dark:text-white flex items-center gap-2">
                                Weekly Performance
                            </h3>
                            <button className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                <Download size={14} /> Export
                            </button>
                        </div>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="day"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}
                                        tickFormatter={(val) => `₱${val}`}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{
                                            borderRadius: '16px',
                                            border: 'none',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                            fontWeight: 'bold'
                                        }}
                                        formatter={(value) => [`₱${value}`, 'Earnings']}
                                    />
                                    <Bar dataKey="amount" fill="#FFD700" radius={[12, 12, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Earnings Breakdown Pie */}
                    <motion.div
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/10 shadow-sm"
                    >
                        <h3 className="text-lg font-black text-secondary dark:text-white mb-6 flex items-center gap-2">
                            <PieChart size={20} className="text-primary" /> Income Sources
                        </h3>
                        <div className="h-[200px] mb-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                    <Pie
                                        data={earningsBreakdown}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {earningsBreakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </RechartsPieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-3">
                            {earningsBreakdown.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{item.name}</span>
                                    </div>
                                    <span className="text-sm font-black text-secondary dark:text-white">₱{item.value.toFixed(0)}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* Trip-by-Trip Breakdown */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/10 overflow-hidden"
                >
                    <div className="p-8 border-b border-slate-100 dark:border-white/5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-secondary dark:text-white flex items-center gap-2">
                                <Receipt size={24} className="text-primary" /> Trip-by-Trip Breakdown
                            </h3>
                            <button className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                <Filter size={14} /> Filter
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Time</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Route</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Fare</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Commission</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Net Earnings</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {trips.map((trip) => (
                                    <tr key={trip.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                                            {new Date(trip.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-bold text-secondary dark:text-white truncate max-w-[200px]">{trip.pickup}</span>
                                                <span className="text-xs text-slate-400 truncate max-w-[200px]">→ {trip.dropoff}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-300">₱{trip.total.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-xs font-bold text-red-600 dark:text-red-400">-₱{trip.commission.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-sm font-black text-primary">₱{trip.net.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total from {trips.length} trips</p>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-xs text-slate-400 font-bold mb-1">Gross</p>
                                    <p className="text-lg font-black text-secondary dark:text-white">₱{trips.reduce((sum, t) => sum + t.total, 0).toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-400 font-bold mb-1">Commission</p>
                                    <p className="text-lg font-black text-red-600 dark:text-red-400">-₱{trips.reduce((sum, t) => sum + t.commission, 0).toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-400 font-bold mb-1">Net Income</p>
                                    <p className="text-2xl font-black text-primary">₱{trips.reduce((sum, t) => sum + t.net, 0).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            <WithdrawalModal
                isOpen={isWithdrawalOpen}
                onClose={() => setIsWithdrawalOpen(false)}
                balance={balance}
                onWithdrawalSuccess={fetchEarningsData}
            />
        </div>
    );
};

export default EarningsDashboard;
