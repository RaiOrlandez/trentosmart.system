import React, { useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Bell,
  Share2,
  Phone
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
  const navigate = useNavigate();
  const [pickup, setPickup] = useState('');
  const [dest, setDest] = useState('');
  const [status, setStatus] = useState('idle');
  const [markers, setMarkers] = useState([]);
  const [fare, setFare] = useState(0);
  const [nearbyDrivers, setNearbyDrivers] = useState(8);
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
  const [nearbyDriverList, setNearbyDriverList] = useState([]); // New: Detailed driver list
  const [selectedDriverId, setSelectedDriverId] = useState(null); // New: Choosen driver ID
  const [routeCoordinates, setRouteCoordinates] = useState(null); // Real driving path

  const [fareParams, setFareParams] = useState({ base: 30, perKm: 8 });
  const { driverLocation, systemEvent } = useSystemEvents();
  const [proximityAlert, setProximityAlert] = useState(false);
  const [requestTimeRemaining, setRequestTimeRemaining] = useState(0);
  const [showFallbackButton, setShowFallbackButton] = useState(false);

  // LGU Rules: Base 30 + 8 per km
  // Simulated Distance Service: Estimates distance based on address complexity
  const computeFare = useCallback(async () => {
    if (!pickup || !dest) {
      setFare(0);
      setDistance(0);
      return;
    }

    try {
      // 1. Geocode Pickup & Destination using OpenStreetMap Nominatim
      // We append the LGU context (Trento) to improve accuracy if not explicitly typed
      const searchPickup = pickup.toLowerCase().includes('trento') ? pickup : `${pickup}, Trento, Agusan del Sur, Philippines`;
      const searchDest = dest.toLowerCase().includes('trento') ? dest : `${dest}, Trento, Agusan del Sur, Philippines`;

      // Fetch Geocoding coordinates (Adding a short timeout to prevent UI hanging)
      const fetchWithTimeout = (url) => Promise.race([
        fetch(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);

      const picRes = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchPickup)}&format=json&limit=1`);
      const destRes = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchDest)}&format=json&limit=1`);

      const picData = await picRes.json();
      const destData = await destRes.json();

      let actualDistance = 0;

      // 2. If valid coordinates are found, query OSRM for exact road distance
      if (picData && picData.length > 0 && destData && destData.length > 0) {
        const pLat = picData[0].lat;
        const pLon = picData[0].lon;
        const dLat = destData[0].lat;
        const dLon = destData[0].lon;

        const routeRes = await fetchWithTimeout(`https://router.project-osrm.org/route/v1/driving/${pLon},${pLat};${dLon},${dLat}?overview=full&geometries=geojson`);
        const routeData = await routeRes.json();

        if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
          // Distance provided in meters; convert to kilometers
          actualDistance = routeData.routes[0].distance / 1000;

          // Extract GeoJSON coordinates [lng, lat] and convert to Leaflet format [lat, lng]
          const pathCoords = routeData.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
          setRouteCoordinates(pathCoords);

          // Visualize the actual geocoded points on the map
          setMarkers(prev => {
            const others = prev.filter(m => !m.isPickup && !m.isDestination && m.title !== 'Pickup' && m.title !== 'Destination');
            return [
              ...others,
              { id: 'pickup', lat: parseFloat(pLat), lng: parseFloat(pLon), title: 'Pickup', info: pickup, isPickup: true, forceFocus: Date.now() },
              { id: 'dest', lat: parseFloat(dLat), lng: parseFloat(dLon), title: 'Destination', info: dest, isDestination: true }
            ];
          });
        }
      }

      // 3. Fallback logic: If they input "Home" or unmappable custom saved places,
      // we fallback to our deterministic pseudo-distance generator to ensure the app still works.
      if (actualDistance === 0) {
        const combined = (pickup + dest).length;
        actualDistance = (combined % 5) + (combined / 10) + 1.5;
      }

      // Ensure a minimum logical distance of 1km for local tricycles
      const finalDistanceKm = Math.max(1, actualDistance);
      setDistance(finalDistanceKm.toFixed(1));

      // 4. Fetch dynamic pricing from backend (Base + Per Km + Surge Multiplier)
      try {
        const res = await api.get('/rides/estimate_fare/');
        const { base_fare, rate_per_km, surge_multiplier, is_surge } = res.data;

        setFareParams({ base: base_fare, perKm: rate_per_km });

        const totalFare = (base_fare + (rate_per_km * finalDistanceKm)) * surge_multiplier;
        setFare(Math.round(totalFare));
        setSurgeInfo({ multiplier: surge_multiplier, isSurge: is_surge });
      } catch (err) {
        // Offline Fallback for Pricing
        const totalFare = 30 + (8 * finalDistanceKm);
        setFare(Math.round(totalFare));
      }

    } catch (err) {
      console.warn("Real Geocoding Failed (likely limit or offline). Using offline heuristic calculation.");
      const fallbackDist = ((pickup + dest).length % 5) + 1.2;
      setDistance(fallbackDist.toFixed(1));
      setFare(30 + Math.round(8 * fallbackDist));
      setRouteCoordinates(null);
    }
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

    // Sync Passenger Online Status
    const syncStatus = async (status) => {
      try {
        await api.post('/users/toggle_online/', { is_online: status });
      } catch (err) {
        console.error('Failed to sync passenger status', err);
      }
    };
    syncStatus(true);

    return () => {
      syncStatus(false);
    };
  }, [fetchSavedPlaces, fetchBroadcasts]);

  // Real-time Driver Availability
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const res = await api.get('/users/nearby_drivers/', {
          params: { lat: 8.050, lng: 126.062 } // Simulated passenger location
        });
        setNearbyDriverList(Array.isArray(res.data) ? res.data : []);
        setNearbyDrivers(Array.isArray(res.data) ? res.data.length : 0);
      } catch (err) {
        console.error('Failed to fetch nearby drivers', err);
      }
    };

    fetchDrivers(); // Initial
    const interval = setInterval(fetchDrivers, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

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
      // If driver went offline, remove their marker
      if (driverLocation.is_online === false) {
        setMarkers(prev => prev.filter(m => m.id !== driverLocation.id));
        return;
      }

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

    // Safety Redundancy: Listen for match events via system channel too
    if (systemEvent && systemEvent.type === 'ride_matched') {
      const matchedRide = systemEvent.ride;
      if (matchedRide.id === activeRideId && status === 'requesting') {
        setStatus('matched');
        if (matchedRide.driver) {
          setAssignedDriver(matchedRide.driver);
        }
      }
    }

    // Real-time Fare Updates
    if (systemEvent && systemEvent.type === 'config_update') {
      computeFare();
    }
  }, [systemEvent, computeFare, activeRideId, status]);

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
      if (newStatus === 'accepted') {
        setStatus('matched');
        if (wsData.data && wsData.data.driver) {
          setAssignedDriver(wsData.data.driver);
        }
      }
      if (newStatus === 'driver_rejected') {
        setStatus('idle');
        setSelectedDriverId(null);
        setActiveRideId(null); // Clear active ride to allow re-requesting
        alert(wsData.message || 'The chosen driver is currently unavailable. Please pick another driver.');
      }
      if (newStatus === 'on_route') setStatus('ongoing');
      if (newStatus === 'completed') {
        setStatus('arrived');
        // Auto-trigger payment modal based on method
        if (paymentMethod === 'gcash') {
          setShowGCashPayment(true);
        } else {
          setShowPayment(true);
        }
      }
    }
  }, [wsData]);

  // Polling Fallback for Ride Status (Safety Net)
  useEffect(() => {
    let interval;
    if (activeRideId && status === 'requesting') {
      const checkStatus = async () => {
        try {
          const res = await api.get(`/rides/${activeRideId}/`);
          if (res.data.status === 'accepted') {
            setStatus('matched');
            // Also fetch driver details if needed, but usually we just wait for WS for live location.
            // However, we should at least have the static driver info.
            if (res.data.driver) {
              setAssignedDriver(res.data.driver);
            }
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      };
      interval = setInterval(checkStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [activeRideId, status]);

  // Request Timeout Logic
  useEffect(() => {
    let timer;
    if (status === 'requesting' && requestTimeRemaining > 0) {
      timer = setInterval(() => {
        setRequestTimeRemaining(prev => {
          if (prev <= 1) {
            setShowFallbackButton(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status, requestTimeRemaining]);

  useEffect(() => {
    if (wsData && wsData.lat && wsData.lng && (status === 'matched' || status === 'ongoing')) {
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
        payment_method: paymentMethod,
        targeted_driver_id: selectedDriverId // NEW: Custom Selection
      });

      const createdRide = response.data;
      setActiveRideId(createdRide.id);

      if (selectedDriverId) {
        setRequestTimeRemaining(30); // 30s wait for preferred driver
        setShowFallbackButton(false);
      }

      // REAL-TIME DISPATCH:
      console.log('Ride requested. Waiting for driver...');



    } catch (err) {
      console.error('Failed to create ride', err);
      alert('Failed to request ride. Please try again.');
      setStatus('idle');
    }
  };

  const cancelRide = async () => {
    if (activeRideId) {
      try {
        await api.patch(`/rides/${activeRideId}/`, { status: 'cancelled' });
      } catch (err) {
        console.error('Failed to cancel ride on server', err);
      }
    }
    setStatus('idle');
    setMarkers([]);
    setRouteCoordinates(null);
    setFare(0);
    setActiveRideId(null);
    setSelectedDriverId(null);
  };

  const triggerSOS = async () => {
    setShowSOS(true);

    let currentLat = 8.050; // Fallback to Trento Municipal Hall
    let currentLng = 126.062;

    // Try to get actual location before dispatching emergency
    if ("geolocation" in navigator) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        currentLat = position.coords.latitude;
        currentLng = position.coords.longitude;
      } catch (e) {
        console.warn('Geolocation failed for SOS, using fallback coords.');
      }
    }

    try {
      await api.post('/incidents/', {
        lat: currentLat,
        lng: currentLng,
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
      setRouteCoordinates(null);

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
              <p className={`text-xs mt-1 font-bold ${nearbyDrivers > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {nearbyDrivers > 0 ? `${nearbyDrivers} drivers nearby` : 'No drivers currently online'}
              </p>
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

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-3 px-1 rounded-2xl text-xs font-black flex items-center justify-center gap-2 border-2 transition-all ${paymentMethod === 'cash' ? 'bg-primary text-secondary border-primary shadow-lg shadow-primary/20' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                    >
                      <Wallet size={16} /> CASH
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('gcash')}
                      className={`py-3 px-1 rounded-2xl text-xs font-black flex items-center justify-center gap-2 border-2 transition-all ${paymentMethod === 'gcash' ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                    >
                      <CreditCard size={16} /> GCASH
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {fare > 0 && nearbyDriverList.length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Select Your Preferred Driver</p>
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
                  {nearbyDriverList.slice(0, 3).map((driver) => (
                    <div
                      key={driver.id}
                      onClick={() => setSelectedDriverId(driver.id)}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3 ${selectedDriverId === driver.id ? 'border-primary bg-primary/5 shadow-md scale-[1.02]' : 'border-slate-100 bg-white hover:border-primary/30'}`}
                    >
                      <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                        {driver.profile_picture ? (
                          <img src={driver.profile_picture} alt="Driver" className="w-full h-full object-cover" />
                        ) : (
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${driver.username}`} alt="Driver" className="w-full h-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-black text-secondary truncate">{driver.username}</p>
                          <div className="flex items-center gap-1 text-yellow-600 font-bold text-xs">
                            <Star size={10} className="fill-yellow-400 mr-0.5" />
                            {driver.average_rating || '5.0'}
                            {driver.average_rating >= 4.5 && (
                              <span className="ml-1 text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Top Rated</span>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {driver.vehicle_model} • {driver.vehicle_plate} • {driver.sidecar_type || 'Standard'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            UNIT {driver.body_number || '---'}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 italic">
                            {driver.distance} km away
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 opacity-70">
                          <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1 py-0.5 rounded border border-blue-100 uppercase">
                            License Verified
                          </span>
                          <span className="text-[8px] font-black text-green-600 bg-green-50 px-1 py-0.5 rounded border border-green-100 uppercase">
                            LGU Permit Active
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
              <div className="space-y-4">
                <div className="w-full py-4 bg-slate-100 rounded-full flex flex-col items-center justify-center">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-bold text-slate-600 italic">
                      {selectedDriverId ? `Waiting for ${nearbyDriverList.find(d => d.id === selectedDriverId)?.username || 'Preferred Driver'}...` : 'Finding Nearest Driver...'}
                    </span>
                  </div>
                  {selectedDriverId && requestTimeRemaining > 0 && (
                    <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">Driver has {requestTimeRemaining}s to respond</p>
                  )}
                </div>

                {showFallbackButton && (
                  <motion.button
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    onClick={async () => {
                      try {
                        // Patch ride to remove targeted_driver
                        await api.patch(`/rides/${activeRideId}/`, { targeted_driver_id: null });
                        setSelectedDriverId(null);
                        setShowFallbackButton(false);
                        setRequestTimeRemaining(0);
                        alert("Notifying all nearby drivers now!");
                      } catch (err) {
                        console.error("Fallback failed", err);
                      }
                    }}
                    className="w-full py-4 bg-primary text-secondary font-black rounded-full shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                  >
                    <Megaphone size={18} />
                    BROADCAST TO ALL DRIVERS
                  </motion.button>
                )}

                <button
                  type="button"
                  onClick={cancelRide}
                  className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-full hover:bg-red-100 transition-colors"
                >
                  Cancel Request
                </button>
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
          onClick={() => navigate('/passenger/support')}
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
                <CheckCircle2 className={status === 'ongoing' ? 'text-primary' : 'text-accent'} size={20} />
                {status === 'matched' ? 'Driver Dispatched' :
                  status === 'ongoing' ? 'Ride In Progress' : 'Request Pending'}
              </h3>
              {(status === 'matched' || status === 'ongoing') && assignedDriver && (
                <div className="space-y-4">
                  {/* Driver Header */}
                  <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl border-2 border-primary/20">
                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-primary shadow-lg flex-shrink-0">
                      {assignedDriver.profile_picture ? (
                        <img src={assignedDriver.profile_picture} alt="Driver" className="w-full h-full object-cover" />
                      ) : (
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${typeof assignedDriver === 'object' ? assignedDriver.username : assignedDriver}`} alt="Driver" className="w-full h-full" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-secondary text-lg">{typeof assignedDriver === 'object' ? assignedDriver.username : 'Driver'}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center text-xs text-yellow-600">
                          <Star size={12} className="text-yellow-400 fill-yellow-400 mr-1" />
                          <span className="font-bold">{assignedDriver.average_rating || '5.0'}</span>
                        </div>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Verified Driver</span>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Information */}
                  {typeof assignedDriver === 'object' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Plate Number</p>
                        <p className="text-sm font-bold text-secondary">{assignedDriver.vehicle_plate || 'N/A'}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Vehicle</p>
                        <p className="text-sm font-bold text-secondary">{assignedDriver.vehicle_model || 'Tricycle'}</p>
                      </div>
                      {assignedDriver.vehicle_color && (
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Color</p>
                          <p className="text-sm font-bold text-secondary">{assignedDriver.vehicle_color}</p>
                        </div>
                      )}
                      {assignedDriver.body_number && (
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-1">LGU Unit</p>
                          <p className="text-sm font-bold text-primary">{assignedDriver.body_number}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Driver Contact */}
                  {typeof assignedDriver === 'object' && assignedDriver.phone_number && (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-2">Driver Contact</p>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-blue-600" />
                        <a href={`tel:${assignedDriver.phone_number}`} className="text-sm font-bold text-blue-600 hover:underline">
                          {assignedDriver.phone_number}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Trip Status */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-green-600">Trip Status</p>
                    </div>
                    <p className="text-sm font-bold text-green-700">Driver is on the way to your location</p>
                    <p className="text-xs text-green-600 mt-1">Track your driver on the map in real-time</p>
                  </div>

                  <button
                    onClick={completeAndPay}
                    className="w-full py-4 bg-green-500 text-white font-black rounded-2xl text-sm hover:bg-green-600 transition-all shadow-lg uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Arrived at Destination
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Map View */}
      <div className="flex-1 min-h-[500px] relative rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white">
        <Map markers={markers} routeCoordinates={routeCoordinates} />

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

          {/* Share Ride Button */}
          {(status === 'matched' || status === 'ongoing') && activeRideId && (
            <button
              onClick={async () => {
                // In a real app, we would fetch the token from the ACTIVE ride object.
                // For now, we need to fetch the ride details to get the token or assume we have it.
                // Let's quickly fetch it or use a placeholder if not in state.
                // Better approach: We should have 'activeRide' state object that includes 'share_token'.
                // BUT to save time, let's fetch it on click.
                try {
                  const res = await api.get(`/rides/${activeRideId}/`);
                  const token = res.data.share_token;
                  const url = `${window.location.origin}/track/${token}`;
                  await navigator.clipboard.writeText(url);
                  alert("Tracking link copied to clipboard! Share it with family.");
                } catch (e) {
                  alert("Could not generate link.");
                }
              }}
              className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg flex items-center gap-3 hover:scale-105 transition-all border border-white/10"
            >
              <Share2 size={20} />
              <span className="text-sm font-bold">Share Ride</span>
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
                Authorities in Trento and your emergency contacts have been notified via SMS with your exact live location. Stay calm and remain where you are.
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
        targetName={assignedDriver?.username || 'Assigned Driver'}
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

      {(status === 'matched' || status === 'ongoing') && (
        <ChatWindow
          messages={messages}
          onSendMessage={sendMessage}
          currentUser={user?.username}
          partnerName={assignedDriver?.username || 'Driver'}
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
