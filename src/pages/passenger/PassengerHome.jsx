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
  Phone,
  Shield,
  RefreshCw
} from 'lucide-react';
import PaymentModal from '../../components/PaymentModal';
import RatingModal from '../../components/RatingModal';
import useRideTracking from '../../hooks/useRideTracking';
import useSystemEvents from '../../hooks/useSystemEvents';
import ChatWindow from '../../components/ChatWindow';
import SavedPlaceModal from '../../components/SavedPlaceModal';
import useNotifications from '../../hooks/useNotifications';
import GCashPaymentModal from '../../components/GCashPaymentModal';
import { Settings, X } from 'lucide-react';
import useGeoLocation from '../../hooks/useGeoLocation';
import LocationPermissionModal from '../../components/LocationPermissionModal';
import { searchLandmarks, QUICK_DESTINATIONS, TRENTO_LANDMARKS } from '../../data/trentoLandmarks';
import { ensureImageUrl } from '../../utils/url';

/**
 * Reverse geocode (lat, lng) → human-readable place name
 * Uses Nominatim (free, OSM-based). Returns a concise local label.
 */
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'TrentoSmartApp/1.0' } });
    if (!res.ok) throw new Error('Nominatim error');
    const data = await res.json();
    if (!data || !data.address) return null;
    const a = data.address;
    // Build a concise label: Road/Neighbourhood + Barangay/City
    const parts = [
      a.road || a.pedestrian || a.path || a.footway,
      a.neighbourhood || a.hamlet || a.suburb,
      a.village || a.city_district || a.county,
    ].filter(Boolean);
    if (parts.length === 0) return data.display_name ? data.display_name.split(',').slice(0, 3).join(', ') : null;
    return parts.slice(0, 3).join(', ');
  } catch {
    return null;
  }
}

// Default map centre (Trento ADS)
const TRENTO_CENTER = { lat: 8.03555, lng: 126.06432 };

const PassengerHome = () => {
  const navigate = useNavigate();
  const { playSound, notify } = useNotifications();
  const [pickup, setPickup] = useState('');
  const [dest, setDest] = useState('');
  const [status, setStatus] = useState('idle');
  const [markers, setMarkers] = useState([]);
  const [fare, setFare] = useState(0);
  const [isFetchingFare, setIsFetchingFare] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState(0);
  const [showSOS, setShowSOS] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [passengerCount, setPassengerCount] = useState(1);
  const [surgeInfo, setSurgeInfo] = useState({ multiplier: 1.0, isSurge: false });
  const [showPayment, setShowPayment] = useState(false);
  const [showGCashPayment, setShowGCashPayment] = useState(false);

  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [activeRideId, setActiveRideId] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [assignedDriver, setAssignedDriver] = useState(null);
  // Snapshots at the moment rating is triggered — prevents race condition where
  // activeRideId or assignedDriver get cleared before the rating modal renders.
  const [ratingRideId, setRatingRideId] = useState(null);
  const [ratingDriver, setRatingDriver] = useState(null);
  // Pre-cached share token so iOS clipboard/share never needs an async fetch on-click
  const [cachedShareToken, setCachedShareToken] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);

  const [distance, setDistance] = useState(0);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [currentBroadcast, setCurrentBroadcast] = useState(null);
  const [dismissedBroadcasts, setDismissedBroadcasts] = useState(() => {
    try {
      const saved = localStorage.getItem('dismissed_broadcasts_p');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showAllBroadcastsModal, setShowAllBroadcastsModal] = useState(false);

  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState(null);
  const [selectedPlaceAction, setSelectedPlaceAction] = useState(null);
  const [nearbyDriverList, setNearbyDriverList] = useState([]); // New: Detailed driver list
  const [selectedDriverId, setSelectedDriverId] = useState(null); // New: Choosen driver ID
  const [routeCoordinates, setRouteCoordinates] = useState(null); // Real driving path
  const [secondaryRouteCoordinates, setSecondaryRouteCoordinates] = useState(null); // Pickup to Destination path when matched
  const [fitBoundsPoints, setFitBoundsPoints] = useState(null); // LatLng bounds coordinates
  const [fitBoundsKey, setFitBoundsKey] = useState(0); // Trigger bounds fitting
  const [driverEta, setDriverEta] = useState(null); // Estimated arrival time in minutes
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState(0);

  // Refs to capture real geocoded coordinates from computeFare() for use in requestRide()
  const pickupCoordsRef = useRef(null); // { lat, lng } — geocoded pickup point
  const destCoordsRef = useRef(null); // { lat, lng } — geocoded destination point
  const lastRouteFetchedCoordsRef = useRef({ lat: 0, lng: 0 }); // Rate limit dynamic OSRM calls
  const hasAutoFocusedOnMatchRef = useRef(false); // One-time auto-focus when driver location first arrives after matching
  // ── FIX #2: Always-current GPS ref so computeFare never reads a stale closure ──
  // useCallback deps only include [pickup, dest] to avoid infinite re-renders;
  // reading gpsLocationRef.current inside the callback always gives the latest fix.
  const gpsLocationRef = useRef(null);

  const [fareParams, setFareParams] = useState({ base: 30, perKm: 8 });
  // eslint-disable-next-line no-unused-vars
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

  const cancelRide = useCallback(async () => {
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
    setCachedShareToken(null);
  }, [activeRideId]);

  // Quick-book from map POI: set pickup from a landmark tap
  const handleSelectPickup = useCallback((name, lat, lng) => {
    setPickup(name);
    pickupCoordsRef.current = { lat, lng };
    // Drop a pickup pin immediately
    setMarkers(prev => [
      ...prev.filter(m => !m.isPickup),
      { id: 'pickup', lat, lng, title: 'Pickup', info: name, isPickup: true, forceFocus: Date.now() },
    ]);
  }, []);

  // Quick-book from map POI: set destination from a landmark tap
  const handleSelectDestination = useCallback((name, lat, lng) => {
    setDest(name);
    destCoordsRef.current = { lat, lng };
    // Drop a destination pin immediately
    setMarkers(prev => [
      ...prev.filter(m => !m.isDestination),
      { id: 'dest', lat, lng, title: '📍 ' + name, info: name, isDestination: true, forceFocus: Date.now() },
    ]);
  }, []);

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

  // ── FIX #2: Keep gpsLocationRef always in sync with the latest GPS fix ─────
  // This lets computeFare read the freshest GPS without declaring it as a
  // useCallback dependency (which would cause infinite re-render loops).
  useEffect(() => {
    gpsLocationRef.current = gpsLocation;
  }, [gpsLocation]);

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

      // Hide you_are_here marker when ride is ongoing
      if (status === 'ongoing') {
        return others;
      }

      return [
        {
          id: 'you_are_here',
          lat: gpsLocation.lat,
          lng: gpsLocation.lng,
          accuracy: gpsLocation.accuracy || 0,  // numeric — used by LeafletMap accuracy ring
          title: '📍 You are here',
          info: `GPS live · ±${Math.round(gpsLocation.accuracy || 0)} m`,
          // Only force-pan to the pin the very first time it appears
          forceFocus: isFirst ? Date.now() : undefined,
        },
        ...others,
      ];
    });
  }, [gpsLocation, status]);

  // Clean up markers when status transitions to ongoing
  useEffect(() => {
    if (status === 'ongoing') {
      setMarkers(prev => prev.filter(m => m.id !== 'pickup' && m.id !== 'you_are_here'));
    }
  }, [status]);


  // LGU Rules: Base 30 + 8 per km
  // Simulated Distance Service: Estimates distance based on address complexity
  const computeFare = useCallback(async () => {
    if (!pickup || !dest) {
      setFare(0);
      setDistance(0);
      setIsFetchingFare(false);
      return;
    }

    setIsFetchingFare(true);

    // Lookup local landmark coordinates if they exist
    const matchedPickupLm = TRENTO_LANDMARKS.find(l => l.name.toLowerCase() === pickup.trim().toLowerCase());
    const matchedDestLm = TRENTO_LANDMARKS.find(l => l.name.toLowerCase() === dest.trim().toLowerCase());

    // 1. Resolve Pickup Coordinates
    let pLat = matchedPickupLm ? matchedPickupLm.lat : null;
    let pLon = matchedPickupLm ? matchedPickupLm.lng : null;

    if (!pLat || !pLon) {
      // FIX #2: Read from gpsLocationRef (always current) instead of the stale
      // gpsLocation closure captured at useCallback definition time.
      const currentGps = gpsLocationRef.current;
      if (pickup === 'Current GPS Location' && currentGps) {
        pLat = currentGps.lat;
        pLon = currentGps.lng;
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

    // Pickup fallback — use live GPS or last known userCenter
    if (!pLat || !pLon) {
      const currentGps = gpsLocationRef.current;
      pLat = currentGps ? currentGps.lat : parseFloat(userCenter.lat);
      pLon = currentGps ? currentGps.lng : parseFloat(userCenter.lng);
    }

    // FIX #4: NEVER store a fake +0.003° offset as destination coords.
    // If the destination is still unresolved at this point, mark it as a
    // fallback so requestRide() can block submission with a proper error.
    const hadValidDest = !!(dLat && dLon);
    if (!dLat || !dLon) {
      // Use pickup coords as a same-location placeholder — at least it won't
      // generate phantom distance. Flag as isFallback so requestRide blocks.
      dLat = pLat;
      dLon = pLon;
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

        // Trigger map fit bounds for pickup + destination
        if (pickupCoordsRef.current && destCoordsRef.current) {
          setFitBoundsPoints([
            [pickupCoordsRef.current.lat, pickupCoordsRef.current.lng],
            [destCoordsRef.current.lat, destCoordsRef.current.lng]
          ]);
          setFitBoundsKey(prev => prev + 1);
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
    } finally {
      setIsFetchingFare(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleDismissBroadcast = (id) => {
    setDismissedBroadcasts(prev => {
      const updated = [...prev, id];
      localStorage.setItem('dismissed_broadcasts_p', JSON.stringify(updated));
      return updated;
    });
  };

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

    // Heartbeat: re-ping every 60s to keep last_location_update fresh.
    // This lets the backend detect stale/disconnected passengers (phone died, tab closed).
    const heartbeat = setInterval(() => syncStatus(true), 60000);

    return () => {
      clearInterval(heartbeat);
      syncStatus(false);
    };
  }, [fetchSavedPlaces, fetchBroadcasts]);

  // Restore Active Ride State on Mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gcash_paid') === 'true') {
      // Clean URL parameters immediately so fresh reloads don't trigger it again
      window.history.replaceState({}, document.title, window.location.pathname);

      const savedDriver = sessionStorage.getItem('gcash_assigned_driver');
      const savedRideId = sessionStorage.getItem('gcash_ride_id') || sessionStorage.getItem('active_ride_id_for_gcash');

      if (savedDriver) {
        try {
          const parsed = JSON.parse(savedDriver);
          setAssignedDriver(parsed);
          setRatingDriver(parsed);
        } catch (e) {
          console.error('Failed to parse saved driver details', e);
        }
      }
      if (savedRideId) {
        const parsedRideId = parseInt(savedRideId);
        setActiveRideId(parsedRideId);
        setRatingRideId(parsedRideId);
      }

      // Clean up session storage
      sessionStorage.removeItem('gcash_assigned_driver');
      sessionStorage.removeItem('gcash_ride_id');
      sessionStorage.removeItem('active_ride_id_for_gcash');

      // Clear ride markers/routes and set completed state
      setStatus('completed');
      setMarkers([]);
      setRouteCoordinates(null);

      // Trigger the rating modal quickly (reduced delay for snappiness)
      setTimeout(() => {
        setShowRating(true);
      }, 400);
      return; // Skip active ride fetch since this ride was just completed
    }

    const fetchActiveRide = async () => {
      try {
        const res = await api.get('/rides/active_ride/');
        if (res.data) {
          const ride = res.data;
          setActiveRideId(ride.id);
          if (ride.share_token) setCachedShareToken(ride.share_token);
          setPickup(ride.pickup_address);
          setDest(ride.dest_address);
          setFare(ride.fare);
          if (ride.payment_method) setPaymentMethod(ride.payment_method);

          if (ride.status === 'requested') {
            const requestedTime = new Date(ride.requested_at).getTime();
            const elapsedSeconds = Math.floor((Date.now() - requestedTime) / 1000);
            const totalWaitTime = ride.targeted_driver_id ? 30 : 180;
            const remaining = totalWaitTime - elapsedSeconds;

            if (remaining > 0) {
              setStatus('requesting');
              setRequestTimeRemaining(remaining);
            } else {
              // Stale request has expired: cancel on server and reset to idle dashboard
              console.log('Stale ride request detected on mount. Auto-cancelling.');
              try {
                await api.patch(`/rides/${ride.id}/`, { status: 'cancelled' });
              } catch (err) {
                console.error('Failed to cancel stale ride on server', err);
              }
              setStatus('idle');
              setPickup('');
              setDest('');
              setFare(0);
              setActiveRideId(null);
              setSelectedDriverId(null);
              setMarkers([]);
              setRouteCoordinates(null);
            }
          } else if (ride.status === 'accepted') {
            setStatus('matched');
            setAssignedDriver(ride.driver);
            // Pre-cache share token for instant iOS share (must be before button tap)
            if (ride.share_token) setCachedShareToken(ride.share_token);
            // Play chime ONCE when polling detects a newly accepted ride
            if (!notifiedMatchedRideIds.current.has(ride.id)) {
              addNotifiedMatchedRide(ride.id);
              playSound('chime');
              notify('Driver Found!', 'A driver has accepted your ride request.');
            }
          } else if (ride.status === 'on_route') {
            setStatus('ongoing');
            setAssignedDriver(ride.driver);
            // Pre-cache share token for ongoing ride too
            if (ride.share_token) setCachedShareToken(ride.share_token);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playSound, notify]);

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
    const interval = setInterval(fetchDrivers, 8000); // Poll every 8s for near-realtime freshness
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCenter.lat, userCenter.lng]);

  // ── Sync nearbyDriverList → map markers (single source of truth) ────────────
  // This effect runs every time the REST poll returns (every 8s) AND every time
  // a WebSocket update patches the list. It replaces all driver markers atomically,
  // so drivers appear immediately on first load without waiting for WS events.
  useEffect(() => {
    if (status !== 'idle') {
      // Remove all idle driver icons when passenger is in an active ride
      setMarkers(prev => prev.filter(m => !m.isDriver || m.title === 'Driver'));
      return;
    }
    setMarkers(prev => {
      const nonDriverMarkers = prev.filter(m => !m.isDriver);
      const driverMarkers = nearbyDriverList
        .filter(d => d.lat && d.lng && !isNaN(parseFloat(d.lat)) && !isNaN(parseFloat(d.lng)))
        .map(d => ({
          id: d.id,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lng),
          title: 'Trike Driver',
          info: `Available\nVehicle: ${d.vehicle_model || 'Tricycle'}\nPlate: ${d.vehicle_plate || 'N/A'}`,
          isDriver: true,
        }));
      return [...nonDriverMarkers, ...driverMarkers];
    });
  }, [nearbyDriverList, status]);

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
  // Track which ride IDs already triggered the "driver found" chime.
  // Seeded from sessionStorage so the dedup survives a page refresh.
  const notifiedMatchedRideIds = React.useRef((() => {
    try {
      const stored = sessionStorage.getItem('notified_matched_rides_p');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  })());
  const addNotifiedMatchedRide = (id) => {
    notifiedMatchedRideIds.current.add(id);
    try {
      sessionStorage.setItem('notified_matched_rides_p', JSON.stringify([...notifiedMatchedRideIds.current]));
    } catch { }
  };

  // Track which ride IDs already triggered the "ride started" chime.
  const notifiedOngoingRideIds = React.useRef((() => {
    try {
      const stored = sessionStorage.getItem('notified_ongoing_rides_p');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  })());
  const addNotifiedOngoingRide = (id) => {
    notifiedOngoingRideIds.current.add(id);
    try {
      sessionStorage.setItem('notified_ongoing_rides_p', JSON.stringify([...notifiedOngoingRideIds.current]));
    } catch { }
  };

  // Track which ride IDs already triggered the "ride completed" chime.
  const notifiedCompletedRideIds = React.useRef((() => {
    try {
      const stored = sessionStorage.getItem('notified_completed_rides_p');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  })());
  const addNotifiedCompletedRide = (id) => {
    notifiedCompletedRideIds.current.add(id);
    try {
      sessionStorage.setItem('notified_completed_rides_p', JSON.stringify([...notifiedCompletedRideIds.current]));
    } catch { }
  };

  // Handle driver requesting payment via WebSocket
  useEffect(() => {
    if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.msgType === 'payment_request') {
        if (paymentMethod === 'gcash') {
          setShowGCashPayment(true);
        } else {
          setShowPayment(true);
        }
      }
    }
  }, [messages, paymentMethod]);

  // Send live passenger location to driver.
  // Key fixes:
  //  • `connected` is in the dep array — fires immediately when the WebSocket
  //    first opens, capturing any gpsLocation that arrived while WS was still connecting.
  //  • Without this, sends during WS handshake are silently dropped and the driver's
  //    map shows a stale pickup pin until the passenger physically moves again.
  useEffect(() => {
    if (!activeRideId) return;
    if (status !== 'matched' && status !== 'ongoing') return;
    if (!gpsLocation) return;
    if (!connected) return; // wait for WebSocket handshake to complete

    sendLocation(
      gpsLocation.lat,
      gpsLocation.lng,
      gpsLocation.heading ?? 0,
      gpsLocation.accuracy ?? null,
    );
  }, [activeRideId, status, gpsLocation, sendLocation, connected]);

  // Heartbeat: resend location every 5 s even if GPS hasn't moved.
  // Without this, a stationary passenger never triggers the above effect after
  // the first send, so the driver's map freezes on the last received position.
  useEffect(() => {
    if (!activeRideId) return;
    if (status !== 'matched' && status !== 'ongoing') return;
    if (!connected) return;

    const heartbeat = setInterval(() => {
      const loc = gpsLocationRef.current;
      if (!loc) return;
      sendLocation(
        loc.lat,
        loc.lng,
        loc.heading ?? 0,
        loc.accuracy ?? null,
      );
    }, 5000);

    return () => clearInterval(heartbeat);
  }, [activeRideId, status, connected, sendLocation]);

  // Handle Real-time Driver Location Updates (WebSocket → patch nearbyDriverList)
  // Instead of writing to markers directly (which caused a race condition with the
  // REST-based sync effect), we patch nearbyDriverList. This triggers the sync
  // effect above, which atomically rebuilds the marker list — single source of truth.
  useEffect(() => {
    if (!driverLocation) return;

    // When passenger is in an active ride, WS idle-driver updates are irrelevant
    if (status !== 'idle') return;

    // Driver went offline — remove from list (sync effect will clear the marker)
    if (driverLocation.is_online === false || driverLocation.is_online !== true) {
      setNearbyDriverList(prev => prev.filter(d => d.id !== driverLocation.id));
      setNearbyDrivers(prev => Math.max(0, prev - 1));
      return;
    }

    // Validate coordinates before patching
    const markerLat = parseFloat(driverLocation.lat);
    const markerLng = parseFloat(driverLocation.lng);
    if (isNaN(markerLat) || isNaN(markerLng)) {
      console.warn('Driver location update has invalid coordinates, skipping:', driverLocation);
      return;
    }

    // Patch lat/lng in-place for existing driver, or add new driver to list
    setNearbyDriverList(prev => {
      const idx = prev.findIndex(d => d.id === driverLocation.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], lat: markerLat, lng: markerLng };
        return updated;
      }
      // New driver came online between REST polls — add them immediately
      setNearbyDrivers(c => c + 1);
      return [...prev, {
        id: driverLocation.id,
        username: driverLocation.username || 'Trike Driver',
        lat: markerLat,
        lng: markerLng,
        vehicle_model: driverLocation.vehicle_model || null,
        vehicle_plate: driverLocation.vehicle_plate || null,
        is_online: true,
      }];
    });
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
        if (matchedRide.share_token) {
          setCachedShareToken(matchedRide.share_token);
        }
        // Play chime only if not already played by WebSocket path
        if (!notifiedMatchedRideIds.current.has(matchedRide.id)) {
          addNotifiedMatchedRide(matchedRide.id);
          playSound('chime');
          notify('Driver Found!', 'A driver has accepted your ride request.');
        }
      }
    }

    // Real-time Fare Updates
    if (systemEvent && systemEvent.type === 'config_update') {
      computeFare();
    }
  }, [systemEvent, computeFare, activeRideId, status, playSound, notify]);

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
        if (wsData.data && wsData.data.share_token) {
          setCachedShareToken(wsData.data.share_token);
        }
        // Play chime only once per ride (guard against system event also firing)
        if (activeRideId && !notifiedMatchedRideIds.current.has(activeRideId)) {
          addNotifiedMatchedRide(activeRideId);
          playSound('chime');
          notify('Driver Found!', 'A driver has accepted your ride request.');
        }
      }
      if (newStatus === 'driver_rejected') {
        setStatus('idle');
        setSelectedDriverId(null);
        setActiveRideId(null); // Clear active ride to allow re-requesting
        alert(wsData.message || 'The chosen driver is currently unavailable. Please pick another driver.');
      }
      if (newStatus === 'on_route') {
        setStatus('ongoing');
        if (wsData.data && wsData.data.share_token) {
          setCachedShareToken(wsData.data.share_token);
        }
        if (activeRideId && !notifiedOngoingRideIds.current.has(activeRideId)) {
          addNotifiedOngoingRide(activeRideId);
          playSound('chime');
          notify('🚀 Ride Started!', 'Your driver is now en route to the destination.');
        }
      }
      if (newStatus === 'completed') {
        setStatus('arrived');
        if (activeRideId && !notifiedCompletedRideIds.current.has(activeRideId)) {
          addNotifiedCompletedRide(activeRideId);
          playSound('chime');
          notify('🏁 Ride Completed!', 'You have arrived at your destination.');
        }
        // Auto-trigger payment modal based on method
        if (paymentMethod === 'gcash') {
          setShowGCashPayment(true);
        } else {
          setShowPayment(true);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsData, paymentMethod, playSound, notify]);

  // Polling Fallback for Ride Status (Safety Net)
  useEffect(() => {
    let interval;
    if (activeRideId && (status === 'requesting' || status === 'matched')) {
      const checkStatus = async () => {
        try {
          const res = await api.get(`/rides/${activeRideId}/`);
          const serverStatus = res.data.status;
          if (res.data.share_token) {
            setCachedShareToken(res.data.share_token);
          }
          if (serverStatus === 'accepted' && status === 'requesting') {
            setStatus('matched');
            if (res.data.driver) {
              setAssignedDriver(res.data.driver);
            }
          }
          // Also handle if server reports on_route while client shows matched
          if (serverStatus === 'on_route' && status === 'matched') {
            setStatus('ongoing');
          }
          if (serverStatus === 'cancelled') {
            setStatus('idle');
            setActiveRideId(null);
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
            if (selectedDriverId) {
              setShowFallbackButton(true);
            } else {
              // General request timeout: auto-cancel the ride
              cancelRide();
              notify("Booking Timeout", "No drivers are currently available in your area. Please try booking again.");
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status, requestTimeRemaining, selectedDriverId, cancelRide, notify]);

  // Handle Real-time Driver Markers & Dynamic Navigation Routing (Passenger Screen)
  useEffect(() => {
    if (wsData && wsData.lat && wsData.lng && (status === 'matched' || status === 'ongoing')) {
      const driverLat = parseFloat(wsData.lat);
      const driverLng = parseFloat(wsData.lng);

      // Accuracy guard: skip position updates from the driver when their GPS fix is
      // very poor (> 200 m). A bad fix would teleport the driver icon to a wrong
      // location. We still update heading and ETA so the UI stays live; only the
      // map pin position is held at the last known accurate location.
      const driverAccuracy = wsData.accuracy ? parseFloat(wsData.accuracy) : null;
      const hasGoodAccuracy = driverAccuracy === null || driverAccuracy <= 200;

      if (hasGoodAccuracy) {
        // Update map marker only when accuracy is acceptable
        setMarkers(current => {
          const otherMarkers = current.filter(m => m.title !== 'Driver');
          return [
            ...otherMarkers,
            {
              id: 'driver',
              lat: driverLat,
              lng: driverLng,
              title: 'Driver',
              info: status === 'matched' ? 'On the way to pick you up!' : 'Heading to destination!',
              isDriver: true,
              heading: wsData.heading || 0,
              accuracy: driverAccuracy,
              isTracking: isTracking,
              eta: driverEta
            }
          ];
        });
      } else {
        // Poor GPS accuracy — update heading/ETA only, keep pin at last known position
        console.warn('[DriverMarker] Skipping position update: driver accuracy too poor (', driverAccuracy, 'm)');
        setMarkers(current => current.map(m =>
          m.title === 'Driver'
            ? { ...m, heading: wsData.heading || m.heading, eta: driverEta }
            : m
        ));
      }

      // Live Routing Call
      let targetLat, targetLng;
      if (status === 'matched') {
        targetLat = pickupCoordsRef.current?.lat;
        targetLng = pickupCoordsRef.current?.lng;
      } else {
        targetLat = destCoordsRef.current?.lat;
        targetLng = destCoordsRef.current?.lng;
      }

      if (targetLat && targetLng) {
        // Rate-limit: skip if driver has moved less than 10 meters
        const latDiff = Math.abs(driverLat - lastRouteFetchedCoordsRef.current.lat);
        const lngDiff = Math.abs(driverLng - lastRouteFetchedCoordsRef.current.lng);

        if (latDiff >= 0.0001 || lngDiff >= 0.0001 || !routeCoordinates) {
          const fetchLiveRoute = async () => {
            try {
              const osrmUrl = process.env.REACT_APP_OSRM_URL || 'https://router.project-osrm.org/route/v1/driving';
              const res = await fetch(`${osrmUrl}/${driverLng},${driverLat};${targetLng},${targetLat}?overview=full&geometries=geojson`);
              const data = await res.json();
              if (data.code === 'Ok' && data.routes?.length > 0) {
                const pathCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                setRouteCoordinates(pathCoords);

                // OSRM duration is in seconds
                const durationMins = Math.ceil(data.routes[0].duration / 60);
                setDriverEta(durationMins);

                lastRouteFetchedCoordsRef.current = { lat: driverLat, lng: driverLng };
              }
            } catch (err) {
              console.warn("Failed to fetch live routing update:", err);
            }
          };
          fetchLiveRoute();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsData, status, isTracking, driverEta]);

  // Handle status transitions for Grab-style camera fitBounds & secondary routes
  useEffect(() => {
    if (status === 'matched') {
      // Preserve pickup -> dest route as secondary dashed route (shown as dashed preview line)
      if (routeCoordinates && !secondaryRouteCoordinates) {
        setSecondaryRouteCoordinates(routeCoordinates);
      }

      // Reset the one-time driver auto-focus flag so it fires again for this new match
      hasAutoFocusedOnMatchRef.current = false;

      // Immediately center on Passenger GPS + Pickup pin (before driver location arrives)
      const pickupLat = pickupCoordsRef.current?.lat || userCenter.lat;
      const pickupLng = pickupCoordsRef.current?.lng || userCenter.lng;
      setFitBoundsPoints([
        [userCenter.lat, userCenter.lng],
        [pickupLat, pickupLng],
      ]);
      setFitBoundsKey(prev => prev + 1);
    } else if (status === 'ongoing') {
      setSecondaryRouteCoordinates(null);
      // Reset auto-focus flag so ongoing state can also trigger a one-time fit
      hasAutoFocusedOnMatchRef.current = false;

      // Focus camera on Driver + Destination
      if (wsData?.lat && destCoordsRef.current) {
        setFitBoundsPoints([
          [parseFloat(wsData.lat), parseFloat(wsData.lng)],
          [destCoordsRef.current.lat, destCoordsRef.current.lng]
        ]);
        setFitBoundsKey(prev => prev + 1);
      }
    } else if (status === 'idle') {
      setSecondaryRouteCoordinates(null);
      setDriverEta(null);
      hasAutoFocusedOnMatchRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // One-time auto-focus: when first driver location arrives after ride is matched,
  // re-fit bounds to show driver + pickup together — this is the "Grab-style" snap-to-view.
  useEffect(() => {
    if (
      status === 'matched' &&
      wsData?.lat && wsData?.lng &&
      !hasAutoFocusedOnMatchRef.current
    ) {
      hasAutoFocusedOnMatchRef.current = true;
      const driverLat = parseFloat(wsData.lat);
      const driverLng = parseFloat(wsData.lng);
      const pickupLat = pickupCoordsRef.current?.lat || userCenter.lat;
      const pickupLng = pickupCoordsRef.current?.lng || userCenter.lng;
      setFitBoundsPoints([
        [driverLat, driverLng],
        [pickupLat, pickupLng],
      ]);
      setFitBoundsKey(prev => prev + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsData, status]);

  const requestRide = async (e) => {
    e.preventDefault();
    if (!pickup || !dest) return;
    if (isRequestingRide) return; // Prevent duplicate requests

    setIsRequestingRide(true);
    setStatus('requesting');

    try {
      // FIX #5: Re-stamp pickup with the very latest GPS fix at request time.
      // Between computeFare and the user tapping "Request Ride", the GPS may have
      // improved from a cell-tower fix (~100m) to a true GPS fix (~5m). Using
      // gpsLocationRef.current guarantees we always submit the freshest coordinate.
      const currentGps = gpsLocationRef.current;
      if (pickup === 'Current GPS Location' && currentGps) {
        pickupCoordsRef.current = { lat: currentGps.lat, lng: currentGps.lng };
      }
      const realPickupLat = pickupCoordsRef.current?.lat ?? (currentGps?.lat ?? userCenter.lat);
      const realPickupLng = pickupCoordsRef.current?.lng ?? (currentGps?.lng ?? userCenter.lng);

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
      if (createdRide.share_token) setCachedShareToken(createdRide.share_token);

      if (selectedDriverId) {
        setRequestTimeRemaining(30); // 30s wait for preferred driver
        setShowFallbackButton(false);
      } else {
        setRequestTimeRemaining(180); // 3 minutes wait for general broadcast
        setShowFallbackButton(false);
      }

      // REAL-TIME DISPATCH: Ride created, waiting for driver match via WebSocket


    } catch (err) {
      console.error('Failed to create ride', err);
      let errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Failed to request ride';
      if (err.response?.data?.server_error) {
        errorMsg += ` (Server Error: ${err.response.data.server_error})`;
      }
      notify('Booking Failed', errorMsg);
      setStatus('idle');
      setActiveRideId(null); // ✅ Clear stale ride ID so WS doesn't reconnect to a failed ride
    } finally {
      setIsRequestingRide(false);
    }
  };

  const getShareTrackingUrl = (token) => {
    const envWebUrl = process.env.REACT_APP_WEB_URL;
    if (envWebUrl) {
      return `${envWebUrl}/track/${token}`;
    }
    const origin = window.location.origin;
    if (origin.startsWith('capacitor://') || (origin.includes('localhost') && !origin.includes(':3000'))) {
      return `https://trentosmart-system.vercel.app/track/${token}`;
    }
    return `${origin}/track/${token}`;
  };

  const copyTextToClipboard = async (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn("[Clipboard] API writeText failed, attempting fallback...", err);
      }
    }
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) return true;
    } catch (err) {
      console.error("[Clipboard] Fallback copying failed:", err);
    }
    return false;
  };

  // Press and Hold SOS States & Refs
  const [sosHoldProgress, setSosHoldProgress] = useState(0);
  const [isHoldingSos, setIsHoldingSos] = useState(false);
  const sosTimerRef = useRef(null);
  const isTouchActiveRef = useRef(false);
  const isSendingSosRef = useRef(false);
  const [isSendingSos, setIsSendingSos] = useState(false);

  const startSosHold = (e) => {
    // Prevent emulated mouse click event when touch is active
    const isTouchEvent = e.type.startsWith('touch');
    if (isTouchEvent) {
      isTouchActiveRef.current = true;
    } else if (isTouchActiveRef.current) {
      return;
    }

    if (e.cancelable) e.preventDefault();
    if (isSendingSosRef.current) return;

    setIsHoldingSos(true);
    setSosHoldProgress(0);
    const startTime = Date.now();

    sosTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / 1500) * 100, 100); // 1.5 seconds hold duration
      setSosHoldProgress(pct);

      if (pct >= 100) {
        clearInterval(sosTimerRef.current);
        triggerSOS();
        setSosHoldProgress(0);
        setIsHoldingSos(false);
      }
    }, 40);
  };

  const cancelSosHold = (e) => {
    setIsHoldingSos(false);
    if (sosTimerRef.current) {
      clearInterval(sosTimerRef.current);
    }
    setSosHoldProgress(0);

    // Keep touch active active briefly to block emulated mouse events
    if (e && e.type.startsWith('touch')) {
      setTimeout(() => {
        isTouchActiveRef.current = false;
      }, 500);
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (sosTimerRef.current) {
        clearInterval(sosTimerRef.current);
      }
    };
  }, []);

  const triggerSOS = async () => {
    if (isSendingSosRef.current) return;
    isSendingSosRef.current = true;
    setIsSendingSos(true);

    let currentLat = 8.03555; // Fallback to Trento Municipal Hall
    let currentLng = 126.06432;

    if (gpsLocation) {
      // Round to 6 decimal places — model DecimalField(max_digits=9, decimal_places=6)
      // Browser GPS can return 10-15 decimal places which causes 400 Bad Request
      currentLat = parseFloat(gpsLocation.lat.toFixed(6));
      currentLng = parseFloat(gpsLocation.lng.toFixed(6));
    }

    try {
      const res = await api.post('/incidents/', {
        lat: currentLat,
        lng: currentLng,
        ride: activeRideId || null,
        description: activeRideId
          ? `Passenger SOS Triggered during Ride #${activeRideId}`
          : 'Passenger SOS Triggered from Mobile App Dashboard'
      });
      console.log('[SOS] ✅ Emergency signal sent successfully. Incident ID:', res.data?.id, '| Status:', res.status);
      setShowSOS(true);
      setTimeout(() => setShowSOS(false), 5000);
    } catch (err) {
      console.error('[SOS] ❌ Failed to send SOS alert:', err?.response?.status, err?.response?.data || err.message);
      alert(`⚠️ SOS signal failed to send (${err?.response?.status || 'Network Error'}). Please retry or call emergency services directly.`);
    } finally {
      isSendingSosRef.current = false;
      setIsSendingSos(false);
    }
  };

  const completeAndPay = async () => {
    // Validate fare before proceeding
    if (!fare || fare <= 0) {
      alert('Invalid fare amount. Please try again.');
      return;
    }

    if (paymentMethod === 'gcash') {
      if (assignedDriver) {
        sessionStorage.setItem('gcash_assigned_driver', JSON.stringify(assignedDriver));
      }
      if (activeRideId) {
        sessionStorage.setItem('active_ride_id_for_gcash', activeRideId.toString());
      }
      setShowGCashPayment(true);
    } else if (paymentMethod !== 'cash') {
      setShowPayment(true);
    } else {
      // Cash payment: the driver's complete/ endpoint already marked the ride completed.
      // Passenger only needs to navigate to the rating screen.
      // Snapshot rideId + driver BEFORE any state changes.
      setRatingRideId(activeRideId);
      setRatingDriver(assignedDriver);
      setStatus('completed');
      setMarkers([]);
      setRouteCoordinates(null);

      // Show rating modal quickly
      setTimeout(() => {
        setShowRating(true);
      }, 400);
    }
  };

  const handleGCashSuccess = async (transactionRef) => {
    try {
      // Verify payment with backend before completing ride
      const verifyRes = await api.get('/payments/gcash/verify/', {
        params: { source_id: transactionRef, ride_id: activeRideId }
      });

      if (!verifyRes.data.success) {
        throw new Error('Payment verification failed. Please contact support.');
      }

      // Snapshot rideId + driver BEFORE clearing state
      setRatingRideId(activeRideId);
      setRatingDriver(assignedDriver);

      setShowGCashPayment(false);
      setStatus('completed');
      setMarkers([]);
      setRouteCoordinates(null);

      // Show success message
      alert(`Payment successful! Reference: ${transactionRef.slice(0, 8)}...`);

      // Show rating modal quickly
      setTimeout(() => {
        setShowRating(true);
      }, 400);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Payment verification failed';
      alert(`Payment Error: ${errorMsg}. Please try again or contact support.`);
      setShowGCashPayment(false);
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
        {(() => {
          const visibleBroadcasts = broadcasts.filter(b => !dismissedBroadcasts.includes(b.id));
          if (visibleBroadcasts.length === 0) return null;
          return (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-2 flex items-center gap-2">
                <Bell size={12} className="text-primary" /> LGU Announcements
              </h3>
              {visibleBroadcasts.slice(0, 2).map((b, idx) => (
                <motion.div
                  key={b.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`p-4 rounded-3xl border-2 flex items-start gap-4 shadow-lg cursor-pointer hover:scale-[1.02] transition-all relative group ${b.is_critical ? 'bg-red-50 border-red-100' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5'}`}
                >
                  <div
                    onClick={() => {
                      setCurrentBroadcast(b);
                      setShowBroadcastModal(true);
                    }}
                    className="flex flex-1 items-start gap-4 min-w-0"
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
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismissBroadcast(b.id);
                    }}
                    className="absolute top-2 right-2 p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all shadow-sm"
                    title="Dismiss Announcement"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              ))}
              {visibleBroadcasts.length > 2 && (
                <button
                  onClick={() => setShowAllBroadcastsModal(true)}
                  className="w-full py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-colors text-center"
                >
                  View All Announcements ({visibleBroadcasts.length})
                </button>
              )}
            </div>
          );
        })()}

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
                onClick={async () => {
                  if (gpsLocation) {
                    // FIX #1: Stamp pickupCoordsRef immediately with the current GPS fix
                    // so computeFare never has to wait for an async geocode call to set it.
                    pickupCoordsRef.current = { lat: gpsLocation.lat, lng: gpsLocation.lng };
                    // Try to get a human-readable label via reverse geocode.
                    // Fall back to the raw coordinate string if Nominatim is slow/offline.
                    try {
                      const label = await reverseGeocode(gpsLocation.lat, gpsLocation.lng);
                      setPickup(label || `${gpsLocation.lat.toFixed(5)}, ${gpsLocation.lng.toFixed(5)}`);
                    } catch {
                      setPickup(`${gpsLocation.lat.toFixed(5)}, ${gpsLocation.lng.toFixed(5)}`);
                    }
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

            {/* Always-visible Pin on Map button */}
            {status === 'idle' && (
              <button
                type="button"
                onClick={() => {
                  setMapTapMode(true);
                  setShowDestSuggestions(false);
                  // On mobile, scroll map into view smoothly
                  setTimeout(() => {
                    const mapEl = document.getElementById('passenger-map-container');
                    if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
                className={`w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 transition-all text-sm font-bold ${mapTapMode
                    ? 'bg-primary text-secondary border-primary shadow-lg shadow-primary/20 animate-pulse'
                    : 'bg-white dark:bg-slate-800 text-secondary dark:text-white border-slate-200 dark:border-white/10 hover:border-primary hover:text-primary'
                  }`}
              >
                <MapPin size={16} className={mapTapMode ? 'text-secondary' : 'text-primary'} />
                <span>{mapTapMode ? '📍 Tap the map below to drop your pin…' : '📍 Pin Custom Location on Map'}</span>
              </button>
            )}

            {status === 'idle' && (
              <div className="pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Quick Places</p>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none px-1">
                  {Array.isArray(savedPlaces) && savedPlaces.map((place) => (
                    <div key={place.id} className="shrink-0">
                      <motion.button
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedPlaceAction(place)}
                        className="flex flex-col items-center gap-2 group/btn"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-center text-slate-400 group-hover/btn:bg-primary group-hover/btn:text-secondary group-hover/btn:border-primary transition-all">
                          {getCategoryIcon(place.category)}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate w-14 text-center">{place.name}</span>
                      </motion.button>
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

            {/* ── Booking Info Card: shows as soon as both pickup & dest are set ── */}
            {(isFetchingFare || fare > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="rounded-3xl overflow-hidden border border-slate-200 shadow-lg shadow-slate-100"
              >
                {/* ── Fare Header ── */}
                <div className="bg-secondary px-5 py-4">
                  <div className="flex items-center justify-between">
                    {/* Estimated Fare */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-0.5">Estimated Fare</p>
                      {isFetchingFare ? (
                        <div className="h-10 w-28 bg-white/10 rounded-xl animate-pulse" />
                      ) : (
                        <motion.p
                          key={fare}
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="text-4xl font-black text-primary tracking-tight"
                        >
                          ₱{fare}
                        </motion.p>
                      )}
                    </div>
                    {/* Distance & ETA */}
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-0.5">Distance & ETA</p>
                      {isFetchingFare ? (
                        <div className="space-y-1.5">
                          <div className="h-5 w-20 bg-white/10 rounded-lg animate-pulse ml-auto" />
                          <div className="h-3.5 w-14 bg-white/10 rounded-lg animate-pulse ml-auto" />
                        </div>
                      ) : (
                        <motion.div key={distance} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <p className="text-lg font-black text-white">{distance} <span className="text-sm font-bold text-white/60">km</span></p>
                          <p className="text-xs text-white/60 font-semibold">~{estimatedTime} mins</p>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Fare Breakdown ── */}
                <div className="bg-white px-5 pt-4 pb-3 space-y-2.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Fare Breakdown</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">Base Fare</span>
                    {isFetchingFare ? <div className="h-3.5 w-12 bg-slate-100 rounded animate-pulse" /> : <span className="text-xs font-black text-secondary">₱{fareParams.base}</span>}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">Rate per km</span>
                    {isFetchingFare ? <div className="h-3.5 w-16 bg-slate-100 rounded animate-pulse" /> : <span className="text-xs font-black text-secondary">₱{fareParams.perKm} / km</span>}
                  </div>
                  {surgeInfo.isSurge && !isFetchingFare && (
                    <div className="flex justify-between items-center bg-orange-50 px-3 py-1.5 rounded-xl">
                      <span className="text-xs font-bold text-orange-600">⚡ High Demand (×{surgeInfo.multiplier})</span>
                      <span className="text-xs font-black text-orange-600">+₱{(fare - (fare / surgeInfo.multiplier)).toFixed(0)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-100 pt-2 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600">Total</span>
                    {isFetchingFare ? <div className="h-4 w-14 bg-slate-100 rounded animate-pulse" /> : <span className="text-sm font-black text-secondary">₱{fare}</span>}
                  </div>
                </div>

                {/* ── Ride Details: Landmark, Notes, Pax Count ── */}
                <div className="bg-slate-50 px-5 py-4 space-y-3 border-t border-slate-100">
                  {/* Nearest Landmark */}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1.5">
                      <span>📍</span> Nearest Landmark <span className="normal-case font-normal">(helps driver find you)</span>
                    </label>
                    <input
                      type="text"
                      value={nearestLandmark}
                      onChange={(e) => setNearestLandmark(e.target.value)}
                      placeholder="e.g. Near Public Market, Beside Mercury Drug…"
                      className="w-full bg-white text-secondary placeholder-slate-300 border-2 border-slate-200 focus:border-primary rounded-xl px-3 py-2.5 text-xs font-medium outline-none transition-all"
                    />
                  </div>

                  {/* Ride Notes */}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1.5">
                      <span>📝</span> Ride Instructions <span className="normal-case font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={rideNotes}
                      onChange={(e) => setRideNotes(e.target.value)}
                      placeholder="e.g. Blue Gate, Waiting Outside, Second House…"
                      className="w-full bg-white text-secondary placeholder-slate-300 border-2 border-slate-200 focus:border-primary rounded-xl px-3 py-2.5 text-xs font-medium outline-none transition-all"
                    />
                  </div>

                  {/* Number of Passengers */}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                      👥 Passengers <span className="normal-case font-normal">(max 5)</span>
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setPassengerCount(num)}
                          className={`w-10 h-10 rounded-xl text-sm font-black transition-all border-2 ${passengerCount === num
                            ? 'bg-secondary text-white border-secondary shadow-md'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-secondary/40'
                            }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Payment Method ── */}
                <div className="bg-white px-5 py-4 border-t border-slate-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Payment Method</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-3 px-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 border-2 transition-all ${paymentMethod === 'cash'
                        ? 'bg-secondary text-white border-secondary shadow-lg'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-secondary/40'}`}
                    >
                      <Wallet size={16} /> Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('gcash')}
                      className={`py-3 px-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 border-2 transition-all ${paymentMethod === 'gcash'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300'}`}
                    >
                      <CreditCard size={16} /> GCash
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
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3 ${selectedDriverId === driver.id ? 'border-primary bg-primary/5 shadow-md scale-[1.02]' : 'border-slate-100 bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5 hover:border-primary/30'}`}
                    >
                      <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                        <img
                          src={ensureImageUrl(driver.profile_picture, driver.username)}
                          alt="Driver"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-black text-secondary dark:text-white truncate">{driver.username}</p>
                          <div className="flex items-center gap-1 text-yellow-600 font-bold text-xs">
                            <Star size={10} className="fill-yellow-400 mr-0.5" />
                            {driver.average_rating > 0 ? parseFloat(driver.average_rating).toFixed(1) : '5.0 (New)'}
                            {driver.average_rating >= 4.5 && (
                              <span className="ml-1 text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Top Rated</span>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                          {driver.vehicle_model || 'Trike'} • {driver.vehicle_plate || 'No Plate'} • {driver.sidecar_type || 'Standard'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            UNIT {driver.body_number || '---'}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 italic">
                            {driver.distance !== null && driver.distance !== undefined ? `${driver.distance} km away` : 'Calculating…'}
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
                  {requestTimeRemaining > 0 && (
                    <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">
                      {selectedDriverId
                        ? `Driver has ${requestTimeRemaining}s to respond`
                        : `Finding drivers... request expires in ${Math.floor(requestTimeRemaining / 60)}m ${requestTimeRemaining % 60}s`
                      }
                    </p>
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
                        setRequestTimeRemaining(180); // 3 minutes for general broadcast
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

        {/* Safety Center Widget Block */}
        <div className="glass-card p-5 rounded-[2rem] border-2 border-slate-100 dark:border-white/5 relative overflow-hidden shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-red-500/10 dark:bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center shadow-inner">
              <Shield size={24} className="animate-pulse" />
            </div>
            <div className="flex-1">
              <h4 className="text-secondary dark:text-white font-black text-sm uppercase tracking-wider">Emergency Services</h4>
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                Active LGU Dispatch Protection
              </p>
            </div>
          </div>

          <button
            type="button"
            onMouseDown={startSosHold}
            onMouseUp={cancelSosHold}
            onMouseLeave={cancelSosHold}
            onTouchStart={startSosHold}
            onTouchEnd={cancelSosHold}
            className="w-full relative overflow-hidden bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all transform active:scale-95 duration-200 select-none uppercase tracking-wider text-xs md:text-sm border-2 border-red-500/50"
            style={{ touchAction: 'none' }}
          >
            {/* Hold progress bar background overlay */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-red-800 transition-all duration-75"
              style={{ width: `${sosHoldProgress}%`, opacity: 0.8 }}
            />

            {/* Alert content */}
            <div className="relative z-10 flex items-center gap-2">
              <AlertTriangle size={18} className="animate-bounce" />
              <span>
                {isHoldingSos
                  ? `Holding... ${Math.round(sosHoldProgress)}%`
                  : 'Press & Hold to Trigger SOS'}
              </span>
            </div>
          </button>
        </div>

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
                  <div className="grid grid-cols-4 gap-2.5 py-3">
                    <button
                      type="button"
                      onClick={() => setShowChat(prev => !prev)}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${showChat ? 'bg-secondary text-white border-secondary shadow-lg shadow-secondary/20' : 'bg-slate-50 text-slate-700 border-slate-200/60 hover:bg-slate-100'}`}
                    >
                      <MessageSquare size={16} className={showChat ? 'text-primary' : 'text-slate-500'} />
                      <span className="text-[9px] font-black uppercase tracking-wider">Chat</span>
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
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${isTracking ? 'bg-primary text-secondary border-primary shadow-lg shadow-primary/20' : 'bg-slate-50 text-slate-700 border-slate-200/60 hover:bg-slate-100'}`}
                    >
                      <Navigation size={16} className={isTracking ? 'animate-pulse text-secondary' : 'text-slate-500'} />
                      <span className="text-[9px] font-black uppercase tracking-wider">{isTracking ? 'Tracking' : 'Track'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const token = cachedShareToken;
                        if (!token) { alert('Tracking link not ready yet. Please try again.'); return; }
                        const url = getShareTrackingUrl(token);
                        if (navigator.share) {
                          navigator.share({ title: "My Live Ride", text: "Track my ride live on TrentoSmart 🚗", url }).catch(() => { });
                        } else {
                          const success = await copyTextToClipboard(url);
                          if (success) {
                            setShareCopied(true);
                            setTimeout(() => setShareCopied(false), 2500);
                          } else {
                            alert(`Copy failed. Please manually copy this link: ${url}`);
                          }
                        }
                      }}
                      className={`p-3 border rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm ${shareCopied ? 'bg-green-50 text-green-600 border-green-200' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-100/60'
                        }`}
                    >
                      <Share2 size={16} className={shareCopied ? 'text-green-500' : 'text-blue-500'} />
                      <span className={`text-[9px] font-black uppercase tracking-wider ${shareCopied ? 'text-green-600' : 'text-blue-600'}`}>{shareCopied ? 'Copied!' : 'Share'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => alert("Initiating secure proxy call. Driver number is hidden for privacy.")}
                      className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Phone size={16} className="text-slate-500" />
                      <span className="text-[9px] font-black uppercase tracking-wider">Call</span>
                    </button>
                  </div>

                  {/* Trip Status */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-green-600">Trip Status</p>
                    </div>
                    <p className="text-sm font-bold text-green-700">
                      {status === 'matched'
                        ? `Driver is arriving in ${driverEta != null ? `${driverEta} min` : 'a few minutes'}`
                        : 'Trip in progress to destination!'}
                    </p>
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
      <div id="passenger-map-container" className="flex-1 min-h-[350px] md:min-h-[500px] relative rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white">
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
          secondaryRouteCoordinates={secondaryRouteCoordinates}
          fitBoundsPoints={fitBoundsPoints}
          fitBoundsKey={fitBoundsKey}
          onMapClick={async (lat, lng) => {
            if (!mapTapMode) return;
            setMapTapMode(false);
            destCoordsRef.current = { lat, lng };

            // Placeholder while geocoding
            const coordLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            setDest('Resolving location…');
            setNearestLandmark('');

            // Drop the pin immediately so the passenger sees it
            setMarkers(prev => [
              ...prev.filter(m => !m.isDestination),
              {
                id: 'dest', lat, lng,
                title: '📍 Custom Pin',
                info: `Fetching address…`,
                isDestination: true,
                autoOpenPopup: true,
                forceFocus: Date.now(),
              },
            ]);

            // Resolve real address in background
            const placeName = await reverseGeocode(lat, lng);
            const finalLabel = placeName || coordLabel;
            setDest(finalLabel);

            // Update the pin popup with the resolved name
            setMarkers(prev => prev.map(m =>
              m.id === 'dest'
                ? { ...m, title: '📍 ' + finalLabel, info: `Custom pin · ${coordLabel}` }
                : m
            ));
          }}
          mapClickEnabled={mapTapMode}
          onSelectPickup={status === 'idle' ? handleSelectPickup : null}
          onSelectDestination={status === 'idle' ? handleSelectDestination : null}
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
        <div className="absolute top-6 right-6 flex flex-col items-end gap-3 z-[1000]">
          {/* Floating Refresh Button (helps PWA / full-screen users recover from connection drops) */}
          <button
            onClick={() => window.location.reload()}
            className="w-10 h-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md text-slate-700 dark:text-slate-200 rounded-full shadow-lg border border-slate-100 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform pointer-events-auto cursor-pointer"
            title="Refresh App"
          >
            <RefreshCw size={18} />
          </button>
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
          <div className="hidden md:flex bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-slate-100 items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <MapPin size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Service Area</p>
              <p className="text-sm font-bold text-secondary">Trento, Agusan del Sur</p>
            </div>
          </div>
          <div className="hidden md:flex bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-slate-100 items-center gap-4">
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
                const token = cachedShareToken;
                if (!token) { alert('Tracking link not ready yet. Please try again.'); return; }
                const url = getShareTrackingUrl(token);
                if (navigator.share) {
                  navigator.share({ title: "My Live Ride", text: "Track my ride live on TrentoSmart 🚗", url }).catch(() => { });
                } else {
                  const success = await copyTextToClipboard(url);
                  if (success) {
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2500);
                  } else {
                    alert(`Copy failed. Please manually copy this link: ${url}`);
                  }
                }
              }}
              className={`hidden md:flex p-4 rounded-2xl shadow-lg items-center gap-3 hover:scale-105 transition-all border active:scale-95 ${shareCopied ? 'bg-green-600 border-green-500/25' : 'bg-blue-600 hover:bg-blue-700 border-blue-500/25'
                } text-white`}
            >
              <Share2 size={20} className="text-white" />
              <span className="text-sm font-bold">{shareCopied ? 'Link Copied!' : 'Share Ride'}</span>
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
          {(showSOS || isSendingSos) && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute inset-0 z-50 bg-red-600/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 text-white"
            >
              {isSendingSos ? (
                <>
                  <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-8">
                    <div className="w-16 h-16 border-4 border-t-transparent border-white rounded-full animate-spin"></div>
                  </div>
                  <h2 className="text-4xl font-extrabold mb-4 uppercase tracking-tighter animate-pulse">Sending SOS...</h2>
                  <p className="text-xl max-w-md opacity-90">
                    Connecting to Trento LGU Dispatcher emergency services. Please wait.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center animate-ping mb-8">
                    <AlertTriangle size={64} />
                  </div>
                  <h2 className="text-4xl font-extrabold mb-4 uppercase tracking-tighter">Emergency Signal Sent!</h2>
                  <p className="text-xl max-w-md opacity-90">
                    Authorities in Trento and your emergency contacts have been notified via SMS with your exact live location. Stay calm and remain where you are.
                  </p>
                </>
              )}
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
          // Snapshot rideId + driver BEFORE clearing state, so the rating modal
          // always receives a valid rideId regardless of subsequent state resets.
          setRatingRideId(activeRideId);
          setRatingDriver(assignedDriver);
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
          setRatingRideId(null);
          setRatingDriver(null);
          setStatus('idle');
          setFare(0);
          setPickup('');
          setDest('');
          setActiveRideId(null);
          setAssignedDriver(null);
          setRouteCoordinates(null);
        }}
        rideId={ratingRideId || activeRideId}
        targetName={ratingDriver?.username || assignedDriver?.username || 'Assigned Driver'}
        targetPhoto={
          ratingDriver?.profile_picture_url ||
          ratingDriver?.profile_picture ||
          assignedDriver?.profile_picture_url ||
          assignedDriver?.profile_picture ||
          null
        }
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

      {/* All LGU Announcements List Modal */}
      <AnimatePresence>
        {showAllBroadcastsModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden relative border border-slate-100 dark:border-white/5"
            >
              <div className="bg-gradient-to-r from-secondary to-primary-dark p-6 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
                    <Bell size={20} className="text-primary animate-pulse" /> All LGU Bulletins
                  </h2>
                  <p className="text-[10px] font-bold opacity-80 mt-1">History of official announcements and traffic advisories</p>
                </div>
                <button
                  onClick={() => setShowAllBroadcastsModal(false)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                {broadcasts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Megaphone size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-bold">No announcements yet.</p>
                  </div>
                ) : (
                  broadcasts.map((b) => {
                    const isDismissed = dismissedBroadcasts.includes(b.id);
                    return (
                      <div
                        key={b.id}
                        onClick={() => {
                          setCurrentBroadcast(b);
                          setShowBroadcastModal(true);
                        }}
                        className={`p-4 rounded-2xl border-2 flex items-start gap-4 cursor-pointer hover:scale-[1.01] transition-all relative group ${b.is_critical ? 'bg-red-50 border-red-100' : 'bg-slate-50 dark:bg-slate-900/55 border-slate-100 dark:border-white/5'}`}
                      >
                        <div className={`p-2.5 rounded-xl shrink-0 ${b.is_critical ? 'bg-red-500 text-white' : 'bg-primary text-secondary'}`}>
                          <Megaphone size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[8px] font-black uppercase tracking-widest ${b.is_critical ? 'text-red-600' : 'text-primary-dark'}`}>
                              {b.is_critical ? 'Urgent Alert' : 'City News'}
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold">{new Date(b.created_at).toLocaleDateString()}</span>
                            {isDismissed && (
                              <span className="text-[8px] bg-slate-200 dark:bg-slate-800 text-slate-500 font-black px-1.5 py-0.25 rounded-md uppercase tracking-widest">Hidden</span>
                            )}
                          </div>
                          <h4 className={`text-xs font-black truncate ${isDismissed ? 'text-slate-400 line-through' : 'text-secondary dark:text-white'}`}>{b.title}</h4>
                          <p className={`text-[10px] line-clamp-2 mt-0.5 ${isDismissed ? 'text-slate-400' : 'text-slate-500'}`}>{b.message}</p>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isDismissed) {
                              setDismissedBroadcasts(prev => {
                                const updated = prev.filter(id => id !== b.id);
                                localStorage.setItem('dismissed_broadcasts_p', JSON.stringify(updated));
                                return updated;
                              });
                            } else {
                              handleDismissBroadcast(b.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-primary transition-all border border-slate-200/50 dark:border-white/5 shadow-sm text-[9px] font-bold uppercase tracking-wider whitespace-nowrap z-10"
                        >
                          {isDismissed ? 'Show' : 'Hide'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {dismissedBroadcasts.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 flex justify-end">
                  <button
                    onClick={() => {
                      setDismissedBroadcasts([]);
                      localStorage.removeItem('dismissed_broadcasts_p');
                    }}
                    className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest transition-colors"
                  >
                    Restore All Hidden Bulletins
                  </button>
                </div>
              )}
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

      {/* Saved Place Quick Actions Modal */}
      <AnimatePresence>
        {selectedPlaceAction && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl relative border border-slate-100 dark:border-white/5"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 text-secondary dark:text-primary flex items-center justify-center">
                    {getCategoryIcon(selectedPlaceAction.category)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-secondary dark:text-white uppercase tracking-wider">{selectedPlaceAction.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 line-clamp-1">{selectedPlaceAction.address}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlaceAction(null)}
                  className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-secondary transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    setDest(selectedPlaceAction.address);
                    setSelectedPlaceAction(null);
                  }}
                  className="w-full py-4 px-5 rounded-2xl bg-secondary text-white font-black text-xs uppercase tracking-widest hover:scale-[1.01] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-slate-200 dark:shadow-none"
                >
                  <MapPin size={14} className="text-primary" />
                  <span>Set as Destination</span>
                </button>

                <button
                  onClick={() => {
                    setPickup(selectedPlaceAction.address);
                    setSelectedPlaceAction(null);
                  }}
                  className="w-full py-4 px-5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-secondary dark:text-white font-black text-xs uppercase tracking-widest hover:scale-[1.01] transition-transform flex items-center justify-center gap-2"
                >
                  <Navigation size={14} />
                  <span>Set as Pickup Location</span>
                </button>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={() => {
                      setEditingPlace(selectedPlaceAction);
                      setShowPlaceModal(true);
                      setSelectedPlaceAction(null);
                    }}
                    className="py-3 px-4 rounded-xl border-2 border-slate-100 dark:border-white/5 hover:border-primary/50 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Settings size={12} />
                    <span>Edit Place</span>
                  </button>

                  <button
                    onClick={() => {
                      handleDeletePlace(selectedPlaceAction.id);
                      setSelectedPlaceAction(null);
                    }}
                    className="py-3 px-4 rounded-xl border-2 border-red-50 dark:border-red-950/20 hover:border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 font-black text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                  >
                    <X size={12} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
