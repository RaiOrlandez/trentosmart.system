import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import Map from '../../components/Map';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tractor,
  MapPin,
  TrendingUp,
  Clock,
  Check,
  X,
  Navigation2,
  Settings,
  Bell,
  ShieldCheck,
  Megaphone,
  Star,
  Wrench,
  AlertTriangle,
  Activity,
  Trophy,
  Target
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import useRideTracking from '../../hooks/useRideTracking';
import useSystemEvents from '../../hooks/useSystemEvents';
import ChatWindow from '../../components/ChatWindow';
import DriverSettingsModal from '../../components/DriverSettingsModal';
import HeatMapModal from '../../components/HeatMapModal';
import RatingModal from '../../components/RatingModal';

const DriverHome = () => {
  const { user } = React.useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [driverPos, setDriverPos] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [earnings, setEarnings] = useState(1250);
  const [tripsCount, setTripsCount] = useState(14);
  const [activeRide, setActiveRide] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [currentBroadcast, setCurrentBroadcast] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHeatMapModal, setShowHeatMapModal] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [completedRideId, setCompletedRideId] = useState(null);
  const [completedPassengerName, setCompletedPassengerName] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const { newRide, systemEvent } = useSystemEvents();
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [trikeHealth, setTrikeHealth] = useState({ status: 'good', message: 'All systems operational' });
  const [dailyGoal, setDailyGoal] = useState(1500); // Default ₱1500 goal

  const fetchMaintenanceLogs = useCallback(async () => {
    try {
      const res = await api.get('/maintenance-logs/');
      const logs = Array.isArray(res.data) ? res.data : [];
      setMaintenanceLogs(logs);

      if (logs.length > 0) {
        const latest = logs[0];
        const nextService = new Date(latest.next_service_date);
        const now = new Date();
        const diffDays = Math.ceil((nextService - now) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          setTrikeHealth({ status: 'critical', message: 'Service Overdue!' });
        } else if (diffDays < 7) {
          setTrikeHealth({ status: 'warning', message: `Service in ${diffDays} days` });
        } else {
          setTrikeHealth({ status: 'good', message: 'Healthy' });
        }
      }
    } catch (err) {
      console.error('Failed to fetch maintenance logs', err);
    }
  }, []);

  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await api.get('/broadcasts/');
      setBroadcasts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch broadcasts', err);
    }
  }, []);

  useEffect(() => {
    fetchBroadcasts();
    fetchMaintenanceLogs();
  }, [fetchBroadcasts, fetchMaintenanceLogs]);

  useEffect(() => {
    // Check for new critical broadcasts to show modal
    const lastSeen = localStorage.getItem('last_seen_broadcast');
    if (broadcasts.length > 0 && broadcasts[0].is_critical && broadcasts[0].id.toString() !== lastSeen) {
      setCurrentBroadcast(broadcasts[0]);
      setShowBroadcastModal(true);
    }
  }, [broadcasts]);

  // Real-time System Event Processing
  useEffect(() => {
    if (systemEvent) {
      if (systemEvent.type === 'driver_verified' && systemEvent.user_id === user?.id) {
        setShowVerificationSuccess(true);
        // Auto-refresh user data in context would be better, but for now just local state
      }
      if (systemEvent.type === 'new_broadcast') {
        const b = systemEvent.broadcast;
        if (b.target_role === 'all' || b.target_role === 'driver') {
          setCurrentBroadcast(b);
          setShowBroadcastModal(true);
        }
      }
    }
  }, [systemEvent, user?.id]);

  // WebSocket Tracking
  const { sendLocation, sendMessage, messages, location: passengerLivePos } = useRideTracking(activeRide?.id, true);

  // Tracking Interval
  useEffect(() => {
    let watchId;
    if (isOnline) {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;

            // Only send to WebSocket if there is an active ride
            if (activeRide) {
              sendLocation(latitude, longitude);
            }

            setDriverPos({
              lat: latitude,
              lng: longitude,
              title: 'Your Location',
              info: 'Driver (Live)',
              isDriver: true
            });
          },
          (err) => console.error('Geolocation error:', err),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      } else {
        console.error('Geolocation is not supported by this browser.');
      }
    } else {
      setMarkers([]); // Clear markers when offline
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isOnline, activeRide, sendLocation]);

  // Server Location Sync (for Admin View)
  useEffect(() => {
    let interval;
    if (isOnline) {
      const updateLocation = async () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
              await api.post('/users/update_location/', {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
              });
            } catch (err) {
              console.error('Failed to sync location with server', err);
            }
          });
        }
      };

      updateLocation(); // Initial call
      interval = setInterval(updateLocation, 15000); // Sync every 15s
    }
    return () => clearInterval(interval);
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) {
      setRequests([]);
      setMarkers([]);
      return;
    }

    const fetchRequests = async () => {
      try {
        const res = await api.get('/driver/requests/');
        setRequests(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Failed to fetch requests', err);
      }
    };

    if (isOnline && !activeRide) {
      fetchRequests();
    }
  }, [isOnline, activeRide]);

  // Handle Real-time Ride Requests
  useEffect(() => {
    if (newRide && isOnline && !activeRide) {
      // Add to requests if not already there
      setRequests(prev => {
        if (prev.find(r => r.id === newRide.id)) return prev;
        const updatedRequests = [newRide, ...prev];
        // Automatically select the newest request for preview
        setSelectedRequest(newRide);
        return updatedRequests;
      });

      // Play alert sound
      try {
        const audio = new Audio('/alert.wav');
        audio.play().catch(() => { });
      } catch (e) { }
    }
  }, [newRide, isOnline, activeRide]);

  // Consolidate marker generation
  useEffect(() => {
    if (!isOnline || !driverPos) {
      setMarkers([]);
      return;
    }

    const newMarkers = [driverPos];

    if (activeRide) {
      // Use live passenger position if available, otherwise fallback to static pickup
      if (passengerLivePos && passengerLivePos.lat) {
        newMarkers.push({
          lat: parseFloat(passengerLivePos.lat),
          lng: parseFloat(passengerLivePos.lng),
          title: 'Passenger (Live)',
          info: 'Current location of passenger',
          isPickup: true
        });
      } else {
        newMarkers.push({
          lat: activeRide.pickup_lat || 8.050,
          lng: activeRide.pickup_lng || 126.062,
          title: 'Pickup',
          info: activeRide.pickup_address || activeRide.pickup,
          isPickup: true
        });
      }

      newMarkers.push({
        lat: activeRide.dest_lat || 8.056,
        lng: activeRide.dest_lng || 126.072,
        title: 'Destination',
        info: activeRide.dest_address || activeRide.dest,
        isDestination: true
      });
    } else if (selectedRequest) {
      newMarkers.push({
        lat: selectedRequest.pickup_lat || 8.050,
        lng: selectedRequest.pickup_lng || 126.062,
        title: 'New Request',
        info: `Pickup at ${selectedRequest.pickup_address || selectedRequest.pickup}`,
        isPickup: true
      });
    }

    setMarkers(newMarkers);
  }, [driverPos, activeRide, selectedRequest, isOnline, passengerLivePos]);

  const acceptRide = async (ride) => {
    try {
      // Inform the server that the ride has been accepted
      await api.post(`/rides/${ride.id}/accept/`);

      setActiveRide(ride);
      setRequests([]);
      setSelectedRequest(null);
    } catch (err) {
      console.error('Failed to accept ride', err);
      // Fallback for demo
      setActiveRide(ride);
      setRequests([]);
      setSelectedRequest(null);
    }
  };

  const declineRequest = (rideId) => {
    setRequests(prev => prev.filter(r => r.id !== rideId));
    if (selectedRequest?.id === rideId) {
      setSelectedRequest(null);
      // Revert markers to just driver
      const driverMarker = markers.find(m => m.isDriver);
      if (driverMarker) setMarkers([driverMarker]);
    }
  };

  const completeRide = async () => {
    if (!activeRide) return;

    try {
      const currentRideId = activeRide.id;
      const passengerName = typeof activeRide.passenger === 'object' ? activeRide.passenger.username : activeRide.passenger;

      // Inform the server that the ride is completed
      await api.post(`/rides/${currentRideId}/complete/`);

      setEarnings(prev => prev + parseFloat(activeRide.fare));
      setTripsCount(prev => prev + 1);
      setCompletedRideId(currentRideId);
      setCompletedPassengerName(passengerName);
      setActiveRide(null);

      // Show rating modal
      setTimeout(() => {
        setShowRating(true);
      }, 500);
    } catch (err) {
      console.error('Failed to complete ride', err);
      // Fallback for demo
      const currentRideId = activeRide.id;
      const passengerName = typeof activeRide.passenger === 'object' ? activeRide.passenger.username : activeRide.passenger;
      setEarnings(prev => prev + parseFloat(activeRide.fare));
      setTripsCount(prev => prev + 1);
      setCompletedRideId(currentRideId);
      setCompletedPassengerName(passengerName);
      setActiveRide(null);
      setTimeout(() => setShowRating(true), 500);
    }
  };

  const openNativeNavigation = (lat, lng, label = 'Destination') => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://maps.apple.com/?q=${label}&ll=${lat},${lng}`
      : `google.navigation:q=${lat},${lng}`;

    // Fallback for desktop/web
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    if (url.startsWith('google.navigation') || url.startsWith('maps:')) {
      window.location.href = url;
    } else {
      window.open(webUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-10 bg-slate-100 px-6">
      <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-8">

        {/* Verification Success Popup */}
        <AnimatePresence>
          {showVerificationSuccess && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-full lg:col-span-4 bg-green-600 text-white p-8 rounded-[2.5rem] shadow-2xl flex items-center justify-between gap-6 mb-6"
            >
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
                  <ShieldCheck size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase italic">You're Verified! 🚀</h3>
                  <p className="font-bold opacity-90">Your documents were approved. You can now go online and start earning.</p>
                </div>
              </div>
              <button
                onClick={() => setShowVerificationSuccess(false)}
                className="bg-white text-green-600 px-8 py-3 rounded-2xl font-black hover:bg-green-50 transition-all uppercase tracking-widest text-xs"
              >
                Let's Go!
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verification Warning */}
        {!user?.is_verified_driver && (
          <div className="w-full lg:col-span-4 bg-amber-50 border-2 border-amber-200 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-4 mb-4 shadow-sm">
            <div className="flex items-center gap-4 text-amber-800">
              <ShieldCheck className="text-amber-500" size={32} />
              <div>
                <p className="font-black uppercase text-xs tracking-wider">Verification Required</p>
                <p className="text-sm font-medium">Your account is not yet verified. You cannot accept rides until documents are approved.</p>
              </div>
            </div>
            <Link
              to="/driver/verify"
              className="bg-amber-500 text-white font-black px-8 py-3 rounded-2xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 whitespace-nowrap"
            >
              Verify Profile
            </Link>
          </div>
        )}

        {/* Left Column: Stats and Controls */}
        <div className="w-full lg:w-1/3 xl:w-1/4 space-y-6">
          {/* Trike Health Smart Badge */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`p-6 rounded-[2.5rem] border-2 shadow-xl overflow-hidden relative ${trikeHealth.status === 'critical' ? 'bg-red-50 border-red-100 text-red-900' :
              trikeHealth.status === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-900' :
                'bg-white border-slate-100 text-secondary'
              }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${trikeHealth.status === 'critical' ? 'bg-red-500 text-white shadow-lg shadow-red-200' :
                trikeHealth.status === 'warning' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' :
                  'bg-primary text-secondary'
                }`}>
                <Wrench size={20} />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Trike Health</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Activity size={12} className={trikeHealth.status === 'good' ? 'text-green-500' : ''} />
                  <span className="text-xs font-black uppercase tracking-tight">
                    {trikeHealth.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-black leading-tight">{trikeHealth.message}</p>
              <p className="text-[10px] font-bold opacity-60">
                Last Checkup: {maintenanceLogs.length > 0 ? new Date(maintenanceLogs[0].service_date).toLocaleDateString() : 'Never'}
              </p>
            </div>

            {/* Micro-Progress Bar */}
            <div className="mt-4 h-1.5 bg-black/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: trikeHealth.status === 'good' ? '90%' : trikeHealth.status === 'warning' ? '40%' : '10%' }}
                className={`h-full ${trikeHealth.status === 'critical' ? 'bg-red-500' :
                  trikeHealth.status === 'warning' ? 'bg-amber-500' :
                    'bg-green-500'
                  }`}
              />
            </div>

            {trikeHealth.status !== 'good' && (
              <Link to="/driver/maintenance" className="mt-4 flex items-center justify-center gap-2 bg-white/50 backdrop-blur-sm border border-black/5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all">
                <AlertTriangle size={12} />
                Fix Issue
              </Link>
            )}
          </motion.div>

          {/* Daily Goal Tracker */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-[2.5rem] bg-secondary text-white shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-2xl" />

            <div className="flex items-center justify-between mb-6">
              <div className="p-3 bg-white/10 rounded-2xl">
                <Target className="text-primary" size={20} />
              </div>
              <div className="bg-white/10 px-3 py-1 rounded-full flex items-center gap-2">
                <Trophy size={12} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Target</span>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-xs font-black uppercase tracking-widest opacity-60 mb-1">Daily Earnings Goal</h4>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black italic">₱{earnings.toLocaleString()}</span>
                <span className="text-sm font-bold opacity-40">/ ₱{dailyGoal.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span>Progress</span>
                <span>{Math.round((earnings / dailyGoal) * 100)}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((earnings / dailyGoal) * 100, 100)}%` }}
                  className="h-full bg-primary shadow-[0_0_15px_rgba(255,215,0,0.5)]"
                />
              </div>
            </div>

            <p className="mt-6 text-[10px] font-bold text-slate-400 italic">
              {earnings >= dailyGoal ? "🎉 Goal reached! Keep crushing it." : `Only ₱${(dailyGoal - earnings).toLocaleString()} away from your goal.`}
            </p>
          </motion.div>

          {Array.isArray(broadcasts) && broadcasts.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-2">Recent Advisories</h3>
              {broadcasts.slice(0, 2).map((b, idx) => (
                <motion.div
                  key={b.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => {
                    setCurrentBroadcast(b);
                    setShowBroadcastModal(true);
                  }}
                  className={`p-4 rounded-3xl border-2 flex items-start gap-4 shadow-lg cursor-pointer hover:scale-[1.02] transition-all ${b.is_critical ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}
                >
                  <div className={`p-3 rounded-2xl shrink-0 ${b.is_critical ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse' : 'bg-primary text-secondary'}`}>
                    <Megaphone size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[9px] font-black uppercase tracking-widest ${b.is_critical ? 'text-red-600' : 'text-primary-dark'}`}>
                        {b.is_critical ? 'Priority Alert' : 'Advisory'}
                      </span>
                      <span className="text-[8px] text-slate-400 font-bold">{new Date(b.created_at).toLocaleDateString()}</span>
                    </div>
                    <h4 className="text-xs font-black text-secondary truncate">{b.title}</h4>
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{b.message}</p>
                  </div>
                </motion.div>
              ))}
              {broadcasts.length > 2 && (
                <button className="w-full py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-colors">
                  View All Announcements ({broadcasts.length})
                </button>
              )}
            </div>
          )}

          {/* Status Switcher */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`glass-card p-6 rounded-[2rem] transition-all duration-500 ${isOnline ? 'border-primary shadow-primary/10' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full animate-pulse ${isOnline ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                <span className="font-bold text-secondary uppercase tracking-tight">Status: {isOnline ? 'Online' : 'Offline'}</span>
              </div>
              <button
                onClick={() => {
                  if (!user?.is_verified_driver) {
                    alert("Please verify your account first!");
                    return;
                  }
                  setIsOnline(!isOnline);
                }}
                className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${isOnline ? 'bg-primary' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 ${isOnline ? 'left-7' : 'left-1'}`}></div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Link to="/driver/earnings" className="bg-slate-50 p-4 rounded-2xl border border-slate-100 block hover:border-primary transition-colors group">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Earnings</p>
                  <TrendingUp size={12} className="text-slate-300 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-xl font-black text-secondary">₱{earnings}</p>
              </Link>
              <Link to="/driver/reviews" className="bg-slate-50 p-4 rounded-2xl border border-slate-100 block hover:border-primary transition-colors group">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Rating</p>
                  <Star size={12} className="text-slate-300 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-xl font-black text-secondary">{user?.average_rating ? parseFloat(user.average_rating).toFixed(1) : '0.0'}</p>
              </Link>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Trips</p>
                <p className="text-xl font-black text-secondary">{tripsCount}</p>
              </div>
            </div>
          </motion.div>

          {/* Ride Requests Area */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-2 flex items-center justify-between">
              <span>Active Requests</span>
              {isOnline && <Bell size={14} className="text-primary-dark" />}
            </h2>

            <AnimatePresence mode="popLayout">
              {!isOnline ? (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-white/40 border border-dashed border-slate-300 rounded-[2rem] p-12 text-center"
                >
                  <Tractor size={48} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-400 font-medium text-sm">Go Online to start receiving ride requests</p>
                </motion.div>
              ) : activeRide ? (
                <motion.div
                  initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                  className="bg-secondary text-white p-6 rounded-[2rem] shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Navigation2 size={80} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center overflow-hidden">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${typeof activeRide.passenger === 'object' ? activeRide.passenger.username : activeRide.passenger}`} alt="P" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{typeof activeRide.passenger === 'object' ? activeRide.passenger.username : activeRide.passenger}</p>
                          <p className="text-[10px] text-primary font-black uppercase tracking-widest">Active Trip</p>
                        </div>
                      </div>
                      <div className="bg-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase">
                        In Progress
                      </div>
                    </div>

                    <div className="space-y-4 mb-8 bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                      <div className="flex items-start space-x-3">
                        <MapPin size={18} className="text-primary mt-1" />
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Pickup</p>
                          <p className="text-sm truncate">{activeRide.pickup_address || activeRide.pickup}</p>
                        </div>
                      </div>
                      <div className="border-l-2 border-dashed border-slate-700 ml-2 h-4 my-1"></div>
                      <div className="flex items-start space-x-3">
                        <Navigation2 size={18} className="text-accent mt-1" />
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Destination</p>
                          <p className="text-sm truncate">{activeRide.dest_address || activeRide.dest}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          const target = passengerLivePos || { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng };
                          openNativeNavigation(target.lat, target.lng, 'Passenger Pickup');
                        }}
                        className="flex-1 bg-white/10 text-white font-black py-4 rounded-2xl hover:bg-white/20 transition-all flex items-center justify-center space-x-2 border border-white/10"
                      >
                        <Navigation2 size={20} className="text-primary" />
                        <span>Navigate</span>
                      </button>
                      <button
                        onClick={completeRide}
                        className="flex-[2] bg-primary text-secondary font-black py-4 rounded-2xl hover:bg-white transition-all flex items-center justify-center space-x-2 shadow-lg shadow-primary/20"
                      >
                        <Check size={20} />
                        <span>Complete</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : selectedRequest ? (
                <motion.div
                  key={selectedRequest.id}
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="bg-white border-2 border-primary p-6 rounded-[2.5rem] shadow-2xl relative"
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-secondary px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-bounce">
                    New Request
                  </div>

                  <div className="flex justify-between items-start mb-6 pt-2">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-slate-100 rounded-2xl overflow-hidden border-2 border-slate-50">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${typeof selectedRequest.passenger === 'object' ? selectedRequest.passenger.username : selectedRequest.passenger}`} alt="P" />
                      </div>
                      <div>
                        <p className="font-black text-secondary text-lg leading-tight">{typeof selectedRequest.passenger === 'object' ? selectedRequest.passenger.username : selectedRequest.passenger}</p>
                        <div className="flex items-center gap-1 text-yellow-500">
                          <Star size={12} className="fill-yellow-500" />
                          <span className="text-[10px] font-bold">4.9 • Member</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-secondary text-2xl">₱{selectedRequest.fare}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{selectedRequest.distance || '2.4 km'} away</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8 bg-slate-50 p-4 rounded-3xl">
                    <div className="flex items-start space-x-3">
                      <MapPin size={18} className="text-primary mt-1" />
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Pickup Location</p>
                        <p className="text-sm font-medium text-secondary truncate">{selectedRequest.pickup_address || selectedRequest.pickup}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Navigation2 size={18} className="text-accent mt-1" />
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Destination</p>
                        <p className="text-sm font-medium text-secondary truncate">{selectedRequest.dest_address || selectedRequest.dest}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => declineRequest(selectedRequest.id)}
                      className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                    >
                      <X size={20} />
                      <span>Decline</span>
                    </button>
                    <button
                      onClick={() => acceptRide(selectedRequest)}
                      className="flex-[2] bg-primary text-secondary font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
                    >
                      <Check size={20} />
                      <span>Accept Request</span>
                    </button>
                  </div>

                  {requests.length > 1 && (
                    <div className="mt-4 flex justify-center gap-1">
                      {requests.map(r => (
                        <div
                          key={r.id}
                          className={`h-1.5 rounded-full transition-all duration-300 ${r.id === selectedRequest.id ? 'w-8 bg-primary' : 'w-2 bg-slate-200'}`}
                          onClick={() => setSelectedRequest(r)}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="bg-white/60 p-12 text-center rounded-[2rem] border-2 border-dashed border-slate-200">
                  <Clock size={32} className="mx-auto text-slate-300 mb-2 animate-pulse" />
                  <p className="text-slate-400 text-sm italic">Waiting for requests...</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: Map and Navigation */}
        <div className="flex-1 min-h-[600px] relative rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white">
          <Map markers={markers} />

          {/* Map Overlays */}
          <div className="absolute top-8 left-8">
            <div className="bg-white/95 backdrop-blur-md px-6 py-4 rounded-3xl shadow-xl flex items-center space-x-4 border border-slate-100">
              <div className="w-10 h-10 bg-primary/20 text-primary-dark rounded-xl flex items-center justify-center font-black">
                {user?.username?.[0] || 'D'}
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Area</p>
                <p className="text-sm font-bold text-secondary">Trento, Agusan del Sur</p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
            {selectedRequest && (
              <button
                onClick={() => {
                  const pickupMarker = markers.find(m => m.isPickup);
                  if (pickupMarker) {
                    setMarkers([...markers.map(m => m.isPickup ? { ...m, forceFocus: Date.now() } : m)]);
                  }
                }}
                className="bg-primary text-secondary px-6 py-3 rounded-2xl font-black text-sm shadow-2xl flex items-center gap-2 hover:scale-105 transition-all border-2 border-white"
              >
                <MapPin size={18} />
                <span>Focus on Pickup</span>
              </button>
            )}
            {activeRide && (
              <>
                <button
                  onClick={() => {
                    // Force a fit bounds by updating markers state slightly
                    setMarkers([...markers.map(m => ({ ...m, forceUpdate: Date.now() }))]);
                  }}
                  className="bg-white text-secondary px-6 py-3 rounded-2xl font-black text-sm shadow-2xl flex items-center gap-2 hover:scale-105 transition-all border-2 border-slate-100"
                >
                  <Navigation2 size={18} />
                  <span>Center View</span>
                </button>
                <button
                  onClick={() => {
                    const target = passengerLivePos || { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng };
                    openNativeNavigation(target.lat, target.lng, 'Pickup Location');
                  }}
                  className="bg-secondary text-white px-6 py-3 rounded-2xl font-black text-sm shadow-2xl flex items-center gap-2 hover:scale-105 transition-all border-2 border-white/10"
                >
                  <MapPin size={18} className="text-primary" />
                  <span>Navigate to Passenger</span>
                </button>
              </>
            )}
          </div>

          <div className="absolute top-8 right-8 flex flex-col gap-3">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center text-slate-600 hover:text-primary transition-colors border border-slate-100"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={() => setShowHeatMapModal(true)}
              className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center text-slate-600 hover:text-primary transition-colors border border-slate-100"
            >
              <TrendingUp size={20} />
            </button>
          </div>
        </div>

      </div>

      {/* LGU Broadcast Modal */}
      <AnimatePresence>
        {showBroadcastModal && currentBroadcast && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => {
                setShowBroadcastModal(false);
                if (currentBroadcast.is_critical) localStorage.setItem('last_seen_broadcast', currentBroadcast.id.toString());
              }}
              className="absolute inset-0 bg-secondary/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] p-10 relative z-10 shadow-2xl overflow-hidden border border-white/20"
            >
              <div className={`absolute top-0 left-0 w-full h-2 ${currentBroadcast.is_critical ? 'bg-red-500' : 'bg-primary'}`} />
              <div className="flex flex-col items-center text-center">
                <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl rotate-3 ${currentBroadcast.is_critical ? 'bg-red-500 text-white' : 'bg-primary text-secondary'}`}>
                  <Megaphone size={40} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Trento LGU Official Announcement</p>
                <h2 className="text-3xl font-black text-secondary dark:text-white leading-tight mb-6">{currentBroadcast.title}</h2>
                <div className="w-full p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl mb-8">
                  <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{currentBroadcast.message}</p>
                </div>
                <button
                  onClick={() => {
                    setShowBroadcastModal(false);
                    if (currentBroadcast.is_critical) localStorage.setItem('last_seen_broadcast', currentBroadcast.id.toString());
                  }}
                  className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl hover:scale-[1.02] ${currentBroadcast.is_critical ? 'bg-red-500 text-white shadow-red-200' : 'bg-secondary text-white'}`}
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {activeRide && (
        <ChatWindow
          messages={messages}
          onSendMessage={sendMessage}
          currentUser={user?.username}
          partnerName={typeof activeRide.passenger === 'object' ? activeRide.passenger.username : activeRide.passenger}
        />
      )}

      <DriverSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        user={user}
        onRefresh={() => window.location.reload()}
      />

      <HeatMapModal
        isOpen={showHeatMapModal}
        onClose={() => setShowHeatMapModal(false)}
      />

      <RatingModal
        isOpen={showRating}
        onClose={() => {
          setShowRating(false);
          setCompletedRideId(null);
          setCompletedPassengerName('');
        }}
        rideId={completedRideId}
        targetName={completedPassengerName}
        targetRole="Passenger"
      />
    </div>
  );
};

export default DriverHome;
