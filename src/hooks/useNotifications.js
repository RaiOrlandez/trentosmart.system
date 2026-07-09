/**
 * useNotifications
 * ─────────────────────────────────────────────────────────
 * A reusable hook that:
 *   1. Requests and tracks browser Notification permission.
 *   2. Shows a native desktop pop-up (works even in background tabs).
 *   3. Plays in-app audio chimes with loop support.
 *   4. Bypasses browser autoplay restrictions using a pre-unlocked audio engine.
 */

import { useCallback, useEffect, useState } from 'react';

const SOUNDS = {
  request : '/alert.wav',   // New ride request  (driver)
  chime   : '/chime.mp3',   // Info notification (admin signup / system / passenger matches)
  siren   : '/siren.mp3',   // Emergency SOS     (admin, loops until stopped)
};

// Global audio instances to ensure they are created once and can be pre-unlocked
let requestAudio = null;
let chimeAudio = null;
let sirenAudio = null;
let isUnlocked = false;

// Helper to initialize audio instances safely
const initAudio = () => {
  if (typeof window === 'undefined') return;
  if (!requestAudio) {
    requestAudio = new Audio(SOUNDS.request);
    requestAudio.preload = 'auto';
  }
  if (!chimeAudio) {
    chimeAudio = new Audio(SOUNDS.chime);
    chimeAudio.preload = 'auto';
  }
  if (!sirenAudio) {
    sirenAudio = new Audio(SOUNDS.siren);
    sirenAudio.preload = 'auto';
  }
};

// Click handler to unlock all audio elements
const unlockAudio = () => {
  if (isUnlocked) return;
  initAudio();

  const unlock = (audio) => {
    if (!audio) return;
    try {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          audio.pause();
          audio.currentTime = 0;
        }).catch(() => {});
      }
    } catch (e) {}
  };

  unlock(requestAudio);
  unlock(chimeAudio);
  unlock(sirenAudio);

  isUnlocked = true;
  console.log('[Notifications] Audio players successfully unlocked.');

  // Clean up event listeners
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  }
};

const useNotifications = () => {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

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

  // Auto-request on mount + setup audio unlock listeners
  useEffect(() => {
    requestPermission();
    initAudio();

    if (!isUnlocked && typeof window !== 'undefined') {
      window.addEventListener('click', unlockAudio);
      window.addEventListener('touchstart', unlockAudio);
      window.addEventListener('keydown', unlockAudio);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      }
    };
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

  // ── 3. Play an audio chime (reuses the preloaded, unlocked instances) ─────
  const playSound = useCallback((type = 'request', loop = false) => {
    initAudio();
    let audio = null;
    if (type === 'request') audio = requestAudio;
    else if (type === 'chime') audio = chimeAudio;
    else if (type === 'siren') audio = sirenAudio;

    if (!audio) return null;

    try {
      audio.loop = loop;
      // Pause and reset if already playing
      audio.pause();
      audio.currentTime = 0;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn(`[Notifications] Autoplay blocked or error playing sound type "${type}":`, err);
        });
      }
      return audio;
    } catch (err) {
      console.warn(`[Notifications] Error playing sound type "${type}":`, err);
      return null;
    }
  }, []);

  // ── 4. Stop the siren ──────────────────────────────────────────────────────
  const stopSiren = useCallback(() => {
    if (sirenAudio) {
      sirenAudio.pause();
      sirenAudio.currentTime = 0;
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
