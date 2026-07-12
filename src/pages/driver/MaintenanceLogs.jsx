import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wrench,
    Plus,
    Calendar,
    DollarSign,
    CheckCircle2,
    AlertTriangle,
    History,
    ClipboardList
} from 'lucide-react';

const MaintenanceLogs = () => {
    const [logs, setLogs] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        service_type: '',
        description: '',
        cost: '',
        service_date: new Date().toISOString().split('T')[0],
        next_service_date: '',
        odometer_reading: ''
    });

    const fetchLogs = useCallback(async () => {
        try {
            const res = await api.get('/maintenance-logs/');
            setLogs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch logs', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/maintenance-logs/', formData);
            setShowAddModal(false);
            setFormData({
                service_type: '',
                description: '',
                cost: '',
                service_date: new Date().toISOString().split('T')[0],
                next_service_date: '',
                odometer_reading: ''
            });
            fetchLogs();
        } catch (err) {
            console.error('Failed to add log', err);
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-12 bg-slate-50 px-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-black text-secondary tracking-tighter flex items-center gap-4">
                            <div className="p-3 bg-primary rounded-3xl text-secondary shadow-lg shadow-primary/20">
                                <Wrench size={32} />
                            </div>
                            Trike Maintenance
                        </h1>
                        <p className="text-slate-500 font-bold mt-2 uppercase text-[10px] tracking-[0.2em]">Keep your vehicle in top condition for Trento service</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-secondary text-primary font-black px-8 py-4 rounded-[2rem] flex items-center gap-3 shadow-2xl hover:scale-105 transition-all w-full md:w-auto justify-center"
                    >
                        <Plus size={20} />
                        Log New Service
                    </button>
                </div>

                <div className="grid gap-6">
                    {loading ? (
                        <div className="text-center py-20 opacity-20 font-black uppercase tracking-widest italic">Scanning logs...</div>
                    ) : logs.length === 0 ? (
                        <div className="bg-white p-12 rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6 font-black">
                                <ClipboardList size={40} />
                            </div>
                            <h3 className="text-xl font-black text-secondary uppercase tracking-tight">No Maintenance Logs Found</h3>
                            <p className="text-slate-400 font-bold mt-2 max-w-[280px]">Logging your services helps maintain your driver rating and vehicle safety.</p>
                        </div>
                    ) : (
                        logs.map((log, idx) => (
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                key={log.id}
                                className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col md:flex-row gap-8 relative overflow-hidden group"
                            >
                                <div className="absolute top-0 left-0 w-2 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-secondary px-3 py-1 rounded-full">
                                            {new Date(log.service_date).toLocaleDateString()}
                                        </span>
                                        {log.next_service_date && new Date(log.next_service_date) < new Date() && (
                                            <span className="bg-red-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
                                                <AlertTriangle size={10} /> Overdue
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-2xl font-black text-secondary italic uppercase tracking-tighter">{log.service_type}</h3>
                                    <p className="text-slate-500 font-medium mt-2 leading-relaxed">{log.description || 'No detailed description provided.'}</p>

                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                                        <div className="bg-slate-50 p-4 rounded-2xl">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Cost</p>
                                            <p className="text-sm font-black text-secondary flex items-center gap-1">
                                                <DollarSign size={14} className="text-primary" />
                                                {parseFloat(log.cost).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Next Service</p>
                                            <p className="text-sm font-black text-secondary flex items-center gap-1">
                                                <Calendar size={14} className="text-primary" />
                                                {log.next_service_date ? new Date(log.next_service_date).toLocaleDateString() : 'N/A'}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Odometer</p>
                                            <p className="text-sm font-black text-secondary flex items-center gap-1">
                                                <History size={14} className="text-primary" />
                                                {log.odometer_reading ? `${log.odometer_reading.toLocaleString()} km` : 'N/A'}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</p>
                                            <p className="text-sm font-black text-green-600 flex items-center gap-1">
                                                <CheckCircle2 size={14} /> Logged
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            {/* Add Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAddModal(false)}
                            className="absolute inset-0 bg-secondary/80 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl relative overflow-hidden"
                        >
                            <div className="bg-primary p-10 text-secondary">
                                <h3 className="text-3xl font-black uppercase italic tracking-tighter">Log Maintenance</h3>
                                <p className="font-bold opacity-60">Complete the details of your recent service</p>
                            </div>

                            <form onSubmit={handleSubmit} className="p-10 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-2">Service Type</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="e.g. Oil Change, Engine Check"
                                            value={formData.service_type}
                                            onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-secondary outline-none focus:border-primary transition-all"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-2">Description</label>
                                        <textarea
                                            placeholder="What work was done?"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-secondary outline-none focus:border-primary transition-all h-24 resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-2">Cost (₱)</label>
                                        <input
                                            required
                                            type="number"
                                            value={formData.cost}
                                            onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-secondary outline-none focus:border-primary transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-2">Odometer (km)</label>
                                        <input
                                            type="number"
                                            value={formData.odometer_reading}
                                            onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-secondary outline-none focus:border-primary transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-2">Service Date</label>
                                        <input
                                            required
                                            type="date"
                                            value={formData.service_date}
                                            onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-secondary outline-none focus:border-primary transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-2">Next Service Date</label>
                                        <input
                                            required
                                            type="date"
                                            value={formData.next_service_date}
                                            onChange={(e) => setFormData({ ...formData, next_service_date: e.target.value })}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-secondary outline-none focus:border-primary transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 font-black uppercase tracking-widest text-xs py-5 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] font-black uppercase tracking-widest text-xs py-5 rounded-2xl bg-secondary text-primary shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                                    >
                                        Save Record
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MaintenanceLogs;
