import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

// --- Demo fallback: Trento, Agusan del Sur, Philippines ---
const DEMO_LOCATION = {
    lat: 8.2965,
    lng: 126.0630,
    accuracy: 0,
    isDemo: true,
};

/**
 * useGeoLocation
 * ──────────────────────────────────────────────────────────────────
 * Continuously tracks the user's real GPS position using the browser
 * Geolocation API (watchPosition). If GPS is denied or unavailable,
 * it falls back to a hard-coded demo location in Trento, ADS.
 *
 * Returns:
 *   location    – { lat, lng, accuracy, isDemo }
 *   status      – 'loading' | 'live' | 'demo' | 'error'
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
    const [status, setStatus] = useState('loading'); // loading | live | demo | error
    const [error, setError] = useState(null);

    const watchIdRef = useRef(null);
    const fallbackTimerRef = useRef(null);
    const hasGotLocationRef = useRef(false);

    // --- Activate demo mode ---
    const activateDemo = useCallback((reason = '') => {
        setLocation(DEMO_LOCATION);
        setStatus('demo');
        setError(reason || 'GPS unavailable – using demo location (Trento ADS)');
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

        setStatus('loading');
        setError(null);

        // Permission fallback timer
        fallbackTimerRef.current = setTimeout(() => {
            if (!hasGotLocationRef.current) {
                activateDemo('Location permission timed out. Showing demo location.');
            }
        }, permissionTimeout);

        const onSuccess = (pos) => {
            clearTimeout(fallbackTimerRef.current);
            hasGotLocationRef.current = true;
            let lat, lng, acc;
            if (pos.coords) { // Web API
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                acc = pos.coords.accuracy;
            } else { // Capacitor native plugin
                lat = pos.latitude;
                lng = pos.longitude;
                acc = pos.accuracy;
            }
            setLocation({
                lat: lat,
                lng: lng,
                accuracy: acc,
                isDemo: false,
            });
            setStatus('live');
            setError(null);
        };

        const onError = (err) => {
            clearTimeout(fallbackTimerRef.current);
            activateDemo('Location tracking error. Showing demo location.');
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
                activateDemo('Geolocation is not supported by this browser.');
                return;
            }
            watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
                enableHighAccuracy,
                timeout,
                maximumAge,
            });
        }
    }, [activateDemo, enableHighAccuracy, timeout, maximumAge, permissionTimeout]);

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
export { DEMO_LOCATION };
