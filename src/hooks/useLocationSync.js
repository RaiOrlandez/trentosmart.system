import { useEffect, useRef, useCallback } from 'react';
import { updateMyLocation } from '../api/locationService';

/**
 * useLocationSync
 * ──────────────────────────────────────────────────────────────────
 * Periodically sends the user's current GPS coordinates to the
 * backend (POST /api/location/update/) on a configurable interval.
 *
 * Only runs when:
 *   - `location` is non-null (from useGeoLocation)
 *   - `enabled` is true (e.g. user is logged in & active)
 *   - Not in demo mode (by default – can be overridden)
 *
 * @param {object|null} location  – { lat, lng, isDemo } from useGeoLocation
 * @param {object}      options
 *   @param {boolean}  options.enabled        – master switch (default true)
 *   @param {number}   options.interval        – ms between syncs (default 4000)
 *   @param {boolean}  options.syncInDemoMode  – whether to push demo coords (default false)
 *   @param {function} options.onSyncSuccess   – callback(data) after successful push
 *   @param {function} options.onSyncError     – callback(err) on failure
 *
 * @returns {{ forcSync: function }} – call forceSync() to push immediately
 * ──────────────────────────────────────────────────────────────────
 */
const useLocationSync = (location, options = {}) => {
    const {
        enabled = true,
        interval = 4000,
        syncInDemoMode = false,
        onSyncSuccess,
        onSyncError,
    } = options;

    const timerRef = useRef(null);
    const isSyncingRef = useRef(false);

    const push = useCallback(async (loc) => {
        if (!loc || isSyncingRef.current) return;
        if (loc.isDemo && !syncInDemoMode) return;

        isSyncingRef.current = true;
        try {
            const data = await updateMyLocation(loc.lat, loc.lng);
            if (onSyncSuccess) onSyncSuccess(data);
        } catch (err) {
            // Silently ignore network errors – don't spam the console
            if (onSyncError) onSyncError(err);
        } finally {
            isSyncingRef.current = false;
        }
    }, [syncInDemoMode, onSyncSuccess, onSyncError]);

    // Set up the recurring timer
    useEffect(() => {
        if (!enabled || !location) return;

        // Push immediately when location first arrives / changes role
        push(location);

        timerRef.current = setInterval(() => {
            push(location);
        }, interval);

        return () => clearInterval(timerRef.current);
    }, [enabled, location, interval, push]);

    // Expose a manual "push now" function
    const forceSync = useCallback(() => push(location), [push, location]);

    return { forceSync };
};

export default useLocationSync;
