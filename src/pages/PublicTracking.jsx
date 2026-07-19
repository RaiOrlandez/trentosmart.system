import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import LeafletMap from '../components/LeafletMap';
import { motion, AnimatePresence } from 'framer-motion';
import { Car, ShieldCheck, Phone, AlertTriangle, Wifi, WifiOff, RefreshCw, CheckCircle2, Clock, Navigation } from 'lucide-react';
import useRideTracking from '../hooks/useRideTracking';

// ── OSRM helper ──────────────────────────────────────────────────────────────
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

const fetchOsrmRoute = async (fromLng, fromLat, toLng, toLat) => {
    try {
        // iOS Compatibility Fix: AbortSignal.timeout is not supported in iOS < 16 or WKWebView/Messenger in-app browsers
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(
            `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        const data = await res.json();
        if (data.code === 'Ok' && data.routes?.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            const durationMins = Math.ceil(data.routes[0].duration / 60);
            return { coords, durationMins };
        }
    } catch (err) { 
        console.warn("[OSRM Route] Failed or timed out", err);
    }
    return null;
};

const PublicTracking = () => {
    const { token } = useParams();
    const [rideData, setRideData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rideEnded, setRideEnded] = useState(false); // 410 from REST or 4004 from WS
    const [markers, setMarkers] = useState([]);
    const [lastUpdated, setLastUpdated] = useState(null);
    const fetchIntervalRef = useRef(null);

    // Route coordinates
    const [routeCoordinates, setRouteCoordinates] = useState(null);          // driver → target (live, blue)
    const [secondaryRouteCoordinates, setSecondaryRouteCoordinates] = useState(null); // pickup → dest (static preview)
    const [driverEta, setDriverEta] = useState(null);

    // Rate-limit: only refetch route when driver moves ≥ ~11m (0.0001°)
    const lastRouteFetchedRef = useRef({ lat: null, lng: null });
    const routeFetchingRef = useRef(false);

    const fetchRide = useCallback(async () => {
        try {
            const res = await api.get(`/ride/track/${token}/`);
            if (rideData && res.data.status !== rideData.status) {
                setRouteCoordinates(null);
                lastRouteFetchedRef.current = { lat: null, lng: null };
            }
            setRideData(res.data);
            setLastUpdated(new Date());
            setLoading(false);
        } catch (err) {
            if (err.response?.status === 410) {
                // Ride already ended — show expired screen
                setRideEnded(true);
                setLoading(false);
            } else if (err.response?.status === 404) {
                setError('Invalid or expired tracking link.');
                setLoading(false);
            } else if (!rideData) {
                setError('Could not load ride data. Please refresh.');
                setLoading(false);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // Initial fetch + 10-second polling
    useEffect(() => {
        fetchRide();
        fetchIntervalRef.current = setInterval(fetchRide, 10000);
        return () => clearInterval(fetchIntervalRef.current);
    }, [fetchRide]);

    // iOS Visibility fix — refetch immediately on tab resume
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') fetchRide();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [fetchRide]);

    // WebSocket real-time tracking (guest mode — token IS the share_token)
    const { location: liveLoc, connected } = useRideTracking(rideData?.id, false, true, token);

    // Detect WS close code 4004 (ride ended) via connected state changing to false
    // and liveLoc having a status of completed/cancelled
    useEffect(() => {
        if (liveLoc?.status && ['completed', 'cancelled'].includes(liveLoc.status)) {
            setRideEnded(true);
        }
    }, [liveLoc?.status]);

    // ── Fetch static preview route: pickup → destination (once) ────────────
    useEffect(() => {
        if (!rideData?.pickup_lat || !rideData?.pickup_lng || !rideData?.dest_lat || !rideData?.dest_lng) return;
        if (secondaryRouteCoordinates) return; // already fetched

        fetchOsrmRoute(
            parseFloat(rideData.pickup_lng), parseFloat(rideData.pickup_lat),
            parseFloat(rideData.dest_lng), parseFloat(rideData.dest_lat)
        ).then(result => {
            if (result) setSecondaryRouteCoordinates(result.coords);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rideData?.pickup_lat, rideData?.pickup_lng, rideData?.dest_lat, rideData?.dest_lng]);

    // ── Fetch live route: driver → pickup or destination (rate-limited) ─────
    const fetchLiveRoute = useCallback(async (driverLat, driverLng, targetLat, targetLng) => {
        if (routeFetchingRef.current) return;

        const latDiff = Math.abs(driverLat - (lastRouteFetchedRef.current.lat ?? 999));
        const lngDiff = Math.abs(driverLng - (lastRouteFetchedRef.current.lng ?? 999));
        if (latDiff < 0.0001 && lngDiff < 0.0001 && routeCoordinates) return; // moved < ~11m, skip

        routeFetchingRef.current = true;
        const result = await fetchOsrmRoute(driverLng, driverLat, targetLng, targetLat);
        routeFetchingRef.current = false;

        if (result) {
            setRouteCoordinates(result.coords);
            setDriverEta(result.durationMins);
            lastRouteFetchedRef.current = { lat: driverLat, lng: driverLng };
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeCoordinates]);

    // ── Build markers + trigger live route fetch on driver/liveLoc change ──
    useEffect(() => {
        if (!rideData) return;

        const newMarkers = [];

        // Driver marker — prefer live WS location over REST snapshot
        const dLat = liveLoc?.lat ? parseFloat(liveLoc.lat) : (rideData.driver?.lat ? parseFloat(rideData.driver.lat) : null);
        const dLng = liveLoc?.lng ? parseFloat(liveLoc.lng) : (rideData.driver?.lng ? parseFloat(rideData.driver.lng) : null);

        if (dLat && dLng) {
            newMarkers.push({
                id: 'driver',
                lat: dLat,
                lng: dLng,
                title: rideData.driver?.username || 'Driver',
                info: `Plate: ${rideData.driver?.vehicle_plate || 'N/A'}`,
                isDriver: true,
                profile_picture: rideData.driver?.profile_picture,
                heading: liveLoc?.heading || 0,
                accuracy: liveLoc?.accuracy || null,
                eta: driverEta,
                forceFocus: true
            });

            // Determine route target based on status
            const status = liveLoc?.status || rideData.status;
            const isMatchedOrAccepted = status === 'matched' || status === 'accepted' || status === 'requested';
            let targetLat, targetLng;
            if (isMatchedOrAccepted && rideData.pickup_lat && rideData.pickup_lng) {
                targetLat = parseFloat(rideData.pickup_lat);
                targetLng = parseFloat(rideData.pickup_lng);
            } else if (rideData.dest_lat && rideData.dest_lng) {
                targetLat = parseFloat(rideData.dest_lat);
                targetLng = parseFloat(rideData.dest_lng);
            }

            if (targetLat && targetLng) {
                fetchLiveRoute(dLat, dLng, targetLat, targetLng);
            }
        }

        if (rideData.pickup_lat && rideData.pickup_lng) {
            newMarkers.push({
                id: 'pickup',
                lat: parseFloat(rideData.pickup_lat),
                lng: parseFloat(rideData.pickup_lng),
                title: 'Pickup',
                info: rideData.pickup_address || rideData.pickup,
                isPickup: true
            });
        }

        if (rideData.dest_lat && rideData.dest_lng) {
            newMarkers.push({
                id: 'dest',
                lat: parseFloat(rideData.dest_lat),
                lng: parseFloat(rideData.dest_lng),
                title: 'Destination',
                info: rideData.dest_address || rideData.destination,
                isDestination: true
            });
        }

        setMarkers(newMarkers);

        // Sync status from WS push
        if (liveLoc?.status && liveLoc.status !== rideData.status) {
            setRouteCoordinates(null);
            lastRouteFetchedRef.current = { lat: null, lng: null };
            setRideData(prev => ({ ...prev, status: liveLoc.status }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rideData, liveLoc, driverEta]);

    // ── Render: Loading ─────────────────────────────────────────────────────
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading Ride...</p>
            </div>
        </div>
    );

    // ── Render: Ride Ended ──────────────────────────────────────────────────
    if (rideEnded) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                className="flex flex-col items-center gap-5 text-center max-w-sm"
            >
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center shadow-md">
                    <CheckCircle2 size={40} className="text-green-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 mb-2">Ride Has Ended</h1>
                    <p className="text-slate-500 font-medium text-sm leading-relaxed">
                        This ride has been completed or cancelled.<br />
                        The tracking link is no longer active.
                    </p>
                </div>
                <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 rounded-full border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-widest">
                    <Clock size={13} />
                    Link Expired
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">
                    Powered by TrentoSmart Safety Hub
                </p>
            </motion.div>
        </div>
    );

    // ── Render: Error ───────────────────────────────────────────────────────
    if (error) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-6">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={32} />
            </div>
            <h1 className="text-xl font-bold text-slate-700">{error}</h1>
            <button
                onClick={fetchRide}
                className="mt-6 px-6 py-2.5 bg-blue-600 text-white text-sm font-black rounded-2xl hover:bg-blue-700 transition-all active:scale-95"
            >
                Try Again
            </button>
        </div>
    );

    const statusLabel = rideData.status?.replace(/_/g, ' ') || '';
    const statusColor = rideData.status === 'on_route'
        ? 'bg-blue-100 text-blue-600'
        : rideData.status === 'completed'
        ? 'bg-green-100 text-green-600'
        : rideData.status === 'cancelled'
        ? 'bg-red-100 text-red-600'
        : 'bg-slate-100 text-slate-500';

    const mapCenter = markers[0] || { lat: 8.03555, lng: 126.06432 };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row relative">
            {/* ── Map Area ── */}
            <div className="flex-1 h-[55vh] md:h-screen relative z-0">
                <LeafletMap
                    markers={markers}
                    zoom={15}
                    center={mapCenter}
                    routeCoordinates={routeCoordinates}
                    secondaryRouteCoordinates={secondaryRouteCoordinates}
                />

                {/* Connection status badge */}
                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-2xl backdrop-blur-md border ${
                            connected
                                ? 'bg-green-500/10 border-green-500/20 text-green-600'
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                        }`}
                    >
                        {connected
                            ? <Wifi size={14} className="animate-pulse" />
                            : <WifiOff size={14} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            {connected ? 'Live Sync Active' : 'Reconnecting...'}
                        </span>
                    </motion.div>

                    {/* ETA badge — only show when driver is en route */}
                    <AnimatePresence>
                        {driverEta && (
                            <motion.div
                                key="eta"
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/90 backdrop-blur-md border border-blue-500/30 text-white rounded-full shadow-lg"
                            >
                                <Navigation size={11} />
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                    ~{driverEta} min
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Manual refresh */}
                    <button
                        onClick={fetchRide}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur-md border border-slate-200 rounded-full shadow text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all active:scale-95"
                    >
                        <RefreshCw size={11} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── Info Card ── */}
            <div className="w-full md:w-[380px] h-[45vh] md:h-screen bg-white shadow-2xl z-10 p-6 overflow-y-auto flex flex-col ring-1 ring-black/5">
                {/* Header */}
                <div className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="text-green-500" size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest text-green-600">Secure Ride Tracking</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-800">
                        {rideData.passenger_name || rideData.passenger}'s Ride
                    </h1>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase capitalize ${statusColor}`}>
                            {statusLabel}
                        </span>
                        {lastUpdated && (
                            <span className="text-[10px] text-slate-400 font-bold">
                                · Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        )}
                    </div>
                </div>

                {/* Driver Card */}
                {rideData.driver ? (
                    <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-200 mb-5 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500 opacity-5 rounded-bl-[2rem]"></div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Driver Assigned</h3>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center border-2 border-blue-200 shadow-lg overflow-hidden flex-shrink-0">
                                <img
                                    src={rideData.driver.profile_picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rideData.driver.username}`}
                                    alt="Driver"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="font-black text-xl text-slate-800 tracking-tight truncate">{rideData.driver.username}</p>
                                <div className="flex flex-col gap-1 text-xs text-slate-500 font-bold uppercase tracking-tight">
                                    <span className="flex items-center gap-1.5">
                                        <Car size={12} className="text-blue-500" />
                                        {rideData.driver.vehicle_model}
                                    </span>
                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md inline-block w-max font-black">
                                        {rideData.driver.vehicle_plate}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {/* ETA inside card on mobile */}
                        {driverEta && (
                            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-blue-600">
                                <Navigation size={13} />
                                <span className="text-xs font-black">Estimated arrival: ~{driverEta} min</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mb-5 text-yellow-700 text-sm font-bold flex items-center gap-3">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
                        Looking for a driver...
                    </div>
                )}

                {/* Route Summary */}
                <div className="space-y-0 flex-1">
                    {/* Blue route indicator line */}
                    <div className="flex items-center gap-2 mb-3">
                        <div className="h-1.5 w-8 rounded-full bg-gradient-to-r from-blue-400 to-blue-700 shadow-sm"></div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-500">Live Route Active</span>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex flex-col items-center gap-1 pt-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></div>
                            <div className="w-0.5 flex-1 bg-slate-200 min-h-[30px]"></div>
                            <div className="w-3 h-3 bg-red-500 rounded-full shadow-sm"></div>
                        </div>
                        <div className="flex-1 space-y-5">
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">Pickup Location</p>
                                <p className="font-bold text-slate-700 leading-tight">{rideData.pickup_address || rideData.pickup}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">Destination</p>
                                <p className="font-bold text-slate-700 leading-tight">{rideData.dest_address || rideData.destination}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-5 pt-5 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-3">Powered by TrentoSmart Safety Hub</p>
                    <div className="flex items-center justify-center gap-3">
                        <button className="p-3 bg-blue-50 text-blue-500 rounded-full hover:bg-blue-100 transition-all">
                            <Phone size={18} />
                        </button>
                        <button className="flex-1 bg-slate-800 text-white font-black py-3 rounded-2xl hover:bg-slate-900 transition-all uppercase tracking-widest text-xs">
                            Help Center
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicTracking;
