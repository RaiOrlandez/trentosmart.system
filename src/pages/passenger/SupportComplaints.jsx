import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
    MessageSquare,
    AlertCircle,
    ChevronRight,
    Clock,
    CheckCircle,
    Search,
    Send,
    Shield,
    HelpCircle,
    Phone,
    Mail,
    LifeBuoy,
    Plus,
    X,
    MessageCircle
} from 'lucide-react';

const SupportComplaints = () => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const rideIdParam = queryParams.get('ride');

    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(!!rideIdParam);
    const [subject, setSubject] = useState(rideIdParam ? `Issue with Ride #${rideIdParam}` : '');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [activeTab, setActiveTab] = useState('tickets'); // tickets, faq, contact

    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = async () => {
        try {
            const res = await api.get('/complaints/');
            setComplaints(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch complaints', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/complaints/', {
                subject,
                description,
                status: 'pending'
            });
            setSuccess(true);
            setSubject('');
            setDescription('');
            fetchComplaints();
            setTimeout(() => {
                setSuccess(false);
                setShowForm(false);
            }, 3000);
        } catch (err) {
            alert('Failed to submit complaint. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'pending': return 'bg-orange-100 text-orange-600 border-orange-200';
            case 'investigation': return 'bg-blue-100 text-blue-600 border-blue-200';
            case 'closed': return 'bg-green-100 text-green-600 border-green-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const faqs = [
        { q: "How do I book a ride?", a: "Enter your pickup and destination in the passenger dashboard and click 'Find Driver'." },
        { q: "What is the LGU commission?", a: "Trento LGU takes a small 5% commission from each ride to maintain the system and infrastructure." },
        { q: "How does GCash payment work?", a: "Select GCash at checkout, follow the secure login steps, and confirm with your MPIN. It's instant and safe." },
        { q: "Can I schedule a ride ahead of time?", a: "Yes, use the 'Schedule' feature to book trips up to 7 days in advance." }
    ];

    return (
        <div className="min-h-screen pt-24 pb-12 bg-slate-50 dark:bg-slate-950 px-6 transition-colors duration-500">
            <div className="max-w-5xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-primary font-black uppercase tracking-[0.3em] text-[10px]">
                            <LifeBuoy size={14} /> Help & Support Center
                        </div>
                        <h1 className="text-5xl font-black text-secondary dark:text-white tracking-tight leading-none uppercase">Support <span className="text-primary-dark font-black">&</span> Complaints</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg mt-3">We're here to ensure your journey in Trento is smooth and safe.</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-none">
                    {[
                        { id: 'tickets', label: 'My Tickets', icon: MessageSquare },
                        { id: 'faq', label: 'Quick Help (FAQ)', icon: HelpCircle },
                        { id: 'contact', label: 'Contact Us', icon: Phone },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all whitespace-nowrap ${activeTab === tab.id
                                ? "bg-secondary text-white dark:bg-primary dark:text-secondary shadow-xl scale-105"
                                : "bg-white dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-white/5 hover:bg-slate-50"
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'tickets' && (
                    <div className="space-y-8">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Tickets</p>
                                <p className="text-4xl font-black text-secondary dark:text-white">{complaints.length}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Resolved</p>
                                <p className="text-4xl font-black text-green-500">{complaints.filter(c => c.status === 'closed').length}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Active</p>
                                <p className="text-4xl font-black text-orange-500">{complaints.filter(c => c.status !== 'closed').length}</p>
                            </div>
                        </div>

                        {/* Complaint List */}
                        <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-4 shadow-xl border border-slate-100 dark:border-white/5 relative overflow-hidden">
                            <div className="p-6 flex items-center justify-between border-b border-slate-50 dark:border-white/5">
                                <h3 className="text-xl font-black text-secondary dark:text-white flex items-center gap-2">
                                    <Clock size={24} className="text-primary" /> Recent Tickets
                                </h3>
                                <button
                                    onClick={() => setShowForm(true)}
                                    className="bg-primary text-secondary px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2"
                                >
                                    <Plus size={16} /> New Complaint
                                </button>
                            </div>

                            <div className="divide-y divide-slate-50 dark:divide-white/5">
                                {loading ? (
                                    <div className="py-20 text-center text-slate-400 italic">Loading your records...</div>
                                ) : complaints.length === 0 ? (
                                    <div className="py-20 text-center flex flex-col items-center">
                                        <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 mb-6">
                                            <Shield size={40} />
                                        </div>
                                        <h4 className="text-xl font-black text-secondary dark:text-white">All Clear!</h4>
                                        <p className="text-slate-500 mt-2 font-medium">You don't have any active complaints or reports.</p>
                                    </div>
                                ) : (
                                    complaints.map((c) => (
                                        <motion.div
                                            key={c.id}
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                            className="p-8 hover:bg-slate-50 dark:hover:bg-white/5 transition-all group cursor-pointer"
                                        >
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusStyle(c.status)}`}>
                                                            {c.status}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ticket #{c.id} • {new Date(c.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <h4 className="text-xl font-black text-secondary dark:text-white tracking-tight group-hover:text-primary transition-colors">{c.subject}</h4>
                                                    <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-1">{c.description}</p>
                                                </div>
                                                <ChevronRight size={20} className="text-slate-300 group-hover:translate-x-2 transition-transform hidden md:block" />
                                            </div>
                                            {c.admin_notes && (
                                                <div className="mt-4 p-4 bg-primary/10 rounded-2xl border-l-4 border-primary">
                                                    <p className="text-xs font-black uppercase text-secondary mb-1">Response from Admin:</p>
                                                    <p className="text-secondary/80 text-sm italic font-medium">"{c.admin_notes}"</p>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'faq' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {faqs.map((faq, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm"
                            >
                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4">
                                    <HelpCircle size={20} />
                                </div>
                                <h4 className="text-lg font-black text-secondary dark:text-white mb-2">{faq.q}</h4>
                                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{faq.a}</p>
                            </motion.div>
                        ))}
                    </div>
                )}

                {activeTab === 'contact' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-[1.5rem] flex items-center justify-center mb-6">
                                <Phone size={32} />
                            </div>
                            <h4 className="font-black text-secondary dark:text-white mb-2 uppercase tracking-widest text-xs font-bold text-slate-400">Emergency Hotlines</h4>
                            <p className="text-xl font-black text-secondary dark:text-white">911</p>
                            <p className="text-xl font-black text-secondary dark:text-white">09XX XXX XXXX</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-[1.5rem] flex items-center justify-center mb-6">
                                <Mail size={32} />
                            </div>
                            <h4 className="font-black text-secondary dark:text-white mb-2 uppercase tracking-widest text-xs font-bold text-slate-400">Official Email</h4>
                            <p className="text-lg font-black text-secondary dark:text-white">support@transmart-trento.ph</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-[1.5rem] flex items-center justify-center mb-6">
                                <AlertCircle size={32} />
                            </div>
                            <h4 className="font-black text-secondary dark:text-white mb-2 uppercase tracking-widest text-xs font-bold text-slate-400">Local Office</h4>
                            <p className="text-sm font-bold text-secondary dark:text-white">LGU Center, Trento Municipality, Agusan del Sur</p>
                        </div>
                    </div>
                )}

                {/* Complaint Modal Overlay */}
                <AnimatePresence>
                    {showForm && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setShowForm(false)}
                                className="absolute inset-0 bg-secondary/80 backdrop-blur-xl"
                            />
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0, y: 50 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 50 }}
                                className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-[3rem] p-10 relative z-10 shadow-2xl overflow-hidden border border-white/20"
                            >
                                <div className="absolute top-0 left-0 w-full h-2 bg-primary" />
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-3xl font-black text-secondary dark:text-white leading-tight uppercase tracking-tight">Post a Ticket</h2>
                                    <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-secondary"><X size={24} /></button>
                                </div>

                                {success ? (
                                    <div className="py-12 text-center">
                                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <CheckCircle size={40} />
                                        </div>
                                        <h3 className="text-2xl font-black text-secondary dark:text-white mb-2 uppercase">Ticket Submitted!</h3>
                                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Reference: #{Math.floor(Math.random() * 900000 + 100000)}</p>
                                        <p className="text-slate-500 mt-4 font-medium">An admin will review your ticket within 24 hours.</p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Subject</label>
                                            <input
                                                required
                                                value={subject}
                                                onChange={(e) => setSubject(e.target.value)}
                                                placeholder="e.g. Lost Item, Driver Misbehavior"
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-white/5 rounded-2xl py-4 px-6 font-bold text-secondary dark:text-white outline-none focus:border-primary transition-all shadow-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Detailed Description</label>
                                            <textarea
                                                required
                                                rows={5}
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Please provide details including ride ID or driver name if possible..."
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-white/5 rounded-2xl py-4 px-6 font-bold text-secondary dark:text-white outline-none focus:border-primary transition-all shadow-sm"
                                            />
                                        </div>
                                        <button
                                            disabled={submitting}
                                            className="w-full bg-secondary text-white font-black py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all text-lg uppercase tracking-widest"
                                        >
                                            <Send size={20} />
                                            {submitting ? 'Submitting...' : 'Submit Report'}
                                        </button>
                                    </form>
                                )}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default SupportComplaints;
