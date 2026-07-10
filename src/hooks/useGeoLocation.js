import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

// Map default fallback (not a GPS fix)
const DEFAULT_CENTER = {
    lat: 8.03555,
    lng: 126.06432,
};

/**
 * useGeoLocation
 * ──────────────────────────────────────────────────────────────────
 * Continuously tracks the user's real GPS position using the browser
 * Geolocation API (watchPosition). If GPS is denied or unavailable,
 * it falls back to a hard-coded demo location in Trento, ADS.
 *
 * Returns:
 *   location    – { lat, lng, accuracy } or null
 *   status      – 'loading' | 'live' | 'error'
 *   error       – error message string or null
 *   retry       – function to restart watching
 * ──────────────────────────────────────────────────────────────────
 */
const useGeoLocation = (options = {}) => {
    const {
        enableHighAccuracy = true,
        timeout = 30000,
        maximumAge = 0, // Force fresh location (no caching) for exact accuracy
        // Wait this long before falling back to demo location.
        // 30 seconds gives adequate time for real hardware GPS lock.
        permissionTimeout = 30000,
    } = options;

    const [location, setLocation] = useState(null);
    const [status, setStatus] = useState('loading'); // loading | live | error
    const [error, setError] = useState(null);

    const watchIdRef = useRef(null);
    const fallbackTimerRef = useRef(null);
    const hasGotLocationRef = useRef(false);
    const lastValidLocationRef = useRef(null);
    const lastValidTimeRef = useRef(0);

    // Calculate distance in metres between two GPS coords (Haversine formula)
    const calculateDistanceMetres = useCallback((lat1, lng1, lat2, lng2) => {
        const R = 6371000;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }, []);

    // --- Handle Location Error ---
    const handleLocationError = useCallback((reason = '') => {
        setLocation(null); // No functional location
        setStatus('error');
        setError(reason || 'GPS unavailable. Please enable location services.');
    }, []);

    // --- Start geo-watching ---
    const startWatching = useCallback(() => {
        // Clear any existing watch
        if (watchIdRef.current !== null) {
            if (Capacitor.isNativePlatform()) {
                BackgroundGeolocation.removeWatcher({ id: watchIdRef.current });
            } else {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        }
        clearTimeout(fallbackTimerRef.current);
        hasGotLocationRef.current = false;
        lastValidLocationRef.current = null;
        lastValidTimeRef.current = 0;

        setStatus('loading');
        setError(null);

        // Permission fallback timer
        fallbackTimerRef.current = setTimeout(() => {
            if (!hasGotLocationRef.current) {
                handleLocationError('Location permission timed out. Please allow location access.');
            }
        }, permissionTimeout);

        const onSuccess = (pos) => {
            clearTimeout(fallbackTimerRef.current);
            hasGotLocationRef.current = true;
            let lat, lng, acc, head;
            if (pos.coords) { // Web API
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                acc = pos.coords.accuracy;
                head = pos.coords.heading;
            } else { // Capacitor native plugin
                lat = pos.latitude;
                lng = pos.longitude;
                acc = pos.accuracy;
                head = pos.heading;
            }

            const now = Date.now();

            // 1. Reject GPS updates with extremely poor accuracy (>100 meters) if we already have a better lock
            if (acc > 100 && lastValidLocationRef.current && lastValidLocationRef.current.accuracy < 50) {
                console.warn('GPS spike filtered: accuracy too poor (accuracy:', acc, 'm)');
                return;
            }

            // 2. Reject speed spikes (impossible coordinate jumps e.g. >80 km/h)
            if (lastValidLocationRef.current && lastValidTimeRef.current > 0) {
                const timeDiffSec = (now - lastValidTimeRef.current) / 1000;
                if (timeDiffSec > 0.5) {
                    const distMetres = calculateDistanceMetres(
                        lastValidLocationRef.current.lat,
                        lastValidLocationRef.current.lng,
                        lat,
                        lng
                    );
                    const speedKmh = (distMetres / timeDiffSec) * 3.6;

                    // Reject impossible tricycle jumps ( Trento city driving speeds are < 75 km/h )
                    if (speedKmh > 75 && distMetres > 30) {
                        console.warn('GPS jitter filtered: impossible jump (speed:', speedKmh.toFixed(1), 'km/h, distance:', distMetres.toFixed(1), 'm)');
                        return;
                    }
                }
            }

            // 3. Accept the raw GPS reading — no position smoothing.
            // The "you are here" marker uses snapToPosition in LeafletMap, so it
            // always reflects the exact GPS fix instantly. Smoothing here causes
            // the displayed position to lag 30–50 m behind the real location,
            // especially when accuracy is 15–50 m (common indoors/suburban).
            // Speed-spike rejection above already handles the major GPS glitches.
            const smoothedLoc = {
                lat,
                lng,
                accuracy: acc,
                heading: head
            };

            lastValidLocationRef.current = smoothedLoc;
            lastValidTimeRef.current = now;

            setLocation(smoothedLoc);
            setStatus('live');
            setError(null);
        };

        const onError = (err) => {
            clearTimeout(fallbackTimerRef.current);
            handleLocationError('Location tracking error. Could not retrieve real-time GPS.');
        };

        if (Capacitor.isNativePlatform()) {
            BackgroundGeolocation.addWatcher(
                {
                    backgroundMessage: "Transmart is tracking your ride.",
                    backgroundTitle: "Transmart GPS Active",
                    requestPermissions: true,
                    stale: false,
                    distanceFilter: 10
                },
                (geoObj, error) => {
                    if (error) {
                        onError(error);
                        return;
                    }
                    onSuccess(geoObj);
                }
            ).then((id) => {
                watchIdRef.current = id;
            });
        } else {
            if (!('geolocation' in navigator)) {
                handleLocationError('Geolocation is not supported by this browser.');
                return;
            }
            watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
                enableHighAccuracy,
                timeout,
                maximumAge,
            });
        }
    }, [handleLocationError, enableHighAccuracy, timeout, maximumAge, permissionTimeout]);

    // Start watching on mount, clean up on unmount
    useEffect(() => {
        startWatching();
        return () => {
            if (watchIdRef.current !== null) {
                if (Capacitor.isNativePlatform()) {
                    BackgroundGeolocation.removeWatcher({ id: watchIdRef.current });
                } else {
                    navigator.geolocation.clearWatch(watchIdRef.current);
                }
            }
            clearTimeout(fallbackTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { location, status, error, retry: startWatching };
};

export default useGeoLocation;
