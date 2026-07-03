import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Target,
  Phone,
  CreditCard,
  Wallet,
  Shield,
  Signal,
  Wifi,
  Battery,
  Camera,
  MessageSquare
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import useRideTracking from '../../hooks/useRideTracking';
import useSystemEvents from '../../hooks/useSystemEvents';
import ChatWindow from '../../components/ChatWindow';
import DriverSettingsModal from '../../components/DriverSettingsModal';
import HeatMapModal from '../../components/HeatMapModal';
import RatingModal from '../../components/RatingModal';
import useGeoLocation from '../../hooks/useGeoLocation';
import useLocationSync from '../../hooks/useLocationSync';
import LocationPermissionModal from '../../components/LocationPermissionModal';

const TRENTO_CENTER = { lat: 8.2965, lng: 126.0630 };

const DriverHome = () => {
  const { user, getProfile } = React.useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [driverPos, setDriverPos] = useState(null);
  const [isOnline, setIsOnline] = useState(() => {
    // ✅ Restore online status from localStorage so page refresh doesn't reset it
    const saved = localStorage.getItem('driver_is_online');
    return saved === 'true';
  });
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [tripsCount, setTripsCount] = useState(0);
  const [activeRide, setActiveRide] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [currentBroadcast, setCurrentBroadcast] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHeatMapModal, setShowHeatMapModal] = useState(false);
  const [showGCashVerify, setShowGCashVerify] = useState(false);
  const [verificationRef, setVerificationRef] = useState('');
  const [showRating, setShowRating] = useState(false);
  const [completedRideId, setCompletedRideId] = useState(null);
  const [completedPassengerName, setCompletedPassengerName] = useState('');
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [navModalData, setNavModalData] = useState(null); // { lat, lng, label }

  // New State for LGU Commission Display
  const [commissionData, setCommissionData] = useState(null);
  const [showCommissionModal, setShowCommissionModal] = useState(false);

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

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await api.get('/driver/analytics/');
      setTodayEarnings(res.data.today || 0);
      setTripsCount(res.data.trips_count || 0);
    } catch (err) {
      console.error('Failed to fetch driver analytics', err);
    }
  }, []);

  useEffect(() => {
    fetchBroadcasts();
    fetchMaintenanceLogs();
    if (user && user.role === 'driver') {
      fetchAnalytics();
    }
  }, [fetchBroadcasts, fetchMaintenanceLogs, fetchAnalytics, user?.id, user?.role]);

  useEffect(() => {
    // Only override localStorage value once on first mount if the server says a different state.
    // After that, localStorage is the source of truth (survives refresh).
    if (user && user.is_online !== undefined) {
      const savedLocal = localStorage.getItem('driver_is_online');
      if (savedLocal === null) {
        // First time ever — initialize from server
        setIsOnline(user.is_online);
      }
      // If savedLocal exists, trust it — the driver set it intentionally
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only run when user identity changes, not on every user update

  useEffect(() => {
    const fetchActiveState = async () => {
      try {
        const res = await api.get('/rides/active_ride/');
        if (res.data) {
          setActiveRide(res.data);
          setRequests([]);
          setSelectedRequest(null);
        }
      } catch (err) {
        console.error('Failed to fetch active ride', err);
      }
    };
    if (user) fetchActiveState();
  }, [user]);

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
  const { sendLocation, sendMessage, messages, connected, location: passengerLivePos } = useRideTracking(activeRide?.id, true);

  // Handle passenger cancellation
  useEffect(() => {
    if (passengerLivePos && passengerLivePos.type === 'status_update' && (passengerLivePos.status === 'cancelled' || passengerLivePos.status === 'driver_rejected')) {
      if (activeRide) {
        alert("Ride update: This request is no longer available.");
        setActiveRide(null);
      }
    }
  }, [passengerLivePos, activeRide]);

  // ✅ Persist online status to localStorage on every change (survives page refresh)
  useEffect(() => {
    localStorage.setItem('driver_is_online', String(isOnline));
  }, [isOnline]);

  // ✅ Sync online status to server ONLY when the driver actively toggles it
  // (NOT on mount/unmount — avoids the refresh-sets-offline bug)
  const syncStatusToServer = useCallback(async (status) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await api.post('/users/toggle_online/', { is_online: status });
    } catch (err) {
      console.error('Failed to sync online status', err);
    }
  }, []);

  // ── Real-time GPS tracking ───────────────────────────────────────────────
  const { location: gpsLocation, status: gpsStatus, error: gpsError, retry: retryGps } = useGeoLocation();

  // Derived map centre
  const driverCenter = gpsLocation
    ? { lat: gpsLocation.lat, lng: gpsLocation.lng }
    : TRENTO_CENTER;

  // Sync location to backend every 4s while online
  useLocationSync(gpsLocation, { enabled: isOnline });

  const [driverRouteCoords, setDriverRouteCoords] = useState(null);
  const lastFetchedCoords = useRef({ lat: 0, lng: 0 });
  const lastSentCoordsRef = useRef({ lat: 0, lng: 0 });
  const lastSentTimeRef = useRef(0);

  // Calculate real haversine distance from driver GPS to pickup location
  const getDistanceToPickup = useCallback((request) => {
    if (!gpsLocation) return request.distance || '2.4 km';
    const pLat = parseFloat(request.pickup_lat);
    const pLng = parseFloat(request.pickup_lng);
    if (isNaN(pLat) || isNaN(pLng)) return request.distance || '2.4 km';

    const R = 6371; // Earth's radius in km
    const dLat = (pLat - gpsLocation.lat) * Math.PI / 180;
    const dLng = (pLng - gpsLocation.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(gpsLocation.lat * Math.PI / 180) * Math.cos(pLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;
    return `${dist.toFixed(1)} km`;
  }, [gpsLocation]);

  // Fetch real-time OSRM navigation route (driver -> pickup, driver -> destination, or preview request)
  useEffect(() => {
    if (!gpsLocation) {
      setDriverRouteCoords(null);
      lastFetchedCoords.current = { lat: 0, lng: 0 };
      return;
    }

    const startLat = gpsLocation.lat;
    const startLng = gpsLocation.lng;

    let targetLat, targetLng;
    if (activeRide) {
      const isOngoing = activeRide.status === 'on_route';
      targetLat = isOngoing ? parseFloat(activeRide.dest_lat) : parseFloat(activeRide.pickup_lat);
      targetLng = isOngoing ? parseFloat(activeRide.dest_lng) : parseFloat(activeRide.pickup_lng);
    } else if (selectedRequest) {
      targetLat = parseFloat(selectedRequest.pickup_lat);
      targetLng = parseFloat(selectedRequest.pickup_lng);
    } else {
      setDriverRouteCoords(null);
      lastFetchedCoords.current = { lat: 0, lng: 0 };
      return;
    }

    if (isNaN(targetLat) || isNaN(targetLng)) {
      setDriverRouteCoords(null);
      return;
    }

    // Rate limit OSRM requests: skip if driver hasn't moved at least 15 meters
    const latDiff = Math.abs(startLat - lastFetchedCoords.current.lat);
    const lngDiff = Math.abs(startLng - lastFetchedCoords.current.lng);
    const distanceDiff = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

    if (distanceDiff < 0.00015 && driverRouteCoords) {
      return;
    }

    let active = true;
    const fetchRoute = async () => {
      try {
        const osrmUrl = process.env.REACT_APP_OSRM_URL || 'https://router.project-osrm.org/route/v1/driving';
        const res = await fetch(`${osrmUrl}/${startLng},${startLat};${targetLng},${targetLat}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (active && data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const pathCoords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
          setDriverRouteCoords(pathCoords);
          lastFetchedCoords.current = { lat: startLat, lng: startLng };
        }
      } catch (err) {
        console.error('Failed to fetch driver navigation route:', err);
      }
    };

    fetchRoute();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRide?.id, activeRide?.status, selectedRequest?.id, gpsLocation?.lat, gpsLocation?.lng]);

  // Update Driver map pinning dynamically based on GPS changes
  useEffect(() => {
    if (!isOnline) {
      setMarkers([]);
      setDriverPos(null);
      return;
    }

    if (gpsLocation) {
      const livePos = {
        lat: gpsLocation.lat,
        lng: gpsLocation.lng,
        heading: gpsLocation.heading ?? null,   // ✅ Real GPS compass bearing
        accuracy: gpsLocation.accuracy ?? null, // ✅ GPS fix radius in metres
        title: user?.username || 'You',
        info: `GPS live · ±${Math.round(gpsLocation.accuracy ?? 0)} m`,
        isDriver: true,
        profile_picture: user?.profile_picture,
      };
      setDriverPos(livePos);

      // Only send live location to passenger over WebSocket if ride active
      if (activeRide) {
        // Rate limit: check distance moved and time elapsed since last send
        const now = Date.now();
        const timeElapsed = now - lastSentTimeRef.current;
        
        let shouldSend = false;
        if (timeElapsed >= 2000) { // minimum 2 seconds interval
          const lastLat = lastSentCoordsRef.current.lat;
          const lastLng = lastSentCoordsRef.current.lng;
          
          if (!lastLat || !lastLng) {
            shouldSend = true;
          } else {
            // Quick Haversine in metres
            const R = 6371e3;
            const phi1 = lastLat * Math.PI / 180;
            const phi2 = gpsLocation.lat * Math.PI / 180;
            const deltaPhi = (gpsLocation.lat - lastLat) * Math.PI / 180;
            const deltaLambda = (gpsLocation.lng - lastLng) * Math.PI / 180;
            const a = Math.sin(deltaPhi / 2) ** 2 +
                      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;
            
            if (distance >= 2.0) { // moved at least 2 metres
              shouldSend = true;
            }
          }
        }
        
        if (shouldSend) {
          sendLocation(
            gpsLocation.lat,
            gpsLocation.lng,
            gpsLocation.heading ?? 0,
            gpsLocation.accuracy ?? null
          );
          lastSentCoordsRef.current = { lat: gpsLocation.lat, lng: gpsLocation.lng };
          lastSentTimeRef.current = now;
        }
      }
    }
  }, [gpsLocation, isOnline, activeRide, sendLocation]);

  const fetchRequests = useCallback(async () => {
    if (!isOnline || activeRide) return;
    try {
      const res = await api.get('/driver/requests/');
      const newRequests = Array.isArray(res.data) ? res.data : [];
      setRequests(newRequests);
    } catch (err) {
      console.error('Failed to fetch requests', err);
    }
  }, [isOnline, activeRide]);

  useEffect(() => {
    if (!isOnline) {
      setRequests([]);
      setMarkers([]);
      setSelectedRequest(null);
      return;
    }

    // Rely on WebSockets for real-time dispatch, but keep a slow fallback poll
    let interval;
    if (isOnline && !activeRide) {
      fetchRequests(); // Initial fetch
      interval = setInterval(fetchRequests, 15000);
    }
    return () => clearInterval(interval);
  }, [isOnline, activeRide, fetchRequests]);

  // Auto-select request logic (moved out of fetch to avoid closure issues)
  useEffect(() => {
    if (requests.length > 0 && !selectedRequest) {
      setSelectedRequest(requests[0]);
    } else if (requests.length === 0 && selectedRequest) {
      setSelectedRequest(null);
    }
  }, [requests, selectedRequest]);

  // Handle Real-time Ride Requests
  useEffect(() => {
    if (newRide && isOnline && !activeRide) {
      // Add to requests if not already there
      setRequests(prev => {
        if (prev.find(r => r.id === newRide.id)) return prev;
        return [newRide, ...prev];
      });

      // Automatically select the newest request for preview
      setSelectedRequest(newRide);

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
      const res = await api.post(`/driver/accept/${ride.id}/`);

      // Use serialized data from server to ensure passenger object is complete
      setActiveRide(res.data);
      setRequests([]);
      setSelectedRequest(null);
    } catch (err) {
      console.error('Failed to accept ride', err);
      alert('Error: Could not accept the ride. Another driver may have taken it or connection lost.');
    }
  };

  const startRide = async () => {
    if (!activeRide) return;
    try {
      await api.patch(`/rides/${activeRide.id}/`, { status: 'on_route' });
      setActiveRide(prev => ({ ...prev, status: 'on_route' }));
    } catch (err) {
      console.error('Failed to start ride', err);
      alert('Error: Could not start the ride. Please check connection.');
    }
  };

  const declineRequest = async (rideId) => {
    // Immediate local update
    setRequests(prev => prev.filter(r => r.id !== rideId));
    if (selectedRequest?.id === rideId) {
      setSelectedRequest(null);
    }

    try {
      // Inform the server that the driver declined (critical for targeted requests)
      await api.post(`/driver/reject/${rideId}/`);
    } catch (err) {
      console.error('Failed to decline ride on server', err);
    }
  };

  const completeRide = async () => {
    if (!activeRide) return;

    try {
      const currentRideId = activeRide.id;
      const passengerName = typeof activeRide.passenger === 'object' ? activeRide.passenger.username : activeRide.passenger;

      // Inform the server that the ride is completed
      const response = await api.post(`/rides/${currentRideId}/complete/`);
      const data = response.data;

      // Use server response for earnings if available, else fallback to local calc
      const gainedEarnings = data.driver_earnings ? parseFloat(data.driver_earnings) : parseFloat(activeRide.fare);

      setTodayEarnings(prev => prev + gainedEarnings);
      setTripsCount(prev => prev + 1);
      if (getProfile) getProfile();
      fetchAnalytics();
      setCompletedRideId(currentRideId);
      setCompletedPassengerName(passengerName);

      // Set commission data for the modal
      if (data.lgu_commission) {
        setCommissionData({
          totalFare: data.total_fare,
          lguCommission: data.lgu_commission,
          driverEarnings: data.driver_earnings,
          commissionRate: data.commission_rate
        });
        setActiveRide(null);
        // Show commission modal first
        setTimeout(() => setShowCommissionModal(true), 500);
      } else {
        // Fallback for old API behavior
        setActiveRide(null);
        setTimeout(() => setShowRating(true), 500);
      }

    } catch (err) {
      console.error('Failed to complete ride', err);
      alert('Error: Could not complete the ride on the server. Retrying might be needed.');
    }
  };

  const openNativeNavigation = (lat, lng, label = 'Destination') => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      alert("Error: Location coordinates are not available or are invalid.");
      return;
    }
    setNavModalData({ lat: parsedLat, lng: parsedLng, label });
  };

  const triggerSOS = async () => {
    setShowSOS(true);

    let currentLat = 8.050; // Fallback
    let currentLng = 126.062;

    if (gpsLocation) {
      currentLat = gpsLocation.lat;
      currentLng = gpsLocation.lng;
    }

    try {
      await api.post('/incidents/', {
        lat: currentLat,
        lng: currentLng,
        description: 'Driver SOS Triggered from Mobile App'
      });
    } catch (err) {
      console.error('Failed to send SOS alert', err);
    }
    setTimeout(() => setShowSOS(false), 5000);
  };

  return (
    <div className="min-h-screen pt-24 pb-10 bg-slate-100 px-4 md:px-6 relative">
      {/* Top Navigation Bar */}
      <div className="absolute top-0 left-0 w-full p-4 sm:p-6 z-[100] pointer-events-none">
        <div className="max-w-[1400px] mx-auto flex justify-between items-start">
          <Link to="/profile" className="bg-white/95 backdrop-blur-md px-6 py-3 rounded-[2rem] shadow-xl flex items-center space-x-4 border border-slate-100 hover:scale-105 transition-transform cursor-pointer pointer-events-auto">
            <div className="w-10 h-10 bg-primary/20 text-primary-dark rounded-xl flex items-center justify-center font-black">
              {user?.username?.[0] || 'D'}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Area</p>
              <p className="text-sm font-bold text-secondary">Trento, Agusan del Sur</p>
            </div>
          </Link>
        </div>
      </div>

      <LocationPermissionModal
        isOpen={gpsStatus === 'error'}
        error={gpsError}
        onRetry={retryGps}
      />
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
          <div className={`w-full lg:col-span-4 border-2 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-4 mb-4 shadow-sm ${user?.verification_status === 'suspended' ? 'bg-red-50 border-red-200' :
            user?.verification_status === 'rejected' ? 'bg-orange-50 border-orange-200' :
              'bg-amber-50 border-amber-200'
            }`}>
            <div className={`flex items-center gap-4 ${user?.verification_status === 'suspended' ? 'text-red-800' :
              user?.verification_status === 'rejected' ? 'text-orange-800' :
                'text-amber-800'
              }`}>
              <ShieldCheck className={
                user?.verification_status === 'suspended' ? 'text-red-500' :
                  user?.verification_status === 'rejected' ? 'text-orange-500' :
                    'text-amber-500'} size={32} />
              <div>
                <p className="font-black uppercase text-xs tracking-wider">
                  {user?.verification_status === 'suspended' ? 'Account Suspended' :
                    user?.verification_status === 'rejected' ? 'Application Rejected' :
                      'Verification Required'}
                </p>
                <p className="text-sm font-medium">
                  {user?.verification_status === 'suspended' ? 'Your account has been suspended by the LGU. Please visit the LGU office.' :
                    user?.verification_status === 'rejected' ? 'Your documents were rejected. Please check and re-upload valid credentials.' :
                      'Your account is not yet verified. You cannot accept rides until documents are approved.'}
                </p>
              </div>
            </div>
            {user?.verification_status !== 'suspended' && (
              <Link
                to="/driver/verify"
                className={`text-white font-black px-8 py-3 rounded-2xl transition-all shadow-lg whitespace-nowrap ${user?.verification_status === 'rejected' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' :
                  'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                  }`}
              >
                {user?.verification_status === 'rejected' ? 'Update Profile' : 'Verify Profile'}
              </Link>
            )}
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
                <span className="text-3xl font-black italic">₱{todayEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-sm font-bold opacity-40">/ ₱{dailyGoal.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span>Progress</span>
                <span>{Math.round((todayEarnings / dailyGoal) * 100)}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((todayEarnings / dailyGoal) * 100, 100)}%` }}
                  className="h-full bg-primary shadow-[0_0_15px_rgba(255,215,0,0.5)]"
                />
              </div>
            </div>

            <p className="mt-6 text-[10px] font-bold text-slate-400 italic">
              {todayEarnings >= dailyGoal ? "🎉 Goal reached! Keep crushing it." : `Only ₱${(dailyGoal - todayEarnings).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} away from your goal.`}
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
                <div className="relative">
                  <div className={`w-3 h-3 rounded-full ${isOnline ? 'status-online' : 'status-offline'}`}></div>
                  {isOnline && <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-20"></div>}
                </div>
                <span className="font-bold text-secondary uppercase tracking-tight text-sm">
                  {isOnline ? 'Online & Available' : 'Offline'}
                </span>
              </div>
              <button
                onClick={() => {
                  if (!user?.is_verified_driver) {
                    alert("Please verify your account first!");
                    return;
                  }
                  const nextStatus = !isOnline;
                  if (nextStatus) {
                    setShowSelfieModal(true);
                  } else {
                    setIsOnline(false);
                    syncStatusToServer(false);
                  }
                }}
                className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${isOnline ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-sm ${isOnline ? 'left-7' : 'left-1'}`}></div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Link to="/driver/earnings" className="bg-slate-50 p-4 rounded-2xl border border-slate-100 block hover:border-primary transition-colors group">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Earnings</p>
                  <TrendingUp size={12} className="text-slate-300 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-xl font-black text-secondary">
                  ₱{user?.wallet_balance !== undefined ? parseFloat(user.wallet_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </p>
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

                    <div className="space-y-4 mb-4 bg-slate-800/50 p-4 rounded-2xl border border-white/5">
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

                    <div className="flex items-center gap-2 mb-6 px-1">
                      <div className="bg-white/10 px-3 py-2 rounded-xl border border-white/5 flex items-center gap-2">
                        <CreditCard size={12} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{activeRide.payment_method || 'Cash'}</span>
                      </div>
                      <div className="bg-white/10 px-3 py-2 rounded-xl border border-white/5 flex items-center gap-2">
                        <Wallet size={12} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">₱{activeRide.fare}</span>
                      </div>

                      {activeRide.payment_method === 'gcash' && (
                        <button
                          onClick={() => {
                            setVerificationRef(`${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`);
                            setShowGCashVerify(true);
                          }}
                          className="ml-auto bg-[#007DFE] text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                        >
                          <Shield size={12} />
                          <span>Verify GCash</span>
                        </button>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-1 flex flex-col gap-2">
                        <button
                          onClick={() => {
                            const target = activeRide.status === 'on_route'
                              ? { lat: activeRide.dest_lat, lng: activeRide.dest_lng }
                              : (passengerLivePos || { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng });
                            openNativeNavigation(target.lat, target.lng, activeRide.status === 'on_route' ? 'Destination' : 'Passenger Pickup');
                          }}
                          className="w-full bg-white/10 text-white font-black py-4 rounded-2xl hover:bg-white/20 transition-all flex items-center justify-center space-x-2 border border-white/10"
                        >
                          <Navigation2 size={20} className="text-primary" />
                          <span>Navigate</span>
                        </button>
                        <p className="text-[8px] text-center text-white/40 uppercase font-black tracking-tighter">Opens Google Maps</p>
                      </div>

                      {activeRide.status === 'accepted' || activeRide.status === 'matched' ? (
                        <button
                          onClick={startRide}
                          className="flex-[2] bg-accent text-secondary font-black py-4 rounded-2xl hover:bg-white transition-all flex items-center justify-center space-x-2 shadow-lg shadow-accent/20"
                        >
                          <Tractor size={20} />
                          <span>Start Ride</span>
                        </button>
                      ) : (
                        <button
                          onClick={completeRide}
                          className="flex-[2] bg-primary text-secondary font-black py-4 rounded-2xl hover:bg-white transition-all flex items-center justify-center space-x-2 shadow-lg shadow-primary/20"
                        >
                          <Check size={20} />
                          <span>Complete</span>
                        </button>
                      )}
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
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-secondary px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-bounce shadow-lg">
                    New Ride Request
                  </div>
                  <button
                    onClick={fetchRequests}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-primary transition-colors"
                    title="Refresh Request"
                  >
                    <Clock size={16} />
                  </button>

                  <div className="space-y-4 pt-2">
                    {/* Passenger Info Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-lg">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${typeof selectedRequest.passenger === 'object' ? selectedRequest.passenger.username : selectedRequest.passenger}`} alt="P" className="w-full h-full" />
                        </div>
                        <div>
                          <p className="font-black text-secondary text-xl leading-tight">{typeof selectedRequest.passenger === 'object' ? selectedRequest.passenger.username : selectedRequest.passenger}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1 text-yellow-500">
                              <Star size={12} className="fill-yellow-500" />
                              <span className="text-[10px] font-bold">4.9</span>
                            </div>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Verified</span>
                            {typeof selectedRequest.passenger === 'object' && (
                              <>
                                {selectedRequest.passenger.gender && (
                                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">{selectedRequest.passenger.gender}</span>
                                )}
                                {selectedRequest.passenger.date_of_birth && (
                                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                                    {Math.floor((new Date() - new Date(selectedRequest.passenger.date_of_birth)) / 31557600000)} Y/O
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-primary text-3xl">₱{selectedRequest.fare}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{getDistanceToPickup(selectedRequest)} away</p>
                      </div>
                    </div>

                    {/* Passenger Contact Details */}
                    {typeof selectedRequest.passenger === 'object' && selectedRequest.passenger.phone_number && (
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-2">Secure Contact</p>
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-blue-600" />
                          <button
                            onClick={() => alert("Initiating secure proxy call. Passenger number is hidden for privacy.")}
                            className="text-sm font-bold text-blue-600 hover:underline focus:outline-none"
                          >
                            Call Passenger (Masked)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 mb-6">
                    {/* Trip Details Card */}
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-5 rounded-3xl border border-slate-200">
                      <div className="flex items-start space-x-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-xl">
                          <MapPin size={18} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1">Pickup Location</p>
                          <p className="text-sm font-bold text-secondary leading-tight">{selectedRequest.pickup_address || selectedRequest.pickup}</p>
                          {selectedRequest.pickup_lat && selectedRequest.pickup_lng && (
                            <p className="text-[10px] text-slate-400 font-mono mt-1">
                              📍 {parseFloat(selectedRequest.pickup_lat).toFixed(4)}, {parseFloat(selectedRequest.pickup_lng).toFixed(4)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="border-l-2 border-dashed border-slate-300 ml-4 h-4 my-2"></div>
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-accent/10 rounded-xl">
                          <Navigation2 size={18} className="text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1">Destination</p>
                          <p className="text-sm font-bold text-secondary leading-tight">{selectedRequest.dest_address || selectedRequest.dest}</p>
                          {selectedRequest.dest_lat && selectedRequest.dest_lng && (
                            <p className="text-[10px] text-slate-400 font-mono mt-1">
                              📍 {parseFloat(selectedRequest.dest_lat).toFixed(4)}, {parseFloat(selectedRequest.dest_lng).toFixed(4)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Trip Metadata */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Requested</p>
                        <p className="text-xs font-bold text-secondary">{new Date(selectedRequest.requested_at).toLocaleTimeString()}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Payment</p>
                        <p className="text-xs font-bold text-secondary uppercase italic">{selectedRequest.payment_method || 'Cash'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-6 border-t border-slate-100">
                    <button
                      onClick={() => {
                        const target = { lat: selectedRequest.pickup_lat, lng: selectedRequest.pickup_lng };
                        openNativeNavigation(target.lat, target.lng, 'Pickup Location');
                      }}
                      className="p-4 bg-slate-50 text-secondary rounded-2xl hover:bg-slate-100 transition-all border border-slate-200"
                      title="Navigate to Pickup"
                    >
                      <Navigation2 size={20} className="text-primary-dark" />
                    </button>
                    <button
                      onClick={() => declineRequest(selectedRequest.id)}
                      className="flex-1 bg-red-50 text-red-600 font-black py-4 rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-2 border border-red-200"
                    >
                      <X size={20} />
                      <span>Decline</span>
                    </button>
                    <button
                      onClick={() => acceptRide(selectedRequest)}
                      className="flex-[2] bg-primary text-secondary font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
                    >
                      <Check size={20} />
                      <span>Accept Ride</span>
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

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={triggerSOS}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-3xl shadow-xl flex items-center justify-center gap-3 transition-colors mt-6"
          >
            <AlertTriangle size={24} />
            SOS EMERGENCY
          </motion.button>
        </div>

        {/* Right Column: Map and Navigation */}
        <div className="flex-1 min-h-[600px] relative rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white">
          <Map markers={markers} center={driverCenter} routeCoordinates={driverRouteCoords} />

          {/* GPS status badge */}
          <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 1000, pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(15,23,42,0.82)',
              backdropFilter: 'blur(10px)',
              borderRadius: 999,
              padding: '6px 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: gpsStatus === 'live' ? '#22c55e' : gpsStatus === 'error' ? '#ef4444' : '#94a3b8',
                boxShadow: `0 0 6px ${gpsStatus === 'live' ? '#22c55e' : gpsStatus === 'error' ? '#ef4444' : '#94a3b8'}`,
                display: 'inline-block',
                flexShrink: 0,
              }} />
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 700, letterSpacing: '0.01em' }}>
                {gpsStatus === 'live'
                  ? 'Tracking live location'
                  : gpsStatus === 'error'
                    ? 'GPS Error: Please enable location'
                    : 'Acquiring GPS…'}
              </span>
            </div>
          </div>

          {/* Map Overlays (Removed Profile Link from here) */}

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-[1000] w-[90%] md:w-auto justify-center">
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
                    const isOngoing = activeRide.status === 'on_route';
                    const targetLat = isOngoing ? activeRide.dest_lat : (passengerLivePos?.lat || activeRide.pickup_lat);
                    const targetLng = isOngoing ? activeRide.dest_lng : (passengerLivePos?.lng || activeRide.pickup_lng);
                    const label = isOngoing ? 'Dropoff Location' : 'Pickup Location';
                    openNativeNavigation(targetLat, targetLng, label);
                  }}
                  className="bg-secondary text-white px-6 py-3 rounded-2xl font-black text-sm shadow-2xl flex items-center gap-2 hover:scale-105 transition-all border-2 border-white/10"
                >
                  <MapPin size={18} className="text-primary" />
                  <span>{activeRide.status === 'on_route' ? 'Navigate to Dropoff' : 'Navigate to Passenger'}</span>
                </button>
              </>
            )}
          </div>

          <div className="absolute top-8 right-8 flex flex-col gap-3 z-[1000]">
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
            {/* Chat button — visible when a ride is active */}
            {activeRide && (
              <button
                onClick={() => setShowChat(prev => !prev)}
                className={`w-12 h-12 rounded-2xl shadow-lg flex items-center justify-center transition-colors border relative ${
                  showChat
                    ? 'bg-secondary text-primary border-secondary/20'
                    : 'bg-white text-slate-600 hover:text-primary border-slate-100'
                }`}
                title="Chat with Passenger"
              >
                <MessageSquare size={20} />
              </button>
            )}
          </div>
        </div>

        {/* SOS Overlay */}
        <AnimatePresence>
          {showSOS && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute inset-0 z-[200] bg-red-600/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 text-white rounded-[3rem]"
            >
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center animate-ping mb-8">
                <AlertTriangle size={64} />
              </div>
              <h2 className="text-4xl font-extrabold mb-4 uppercase tracking-tighter">Emergency Signal Sent!</h2>
              <p className="text-xl max-w-md opacity-90">
                Authorities in Trento and your emergency contacts have been notified via SMS with your exact live location. Stay calm and remain safe.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
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

      {
        activeRide && (
          <ChatWindow
            messages={messages}
            onSendMessage={sendMessage}
            currentUser={user?.username}
            partnerName={typeof activeRide.passenger === 'object' ? activeRide.passenger.username : activeRide.passenger}
            isConnected={connected}
            isOpen={showChat}
            onToggle={() => setShowChat(prev => !prev)}
          />
        )
      }

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

      {/* LGU Commission Modal (New Feature) */}
      <AnimatePresence>
        {showCommissionModal && commissionData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-secondary/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="w-full max-w-md bg-white rounded-[2.5rem] p-8 relative z-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-3 bg-secondary" />
              <div className="text-center mb-6 pt-4">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <Check size={40} strokeWidth={3} />
                </div>
                <h2 className="text-2xl font-black text-secondary">Ride Completed!</h2>
                <p className="text-slate-400 font-medium">Here's your earnings breakdown</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="font-bold text-slate-500">Total Fare</span>
                  <span className="font-black text-xl text-secondary">₱{commissionData.totalFare}</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-red-50 rounded-2xl border border-red-100 relative overflow-hidden">
                  <div className="absolute left-0 top-0 h-full w-1 bg-red-400" />
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-red-500 text-sm">LGU Commission ({commissionData.commissionRate}%)</span>
                    <span className="text-[10px] text-red-400 font-medium tracking-tight">Maintenance & Emergency Fund</span>
                  </div>
                  <span className="font-black text-xl text-red-500">-₱{commissionData.lguCommission}</span>
                </div>

                <div className="flex justify-between items-center p-6 bg-green-600 rounded-2xl shadow-xl shadow-green-200 text-white transform scale-105">
                  <span className="font-bold opacity-90">NET EARNINGS</span>
                  <span className="font-black text-3xl">₱{commissionData.driverEarnings}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowCommissionModal(false);
                  setTimeout(() => setShowRating(true), 300); // Show rating after closing
                }}
                className="w-full py-4 bg-secondary text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-lg"
              >
                Continue
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
      <GCashVerifyModal
        isOpen={showGCashVerify}
        onClose={() => setShowGCashVerify(false)}
        amount={activeRide?.fare}
        refNo={verificationRef}
      />
      <SelfieVerificationModal
        isOpen={showSelfieModal}
        onClose={() => setShowSelfieModal(false)}
        onVerify={() => {
          setShowSelfieModal(false);
          setIsOnline(true);
          syncStatusToServer(true);
          setTimeout(fetchRequests, 500);
        }}
      />
      {/* Professional Navigation App Choice Modal */}
      <AnimatePresence>
        {navModalData && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNavModalData(null)}
              className="absolute inset-0 bg-secondary/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 100, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl relative z-10 border border-slate-100 dark:border-white/10 text-center"
            >
              <div className="mb-6 flex flex-col items-center">
                <div className="w-12 h-12 bg-primary/20 text-primary-dark dark:text-primary rounded-full flex items-center justify-center mb-3">
                  <Navigation2 size={24} className="rotate-45" />
                </div>
                <h3 className="text-lg font-black text-secondary dark:text-white">Choose Navigation App</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Navigate to {navModalData.label}</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${navModalData.lat},${navModalData.lng}&travelmode=driving`;
                    window.open(url, '_blank');
                    setNavModalData(null);
                  }}
                  className="w-full py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl font-black text-secondary dark:text-white transition-all flex items-center justify-center gap-3 border border-slate-100 dark:border-white/5"
                >
                  <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Google_Maps_icon_2020.svg" alt="Google Maps" className="w-5 h-5" />
                  <span>Google Maps</span>
                </button>

                <button
                  onClick={() => {
                    const url = `https://waze.com/ul?ll=${navModalData.lat},${navModalData.lng}&navigate=yes`;
                    window.open(url, '_blank');
                    setNavModalData(null);
                  }}
                  className="w-full py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl font-black text-secondary dark:text-white transition-all flex items-center justify-center gap-3 border border-slate-100 dark:border-white/5"
                >
                  <img src="https://upload.wikimedia.org/wikipedia/commons/e/e6/Waze_logo.svg" alt="Waze" className="w-5 h-5" />
                  <span>Waze</span>
                </button>

                {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
                  <button
                    onClick={() => {
                      const url = `maps://maps.apple.com/?daddr=${navModalData.lat},${navModalData.lng}&dirflg=d`;
                      window.open(url, '_blank');
                      setNavModalData(null);
                    }}
                    className="w-full py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl font-black text-secondary dark:text-white transition-all flex items-center justify-center gap-3 border border-slate-100 dark:border-white/5"
                  >
                    <img src="https://upload.wikimedia.org/wikipedia/commons/d/df/Apple_Maps_logo.svg" alt="Apple Maps" className="w-5 h-5" />
                    <span>Apple Maps</span>
                  </button>
                )}

                <button
                  onClick={() => setNavModalData(null)}
                  className="w-full py-4 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-2xl font-black transition-all uppercase tracking-widest text-xs"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div >
  );
};

const GCashVerifyModal = ({ isOpen, onClose, amount, refNo }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-secondary/95 backdrop-blur-2xl"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 50 }}
          className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden relative z-10 shadow-[0_32px_80px_rgba(0,0,0,0.5)] border border-white/20"
        >
          {/* Simulated Mobile Header for Driver Side */}
          <div className="bg-[#007DFE] px-6 pt-3 flex items-center justify-end text-white/50 gap-1.5 grayscale opacity-50">
            <Signal size={8} />
            <Wifi size={8} />
            <Battery size={10} />
          </div>

          <div className="bg-gradient-to-b from-[#007DFE] to-[#005ECB] p-10 text-center relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/5 rounded-full blur-2xl" />

            <div className="absolute top-4 right-4 text-white/30 hover:text-white cursor-pointer z-50" onClick={onClose}>
              <X size={24} />
            </div>

            <div className="relative z-10">
              <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center shadow-2xl mb-4">
                <svg viewBox="0 0 100 100" className="w-10 h-10">
                  <circle cx="50" cy="50" r="48" fill="#007DFE" />
                  <text x="50" y="65" textAnchor="middle" fill="white" fontSize="45" fontWeight="900" fontStyle="italic">G</text>
                </svg>
              </div>
              <h3 className="text-white font-black uppercase tracking-[0.2em] text-sm">GCash Verification</h3>
              <div className="mt-2 inline-flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full">
                <Shield size={10} className="text-blue-200" />
                <span className="text-[8px] text-blue-100 font-black uppercase tracking-widest">Merchant Portal</span>
              </div>
            </div>
          </div>

          <div className="p-10 space-y-8">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Incoming Payment Amount</p>
              <h4 className="text-5xl font-black text-secondary leading-none tracking-tighter">₱{amount}.00</h4>
            </div>

            <div className="bg-slate-50/80 rounded-[2rem] p-8 border border-slate-100 space-y-5 text-center relative">
              <div className="absolute top-3 left-3 w-1.5 h-1.5 bg-blue-500/20 rounded-full" />
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Audit Reference No.</p>
                <code className="text-xl font-black text-[#007DFE] tracking-[0.1em]">{refNo}</code>
              </div>
              <div className="pt-4 border-t border-slate-200/50 flex items-center justify-center gap-2">
                <div className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                  <Check size={12} strokeWidth={4} />
                </div>
                <span className="text-[10px] font-black uppercase text-green-600 tracking-wider">Verified by GCash Network</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-secondary text-white font-black py-5 rounded-[1.5rem] shadow-xl hover:bg-slate-800 transition-all active:scale-95 text-sm uppercase tracking-widest"
            >
              Confirm Reference
            </button>
          </div>
          <div className="h-4 bg-slate-50 flex items-center justify-center pb-2">
            <div className="w-16 h-1 bg-slate-200 rounded-full" />
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const SelfieVerificationModal = ({ isOpen, onClose, onVerify }) => {
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const streamRef = React.useRef(null);

  const [phase, setPhase] = useState('preview'); // 'preview' | 'captured' | 'confirming' | 'error'
  const [capturedImage, setCapturedImage] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraReady, setCameraReady] = useState(false);

  // Start camera when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setPhase('preview');
    setCapturedImage(null);
    setErrorMsg('');
    setCameraReady(false);

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setCameraReady(true);
          };
        }
      } catch (err) {
        console.error('Camera access denied:', err);
        if (err.name === 'NotAllowedError') {
          setErrorMsg('Camera access was denied. Please allow camera access in your browser settings and try again.');
        } else if (err.name === 'NotFoundError') {
          setErrorMsg('No camera found on this device.');
        } else {
          setErrorMsg(`Camera error: ${err.message}`);
        }
        setPhase('error');
      }
    };

    startCamera();

    // Cleanup: stop camera tracks when modal closes
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    // Mirror the image so it looks natural (front camera)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    setPhase('captured');

    // Stop camera preview after capture to save resources
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleRetake = async () => {
    setCapturedImage(null);
    setPhase('preview');
    setCameraReady(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraReady(true);
        };
      }
    } catch (err) {
      setErrorMsg('Failed to restart camera.');
      setPhase('error');
    }
  };

  const handleConfirm = () => {
    setPhase('confirming');
    // Small delay for UX feedback before proceeding
    setTimeout(() => {
      onVerify();
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-secondary/95 backdrop-blur-2xl"
          onClick={phase !== 'confirming' ? onClose : undefined}
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 50 }}
          className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden relative z-10 shadow-[0_32px_80px_rgba(0,0,0,0.5)] border border-white/20"
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-4 text-center relative">
            {phase !== 'confirming' && (
              <button className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 cursor-pointer z-50" onClick={onClose}>
                <X size={24} />
              </button>
            )}
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Camera size={28} />
            </div>
            <h3 className="text-xl font-black text-secondary mb-1">Driver Liveness Check</h3>
            <p className="text-xs text-slate-500 font-medium">
              {phase === 'preview' && 'Position your face in the circle and take a selfie.'}
              {phase === 'captured' && 'Looking good! Confirm to proceed online.'}
              {phase === 'confirming' && 'Verifying your identity...'}
              {phase === 'error' && 'Camera unavailable'}
            </p>
          </div>

          {/* Camera / Preview Area */}
          <div className="px-8 pb-6">
            {phase === 'error' ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="w-20 h-20 bg-red-50 text-red-400 rounded-full flex items-center justify-center">
                  <Camera size={36} />
                </div>
                <p className="text-sm text-red-500 font-medium">{errorMsg}</p>
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-sm"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {/* Camera Viewport */}
                <div className="relative w-full aspect-square rounded-[2rem] overflow-hidden bg-slate-900 mb-6 shadow-inner border-4 border-slate-100">
                  {/* Live video (shown in preview phase) */}
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                      phase === 'preview' ? (cameraReady ? 'opacity-100' : 'opacity-0') : 'opacity-0'
                    }`}
                    style={{ transform: 'scaleX(-1)' }} /* Mirror video for natural selfie feel */
                  />

                  {/* Loading spinner while camera boots */}
                  {phase === 'preview' && !cameraReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-slate-400 font-bold">Starting camera...</p>
                    </div>
                  )}

                  {/* Captured snapshot */}
                  {phase === 'captured' && capturedImage && (
                    <img
                      src={capturedImage}
                      alt="Selfie"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}

                  {/* Confirming overlay */}
                  {phase === 'confirming' && (
                    <div className="absolute inset-0 bg-secondary/80 flex flex-col items-center justify-center gap-3">
                      {capturedImage && (
                        <img src={capturedImage} alt="Selfie" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                      )}
                      <div className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-xl animate-pulse">
                          <ShieldCheck size={28} className="text-secondary" />
                        </div>
                        <p className="text-white font-black text-sm uppercase tracking-widest">Verifying...</p>
                      </div>
                    </div>
                  )}

                  {/* Face guide overlay ring */}
                  {(phase === 'preview' && cameraReady) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-4 border-primary/60 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
                    </div>
                  )}

                  {/* Captured check badge */}
                  {phase === 'captured' && (
                    <div className="absolute top-3 right-3 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                      <Check size={20} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>

                {/* Hidden canvas for snapshot */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Action Buttons */}
                {phase === 'preview' && (
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCapture}
                      disabled={!cameraReady}
                      className="flex-[2] py-4 bg-primary text-secondary rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Camera size={16} />
                      Take Selfie
                    </button>
                  </div>
                )}

                {phase === 'captured' && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleRetake}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                    >
                      Retake
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="flex-[2] py-4 bg-green-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                    >
                      <ShieldCheck size={16} />
                      Go Online
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DriverHome;
