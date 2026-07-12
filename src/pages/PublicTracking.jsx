import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import LeafletMap from '../components/LeafletMap';
import { motion } from 'framer-motion';
import { Car, ShieldCheck, Phone, AlertTriangle, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import useRideTracking from '../hooks/useRideTracking';

const PublicTracking = () => {
    const { token } = useParams();
    const [rideData, setRideData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [markers, setMarkers] = useState([]);
    const [lastUpdated, setLastUpdated] = useState(null);
    const fetchIntervalRef = useRef(null);

    const fetchRide = useCallback(async () => {
        try {
            const res = await api.get(`/ride/track/${token}/`);
            setRideData(res.data);
            setLastUpdated(new Date());
            setLoading(false);
        } catch (err) {
            console.error(err);
            if (!rideData) {
                setError("Invalid link or ride has expired.");
            }
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // Initial fetch + fast 10-second polling (was 30s)
    useEffect(() => {
        fetchRide();
        fetchIntervalRef.current = setInterval(fetchRide, 10000);
        return () => clearInterval(fetchIntervalRef.current);
    }, [fetchRide]);

    // ── iOS Visibility API fix ──────────────────────────────────────────────
    // iOS Safari aggressively kills WebSocket + halts timers when the screen
    // is locked or the app is backgrounded. When the user brings the tab
    // back to foreground, we immediately re-fetch ride data so the map
    // is up-to-date without waiting for the next poll interval.
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchRide();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [fetchRide]);

    // WebSocket Real-time Tracking (guest mode — token is the share_token)
    const { location: liveLoc, connected } = useRideTracking(rideData?.id, false, true, token);

    useEffect(() => {
        if (!rideData) return;

        const newMarkers = [];

        // Driver Marker (Prioritize Live WebSocket data over REST snapshot)
        const lat = liveLoc?.lat ? parseFloat(liveLoc.lat) : (rideData.driver?.lat ? parseFloat(rideData.driver.lat) : null);
        const lng = liveLoc?.lng ? parseFloat(liveLoc.lng) : (rideData.driver?.lng ? parseFloat(rideData.driver.lng) : null);

        if (lat && lng) {
            newMarkers.push({
                lat,
                lng,
                title: rideData.driver?.username || 'Driver',
                info: `Plate: ${rideData.driver?.vehicle_plate || 'N/A'}`,
                isDriver: true,
                profile_picture: rideData.driver?.profile_picture,
                heading: liveLoc?.heading || 0,
                accuracy: liveLoc?.accuracy || null,
                forceFocus: true
            });
        }

        if (rideData.pickup_lat && rideData.pickup_lng) {
            newMarkers.push({
                lat: parseFloat(rideData.pickup_lat),
                lng: parseFloat(rideData.pickup_lng),
                title: 'Pickup',
                info: rideData.pickup_address || rideData.pickup,
                isPickup: true
            });
        }

        if (rideData.dest_lat && rideData.dest_lng) {
            newMarkers.push({
                lat: parseFloat(rideData.dest_lat),
                lng: parseFloat(rideData.dest_lng),
                title: 'Destination',
                info: rideData.dest_address || rideData.dest,
                isDestination: true
            });
        }

        setMarkers(newMarkers);

        if (liveLoc?.status && liveLoc.status !== rideData.status) {
            setRideData(prev => ({ ...prev, status: liveLoc.status }));
        }
    }, [rideData, liveLoc]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-6">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={32} />
            </div>
            <h1 className="text-xl font-bold text-slate-700">{error}</h1>
        </div>
    );

    const statusLabel = rideData.status?.replace(/_/g, ' ') || '';
    const statusColor = rideData.status === 'on_route'
        ? 'bg-blue-100 text-blue-600'
        : rideData.status === 'completed'
        ? 'bg-green-100 text-green-600'
        : 'bg-slate-100 text-slate-500';

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row relative">
            {/* Map Area */}
            <div className="flex-1 h-[50vh] md:h-screen relative z-0">
                <LeafletMap markers={markers} zoom={15} center={markers[0] || { lat: 8.03555, lng: 126.06432 }} />

                {/* Live/Reconnecting Badge */}
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
                    {/* Manual refresh button - critical for iOS when user returns from background */}
                    <button
                        onClick={fetchRide}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur-md border border-slate-200 rounded-full shadow text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all active:scale-95"
                    >
                        <RefreshCw size={11} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Info Card */}
            <div className="w-full md:w-[400px] h-[50vh] md:h-screen bg-white shadow-2xl z-10 p-6 overflow-y-auto flex flex-col ring-1 ring-black/5">
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="text-green-500" size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest text-green-600">Secure Ride Tracking</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-800">
                        {rideData.passenger_name || rideData.passenger}'s Ride
                    </h1>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase mt-2 capitalize ${statusColor}`}>
                        {statusLabel}
                    </span>
                    {lastUpdated && (
                        <p className="text-[10px] text-slate-400 mt-1">
                            Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                    )}
                </div>

                {rideData.driver ? (
                    <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-200 mb-6 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-primary opacity-5 rounded-bl-[2rem]"></div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Driver Assigned</h3>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center border-2 border-primary shadow-lg overflow-hidden flex-shrink-0">
                                <img
                                    src={rideData.driver.profile_picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rideData.driver.username}`}
                                    alt="Driver"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="font-black text-xl text-secondary tracking-tight truncate">{rideData.driver.username}</p>
                                <div className="flex flex-col gap-1 text-xs text-slate-500 font-bold uppercase tracking-tight">
                                    <span className="flex items-center gap-1.5"><Car size={12} className="text-primary" /> {rideData.driver.vehicle_model}</span>
                                    <span className="bg-primary/20 text-primary-dark px-2 py-0.5 rounded-md inline-block w-max">{rideData.driver.vehicle_plate}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mb-6 text-yellow-700 text-sm font-bold flex items-center gap-3">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
                        Looking for a driver...
                    </div>
                )}

                <div className="space-y-6 flex-1">
                    <div className="flex gap-4">
                        <div className="flex flex-col items-center gap-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <div className="w-0.5 flex-1 bg-slate-200 min-h-[30px]"></div>
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        </div>
                        <div className="flex-1 space-y-6">
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">Pickup Location</p>
                                <p className="font-bold text-slate-700 leading-tight">{rideData.pickup_address || rideData.pickup}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">Destination</p>
                                <p className="font-bold text-slate-700 leading-tight">{rideData.dest_address || rideData.dest}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Powered by Transmart Safety Hub</p>
                    <div className="flex items-center justify-center gap-4 mt-4">
                        <button className="p-3 bg-primary/10 text-primary-dark rounded-full hover:bg-primary/20 transition-all">
                            <Phone size={20} />
                        </button>
                        <button className="flex-1 bg-secondary text-white font-black py-3 rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest text-xs">
                            Help Center
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicTracking;
