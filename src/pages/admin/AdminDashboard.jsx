import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import Map from '../../components/Map';
import { ensureImageUrl } from '../../utils/url';
import {
  Map as MapIcon,
  TrendingUp,
  UserCheck,
  ShieldAlert,
  Users,
  CheckCircle2,
  XCircle,
  Car,
  Settings,
  DollarSign,
  Megaphone,
  Bell,
  Search,
  Eye,
  UserPlus,
  RefreshCw,
  Clock,
  Sparkles,
  MapPin,
  ClipboardList,
  Star,
  Download
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';


import UserDetailModal from '../../components/UserDetailModal';
import CreateUserModal from '../../components/CreateUserModal';
import useSystemEvents from '../../hooks/useSystemEvents';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    drivers: 0,
    activeRides: 0,
    incidents: 0,
    totalRevenue: 0,
    commission: 0
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { driverLocation, newRide, newSignup, emergencyAlert, systemEvent } = useSystemEvents();
  const [activeSOS, setActiveSOS] = useState(null);
  const [isUpdatingMap, setIsUpdatingMap] = useState(false);
  const [approvingId, setApprovingId] = useState(null); // prevent double-click
  const isFetchingUsers = React.useRef(false);           // prevent overlapping fetches

  // Live Alerts & Notifications State
  const [liveAlerts, setLiveAlerts] = useState([
    { time: '2h ago', type: 'System', msg: 'Map tile update completed.' },
  ]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [demandPoints, setDemandPoints] = useState([]);
  const [refreshInterval, setRefreshInterval] = useState(null);

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/reports/export/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'LGU_Revenue_Report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      alert("Failed to export report.");
    }
  };

  const fetchStats = useCallback(async () => {
    try {
      const usersRes = await api.get('/users/');
      const ridesRes = await api.get('/rides/');
      const incidentsRes = await api.get('/incidents/');

      const usersData = Array.isArray(usersRes.data) ? usersRes.data : [];
      const ridesData = Array.isArray(ridesRes.data) ? ridesRes.data : [];
      const incidentsData = Array.isArray(incidentsRes.data) ? incidentsRes.data : [];

      setStats({
        drivers: usersData.filter(u => u.role === 'driver').length,
        onlineDrivers: usersData.filter(u => u.role === 'driver' && u.is_online).length,
        onlinePassengers: usersData.filter(u => u.role === 'passenger' && u.is_online).length,
        activeRides: ridesData.filter(r => r.status === 'requested' || r.status === 'accepted' || r.status === 'on_route').length,
        totalRidesToday: ridesData.filter(r => new Date(r.requested_at).toDateString() === new Date().toDateString()).length,
        incidents: incidentsData.length,
        totalRevenue: ridesData.filter(r => r.status === 'completed').reduce((sum, r) => sum + parseFloat(r.fare || 0), 0),
        commission: ridesData.filter(r => r.status === 'completed').reduce((sum, r) => sum + parseFloat(r.fare || 0), 0) * 0.05 // Real 5%
      });
    } catch (err) {
      console.error("Failed to initial stats", err);
    }
  }, []);

  const fetchUsers = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && isFetchingUsers.current) return; // debounce: skip if already running (unless forced)
    isFetchingUsers.current = true;
    setLoadingUsers(true);
    try {
      const res = await api.get('/users/');
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      // Ensure newest are on top
      const sorted = [...data].sort((a, b) => new Date(b.date_joined) - new Date(a.date_joined));
      setUsers(sorted);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoadingUsers(false);
      isFetchingUsers.current = false;
    }
  }, []);

  useEffect(() => {
    fetchStats();
    if (activeTab === 'drivers' || activeTab === 'passengers') {
      fetchUsers();
    }
  }, [activeTab, fetchStats, fetchUsers]);

  // Process Real-time Events
  useEffect(() => {
    if (newRide) {
      setLiveAlerts(prev => [{
        time: 'JUST NOW',
        type: 'RIDE',
        msg: `New ride request from ${typeof newRide.passenger === 'object' ? newRide.passenger.username : 'user'}`,
        urgent: false
      }, ...prev].slice(0, 15));
      fetchStats();
    }
  }, [newRide, fetchStats]);

  useEffect(() => {
    if (newSignup) {
      setLiveAlerts(prev => [{
        time: 'JUST NOW',
        type: 'USER',
        msg: `New signup: ${newSignup.username} (${newSignup.role})`,
        urgent: false
      }, ...prev].slice(0, 15));
      fetchUsers();
    }
  }, [newSignup, fetchUsers]);

  useEffect(() => {
    if (emergencyAlert) {
      setLiveAlerts(prev => [{
        time: 'CRITICAL',
        type: 'SOS',
        msg: emergencyAlert.message || 'Emergency signal detected!',
        urgent: true
      }, ...prev].slice(0, 15));
      setActiveSOS(emergencyAlert);
      setActiveTab('live'); // Force switch to map to see location
      fetchStats();
    }
  }, [emergencyAlert, fetchStats]);

  useEffect(() => {
    if (systemEvent) {
      const typeMap = {
        'config_update': 'FARE',
        'withdrawal_request': 'WALLET',
        'withdrawal_update': 'WALLET',
        'safety_alert': 'SAFETY',
        'safety_update': 'SAFETY',
        'review_posted': 'FEEDBACK',
        'ride_activity': 'RIDE',
        'driver_verified': 'USER'
      };

      setLiveAlerts(prev => [{
        time: 'REAL-TIME',
        type: typeMap[systemEvent.type] || 'SYSTEM',
        msg: systemEvent.message,
        urgent: systemEvent.type.includes('safety') || systemEvent.type.includes('withdrawal_request')
      }, ...prev].slice(0, 15));

      // Auto-refresh relevant data
      if (systemEvent.type.includes('config')) fetchStats();
      if (systemEvent.type.includes('ride')) fetchStats();
      if (systemEvent.type.includes('withdrawal')) fetchStats();
      if (systemEvent.type === 'driver_verified') fetchUsers();
    }
  }, [systemEvent, fetchStats, fetchUsers]);

  // Live Map Refresh Logic
  const [liveMarkers, setLiveMarkers] = useState([]);

  // Live Map Tracking & Demand Analysis
  const fetchLiveData = useCallback(async () => {
    try {
      const [usersRes, ridesRes] = await Promise.all([
        api.get('/users/'),
        api.get('/rides/')
      ]);

      const usersData = Array.isArray(usersRes.data) ? usersRes.data : [];
      const ridesData = Array.isArray(ridesRes.data) ? ridesRes.data : [];

      // Supply: Online Drivers with coordinates
      const activeRides = ridesData.filter(r => r.status === 'accepted' || r.status === 'on_route');
      const drivers = usersData.filter(u => u.role === 'driver' && u.last_lat && u.last_lng);

      const newMarkers = drivers.map(d => {
        const currentRide = activeRides.find(r => r.driver?.id === d.id);
        const status = currentRide ? 'On Trip 🚩' : d.is_online ? 'Available ✅' : 'Offline 🌑';
        return {
          id: d.id,
          lat: parseFloat(d.last_lat),
          lng: parseFloat(d.last_lng),
          title: d.vehicle_plate || d.username,
          info: `Driver: ${d.username}\nStatus: ${status}\nVehicle: ${d.vehicle_model || 'Tricycle'}`,
          isDriver: true,
          isOnline: d.is_online
        };
      });
      setLiveMarkers(newMarkers);

      // Demand: Locations where rides are requested but not yet matched
      const demand = ridesData
        .filter(r => r.status === 'requested')
        .map(r => ({
          lat: parseFloat(r.pickup_lat),
          lng: parseFloat(r.pickup_lng)
        }));
      setDemandPoints(demand);

    } catch (err) {
      console.error("Failed to fetch live data", err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'live') {
      fetchLiveData();
      const interval = setInterval(fetchLiveData, 5000); // 5s refresh
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchLiveData]);

  // Handle Real-time Driver Updates
  useEffect(() => {
    if (driverLocation) {
      // Update Live Map Markers if on live tab
      if (activeTab === 'live') {
        setLiveMarkers(prev => {
          const existingIdx = prev.findIndex(m => m.id === driverLocation.id);
          const newMarker = {
            id: driverLocation.id,
            lat: parseFloat(driverLocation.lat),
            lng: parseFloat(driverLocation.lng),
            title: driverLocation.username,
            info: `Driver: ${driverLocation.username}\nStatus: ${driverLocation.is_online ? 'Available ✅' : 'Offline 🌑'}`,
            isDriver: true,
            isOnline: driverLocation.is_online
          };

          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = newMarker;
            return updated;
          }
          return [...prev, newMarker];
        });
      }

      // Real-time update for Drivers Table Status
      setUsers(prev => prev.map(u => {
        if (u.id === driverLocation.id) {
          return {
            ...u,
            is_online: driverLocation.is_online,
            last_lat: driverLocation.lat,
            last_lng: driverLocation.lng
          };
        }
        return u;
      }));
    }
  }, [driverLocation, activeTab]);



  const approveDriver = async (userId) => {
    if (approvingId) return; // prevent double-click
    setApprovingId(userId);
    try {
      console.log(`Approving driver with ID: ${userId}`);
      const response = await api.post(`/users/${userId}/approve_driver/`);
      console.log('Approval response:', response.data);

      // Optimistically update local state immediately
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified_driver: true, verification_status: 'approved' } : u));
      alert(`Driver Verified Successfully! ${response.data.detail || ''}`);

      // Force refresh to ensure DB-confirmed state overrides optimistic update
      await fetchUsers(true);
    } catch (err) {
      console.error('Driver approval error:', err);
      console.error('Error response:', err.response?.data);

      let errorMsg = 'Failed to verify driver. ';
      if (err.response?.status === 403) {
        errorMsg += 'You do not have admin permissions.';
      } else if (err.response?.status === 400) {
        errorMsg += err.response.data?.detail || 'User is not a driver.';
      } else if (err.response?.status === 404) {
        errorMsg += 'Driver not found.';
      } else if (err.response?.data?.detail) {
        errorMsg += err.response.data.detail;
      } else if (err.response?.data?.error) {
        errorMsg += err.response.data.error;
      } else {
        errorMsg += 'Please check server logs for details.';
      }

      alert(errorMsg);
    } finally {
      setApprovingId(null);
    }
  };

  const rejectDriver = async (userId) => {
    try {
      await api.post(`/users/${userId}/reject_driver/`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified_driver: false, verification_status: 'rejected' } : u));
      alert('Driver rejected.');
      await fetchUsers(true);
    } catch (err) { alert('Action failed'); }
  };

  const suspendDriver = async (userId) => {
    try {
      if (!window.confirm("Suspend this driver? They will not be able to accept rides.")) return;
      await api.post(`/users/${userId}/suspend_driver/`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified_driver: false, verification_status: 'suspended' } : u));
      alert('Driver suspended.');
      await fetchUsers(true);
    } catch (err) { alert('Action failed'); }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Permanently delete this account? All associated data will be lost.")) return;
    try {
      await api.delete(`/users/${id}/`);
      setUsers(prev => prev.filter(u => u.id !== id));
      fetchStats(); // Update counters
    } catch (err) {
      alert("Failed to delete user record.");
    }
  };

  const rideData = [
    { name: '6 AM', rides: 12 },
    { name: '9 AM', rides: 45 },
    { name: '12 PM', rides: 68 },
    { name: '3 PM', rides: 52 },
    { name: '6 PM', rides: 89 },
    { name: '9 PM', rides: 34 },
  ];





  const isNew = (date) => {
    if (!date) return false;
    const joined = new Date(date);
    const now = new Date();
    return (now - joined) < (24 * 60 * 60 * 1000); // New if joined in last 24h
  };

  return (
    <div className="min-h-screen pt-20 pb-10 bg-slate-100 dark:bg-slate-950 flex flex-col px-6 max-w-[1600px] mx-auto transition-colors duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-secondary dark:text-white tracking-tight">Authority Console</h1>
            <p className="text-slate-500 dark:text-slate-400">Monitoring & Control Center</p>
          </div>

          <button onClick={handleExportCSV} className="bg-primary/20 text-primary-dark dark:text-primary px-4 py-2 border border-primary/30 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all flex items-center gap-2 shadow-sm">
            <Download size={16} /> Export CSV Report
          </button>

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 text-slate-400 hover:text-primary transition-all relative"
            >
              <Bell size={24} />
              {notifications.length > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-primary text-secondary text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                  {notifications.length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute left-0 mt-4 w-80 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-white/10 z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">System Activity</h3>
                    <button onClick={() => setNotifications([])} className="text-[10px] font-bold text-primary hover:underline">Clear All</button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="mx-auto text-slate-200 mb-2" size={32} />
                        <p className="text-xs font-bold text-slate-400">No new notifications</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`p-4 border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${n.urgent ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${n.type === 'Safety' ? 'bg-red-100 text-red-600' :
                              n.type === 'Ride' ? 'bg-blue-100 text-blue-600' :
                                'bg-primary/20 text-secondary dark:text-primary'
                              }`}>
                              {n.type}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">{n.time}</span>
                          </div>
                          <p className="text-xs font-bold text-secondary dark:text-white leading-tight">{n.msg}</p>
                        </div>
                      ))
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="p-3 bg-slate-50 dark:bg-white/5 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End of Feed</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex gap-2 bg-white dark:bg-slate-900 p-1 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 overflow-x-auto">
          {['overview', 'drivers', 'passengers', 'live', 'economy', 'fares', 'safety', 'broadcast', 'audit'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-xl text-sm font-bold capitalize whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === tab ? 'bg-secondary text-white shadow-lg dark:bg-primary dark:text-secondary' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5'}`}
            >
              {tab === 'live' ? 'Live Map' : tab === 'economy' ? 'Finance Center' : tab === 'fares' ? 'Fare Control' : tab === 'safety' ? 'Safety Hub' : tab === 'broadcast' ? 'LGU Broadcast' : tab === 'audit' ? 'System Audit' : tab}
              {tab === 'drivers' && users.some(u => u.role === 'driver' && !u.is_verified_driver) && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-sm shadow-red-500/50"></span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
          {/* Quick Stats */}
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-card p-6 rounded-3xl border-l-4 border-primary">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary-dark"><UserCheck size={24} /></div>
              <div className="flex flex-col items-end">
                <span className="text-green-500 text-xs font-black">{stats.onlineDrivers} ONLINE</span>
                <span className="text-slate-400 text-[10px] font-bold">OUT OF {stats.drivers}</span>
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest">Available Drivers</p>
            <h2 className="text-4xl font-black text-secondary dark:text-white mt-1">{stats.onlineDrivers}</h2>
          </motion.div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="glass-card p-6 rounded-3xl border-l-4 border-accent">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-accent/10 rounded-2xl text-accent"><MapIcon size={24} /></div>
              <span className="bg-green-500/10 text-green-600 text-[10px] px-2 py-0.5 rounded-full font-bold">LIVE NOW</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest">Active Rides</p>
            <h2 className="text-4xl font-black text-secondary dark:text-white mt-1">{stats.activeRides}</h2>
          </motion.div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card p-6 rounded-3xl border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-600"><TrendingUp size={24} /></div>
              <span className="text-orange-500 text-xs font-bold font-mono">3,240 Total</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest">Trips Today</p>
            <h2 className="text-4xl font-black text-secondary dark:text-white mt-1">{stats.totalRidesToday}</h2>
          </motion.div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card p-6 rounded-3xl border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-red-500/10 rounded-2xl text-red-600"><ShieldAlert size={24} /></div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stats.incidents > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-green-100 text-green-600'}`}>
                {stats.incidents} FLAG{stats.incidents !== 1 ? 'S' : ''}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest">Safety Incidents</p>
            <h2 className="text-4xl font-black text-secondary dark:text-white mt-1">{stats.incidents}</h2>
          </motion.div>

          {/* Charts Row */}
          <div className="lg:col-span-3 glass-card p-8 rounded-3xl min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-secondary dark:text-white">Ride Distribution</h3>
              <select className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 outline-none">
                <option>Last 24 Hours</option>
                <option>Last 7 Days</option>
              </select>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rideData}>
                  <defs>
                    <linearGradient id="colorRides" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="rides" stroke="#FFD700" strokeWidth={4} fillOpacity={1} fill="url(#colorRides)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Event Log */}
          <div className="glass-card p-8 rounded-3xl flex flex-col">
            <h3 className="text-xl font-bold text-secondary dark:text-white mb-6">Live Events & Logs</h3>
            <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
              {liveAlerts.map((log, i) => (
                <motion.div
                  key={i} initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                  className={`p-4 rounded-2xl text-sm border transition-colors ${log.urgent ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30 border-2 shadow-lg animate-pulse' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-white/5'}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[10px] font-black uppercase ${log.urgent ? 'text-red-500' : 'text-slate-400'}`}>{log.type}</span>
                    <span className="text-[10px] text-slate-400">{log.time}</span>
                  </div>
                  <p className={`font-black tracking-tight ${log.urgent ? 'text-red-700 dark:text-red-200' : 'text-slate-600 dark:text-slate-300'}`}>{log.msg}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {
        activeTab === 'drivers' && (
          <div className="glass-card p-8 rounded-[2.5rem] animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-secondary dark:text-white flex items-center gap-3">
                <Car size={32} className="text-primary" /> Driver Management
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search drivers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-bold w-64 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={fetchUsers}
                  disabled={loadingUsers}
                  className="p-2 bg-white dark:bg-slate-800 text-slate-400 rounded-xl hover:text-primary transition-all shadow-md"
                  title="Refresh Data"
                >
                  <RefreshCw size={18} className={loadingUsers ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-primary text-secondary px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-secondary hover:text-white transition-all flex items-center gap-2 shadow-lg"
                >
                  <UserPlus size={16} /> Create Driver
                </button>
                <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-500">
                  {users.filter(u => u.role === 'driver').length} Drivers Total
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="pb-4 pl-4 font-black text-slate-400 text-xs uppercase tracking-widest">Driver Name</th>
                    <th className="pb-4 font-black text-slate-400 text-xs uppercase tracking-widest">Email</th>
                    <th className="pb-4 font-black text-slate-400 text-xs uppercase tracking-widest">Joined On</th>
                    <th className="pb-4 font-black text-slate-400 text-xs uppercase tracking-widest">Status</th>
                    <th className="pb-4 font-black text-slate-400 text-xs uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users
                    .filter(u => u.role === 'driver')
                    .filter(u =>
                      u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .sort((a, b) => new Date(b.date_joined) - new Date(a.date_joined)) // Sort by date_joined descending
                    .map(driver => (
                      <tr key={driver.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="py-4 pl-4 font-bold text-secondary dark:text-white flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative shadow-sm border border-slate-100 dark:border-white/10">
                            <img src={ensureImageUrl(driver.profile_picture, driver.username)} alt="avatar" className="w-full h-full object-cover" />
                            {isNew(driver.date_joined) && (
                              <div className="absolute top-0 right-0 w-3 h-3 bg-primary border-2 border-white dark:border-slate-900 rounded-full" title="New Signup"></div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1.5">
                              {driver.username}
                              {isNew(driver.date_joined) && <Sparkles size={12} className="text-primary animate-pulse" />}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 text-sm font-medium text-slate-500 dark:text-slate-400">{driver.email}</td>
                        <td className="py-4 text-xs font-bold text-slate-400 flex items-center gap-1">
                          <Clock size={12} /> {new Date(driver.date_joined).toLocaleDateString()}
                        </td>
                        <td className="py-4">
                          <div className="flex flex-col gap-1.5">
                            {driver.verification_status === 'approved' && (
                              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit">
                                <CheckCircle2 size={12} /> Approved
                              </span>
                            )}
                            {(!driver.verification_status || driver.verification_status === 'pending') && (
                              <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit">
                                Pending
                              </span>
                            )}
                            {driver.verification_status === 'rejected' && (
                              <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit">
                                <XCircle size={12} /> Rejected
                              </span>
                            )}
                            {driver.verification_status === 'suspended' && (
                              <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit">
                                <ShieldAlert size={12} /> Suspended
                              </span>
                            )}
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${driver.is_online ? 'status-online' : 'status-offline'}`}></div>
                              <span className={driver.is_online ? 'badge-live' : 'badge-offline'}>{driver.is_online ? 'Live' : 'Offline'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-right pr-4">
                          <div className="flex items-center justify-end gap-2">
                            {(!driver.verification_status || driver.verification_status === 'pending') && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => approveDriver(driver.id)}
                                  className="bg-secondary text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary hover:text-secondary transition-all shadow-md"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => rejectDriver(driver.id)}
                                  className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-600 hover:text-white transition-all shadow-md"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                            {driver.verification_status === 'approved' && (
                              <button
                                onClick={() => suspendDriver(driver.id)}
                                className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-600 hover:text-white transition-all shadow-md"
                              >
                                Suspend
                              </button>
                            )}
                            {driver.verification_status === 'suspended' && (
                               <button
                                  onClick={() => approveDriver(driver.id)}
                                  className="bg-secondary text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary hover:text-secondary transition-all shadow-md"
                                >
                                  Restore
                                </button>
                            )}
                            <button
                              onClick={() => { setSelectedUser(driver); setShowDetailModal(true); }}
                              className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-primary hover:text-secondary transition-all"
                              title="Read Record"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => deleteUser(driver.id)}
                              className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                              title="Delete Driver"
                            >
                              <XCircle size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {activeTab === 'passengers' && (
        <div className="glass-card p-8 rounded-[2.5rem] animate-in slide-in-from-right duration-500">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-secondary dark:text-white flex items-center gap-3">
              <Users size={32} className="text-secondary dark:text-slate-400" /> Passenger Directory
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Find passengers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-bold w-64 outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
              <button
                onClick={fetchUsers}
                disabled={loadingUsers}
                className="p-2 bg-white dark:bg-slate-800 text-slate-400 rounded-xl hover:text-secondary transition-all shadow-md"
                title="Refresh Data"
              >
                <RefreshCw size={18} className={loadingUsers ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-secondary text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-secondary transition-all flex items-center gap-2 shadow-lg"
              >
                <UserPlus size={16} /> Add Passenger
              </button>
              <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-500">
                {users.filter(u => u.role === 'passenger').length} Passengers
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users
              .filter(u => u.role === 'passenger')
              .filter(u =>
                u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email?.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .sort((a, b) => new Date(b.date_joined) - new Date(a.date_joined)) // Sort by date_joined descending
              .map(user => (
                <div key={user.id} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-between group shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full p-1 shadow-sm relative overflow-hidden border border-slate-100 dark:border-white/10">
                      <img src={ensureImageUrl(user.profile_picture, user.username)} alt="avatar" className="w-full h-full rounded-full object-cover" />
                      {isNew(user.date_joined) && (
                        <div className="absolute -top-1 -right-1 p-1 bg-primary text-secondary rounded-full shadow-lg animate-bounce z-10">
                          <Sparkles size={10} />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-secondary dark:text-white leading-tight">{user.username}</h3>
                        {isNew(user.date_joined) && (
                          <span className="bg-primary/20 text-primary-dark text-[8px] font-black px-1.5 py-0.5 rounded border border-primary/30 uppercase tracking-tighter">New User</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-1">{user.email}</p>
                      <div className="flex items-center gap-2">
                        <span className={user.is_online ? 'badge-live' : 'badge-offline'}>
                          {user.is_online ? 'Currently Online' : 'Regular Passenger'}
                        </span>
                        <span className="text-[9px] text-slate-400 flex items-center gap-1 font-bold">
                          <Clock size={10} /> {new Date(user.date_joined).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => { setSelectedUser(user); setShowDetailModal(true); }}
                      className="p-2 opacity-0 group-hover:opacity-100 bg-white dark:bg-slate-800 text-slate-400 rounded-xl hover:text-primary transition-all shadow-lg"
                      title="View Information"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="p-2 opacity-0 group-hover:opacity-100 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg"
                      title="Delete User"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {activeTab === 'live' && (
        <div className="flex-1 min-h-[600px] relative rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800 transition-colors animate-in fade-in">
          <Map markers={liveMarkers} heatPoints={showHeatmap ? demandPoints : []} />
          <div className="absolute top-8 left-8 flex flex-col gap-4">
            <div className="bg-black/80 backdrop-blur-md p-6 rounded-3xl text-white border border-white/10 max-w-xs shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 status-online rounded-full"></div>
                <h3 className="font-bold uppercase tracking-tight text-sm">Live Network Status</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Total Dispatch:</span>
                  <span className="font-bold">{stats.drivers} Trikes</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Live Tracking:</span>
                  <span className="font-bold">{liveMarkers.length} Online</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Demand Heat:</span>
                  <span className="font-bold text-primary">{stats.activeRides > 5 ? 'CRITICAL' : 'NORMAL'}</span>
                </div>
                <div className="pt-3 mt-3 border-t border-white/10 flex items-center gap-2">
                  <MapPin size={12} className="text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Trento Service Zone</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className="flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-2xl border-2 bg-white text-secondary"
            >
              <div className={`w-3 h-3 rounded-full ${showHeatmap ? 'bg-secondary animate-pulse' : 'bg-slate-300'}`}></div>
              {showHeatmap ? 'Disable Heatmap' : 'Analyze Demand Heat'}
            </button>

            <button
              onClick={() => {
                setIsUpdatingMap(true);
                setTimeout(() => {
                  setIsUpdatingMap(false);
                  setLiveAlerts(prev => [{
                    time: 'Just now',
                    type: 'SYSTEM',
                    msg: 'Map tile update completed.',
                    urgent: false
                  }, ...prev].slice(0, 15));
                }, 2000);
              }}
              disabled={isUpdatingMap}
              className="flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-2xl border-2 bg-slate-900 text-white hover:bg-black disabled:opacity-50"
            >
              <div className={`w-3 h-3 rounded-full ${isUpdatingMap ? 'bg-primary animate-spin' : 'bg-green-500'}`}></div>
              {isUpdatingMap ? 'Updating Tiles...' : 'Force Map Refresh'}
            </button>
          </div>

          {/* SOS EMERGENCY CONSOLE OVERLAY */}
          <AnimatePresence>
            {activeSOS && (
              <motion.div
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                className="absolute top-8 right-8 w-[400px] z-[100]"
              >
                <div className="bg-red-600 text-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(220,38,38,0.4)] overflow-hidden border-4 border-white/20">
                  <div className="p-8 pb-4">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-4 bg-white/20 rounded-3xl animate-pulse">
                        <ShieldAlert size={32} />
                      </div>
                      <button
                        onClick={() => setActiveSOS(null)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                      >
                        <XCircle size={24} />
                      </button>
                    </div>

                    <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none mb-2">SOS SIGNAL</h2>
                    <p className="text-red-100 font-bold text-xs uppercase tracking-[0.2em] opacity-80">EMERGENCY DISPATCH MODE</p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md p-8 pt-4 space-y-6">
                    <div className="bg-black/20 p-6 rounded-3xl">
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-100/50 mb-2">Potential Victim</p>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-red-600">
                          <Users size={20} />
                        </div>
                        <div>
                          <p className="text-lg font-black uppercase">{activeSOS.user || 'Unknown User'}</p>
                          <p className="text-xs font-bold opacity-60 italic">{activeSOS.message}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/20 p-4 rounded-2xl">
                        <p className="text-[9px] font-black uppercase text-red-100/50">Proximity</p>
                        <p className="text-sm font-black italic">ESTABLISHING...</p>
                      </div>
                      <div className="bg-black/20 p-4 rounded-2xl">
                        <p className="text-[9px] font-black uppercase text-red-100/50">Nearby Drivers</p>
                        <p className="text-sm font-black italic">{liveMarkers.length} ACTIVE</p>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button className="flex-1 bg-white text-red-600 font-black uppercase tracking-widest text-xs py-5 rounded-2xl shadow-xl hover:scale-[1.02] transition-all">
                        Dispatch Nearest
                      </button>
                      <button
                        onClick={() => setActiveSOS(null)}
                        className="px-6 bg-red-800/50 text-white font-black uppercase tracking-widest text-xs py-5 rounded-2xl hover:bg-red-800 transition-all"
                      >
                        Resolved
                      </button>
                    </div>
                  </div>

                  <div className="bg-red-700 py-3 px-8 text-center">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em]">Direct Communication Line Active</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )
      }

      {activeTab === 'safety' && <SafetyHubTab />}
      {activeTab === 'economy' && <FinanceTab stats={stats} />}
      {activeTab === 'broadcast' && <BroadcastTab />}
      {activeTab === 'audit' && <AuditLogTab alerts={liveAlerts} />}
      {activeTab === 'fares' && <FareControlTab />}

      <UserDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        user={selectedUser}
        onRefresh={fetchUsers}
        onApprove={approveDriver}
      />

      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onRefresh={fetchUsers}
      />
    </div >
  );
};

const BroadcastTab = () => {
  const [broadcasts, setBroadcasts] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all');
  const [isCritical, setIsCritical] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const fetchBroadcasts = async () => {
    try {
      const res = await api.get('/broadcasts/');
      setBroadcasts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch broadcasts", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title,
        message,
        target_role: target,
        is_critical: isCritical
      };

      if (editingId) {
        await api.patch(`/broadcasts/${editingId}/`, payload);
      } else {
        await api.post('/broadcasts/', payload);
      }

      setTitle('');
      setMessage('');
      setTarget('all');
      setIsCritical(false);
      setEditingId(null);
      fetchBroadcasts();
    } catch (err) {
      alert("Failed to save broadcast");
    }
  };

  const handleEdit = (b) => {
    setTitle(b.title);
    setMessage(b.message);
    setTarget(b.target_role);
    setIsCritical(b.is_critical);
    setEditingId(b.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this broadcast? This cannot be undone.")) return;
    try {
      await api.delete(`/broadcasts/${id}/`);
      fetchBroadcasts();
    } catch (err) {
      alert("Failed to delete broadcast");
    }
  };

  if (loading) return <div className="p-20 text-center font-bold text-slate-400">LOADING BROADCASTS...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in zoom-in duration-500">
      <div className="space-y-6">
        <div className="glass-card p-10 rounded-[3rem] border-t-8 border-primary">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-primary rounded-3xl text-secondary">
              <Megaphone size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-secondary dark:text-white uppercase tracking-tight">
                {editingId ? 'Edit Broadcast' : 'LGU City Broadcast'}
              </h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                {editingId ? 'Updating official announcement' : 'Send Official Announcements'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-6">
            {editingId && (
              <div className="flex justify-between items-center bg-primary/10 p-3 rounded-xl border border-primary/20">
                <span className="text-[10px] font-black text-primary-dark uppercase">Currently Editing Broadcast #{editingId}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setTitle('');
                    setMessage('');
                    setTarget('all');
                    setIsCritical(false);
                  }}
                  className="text-[10px] font-black underline hover:text-red-500"
                >
                  Cancel Edit
                </button>
              </div>
            )}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Announcement Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Storm Advisory #1"
                className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary transition-all"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Message Body</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Details about the announcement..."
                className="w-full h-32 bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-[2rem] p-6 text-sm font-medium outline-none focus:border-primary transition-all"
                required
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Target Audience</label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary transition-all"
                >
                  <option value="all">Everyone</option>
                  <option value="driver">Drivers Only</option>
                  <option value="passenger">Passengers Only</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setIsCritical(!isCritical)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${isCritical ? 'bg-red-500' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isCritical ? 'right-1' : 'left-1'}`} />
                </button>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mark as Critical</span>
              </div>
            </div>

            <button
              type="submit"
              className={`w-full py-5 text-white font-black uppercase tracking-widest rounded-2xl hover:shadow-2xl transition-all ${editingId ? 'bg-primary text-secondary' : 'bg-secondary hover:bg-primary hover:text-secondary'}`}
            >
              {editingId ? 'Update Broadcast Info' : 'Broadcast Message Now'}
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-black text-secondary dark:text-white uppercase italic px-4">Broadcast History</h3>
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {broadcasts.map(b => (
            <div key={b.id} className={`glass-card p-6 rounded-3xl border-l-4 group relative ${b.is_critical ? 'border-red-500' : 'border-primary'}`}>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-black text-secondary dark:text-white uppercase text-sm tracking-tight">{b.title}</h4>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(b)} className="p-2 hover:bg-primary/20 rounded-lg text-slate-400 hover:text-primary transition-colors">
                    <Settings size={14} />
                  </button>
                  <button onClick={() => handleDelete(b.id)} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                    <XCircle size={14} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">{b.message}</p>
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded">TO: {b.target_role}</span>
                  {b.is_critical && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-red-100 text-red-600 rounded">CRITICAL</span>}
                </div>
                <span className="text-[10px] text-slate-400">{new Date(b.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {broadcasts.length === 0 && (
            <div className="p-20 text-center opacity-30">
              <Megaphone size={64} className="mx-auto mb-4" />
              <p className="font-bold uppercase tracking-widest text-xs">No Broadcasts Yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FinanceTab = ({ stats }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const financeData = [
    { name: 'Mon', revenue: 4500, commission: 450 },
    { name: 'Tue', revenue: 5200, commission: 520 },
    { name: 'Wed', revenue: 4800, commission: 480 },
    { name: 'Thu', revenue: 6100, commission: 610 },
    { name: 'Fri', revenue: 7500, commission: 750 },
    { name: 'Sat', revenue: 8900, commission: 890 },
    { name: 'Sun', revenue: 3200, commission: 320 },
  ];

  useEffect(() => {
    const fetchFinanceData = async () => {
      try {
        const res = await api.get('/wallet/');
        setTransactions(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch finance data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFinanceData();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-secondary text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mr-16 -mt-16" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Total Platform Volume</p>
          <h2 className="text-5xl font-black italic tracking-tighter">₱{stats.totalRevenue.toLocaleString()}</h2>
          <div className="mt-6 flex items-center gap-2 text-primary font-bold text-xs">
            <TrendingUp size={14} />
            <span>+18.5% FROM LAST MONTH</span>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">LGU Commission (5%)</p>
          <h2 className="text-5xl font-black italic tracking-tighter text-secondary">₱{stats.commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
          <div className="mt-6 flex items-center gap-2 text-green-500 font-bold text-xs uppercase">
            <CheckCircle2 size={14} />
            <span>Funds Secured</span>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-primary text-secondary p-8 rounded-[3rem] shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Payouts to Drivers</p>
          <h2 className="text-5xl font-black italic tracking-tighter">₱{(stats.totalRevenue - stats.commission).toLocaleString()}</h2>
          <div className="mt-6 flex items-center gap-2 font-black text-xs uppercase tracking-widest">
            <Clock size={14} />
            <span>Next Settlement: Friday</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-10 rounded-[3rem]">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-black text-secondary italic uppercase tracking-tighter">Revenue Growth</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Weekly Performance Analytics</p>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financeData}>
                <defs>
                  <linearGradient id="financeSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFD700" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 'bold' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '20px' }}
                  itemStyle={{ fontWeight: '900', textTransform: 'uppercase', fontSize: '10px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#FFD700" strokeWidth={6} fill="url(#financeSales)" />
                <Area type="monotone" dataKey="commission" stroke="#1E293B" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-10 rounded-[3rem] flex flex-col">
          <h3 className="text-xl font-black text-secondary italic uppercase tracking-tighter mb-8">Recent Cashflows</h3>
          <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {loading ? (
              <div className="p-10 text-center opacity-20 font-black uppercase italic tracking-widest">Syncing ledger...</div>
            ) : transactions.length === 0 ? (
              <div className="p-10 text-center opacity-40 font-bold text-xs uppercase tracking-widest">No recent transactions</div>
            ) : (
              transactions.map((tx, i) => (
                <div key={i} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all cursor-default">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${tx.type === 'deposit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.type === 'deposit' ? <TrendingUp size={16} /> : <TrendingUp size={16} className="rotate-180" />}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-secondary">{tx.description || 'System Transaction'}</p>
                      <p className="text-[10px] font-bold text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-black italic ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.type === 'deposit' ? '+' : '-'}₱{parseFloat(tx.amount).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const FareControlTab = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [showSuccessFor, setShowSuccessFor] = useState(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await api.get('/system-config/');
      const configData = Array.isArray(res.data) ? res.data : [];
      setConfigs(configData);

      // If empty, create defaults
      if (configData.length === 0) {
        const defaults = [
          { key: 'base_fare', value: '30.00', description: 'Starting price for every ride in PHP' },
          { key: 'rate_per_km', value: '8.00', description: 'Additional charge per kilometer traveled' },
          { key: 'surge_multiplier', value: '1.5', description: 'Base multiplier during high demand periods' },
          { key: 'surge_threshold', value: '1.5', description: 'Ride-to-driver ratio that triggers surge' }
        ];
        for (const d of defaults) {
          await api.post('/system-config/', d);
        }
        const refreshed = await api.get('/system-config/');
        setConfigs(refreshed.data);
      }
    } catch (err) {
      console.error("Failed to fetch configs", err);
    } finally {
      setLoading(false);
    }
  };

  const updateValue = async (id, newValue) => {
    setSavingId(id);
    try {
      await api.patch(`/system-config/${id}/`, { value: newValue });
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, value: newValue } : c));
      setShowSuccessFor(id);
      setTimeout(() => setShowSuccessFor(null), 3000);
    } catch (err) {
      alert("Failed to update value");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="p-20 text-center font-bold text-slate-400 uppercase tracking-widest">Loading Economy Parameters...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in zoom-in duration-500">
      <div className="space-y-6">
        <div className="glass-card p-10 rounded-[3rem] border-t-8 border-primary">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-primary rounded-3xl text-secondary">
              <DollarSign size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-secondary dark:text-white uppercase tracking-tight">Dynamic Fare Engine</h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Global Price Settings for Trento LGU</p>
            </div>
          </div>

          <div className="space-y-8">
            {configs.map(config => (
              <div key={config.id} className="group">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{config.key.replace(/_/g, ' ')}</label>
                  <div className="flex items-center gap-2">
                    {savingId === config.id && <RefreshCw size={10} className="animate-spin text-primary" />}
                    {showSuccessFor === config.id && <CheckCircle2 size={10} className="text-green-500" />}
                    <span className="text-[10px] font-bold text-primary-dark bg-primary/10 px-2 py-0.5 rounded-md">LIVE</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={config.value}
                      onChange={(e) => updateValue(config.id, e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl py-4 px-6 text-xl font-black text-secondary dark:text-white focus:border-primary outline-none transition-all group-hover:bg-white dark:group-hover:bg-slate-800"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-bold group-hover:text-primary">
                      {config.key.includes('multiplier') || config.key.includes('threshold') ? '×' : '₱'}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[10px] font-medium text-slate-500 italic px-2">{config.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-secondary dark:bg-slate-800 rounded-[2rem] text-white">
            <div className="flex items-center gap-3 mb-2 text-primary">
              <Settings size={18} className="animate-spin-slow" />
              <span className="text-xs font-black uppercase tracking-widest">Deployment Status</span>
            </div>
            <p className="text-sm font-medium opacity-80 leading-relaxed">Changes to these values are synchronized in real-time across all user dashboards in Trento. Use caution when adjusting multipliers during peak hours.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-card p-10 rounded-[3rem] bg-slate-900 text-white relative overflow-hidden h-full">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="relative z-10">
            <h3 className="text-xl font-black italic uppercase tracking-tight mb-8">Economy Simulation</h3>

            <div className="space-y-8">
              <div className="p-8 bg-white/5 border border-white/10 rounded-[2rem] backdrop-blur-md">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Earnings Projection (5km trip)</p>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="opacity-60">Standard Base Fare</span>
                    <span className="font-bold">₱{configs.find(c => c.key === 'base_fare')?.value || '30.00'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="opacity-60">Distance (5km)</span>
                    <span className="font-bold">₱{(parseFloat(configs.find(c => c.key === 'rate_per_km')?.value || '8.00') * 5).toFixed(2)}</span>
                  </div>
                  <div className="pt-4 mt-4 border-t border-white/10 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Grand Total</p>
                      <p className="text-4xl font-black italic">₱{(
                        parseFloat(configs.find(c => c.key === 'base_fare')?.value || '30.00') +
                        (parseFloat(configs.find(c => c.key === 'rate_per_km')?.value || '8.00') * 5)
                      ).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">With Surge (1.5x)</p>
                      <p className="text-lg font-black text-primary italic">₱{(
                        (parseFloat(configs.find(c => c.key === 'base_fare')?.value || '30.00') +
                          (parseFloat(configs.find(c => c.key === 'rate_per_km')?.value || '8.00') * 5)) * 1.5
                      ).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-primary/10 border border-primary/20 rounded-3xl">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Surge Sensitivity</p>
                  <p className="text-lg font-black">MODERATE</p>
                </div>
                <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-3xl">
                  <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">Fleet Stability</p>
                  <p className="text-lg font-black">HEALTHY</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SafetyHubTab = () => {
  const [incidents, setIncidents] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [incRes, compRes] = await Promise.all([
        api.get('/incidents/'),
        api.get('/complaints/')
      ]);
      setIncidents(Array.isArray(incRes.data) ? incRes.data : []);
      setComplaints(Array.isArray(compRes.data) ? compRes.data : []);
    } catch (err) {
      console.error("Failed to fetch safety data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCase = async (type, id, data) => {
    try {
      if (type === 'incident') {
        await api.patch(`/incidents/${id}/`, data);
      } else {
        await api.patch(`/complaints/${id}/`, data);
      }
      fetchData();
      setSelectedCase(null);
    } catch (err) {
      alert("Update failed");
    }
  };



  if (loading) return <div className="p-20 text-center font-bold text-slate-400">LOADING SAFETY RECORDS...</div>;

  const allCases = [
    ...(Array.isArray(incidents) ? incidents : []).map(i => ({ ...i, type: 'incident', title: 'SOS EMERGENCY' })),
    ...(Array.isArray(complaints) ? complaints : []).map(c => ({ ...c, type: 'complaint', title: c.subject }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 bg-red-600 text-white rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Critical Alerts</p>
          <h3 className="text-4xl font-black italic">{incidents.filter(i => i.status === 'pending' || i.status === 'active').length}</h3>
          <p className="text-xs font-bold mt-2">Active SOS Signals in Trento</p>
        </div>
        <div className="glass-card p-6 bg-secondary text-white rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Open Complaints</p>
          <h3 className="text-4xl font-black italic">{complaints.filter(c => c.status !== 'closed').length}</h3>
          <p className="text-xs font-bold mt-2">Requiring Investigation</p>
        </div>
        <div className="glass-card p-6 bg-green-500 text-white rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Resolved Today</p>
          <h3 className="text-4xl font-black italic">14</h3>
          <p className="text-xs font-bold mt-2">Safe Public Utility Status</p>
        </div>
      </div>

      <div className="glass-card p-8 rounded-[3rem]">
        <h2 className="text-2xl font-black text-secondary dark:text-white mb-8 flex items-center gap-3">
          <ShieldAlert size={32} className="text-red-500" /> Resolution Workflow
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="pb-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Case ID</th>
                <th className="pb-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Type</th>
                <th className="pb-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Involved Party</th>
                <th className="pb-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Status</th>
                <th className="pb-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Timestamp</th>
                <th className="pb-4 font-black text-slate-400 text-[10px] uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {allCases.map((item) => (
                <tr key={`${item.type}-${item.id}`} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="py-6 text-sm font-mono text-slate-500">#{item.type.charAt(0).toUpperCase()}{item.id}</td>
                  <td className="py-6">
                    <div className={`text-[10px] font-black px-2 py-1 rounded inline-block ${item.type === 'incident' ? 'bg-red-100 text-red-600' : 'bg-secondary/10 text-secondary dark:text-slate-300'}`}>
                      {item.title}
                    </div>
                  </td>
                  <td className="py-6 font-bold text-secondary dark:text-white">{item.user?.username || 'System User'}</td>
                  <td className="py-6">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${['resolved', 'closed'].includes(item.status) ? 'bg-green-100 text-green-700' :
                      ['investigating', 'active'].includes(item.status) ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-6 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="py-6 text-right">
                    <button
                      onClick={() => setSelectedCase(item)}
                      className="px-4 py-2 bg-secondary text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-primary hover:text-secondary transition-all"
                    >
                      Investigate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <InvestigationModal
        isOpen={!!selectedCase}
        onClose={() => setSelectedCase(null)}
        data={selectedCase}
        onUpdate={handleUpdateCase}
      />
    </div>
  );
};

const InvestigationModal = ({ isOpen, onClose, data, onUpdate }) => {
  const [notes, setNotes] = useState('');
  const [statusTab, setStatusTab] = useState('');

  useEffect(() => {
    if (data) {
      setNotes(data.admin_notes || '');
      setStatusTab(data.status);
    }
  }, [data]);

  if (!data) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800"
          >
            <div className="p-10">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded">Active Investigation</span>
                    <span className="text-[10px] font-bold text-slate-400">Case #{data.type.charAt(0).toUpperCase()}{data.id}</span>
                  </div>
                  <h2 className="text-3xl font-black text-secondary dark:text-white italic uppercase">{data.title}</h2>
                </div>
                <button onClick={onClose} className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
                  <XCircle size={24} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-10">
                <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic">Description</p>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{data.description || 'No detailed description provided.'}</p>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary-dark">
                      <Users size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reported By</p>
                      <p className="text-sm font-bold text-secondary dark:text-white">{data.user?.username || 'System'}</p>
                    </div>
                  </div>
                  {data.ride && (
                    <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-2xl flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center text-accent">
                        <Car size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Link Ride</p>
                        <p className="text-sm font-bold text-secondary dark:text-white">#{data.ride}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block italic">Official Admin Action Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter investigation notes, resolution steps, or disciplinary actions..."
                    className="w-full h-32 bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-[2rem] p-6 text-sm font-medium outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-2">
                    {(data.type === 'incident' ? ['pending', 'active', 'resolved', 'dismissed'] : ['pending', 'investigation', 'closed']).map(s => (
                      <button
                        key={s}
                        onClick={() => setStatusTab(s)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusTab === s ? 'bg-secondary text-white' : 'bg-slate-100 text-slate-400 dark:bg-white/5'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => onUpdate(data.type, data.id, { admin_notes: notes, status: statusTab })}
                    className="px-8 py-4 bg-primary text-secondary font-black uppercase tracking-widest rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all"
                  >
                    Update Case File
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const AuditLogTab = ({ alerts }) => {
  const [filter, setFilter] = useState('');

  return (
    <div className="glass-card p-10 rounded-[3rem] animate-in slide-in-from-bottom duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-2xl font-black text-secondary dark:text-white uppercase tracking-tighter italic flex items-center gap-3">
            <ClipboardList size={32} className="text-secondary" />
            System Transparency Audit
          </h2>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1">Official registry of all administrative and platform actions</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit trail..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-sm font-bold outline-none border-2 border-transparent focus:border-secondary transition-all w-full md:w-80"
          />
        </div>
      </div>

      <div className="overflow-hidden bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-white/5">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-100 dark:bg-white/5">
              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Timestamp</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Event Type</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Action/Message</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Stability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {alerts
              .filter(a => a.msg.toLowerCase().includes(filter.toLowerCase()) || a.type.toLowerCase().includes(filter.toLowerCase()))
              .map((a, i) => (
                <tr key={i} className="hover:bg-white dark:hover:bg-white/5 transition-colors group">
                  <td className="px-8 py-6">
                    <span className="text-xs font-black text-slate-400 group-hover:text-secondary transition-colors">{a.time}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${a.urgent ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                        {a.type === 'RIDE' && <MapPin size={14} />}
                        {a.type === 'WALLET' && <DollarSign size={14} />}
                        {a.type === 'FARE' && <TrendingUp size={14} />}
                        {a.type === 'SAFETY' && <ShieldAlert size={14} />}
                        {a.type === 'SOS' && <ShieldAlert size={14} className="animate-pulse" />}
                        {a.type === 'USER' && <UserCheck size={14} />}
                        {a.type === 'FEEDBACK' && <Star size={14} />}
                        {(!['RIDE', 'WALLET', 'FARE', 'SAFETY', 'SOS', 'USER', 'FEEDBACK'].includes(a.type)) && <Settings size={14} />}
                      </div>
                      <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${a.urgent ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-secondary text-primary'
                        }`}>
                        {a.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-bold text-secondary dark:text-white leading-relaxed">{a.msg}</p>
                  </td>
                  <td className="px-8 py-6 text-right pr-12">
                    <div className="flex items-center gap-2 text-green-500">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest">LOGGED</span>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {alerts.length === 0 && (
          <div className="p-20 text-center opacity-20 font-black uppercase tracking-widest italic">The auditor's ledger is currently empty</div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
