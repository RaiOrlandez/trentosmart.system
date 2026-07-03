import { useEffect, useRef, useCallback } from 'react';
import { updateMyLocation } from '../api/locationService';

// Haversine formula — returns distance in metres between two GPS coords
const haversineMetres = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * useLocationSync
 * ──────────────────────────────────────────────────────────────────
 * Sends the user's GPS position to the backend when:
 *   1. The device has moved at least `minDistanceMetres` (default 10 m)
 *   2. OR the interval timer fires (heartbeat – default 6 s)
 *
 * This prevents spamming the server with identical coordinates when
 * the user is stationary, while still keeping the backend in sync.
 *
 * Also forwards heading, accuracy, and speed so the server can
 * display the driver icon with the correct orientation and confidence ring.
 *
 * @param {object|null} location  – { lat, lng, accuracy, heading, speed } from useGeoLocation
 * @param {object}      options
 *   @param {boolean}  options.enabled           – master switch (default true)
 *   @param {number}   options.interval           – heartbeat ms (default 6000)
 *   @param {number}   options.minDistanceMetres  – skip sync if moved < this (default 10)
 *   @param {function} options.onSyncSuccess      – callback(data) after successful push
 *   @param {function} options.onSyncError        – callback(err) on failure
 *
 * @returns {{ forceSync: function }} – call forceSync() to push immediately
 * ──────────────────────────────────────────────────────────────────
 */
const useLocationSync = (location, options = {}) => {
    const {
        enabled = true,
        interval = 6000,
        minDistanceMetres = 10,
        onSyncSuccess,
        onSyncError,
    } = options;

    const timerRef      = useRef(null);
    const isSyncingRef  = useRef(false);
    const lastSyncedRef = useRef(null); // { lat, lng } of last successful push

    const push = useCallback(async (loc, force = false) => {
        if (!loc || isSyncingRef.current) return;

        // Skip if device hasn't moved enough (unless forced)
        if (!force && lastSyncedRef.current) {
            const metres = haversineMetres(
                lastSyncedRef.current.lat,
                lastSyncedRef.current.lng,
                loc.lat,
                loc.lng
            );
            if (metres < minDistanceMetres) return;
        }

        isSyncingRef.current = true;
        try {
            const data = await updateMyLocation(loc.lat, loc.lng, {
                heading:  loc.heading,
                accuracy: loc.accuracy,
                speed:    loc.speed,
            });
            lastSyncedRef.current = { lat: loc.lat, lng: loc.lng };
            if (onSyncSuccess) onSyncSuccess(data);
        } catch (err) {
            // Silently ignore network errors – don't spam the console
            if (onSyncError) onSyncError(err);
        } finally {
            isSyncingRef.current = false;
        }
    }, [minDistanceMetres, onSyncSuccess, onSyncError]);

    // Push immediately on first location arrival or location change
    useEffect(() => {
        if (!enabled || !location) return;
        push(location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, location?.lat, location?.lng]);

    // Heartbeat timer: sync even if not moved (keeps backend session alive)
    useEffect(() => {
        if (!enabled || !location) return;
        timerRef.current = setInterval(() => {
            push(location, true); // force = true bypasses distance check
        }, interval);
        return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, interval]);

    // Expose a manual "push now" function
    const forceSync = useCallback(() => push(location, true), [push, location]);

    return { forceSync };
};

export default useLocationSync;
