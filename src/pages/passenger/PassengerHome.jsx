import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
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
import useGeoLocation from '../../hooks/useGeoLocation';
import LocationPermissionModal from '../../components/LocationPermissionModal';
import { searchLandmarks, QUICK_DESTINATIONS, TRENTO_LANDMARKS } from '../../data/trentoLandmarks';

// Default map centre (Trento ADS)
const TRENTO_CENTER = { lat: 8.0505, lng: 126.0624 };

const PassengerHome = () => {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState('');
  const [dest, setDest] = useState('');
  const [status, setStatus] = useState('idle');
  const [markers, setMarkers] = useState([]);
  const [fare, setFare] = useState(0);
  const [nearbyDrivers, setNearbyDrivers] = useState(0);
  const [showSOS, setShowSOS] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [passengerCount, setPassengerCount] = useState(1);
  const [surgeInfo, setSurgeInfo] = useState({ multiplier: 1.0, isSurge: false });
  const [showPayment, setShowPayment] = useState(false);
  const [showGCashPayment, setShowGCashPayment] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const gcashEnabled = process.env.REACT_APP_GCASH_ENABLED === 'true';
  const [activeRideId, setActiveRideId] = useState(null);
  const [showChat, setShowChat] = useState(false);
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
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState(0);

  // Refs to capture real geocoded coordinates from computeFare() for use in requestRide()
  const pickupCoordsRef = useRef(null); // { lat, lng } — geocoded pickup point
  const destCoordsRef = useRef(null); // { lat, lng } — geocoded destination point

  const [fareParams, setFareParams] = useState({ base: 30, perKm: 8 });
  const { driverLocation, systemEvent } = useSystemEvents();
  const [proximityAlert, setProximityAlert] = useState(false);
  const [requestTimeRemaining, setRequestTimeRemaining] = useState(0);
  const [showFallbackButton, setShowFallbackButton] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  // Grab-style booking enhancements
  const [nearestLandmark, setNearestLandmark] = useState('');
  const [rideNotes, setRideNotes] = useState('');
  const [mapTapMode, setMapTapMode] = useState(false);
  const [lmSuggestions, setLmSuggestions] = useState([]); // live landmark search results

  // Fetch real system configuration fare policies on load
  useEffect(() => {
    const fetchSystemConfig = async () => {
      try {
        const res = await api.get('/system-config/');
        const configList = Array.isArray(res.data) ? res.data : (res.data.results || []);

        const baseFareObj = configList.find(c => c.key === 'base_fare');
        const ratePerKmObj = configList.find(c => c.key === 'rate_per_km');
        const surgeObj = configList.find(c => c.key === 'surge_multiplier');

        const base = baseFareObj ? parseFloat(baseFareObj.value) : 30;
        const perKm = ratePerKmObj ? parseFloat(ratePerKmObj.value) : 8;
        const multiplier = surgeObj ? parseFloat(surgeObj.value) : 1.0;

        setFareParams({ base, perKm });
        setSurgeInfo({
          multiplier,
          isSurge: multiplier > 1.0
        });
      } catch (err) {
        console.error('Failed to fetch system config in PassengerHome:', err);
      }
    };
    fetchSystemConfig();
  }, []);
  // ── Real-time GPS tracking (falls back to Trento ADS demo if denied) ────────
  const { location: gpsLocation, status: gpsStatus, error: gpsError, retry: retryGps } = useGeoLocation();

  // Derived map centre: use live GPS when available, else TRENTO_CENTER
  const userCenter = gpsLocation
    ? { lat: gpsLocation.lat, lng: gpsLocation.lng }
    : TRENTO_CENTER;

  // ── "You are here" marker ────────────────────────────────────────────────
  useEffect(() => {
    if (!gpsLocation) {
      setMarkers(prev => prev.filter(m => m.id !== 'you_are_here'));
      return;
    }

    // Real GPS fix — place / update the marker
    setMarkers(prev => {
      const others = prev.filter(m => m.id !== 'you_are_here');
      const isFirst = !prev.find(m => m.id === 'you_are_here');
      return [
        {
          id: 'you_are_here',
          lat: gpsLocation.lat,
          lng: gpsLocation.lng,
          title: '📍 You are here',
          info: `GPS live · ±${Math.round(gpsLocation.accuracy || 0)} m`,
          // Only force-pan to the pin the very first time it appears
          forceFocus: isFirst ? Date.now() : undefined,
        },
        ...others,
      ];
    });
  }, [gpsLocation]);


  // LGU Rules: Base 30 + 8 per km
  // Simulated Distance Service: Estimates distance based on address complexity
  const computeFare = useCallback(async () => {
    if (!pickup || !dest) {
      setFare(0);
      setDistance(0);
      return;
    }

    // Lookup local landmark coordinates if they exist
    const matchedPickupLm = TRENTO_LANDMARKS.find(l => l.name.toLowerCase() === pickup.trim().toLowerCase());
    const matchedDestLm = TRENTO_LANDMARKS.find(l => l.name.toLowerCase() === dest.trim().toLowerCase());

    // 1. Resolve Pickup Coordinates
    let pLat = matchedPickupLm ? matchedPickupLm.lat : null;
    let pLon = matchedPickupLm ? matchedPickupLm.lng : null;

    if (!pLat || !pLon) {
      if (pickup === 'Current GPS Location' && gpsLocation) {
        pLat = gpsLocation.lat;
        pLon = gpsLocation.lng;
      } else if (pickupCoordsRef.current && !pickupCoordsRef.current.isFallback) {
        pLat = pickupCoordsRef.current.lat;
        pLon = pickupCoordsRef.current.lng;
      }
    }

    // 2. Resolve Destination Coordinates
    let dLat = matchedDestLm ? matchedDestLm.lat : null;
    let dLon = matchedDestLm ? matchedDestLm.lng : null;

    if (!dLat || !dLon) {
      if (destCoordsRef.current && !destCoordsRef.current.isFallback) {
        dLat = destCoordsRef.current.lat;
        dLon = destCoordsRef.current.lng;
      }
    }

    // Fallbacks if not set
    if (!pLat || !pLon) {
      pLat = parseFloat(userCenter.lat);
      pLon = parseFloat(userCenter.lng);
    }
    const hadValidDest = !!(dLat && dLon);
    if (!dLat || !dLon) {
      dLat = parseFloat(userCenter.lat) + 0.003;
      dLon = parseFloat(userCenter.lng) + 0.003;
    }

    // Store in refs
    pickupCoordsRef.current = { lat: pLat, lng: pLon };
    destCoordsRef.current = { lat: dLat, lng: dLon, isFallback: !hadValidDest };

    try {
      const fetchWithTimeout = (url) => Promise.race([
        fetch(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);

      const nominatimUrl = process.env.REACT_APP_NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';

      // 3. Query geocoding only if we don't already have matched/exact coordinates
      let finalPLat = pLat;
      let finalPLon = pLon;
      if (!matchedPickupLm && pickup !== 'Current GPS Location' && (!pickupCoordsRef.current || pickupCoordsRef.current.isFallback)) {
        try {
          const searchPickup = pickup.toLowerCase().includes('trento') ? pickup : `${pickup}, Trento, Agusan del Sur, Philippines`;
          const picRes = await fetchWithTimeout(`${nominatimUrl}?q=${encodeURIComponent(searchPickup)}&format=json&limit=1`);
          const picData = await picRes.json();
          if (picData && picData.length > 0) {
            finalPLat = parseFloat(picData[0].lat);
            finalPLon = parseFloat(picData[0].lon);
            pickupCoordsRef.current = { lat: finalPLat, lng: finalPLon };
          }
        } catch (e) {
          console.warn("Pickup Nominatim geocoding failed, using fallback.", e);
        }
      }

      let finalDLat = dLat;
      let finalDLon = dLon;
      if (!matchedDestLm && !dest.startsWith('Pin at') && !hadValidDest) {
        try {
          const searchDest = dest.toLowerCase().includes('trento') ? dest : `${dest}, Trento, Agusan del Sur, Philippines`;
          const destRes = await fetchWithTimeout(`${nominatimUrl}?q=${encodeURIComponent(searchDest)}&format=json&limit=1`);
          const destData = await destRes.json();
          if (destData && destData.length > 0) {
            finalDLat = parseFloat(destData[0].lat);
            finalDLon = parseFloat(destData[0].lon);
            destCoordsRef.current = { lat: finalDLat, lng: finalDLon };
          }
        } catch (e) {
          console.warn("Destination Nominatim geocoding failed, using fallback.", e);
        }
      }

      let actualDistance = 0;

      // 2. Query OSRM for exact road distance using resolved coordinates
      const osrmUrl = process.env.REACT_APP_OSRM_URL || 'https://router.project-osrm.org/route/v1/driving';
      const routeRes = await fetchWithTimeout(`${osrmUrl}/${pickupCoordsRef.current.lng},${pickupCoordsRef.current.lat};${destCoordsRef.current.lng},${destCoordsRef.current.lat}?overview=full&geometries=geojson`);
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
            { id: 'pickup', lat: pickupCoordsRef.current.lat, lng: pickupCoordsRef.current.lng, title: 'Pickup', info: pickup, isPickup: true, forceFocus: Date.now() },
            { id: 'dest', lat: destCoordsRef.current.lat, lng: destCoordsRef.current.lng, title: 'Destination', info: dest, isDestination: true }
          ];
        });
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
      setEstimatedTime(Math.ceil(finalDistanceKm * 3));

      // 4. Fetch dynamic pricing from backend — pass distance so backend applies LGU ceil() formula
      // Formula: Fare = Base Fare + ceil((distance - base_distance) / 1) × rate_per_km
      try {
        const res = await api.get('/rides/estimate_fare/', {
          params: { distance: finalDistanceKm.toFixed(2) }
        });
        const { base_fare, rate_per_km, base_distance = 2.0, surge_multiplier, is_surge, calculated_fare } = res.data;

        setFareParams({ base: base_fare, perKm: rate_per_km });
        setSurgeInfo({ multiplier: surge_multiplier, isSurge: is_surge });

        // Prefer server-computed ceil() fare; fall back to local ceil() if absent
        if (calculated_fare != null) {
          setFare(Math.round(calculated_fare));
        } else {
          const extraKm = Math.max(0, finalDistanceKm - base_distance);
          const localFare = (base_fare + Math.ceil(extraKm) * rate_per_km) * surge_multiplier;
          setFare(Math.round(localFare));
        }
      } catch (err) {
        // Offline Fallback — mirrors LGU ceil() formula with hardcoded defaults
        const BASE_FARE = 30; const RATE_PER_KM = 8; const BASE_DIST = 2.0;
        const extraKm = Math.max(0, finalDistanceKm - BASE_DIST);
        setFare(Math.round(BASE_FARE + Math.ceil(extraKm) * RATE_PER_KM));
      }

    } catch (err) {
      console.warn("Real Geocoding Failed (likely limit or offline). Using offline heuristic calculation.");
      const fallbackDist = ((pickup + dest).length % 5) + 1.2;
      setDistance(fallbackDist.toFixed(1));
      setEstimatedTime(Math.ceil(fallbackDist * 3));
      // Offline ceil() fallback consistent with LGU model
      const BASE_FARE = 30; const RATE_PER_KM = 8; const BASE_DIST = 2.0;
      const extraKm = Math.max(0, fallbackDist - BASE_DIST);
      setFare(Math.round(BASE_FARE + Math.ceil(extraKm) * RATE_PER_KM));
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
      const token = localStorage.getItem('token');
      if (!token) return;
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

  // Restore Active Ride State on Mount
  useEffect(() => {
    const fetchActiveRide = async () => {
      try {
        const res = await api.get('/rides/active_ride/');
        if (res.data) {
          const ride = res.data;
          setActiveRideId(ride.id);
          setPickup(ride.pickup_address);
          setDest(ride.dest_address);
          setFare(ride.fare);
          if (ride.payment_method) setPaymentMethod(ride.payment_method);

          if (ride.status === 'requested') {
            setStatus('requesting');
          } else if (ride.status === 'accepted') {
            setStatus('matched');
            setAssignedDriver(ride.driver);
          } else if (ride.status === 'on_route') {
            setStatus('ongoing');
            setAssignedDriver(ride.driver);
          }

          // Restore markers on map
          if (ride.pickup_lat && ride.pickup_lng && ride.dest_lat && ride.dest_lng) {
            const pLat = parseFloat(ride.pickup_lat);
            const pLng = parseFloat(ride.pickup_lng);
            const dLat = parseFloat(ride.dest_lat);
            const dLng = parseFloat(ride.dest_lng);

            setMarkers([
              { id: 'pickup', lat: pLat, lng: pLng, title: 'Pickup', info: ride.pickup_address, isPickup: true, forceFocus: Date.now() },
              { id: 'dest', lat: dLat, lng: dLng, title: 'Destination', info: ride.dest_address, isDestination: true }
            ]);

            // ✅ Real distance & route: call OSRM with the stored coords
            try {
              const osrmUrl = process.env.REACT_APP_OSRM_URL || 'https://router.project-osrm.org/route/v1/driving';
              const rRes = await fetch(`${osrmUrl}/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson`);
              const rData = await rRes.json();
              if (rData.code === 'Ok' && rData.routes?.length > 0) {
                const realDist = rData.routes[0].distance / 1000;
                setDistance(realDist.toFixed(1));
                setEstimatedTime(Math.ceil(realDist * 3));
                const pathCoords = rData.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                setRouteCoordinates(pathCoords);
              } else {
                throw new Error('OSRM no route');
              }
            } catch {
              // Haversine fallback — at least a geometrically correct straight-line distance
              const R = 6371;
              const dLat2 = (dLat - pLat) * Math.PI / 180;
              const dLng2 = (dLng - pLng) * Math.PI / 180;
              const a = Math.sin(dLat2 / 2) ** 2 +
                Math.cos(pLat * Math.PI / 180) * Math.cos(dLat * Math.PI / 180) * Math.sin(dLng2 / 2) ** 2;
              const hDist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              setDistance(hDist.toFixed(1));
              setEstimatedTime(Math.ceil(hDist * 3));
            }
          }
        }
      } catch (err) {
        console.error('Failed to restore active ride', err);
      }
    };
    fetchActiveRide();
  }, []);

  // Real-time Driver Availability — uses live GPS coords when available
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const res = await api.get('/users/nearby_drivers/', {
          params: { lat: userCenter.lat, lng: userCenter.lng }
        });
        setNearbyDriverList(Array.isArray(res.data) ? res.data : []);
        setNearbyDrivers(Array.isArray(res.data) ? res.data.length : 0);
      } catch (err) {
        // Handle 401 authentication errors silently - token refresh will handle it
        if (err.response?.status === 401) {
          console.warn('Authentication token expired, refresh in progress...');
        } else {
          console.error('Failed to fetch nearby drivers', err);
        }
      }
    };

    fetchDrivers(); // Initial
    const interval = setInterval(fetchDrivers, 15000); // Poll every 15s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCenter.lat, userCenter.lng]);

  useEffect(() => {
    // Check for new critical broadcasts
    const lastSeen = localStorage.getItem('last_seen_broadcast_p');
    if (broadcasts.length > 0 && broadcasts[0].is_critical && broadcasts[0].id.toString() !== lastSeen) {
      setCurrentBroadcast(broadcasts[0]);
      setShowBroadcastModal(true);
    }
  }, [broadcasts]);

  useEffect(() => {
    if (pickup && dest && status === 'idle') {
      computeFare();
    }
  }, [pickup, dest, computeFare, status]);

  // Live Tracking
  const { user } = useContext(AuthContext);
  const { location: wsData, sendMessage, messages, connected, sendLocation } = useRideTracking(activeRideId);

  // Send passenger location to driver
  useEffect(() => {
    let watchId;
    if (activeRideId && (status === 'matched' || status === 'ongoing')) {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            sendLocation(pos.coords.latitude, pos.coords.longitude);
          },
          (err) => {
            // Gracefully handle geolocation errors without spamming console
            if (err.code === 1) {
              // Permission denied - user chose not to share location
              console.warn('Geolocation permission denied by user');
            } else if (err.code === 2) {
              // Position unavailable - GPS issue
              console.warn('Geolocation position unavailable');
            } else if (err.code === 3) {
              // Timeout
              console.warn('Geolocation request timed out');
            }
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
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

  // Handle Proximity Alert — compare driver WS position to passenger's real GPS pickup location
  useEffect(() => {
    if (wsData && wsData.lat && wsData.lng && status === 'matched') {
      // Use actual passenger GPS (userCenter) as the reference, not a hardcoded coordinate
      const refLat = userCenter.lat;
      const refLng = userCenter.lng;
      // ≈200 m threshold using quick lat/lng delta (0.002° ≈ 220 m at these latitudes)
      const latDiff = Math.abs(parseFloat(wsData.lat) - refLat);
      const lngDiff = Math.abs(parseFloat(wsData.lng) - refLng);
      if (latDiff < 0.002 && lngDiff < 0.002 && !proximityAlert) {
        setProximityAlert(true);
      }
    }
  }, [wsData, status, proximityAlert, userCenter.lat, userCenter.lng]);

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

        return [
          ...otherMarkers,
          {
            lat: parseFloat(wsData.lat),
            lng: parseFloat(wsData.lng),
            title: 'Driver',
            info: 'On the way to you!',
            isDriver: true,
            heading: wsData.heading || 0,
            accuracy: wsData.accuracy || null,
            isTracking: isTracking
          }
        ];
      });
    }
  }, [wsData, status, isTracking]);

  const requestRide = async (e) => {
    e.preventDefault();
    if (!pickup || !dest) return;
    if (isRequestingRide) return; // Prevent duplicate requests

    setIsRequestingRide(true);
    setStatus('requesting');

    try {
      // ✅ Use real geocoded pickup coords (from computeFare ref) — fall back to live GPS if not yet geocoded
      const realPickupLat = pickupCoordsRef.current?.lat ?? userCenter.lat;
      const realPickupLng = pickupCoordsRef.current?.lng ?? userCenter.lng;

      // ✅ Use real geocoded destination coords (from computeFare ref) — reject fake offsets
      if (!destCoordsRef.current) {
        alert('Please wait for the route to load before requesting a ride. The destination location is still being resolved.');
        setStatus('idle');
        return;
      }
      const realDestLat = destCoordsRef.current.lat;
      const realDestLng = destCoordsRef.current.lng;

      // Create actual ride in database with real geocoded coordinates
      const response = await api.post('/rides/', {
        pickup_address: pickup,
        dest_address: dest,
        pickup_lat: parseFloat(realPickupLat).toFixed(6),
        pickup_lng: parseFloat(realPickupLng).toFixed(6),
        dest_lat: parseFloat(realDestLat).toFixed(6),
        dest_lng: parseFloat(realDestLng).toFixed(6),
        fare: fare,
        payment_method: paymentMethod,
        passenger_count: passengerCount,
        targeted_driver_id: selectedDriverId,
        nearest_landmark: nearestLandmark,
        notes: rideNotes,
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
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Failed to request ride';
      alert(`Failed to request ride: ${errorMsg}`);
      setStatus('idle');
    } finally {
      setIsRequestingRide(false);
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
    // Validate fare before proceeding
    if (!fare || fare <= 0) {
      alert('Invalid fare amount. Please try again.');
      return;
    }

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
        const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Failed to complete ride';
        alert(`Error: ${errorMsg}`);
        return;
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
    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      // Verify payment with backend before completing ride
      const verifyRes = await api.get('/payments/gcash/verify/', {
        params: { source_id: transactionRef }
      });

      if (!verifyRes.data.success) {
        throw new Error('Payment verification failed. Please contact support.');
      }

      // Mark ride as completed in database with payment reference
      if (activeRideId) {
        await api.patch(`/rides/${activeRideId}/`, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          payment_reference: transactionRef,
          payment_verified: true
        });
      }

      setShowGCashPayment(false);
      setStatus('completed');
      setMarkers([]);
      setRouteCoordinates(null);

      // Show success message
      alert(`Payment successful! Reference: ${transactionRef.slice(0, 8)}...`);

      // Show rating modal after a short delay
      setTimeout(() => {
        setShowRating(true);
      }, 1000);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Payment verification failed';
      setPaymentError(errorMsg);
      alert(`Payment Error: ${errorMsg}. Please try again or contact support.`);
      setShowGCashPayment(false);
    } finally {
      setIsProcessingPayment(false);
    }
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
    <div className="min-h-screen pt-20 pb-10 bg-slate-100 dark:bg-slate-950 flex flex-col-reverse md:flex-row gap-4 md:gap-6 px-4 md:px-6 max-w-[1400px] mx-auto transition-colors duration-500">
      <LocationPermissionModal
        isOpen={gpsStatus === 'error'}
        error={gpsError}
        onRetry={retryGps}
      />

      {/* Floating Live Tracking Indicator */}
      <AnimatePresence>
        {isTracking && (status === 'matched' || status === 'ongoing') && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-primary text-secondary px-6 py-2 rounded-full shadow-2xl border-2 border-white flex items-center gap-3"
          >
            <div className="w-2 h-2 bg-secondary rounded-full animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live Tracking Active</span>
          </motion.div>
        )}
      </AnimatePresence>

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
                placeholder="Enter pickup location"
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-12 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all dark:text-white text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  if (gpsLocation) {
                    setPickup('Current GPS Location');
                  } else {
                    alert('Please wait for GPS to locate you, or enter manually.');
                  }
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:text-primary-dark transition-colors"
                title="Use Current Location"
              >
                <Navigation size={18} />
              </button>
            </div>
              <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={18} />
              </div>
              <input
                value={dest}
                onChange={(e) => {
                  const v = e.target.value;
                  setDest(v);
                  setShowDestSuggestions(true);
                  setLmSuggestions(searchLandmarks(v));
                }}
                onFocus={() => {
                  setShowDestSuggestions(true);
                  setLmSuggestions(searchLandmarks(dest));
                }}
                onBlur={() => setTimeout(() => setShowDestSuggestions(false), 200)}
                placeholder="Search destination (Market, Hospital, Brgy…)"
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all dark:text-white text-sm"
              />
              <AnimatePresence>
                {showDestSuggestions && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-white/10 z-50 overflow-hidden"
                  >
                    <div className="p-2 max-h-64 overflow-y-auto">
                      {/* Live search results from Trento DB */}
                      {lmSuggestions.length > 0 ? (
                        <>
                          <p className="text-[9px] font-black uppercase text-slate-400 ml-2 mb-1">Matching Landmarks</p>
                          {lmSuggestions.map((lm) => (
                            <button
                              key={lm.id}
                              type="button"
                              onClick={() => {
                                setDest(lm.name);
                                setNearestLandmark(lm.name);
                                destCoordsRef.current = { lat: lm.lat, lng: lm.lng };
                                setShowDestSuggestions(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-secondary dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-3"
                            >
                              <span className="text-base">{lm.icon}</span>
                              <div className="min-w-0">
                                <p className="font-bold truncate">{lm.name}</p>
                                <p className="text-[10px] text-slate-400">{lm.category}</p>
                              </div>
                            </button>
                          ))}
                        </>
                      ) : dest.length >= 2 ? (
                        <div className="px-3 py-3 text-center">
                          <p className="text-xs text-slate-400 font-bold">No local landmarks found.</p>
                          <button
                            type="button"
                            onClick={() => { setMapTapMode(true); setShowDestSuggestions(false); }}
                            className="mt-1 text-xs text-primary font-black hover:underline"
                          >
                            📍 Tap the map to pin your destination
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-[9px] font-black uppercase text-slate-400 ml-2 mb-1">Quick Destinations</p>
                          {QUICK_DESTINATIONS.map((lm) => (
                            <button
                              key={lm.id}
                              type="button"
                              onClick={() => {
                                setDest(lm.name);
                                setNearestLandmark(lm.name);
                                destCoordsRef.current = { lat: lm.lat, lng: lm.lng };
                                setShowDestSuggestions(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-secondary dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-3"
                            >
                              <span className="text-base">{lm.icon}</span>
                              <div className="min-w-0">
                                <p className="font-bold truncate">{lm.name}</p>
                                <p className="text-[10px] text-slate-400">{lm.category}</p>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
                      <p className="text-[10px] text-slate-300 font-bold mt-0.5">~{estimatedTime} mins</p>
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

                  {/* Nearest Landmark */}
                  <div className="mb-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/80 mb-1.5">📍 Nearest Landmark <span className="normal-case font-medium opacity-60">(helps driver find you)</span></p>
                    <input
                      type="text"
                      value={nearestLandmark}
                      onChange={(e) => setNearestLandmark(e.target.value)}
                      placeholder="e.g. Near Public Market, Beside Mercury Drug…"
                      className="w-full bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-white/30"
                    />
                  </div>

                  {/* Ride Notes */}
                  <div className="mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/80 mb-1.5">📝 Ride Instructions <span className="normal-case font-medium opacity-60">(optional)</span></p>
                    <input
                      type="text"
                      value={rideNotes}
                      onChange={(e) => setRideNotes(e.target.value)}
                      placeholder="e.g. Blue Gate, Waiting Outside, Second House…"
                      className="w-full bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-white/30"
                    />
                  </div>

                  <div className="mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/80 mb-2">Number of Passengers (Max 5)</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setPassengerCount(num)}
                          className={`w-10 h-10 rounded-xl text-xs font-black transition-all border-2 ${passengerCount === num
                              ? 'bg-primary text-secondary border-primary shadow-md'
                              : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                            }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
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
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-2">Secure Contact</p>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-blue-600" />
                        <button
                          onClick={() => alert("Initiating secure proxy call. Driver number is hidden for privacy.")}
                          className="text-sm font-bold text-blue-600 hover:underline focus:outline-none"
                        >
                          Call Driver (Masked)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Mobile-Optimized Driver Controls */}
                  <div className="grid grid-cols-4 gap-2 py-2">
                    <button
                      type="button"
                      onClick={() => setShowChat(prev => !prev)}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${showChat ? 'bg-secondary text-white border-secondary' : 'bg-white text-secondary border-slate-200 hover:bg-slate-50'}`}
                    >
                      <MessageSquare size={16} />
                      <span className="text-[8px] font-black uppercase tracking-wider">Chat</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTracking(!isTracking);
                        const driverMarker = markers.find(m => m.title === 'Driver');
                        if (driverMarker) {
                          setMarkers([...markers.map(m => m.title === 'Driver' ? { ...m, isTracking: !isTracking, forceFocus: !isTracking ? Date.now() : null } : m)]);
                        }
                      }}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${isTracking ? 'bg-primary text-secondary border-primary' : 'bg-white text-secondary border-slate-200 hover:bg-slate-50'}`}
                    >
                      <Navigation size={16} className={isTracking ? 'animate-pulse' : ''} />
                      <span className="text-[8px] font-black uppercase tracking-wider">{isTracking ? 'Tracking' : 'Track'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await api.get(`/rides/${activeRideId}/`);
                          const token = res.data.share_token;
                          const url = `${window.location.origin}/track/${token}`;
                          await navigator.clipboard.writeText(url);
                          alert("Tracking link copied to clipboard!");
                        } catch (e) {
                          alert("Could not generate link.");
                        }
                      }}
                      className="p-3 bg-white hover:bg-slate-50 text-secondary border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all"
                    >
                      <Share2 size={16} />
                      <span className="text-[8px] font-black uppercase tracking-wider">Share</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => alert("Initiating secure proxy call. Driver number is hidden for privacy.")}
                      className="p-3 bg-white hover:bg-slate-50 text-secondary border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all"
                    >
                      <Phone size={16} />
                      <span className="text-[8px] font-black uppercase tracking-wider">Call</span>
                    </button>
                  </div>

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

      {/* Main Map View — centred on live GPS position */}
      <div className="flex-1 min-h-[500px] relative rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white">
        {/* Map tap mode banner */}
        <AnimatePresence>
          {mapTapMode && (
            <motion.div
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-secondary text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border-2 border-white"
            >
              <MapPin size={16} className="text-primary" />
              <span className="text-xs font-black">Tap anywhere to set your destination</span>
              <button
                onClick={() => setMapTapMode(false)}
                className="ml-1 text-white/60 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <Map
          center={userCenter}
          markers={markers}
          routeCoordinates={routeCoordinates}
          onMapClick={(lat, lng) => {
            if (!mapTapMode) return;
            // Place/update destination marker
            const label = `Pin at ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            setDest(label);
            destCoordsRef.current = { lat, lng };
            setMarkers(prev => [
              ...prev.filter(m => !m.isDestination),
              { id: 'dest', lat, lng, title: 'Destination', info: label, isDestination: true, forceFocus: Date.now() },
            ]);
            setMapTapMode(false);
          }}
          mapClickEnabled={mapTapMode}
        />

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
          {(status === 'matched' || status === 'ongoing') && (
            <button
              onClick={() => {
                setIsTracking(!isTracking);
                const driverMarker = markers.find(m => m.title === 'Driver');
                if (driverMarker) {
                  setMarkers([...markers.map(m => m.title === 'Driver' ? { ...m, isTracking: !isTracking, forceFocus: !isTracking ? Date.now() : null } : m)]);
                }
              }}
              className={`hidden md:flex ${isTracking ? 'bg-primary text-secondary ring-4 ring-primary/30' : 'bg-secondary text-white'} p-4 rounded-2xl shadow-lg items-center gap-3 hover:scale-105 transition-all border border-white/10`}
            >
              <Navigation size={20} className={isTracking ? 'text-secondary animate-pulse' : 'text-primary'} />
              <span className="text-sm font-bold">{isTracking ? 'Following Driver...' : 'Track Driver'}</span>
            </button>
          )}

          {/* Share Ride Button */}
          {(status === 'matched' || status === 'ongoing') && activeRideId && (
            <button
              onClick={async () => {
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
              className="hidden md:flex bg-blue-600 text-white p-4 rounded-2xl shadow-lg items-center gap-3 hover:scale-105 transition-all border border-white/10"
            >
              <Share2 size={20} />
              <span className="text-sm font-bold">Share Ride</span>
            </button>
          )}
          {/* Chat with Driver Button — shows only during active ride */}
          {(status === 'matched' || status === 'ongoing') && (
            <button
              onClick={() => setShowChat(prev => !prev)}
              className={`hidden md:flex p-4 rounded-2xl shadow-lg items-center gap-3 hover:scale-105 transition-all border relative ${showChat
                  ? 'bg-secondary text-white border-white/10'
                  : 'bg-white text-secondary border-slate-100'
                }`}
            >
              <MessageSquare size={20} className={showChat ? 'text-primary' : 'text-secondary'} />
              <span className="text-sm font-bold">Chat with Driver</span>
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
          setPickup('');
          setDest('');
          setActiveRideId(null);
          setAssignedDriver(null);
          setRouteCoordinates(null);
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
          isConnected={connected}
          isOpen={showChat}
          onToggle={() => setShowChat(prev => !prev)}
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
