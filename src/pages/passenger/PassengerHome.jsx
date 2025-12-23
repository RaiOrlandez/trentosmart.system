import React, { useState, useContext, useEffect, useCallback } from 'react';
import Map from '../../components/Map';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Navigation,
  Clock,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Star,
  Search,
  TrendingUp,
  Wallet,
  MessageSquare,
  Home,
  Briefcase,
  GraduationCap,
  Store,
  Plus,
  Megaphone,
  Bell
} from 'lucide-react';
import PaymentModal from '../../components/PaymentModal';
import RatingModal from '../../components/RatingModal';
import useRideTracking from '../../hooks/useRideTracking';
import useSystemEvents from '../../hooks/useSystemEvents';
import ChatWindow from '../../components/ChatWindow';
import SavedPlaceModal from '../../components/SavedPlaceModal';
import GCashPaymentModal from '../../components/GCashPaymentModal';
import { Settings, X } from 'lucide-react';

const PassengerHome = () => {
  const [pickup, setPickup] = useState('');
  const [dest, setDest] = useState('');
  const [status, setStatus] = useState('idle');
  const [markers, setMarkers] = useState([]);
  const [fare, setFare] = useState(0);
  const [nearbyDrivers] = useState(8);
  const [showSOS, setShowSOS] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [surgeInfo, setSurgeInfo] = useState({ multiplier: 1, isSurge: false });
  const [showPayment, setShowPayment] = useState(false);
  const [showGCashPayment, setShowGCashPayment] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [activeRideId, setActiveRideId] = useState(null);
  const [assignedDriver, setAssignedDriver] = useState(null);

  const [distance, setDistance] = useState(0);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [currentBroadcast, setCurrentBroadcast] = useState(null);

  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState(null);

  const [fareParams, setFareParams] = useState({ base: 30, perKm: 8 });
  const { driverLocation, systemEvent } = useSystemEvents();
  const [proximityAlert, setProximityAlert] = useState(false);

  // LGU Rules: Base 30 + 8 per km
  // Simulated Distance Service: Estimates distance based on address complexity
  const computeFare = useCallback(() => {
    if (!pickup || !dest) {
      setFare(0);
      setDistance(0);
      return;
    }

    // Seeded random based on address strings for consistency in same session
    const combined = (pickup + dest).length;
    const simDistance = (combined % 5) + (combined / 10); // Pseudo-distance 1-10km

    // Fetch AI Elasticity Surge
    const fetchSurge = async () => {
      try {
        const res = await api.get('/rides/estimate_fare/');
        const { base_fare, rate_per_km, surge_multiplier, is_surge } = res.data;

        setFareParams({ base: base_fare, perKm: rate_per_km });

        const totalFare = (base_fare + (rate_per_km * simDistance)) * surge_multiplier;
        setFare(Math.round(totalFare));
        setSurgeInfo({ multiplier: surge_multiplier, isSurge: is_surge });
      } catch (err) {
        const totalFare = 30 + Math.round(8 * simDistance);
        setFare(totalFare);
      }
    };

    setDistance(simDistance.toFixed(1));
    fetchSurge();
  }, [pickup, dest]);

  const fetchSavedPlaces = useCallback(async () => {
    try {
      const res = await api.get('/saved-places/');
      setSavedPlaces(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch saved places', err);
    }
  }, []);

  const handleDeletePlace = async (id) => {
    if (!window.confirm("Remove this place from your list?")) return;
    try {
      await api.delete(`/saved-places/${id}/`);
      fetchSavedPlaces();
    } catch (err) {
      alert("Failed to delete place");
    }
  };

  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await api.get('/broadcasts/');
      setBroadcasts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch broadcasts', err);
    }
  }, []);

  useEffect(() => {
    fetchSavedPlaces();
    fetchBroadcasts();
  }, [fetchSavedPlaces, fetchBroadcasts]);

  useEffect(() => {
    // Check for new critical broadcasts
    const lastSeen = localStorage.getItem('last_seen_broadcast_p');
    if (broadcasts.length > 0 && broadcasts[0].is_critical && broadcasts[0].id.toString() !== lastSeen) {
      setCurrentBroadcast(broadcasts[0]);
      setShowBroadcastModal(true);
    }
  }, [broadcasts]);

  useEffect(() => {
    if (pickup && dest) {
      computeFare();
    }
  }, [pickup, dest, computeFare]);

  // Live Tracking
  const { user } = useContext(AuthContext);
  const { location: wsData, sendMessage, messages, sendLocation } = useRideTracking(activeRideId);

  // Send passenger location to driver
  useEffect(() => {
    let watchId;
    if (activeRideId && (status === 'matched' || status === 'ongoing')) {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            sendLocation(pos.coords.latitude, pos.coords.longitude);
          },
          (err) => console.error(err),
          { enableHighAccuracy: true }
        );
      }
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [activeRideId, status, sendLocation]);

  // Handle Real-time Driver Markers (Global)
  useEffect(() => {
    if (driverLocation && status === 'idle') {
      setMarkers(prev => {
        const existingIdx = prev.findIndex(m => m.id === driverLocation.id);
        const newMarker = {
          id: driverLocation.id,
          lat: parseFloat(driverLocation.lat),
          lng: parseFloat(driverLocation.lng),
          title: 'Trike Driver',
          info: 'Available',
          isDriver: true
        };
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = newMarker;
          return updated;
        }
        return [...prev, newMarker];
      });
    }
  }, [driverLocation, status]);

  // Listen for Real-time System Broadcasts
  useEffect(() => {
    if (systemEvent && systemEvent.type === 'new_broadcast') {
      const b = systemEvent.broadcast;
      // Only show if it targets passengers or everyone
      if (b.target_role === 'all' || b.target_role === 'passenger') {
        setCurrentBroadcast(b);
        setShowBroadcastModal(true);
      }
    }

    // Real-time Fare Updates
    if (systemEvent && systemEvent.type === 'config_update') {
      computeFare();
    }
  }, [systemEvent, computeFare]);

  // Handle Proximity Alert
  useEffect(() => {
    if (wsData && wsData.lat && wsData.lng && status === 'matched') {
      // Simple distance check (approx 200m)
      const latDiff = Math.abs(parseFloat(wsData.lat) - 8.050);
      const lngDiff = Math.abs(parseFloat(wsData.lng) - 126.062);
      if (latDiff < 0.002 && lngDiff < 0.002 && !proximityAlert) {
        setProximityAlert(true);
      }
    }
  }, [wsData, status, proximityAlert]);

  // Handle Ride Status Updates via WebSocket
  useEffect(() => {
    if (wsData && wsData.type === 'status_update') {
      const newStatus = wsData.status;
      if (newStatus === 'accepted') setStatus('matched');
      if (newStatus === 'on_route') setStatus('ongoing');
      if (newStatus === 'completed') setStatus('arrived');
    }
  }, [wsData]);

  useEffect(() => {
    if (wsData && wsData.lat && wsData.lng && status === 'matched') {
      setMarkers(current => {
        // Keep pickup and dest, update driver
        const otherMarkers = current.filter(m => m.title !== 'Driver');

        // Find if we should auto-focus (first time driver appears or if we have a "Follow Mode" active)
        const shouldFocus = !current.find(m => m.title === 'Driver');

        return [
          ...otherMarkers,
          {
            lat: parseFloat(wsData.lat),
            lng: parseFloat(wsData.lng),
            title: 'Driver',
            info: 'On the way to you!',
            isDriver: true,
            forceFocus: shouldFocus ? Date.now() : undefined
          }
        ];
      });
    }
  }, [wsData, status]);

  const requestRide = async (e) => {
    e.preventDefault();
    if (!pickup || !dest) return;

    setStatus('requesting');

    try {
      // Create actual ride in database
      const response = await api.post('/rides/', {
        pickup_address: pickup,
        dest_address: dest,
        pickup_lat: 8.050, // In production, use actual geolocation
        pickup_lng: 126.062,
        dest_lat: 8.055,
        dest_lng: 126.070,
        fare: fare,
        payment_method: paymentMethod
      });

      const createdRide = response.data;
      setActiveRideId(createdRide.id);

      // Auto-assign a driver immediately (in production, this would be done by dispatch system)
      try {
        const driversResponse = await api.get('/users/');
        const allUsers = Array.isArray(driversResponse.data) ? driversResponse.data : [];
        const drivers = allUsers.filter(u => u.role === 'driver');

        if (drivers.length === 0) {
          // No drivers available - create a test driver or show error
          alert('No drivers available. Please ensure at least one driver account exists in the system.');
          setStatus('idle');
          return;
        }

        const availableDriver = drivers.find(d => d.is_verified_driver) || drivers[0];
        if (availableDriver) {
          setAssignedDriver(availableDriver);
          // Update ride with driver assignment
          await api.patch(`/rides/${createdRide.id}/`, {
            driver: availableDriver.id,
            status: 'accepted',
            accepted_at: new Date().toISOString()
          });
        }
        console.log('Driver assigned:', availableDriver.username);
      } catch (err) {
        console.error('Failed to assign driver', err);
        alert('Failed to assign driver. The ride was created but cannot proceed without a driver.');
        setStatus('idle');
        return;
      }

      // Show matching animation
      setTimeout(() => {
        setStatus('matched');
        const baseLat = 8.050;
        const baseLng = 126.062;
        setMarkers([
          { lat: baseLat, lng: baseLng, title: 'Pickup', info: 'Your location' },
          { lat: baseLat + 0.005, lng: baseLng + 0.008, title: 'Destination', info: 'Destination' },
        ]);
      }, 1000);
    } catch (err) {
      console.error('Failed to create ride', err);
      alert('Failed to request ride. Please try again.');
      setStatus('idle');
    }
  };

  const cancelRide = () => {
    setStatus('idle');
    setMarkers([]);
    setFare(0);
  };

  const triggerSOS = async () => {
    setShowSOS(true);
    try {
      await api.post('/incidents/', {
        lat: 8.050, // Real app would use geolocation.getCurrentPosition
        lng: 126.062,
        description: 'Passenger SOS Triggered from Mobile App'
      });
    } catch (err) {
      console.error('Failed to send SOS alert', err);
    }
    setTimeout(() => setShowSOS(false), 5000);
  };

  const completeAndPay = async () => {
    if (paymentMethod === 'gcash') {
      setShowGCashPayment(true);
    } else if (paymentMethod !== 'cash') {
      setShowPayment(true);
    } else {
      // Mark ride as completed in database
      try {
        if (activeRideId) {
          await api.patch(`/rides/${activeRideId}/`, {
            status: 'completed',
            completed_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Failed to update ride status', err);
      }

      setStatus('completed');
      setMarkers([]);

      // Show rating modal after a short delay
      setTimeout(() => {
        setShowRating(true);
      }, 1000);
    }
  };

  const handleGCashSuccess = async (transactionRef) => {
    console.log('GCash payment successful:', transactionRef);

    // Mark ride as completed in database
    try {
      if (activeRideId) {
        await api.patch(`/rides/${activeRideId}/`, {
          status: 'completed',
          completed_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Failed to update ride status', err);
    }

    setShowGCashPayment(false);
    setStatus('completed');
    setMarkers([]);
    setTimeout(() => {
      setShowRating(true);
    }, 1000);
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'home': return <Home size={18} />;
      case 'work': return <Briefcase size={18} />;
      case 'school': return <GraduationCap size={18} />;
      case 'market': return <Store size={18} />;
      default: return <MapPin size={18} />;
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-10 bg-slate-100 dark:bg-slate-950 flex flex-col md:flex-row gap-6 px-6 max-w-[1400px] mx-auto transition-colors duration-500">
      {/* LGU Announcements */}
      <div className="w-full md:w-1/3 lg:w-1/4 space-y-6">
        {Array.isArray(broadcasts) && broadcasts.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-2 flex items-center gap-2">
              <Bell size={12} className="text-primary" /> LGU Announcements
            </h3>
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
                className={`p-4 rounded-3xl border-2 flex items-start gap-4 shadow-lg cursor-pointer hover:scale-[1.02] transition-all ${b.is_critical ? 'bg-red-50 border-red-100' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5'}`}
              >
                <div className={`p-3 rounded-2xl shrink-0 ${b.is_critical ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse' : 'bg-primary text-secondary'}`}>
                  <Megaphone size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${b.is_critical ? 'text-red-600' : 'text-primary-dark'}`}>
                      {b.is_critical ? 'Urgent Alert' : 'City News'}
                    </span>
                    <span className="text-[8px] text-slate-400 font-bold">{new Date(b.created_at).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-xs font-black text-secondary dark:text-white truncate">{b.title}</h4>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{b.message}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="glass-card p-6 rounded-3xl"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Navigation className="text-secondary" size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-secondary dark:text-white leading-none">Where to?</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{nearbyDrivers} drivers nearby in Trento</p>
            </div>
          </div>

          <form onSubmit={requestRide} className="space-y-4">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <MapPin size={18} />
              </div>
              <input
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                placeholder="Current location"
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all dark:text-white"
              />
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={18} />
              </div>
              <input
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                placeholder="Enter destination"
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all dark:text-white"
              />
            </div>

            {status === 'idle' && (
              <div className="pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Quick Places</p>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none px-1">
                  {Array.isArray(savedPlaces) && savedPlaces.map((place) => (
                    <div key={place.id} className="relative group/place shrink-0">
                      <motion.button
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setDest(place.address)}
                        className="flex flex-col items-center gap-2 group/btn"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-center text-slate-400 group-hover/btn:bg-primary group-hover/btn:text-secondary group-hover/btn:border-primary transition-all">
                          {getCategoryIcon(place.category)}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate w-14 text-center">{place.name}</span>
                      </motion.button>
                      <div className="absolute -top-1 -right-1 flex flex-col gap-1 opacity-0 group-hover/place:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingPlace(place); setShowPlaceModal(true); }}
                          className="p-1.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-full shadow-lg text-slate-400 hover:text-primary transition-colors"
                        >
                          <Settings size={10} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePlace(place.id); }}
                          className="p-1.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-full shadow-lg text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <motion.button
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setEditingPlace(null); setShowPlaceModal(true); }}
                    className="flex-shrink-0 flex flex-col items-center gap-2 group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-300 group-hover:border-primary group-hover:text-primary transition-all">
                      <Plus size={18} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 truncate w-12 text-center text-ellipsis">Add New</span>
                  </motion.button>
                </div>
              </div>
            )}

            {fare > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="p-5 bg-gradient-to-br from-primary/20 to-secondary text-white rounded-3xl border border-primary/30 relative overflow-hidden"
              >
                <div className="absolute -right-4 -top-4 opacity-10">
                  <TrendingUp size={80} />
                </div>

                <div className="relative z-10">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">Estimated Fare</p>
                      <p className="text-3xl font-black italic underline decoration-primary">₱{fare}.00</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Distance</p>
                      <p className="font-bold text-accent">{distance} km</p>
                    </div>
                  </div>

                  <div className="space-y-1 mb-6 opacity-80">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span>Base Fare</span>
                      <span>₱{fareParams.base}.00</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span>Rate per KM</span>
                      <span>₱{fareParams.perKm}.00 / km</span>
                    </div>
                    {surgeInfo.isSurge && (
                      <div className="flex justify-between text-[10px] font-bold text-accent animate-pulse">
                        <span>High Demand Surge (x{surgeInfo.multiplier})</span>
                        <span>+₱{(fare - (fare / surgeInfo.multiplier)).toFixed(0)}.00</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-2 px-1 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 border-2 transition-all ${paymentMethod === 'cash' ? 'bg-primary text-secondary border-primary shadow-lg shadow-primary/20' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                    >
                      <Wallet size={12} /> CASH
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('gcash')}
                      className={`py-2 px-1 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 border-2 transition-all ${paymentMethod === 'gcash' ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                    >
                      <CreditCard size={12} /> GCASH
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('wallet')}
                      className={`py-2 px-1 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 border-2 transition-all ${paymentMethod === 'wallet' ? 'bg-primary-dark text-white border-primary-dark shadow-lg shadow-primary-dark/20' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                    >
                      <Wallet size={12} /> WALLET
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {status === 'idle' ? (
              <button
                type="submit"
                disabled={!dest}
                className="w-full btn-primary py-4 disabled:opacity-50 disabled:transform-none"
              >
                Confirm Request
              </button>
            ) : status === 'requesting' ? (
              <div className="w-full py-4 bg-slate-100 rounded-full flex items-center justify-center space-x-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="font-bold text-slate-600 italic">Finding Driver...</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={cancelRide}
                className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-full hover:bg-red-100 transition-colors"
              >
                Cancel Ride
              </button>
            )}
          </form>
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={triggerSOS}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-3xl shadow-xl flex items-center justify-center gap-3 transition-colors"
        >
          <AlertTriangle size={24} />
          SOS EMERGENCY
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-full bg-white border border-slate-200 text-slate-600 font-bold py-4 rounded-3xl shadow-sm flex items-center justify-center gap-3 transition-colors"
        >
          <MessageSquare size={24} />
          Support & Complaints
        </motion.button>

        {/* Status Card */}
        <AnimatePresence>
          {status !== 'idle' && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="glass-card p-6 rounded-3xl border-l-4 border-accent"
            >
              <h3 className="text-secondary font-bold flex items-center gap-2 mb-4">
                <CheckCircle2 className="text-accent" size={20} />
                {status === 'matched' ? 'Driver Dispatched' : 'Request Pending'}
              </h3>
              {status === 'matched' && (
                <>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-200">
                      <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Driver" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-secondary">Ricky M.</p>
                      <div className="flex items-center text-xs text-slate-500">
                        <Star size={12} className="text-yellow-400 fill-yellow-400 mr-1" />
                        <span>4.9 • Plate #RT-1024</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={completeAndPay}
                    className="w-full mt-4 py-2 bg-green-500 text-white font-bold rounded-xl text-xs hover:bg-green-600 transition-colors uppercase tracking-wider"
                  >
                    Arrived at Destination
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Map View */}
      <div className="flex-1 min-h-[500px] relative rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white">
        <Map markers={markers} />

        {/* Floating Info */}
        <div className="absolute top-6 right-6 flex flex-col gap-3">
          <AnimatePresence>
            {proximityAlert && status === 'matched' && (
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                className="bg-primary text-secondary p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-white animate-bounce"
              >
                <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
                  <Navigation className="text-secondary animate-pulse" size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-tighter">He's here!</p>
                  <p className="text-sm font-bold">Driver is arriving now</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {status === 'completed' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-green-500 text-white p-4 rounded-2xl shadow-lg flex items-center gap-3"
            >
              <CheckCircle2 size={24} />
              <span className="font-bold">Ride Completed!</span>
            </motion.div>
          )}
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-slate-100 flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <MapPin size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Service Area</p>
              <p className="text-sm font-bold text-secondary">Trento, Agusan del Sur</p>
            </div>
          </div>
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-slate-100 flex items-center gap-4">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Estimated Time</p>
              <p className="text-sm font-bold text-secondary">4 mins away</p>
            </div>
          </div>
          {status === 'matched' && (
            <button
              onClick={() => {
                const driverMarker = markers.find(m => m.title === 'Driver');
                if (driverMarker) {
                  setMarkers([...markers.map(m => m.title === 'Driver' ? { ...m, forceFocus: Date.now() } : m)]);
                }
              }}
              className="bg-secondary text-white p-4 rounded-2xl shadow-lg flex items-center gap-3 hover:scale-105 transition-all border border-white/10"
            >
              <Navigation size={20} className="text-primary" />
              <span className="text-sm font-bold">Track Driver</span>
            </button>
          )}
        </div>

        {/* SOS Overlay */}
        <AnimatePresence>
          {showSOS && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute inset-0 z-50 bg-red-600/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 text-white"
            >
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center animate-ping mb-8">
                <AlertTriangle size={64} />
              </div>
              <h2 className="text-4xl font-extrabold mb-4 uppercase tracking-tighter">Emergency Signal Sent!</h2>
              <p className="text-xl max-w-md opacity-90">
                Authorities in Trento and emergency responders have been notified of your location. Stay where you are.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        amount={fare}
        method={paymentMethod}
        onComplete={async () => {
          // Mark ride as completed in database
          try {
            if (activeRideId) {
              await api.patch(`/rides/${activeRideId}/`, {
                status: 'completed',
                completed_at: new Date().toISOString()
              });
            }
          } catch (err) {
            console.error('Failed to update ride status', err);
          }

          setShowPayment(false);
          setStatus('completed');
          setMarkers([]);
          setShowRating(true);
        }}
      />

      <RatingModal
        isOpen={showRating}
        onClose={() => {
          setShowRating(false);
          setStatus('idle');
          setFare(0);
        }}
        rideId={activeRideId}
        targetName={assignedDriver?.username || 'Ricky M.'}
        targetRole="Driver"
      />

      {/* LGU Broadcast Modal */}
      <AnimatePresence>
        {showBroadcastModal && currentBroadcast && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => {
                setShowBroadcastModal(false);
                if (currentBroadcast.is_critical) localStorage.setItem('last_seen_broadcast_p', currentBroadcast.id.toString());
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
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Trento LGU Official Bulletin</p>
                <h2 className="text-3xl font-black text-secondary dark:text-white leading-tight mb-6">{currentBroadcast.title}</h2>
                <div className="w-full p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl mb-8">
                  <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{currentBroadcast.message}</p>
                </div>
                <button
                  onClick={() => {
                    setShowBroadcastModal(false);
                    if (currentBroadcast.is_critical) localStorage.setItem('last_seen_broadcast_p', currentBroadcast.id.toString());
                  }}
                  className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl hover:scale-[1.02] ${currentBroadcast.is_critical ? 'bg-red-500 text-white shadow-red-200' : 'bg-secondary text-white'}`}
                >
                  I've Read This
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {status === 'matched' && (
        <ChatWindow
          messages={messages}
          onSendMessage={sendMessage}
          currentUser={user?.username}
          partnerName="Ricky M."
        />
      )}

      <SavedPlaceModal
        isOpen={showPlaceModal}
        onClose={() => { setShowPlaceModal(false); setEditingPlace(null); }}
        onRefresh={fetchSavedPlaces}
        place={editingPlace}
      />

      <GCashPaymentModal
        isOpen={showGCashPayment}
        onClose={() => setShowGCashPayment(false)}
        amount={fare}
        onSuccess={handleGCashSuccess}
        rideId={activeRideId}
      />
    </div >
  );
};

export default PassengerHome;
