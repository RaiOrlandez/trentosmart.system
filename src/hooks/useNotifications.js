/**
 * useNotifications
 * ─────────────────────────────────────────────────────────
 * A reusable hook that:
 *   1. Requests and tracks browser Notification permission.
 *   2. Shows a native desktop pop-up (works even in background tabs).
 *   3. Plays in-app audio chimes with loop support.
 *
 * Audio files expected in /public:
 *   /alert.wav       – Ride request ping (driver)
 *   /chime.mp3       – Gentle info chime (admin: new signup, system)
 *   /siren.mp3       – Urgent looping siren (admin: SOS emergency)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const SOUNDS = {
  request : '/alert.wav',   // New ride request  (driver)
  chime   : '/chime.mp3',   // Info notification (admin signup / system)
  siren   : '/siren.mp3',   // Emergency SOS     (admin, loops until stopped)
};

const useNotifications = () => {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const sirenRef = useRef(null); // keep a ref so we can stop the siren manually

  // ── 1. Request browser permission ──────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied';
    if (Notification.permission === 'granted') {
      setPermission('granted');
      return 'granted';
    }
    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    }
    return Notification.permission;
  }, []);

  // Auto-request on mount (silently — browser only shows the prompt if never asked)
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // ── 2. Show a desktop notification ────────────────────────────────────────
  const notify = useCallback((title, body, options = {}) => {
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, {
        body,
        icon: '/zap.svg',
        badge: '/zap.svg',
        vibrate: [200, 100, 200],
        ...options,
      });
      // Auto-close after 8 seconds
      setTimeout(() => n.close(), 8000);
    } catch (err) {
      console.warn('[Notifications] Could not show desktop notification:', err);
    }
  }, []);

  // ── 3. Play an audio chime ─────────────────────────────────────────────────
  const playSound = useCallback((type = 'request', loop = false) => {
    const src = SOUNDS[type] || SOUNDS.request;
    try {
      const audio = new Audio(src);
      audio.loop = loop;
      // Keep a reference to the siren so it can be stopped
      if (type === 'siren') {
        if (sirenRef.current) {
          sirenRef.current.pause();
          sirenRef.current.currentTime = 0;
        }
        sirenRef.current = audio;
      }
      audio.play().catch(() => {
        // Autoplay blocked — silently ignore (first interaction will unblock future plays)
      });
      return audio;
    } catch (err) {
      console.warn('[Notifications] Audio playback error:', err);
      return null;
    }
  }, []);

  // ── 4. Stop the siren (called when admin resolves SOS) ────────────────────
  const stopSiren = useCallback(() => {
    if (sirenRef.current) {
      sirenRef.current.pause();
      sirenRef.current.currentTime = 0;
      sirenRef.current = null;
    }
  }, []);

  // ── 5. Convenience wrappers ────────────────────────────────────────────────

  /** New ride request for driver — plays ping + desktop popup */
  const notifyNewRideRequest = useCallback((pickupAddress) => {
    playSound('request');
    notify('🚕 New Ride Request!', `Passenger is requesting a ride from ${pickupAddress || 'nearby'}.`);
  }, [playSound, notify]);

  /** New user registration for admin — plays chime + popup */
  const notifyNewSignup = useCallback((username, role) => {
    playSound('chime');
    notify(
      '👤 New Registration',
      `${username} just signed up as a ${role}. Review their account.`,
      { tag: `signup-${username}` }
    );
  }, [playSound, notify]);

  /** Emergency SOS for admin — plays looping siren + urgent popup */
  const notifyEmergencySOS = useCallback((senderName, description) => {
    playSound('siren', true); // looping until resolved
    notify(
      '🚨 EMERGENCY SOS!',
      `${senderName || 'A user'}: ${description || 'Emergency signal detected!'}`,
      { tag: 'sos-emergency', requireInteraction: true } // stays until admin dismisses
    );
  }, [playSound, notify]);

  /** Route anomaly alert for admin — plays chime + popup */
  const notifyRouteAnomaly = useCallback((driverName, rideId) => {
    playSound('chime');
    notify(
      '⚠️ Route Anomaly Detected',
      `Driver ${driverName} appears off-route (Ride #${rideId}). Check live map.`,
      { tag: `anomaly-${rideId}` }
    );
  }, [playSound, notify]);

  return {
    permission,
    requestPermission,
    notify,
    playSound,
    stopSiren,
    notifyNewRideRequest,
    notifyNewSignup,
    notifyEmergencySOS,
    notifyRouteAnomaly,
  };
};

export default useNotifications;
