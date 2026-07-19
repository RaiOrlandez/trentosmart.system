import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useSystemEvents — WebSocket hook for real-time admin system events.
 *
 * Fixes:
 *  - Auto-reconnect with exponential backoff (1s → 2s → 4s … max 30s)
 *    so SOS alerts are never delayed when Railway drops the idle WS.
 *  - Heartbeat ping every 25s to keep connection alive through Railway's
 *    30-second idle timeout.
 */
const useSystemEvents = () => {
    const [newRide, setNewRide] = useState(null);
    const [driverLocation, setDriverLocation] = useState(null);
    const [newSignup, setNewSignup] = useState(null);
    const [emergencyAlert, setEmergencyAlert] = useState(null);
    const [systemEvent, setSystemEvent] = useState(null);

    const socketRef = useRef(null);
    const reconnectDelay = useRef(1000);   // start at 1 second
    const reconnectTimer = useRef(null);
    const heartbeatTimer = useRef(null);
    const isMounted = useRef(true);

    const connect = useCallback(() => {
        if (!isMounted.current) return;

        const token = localStorage.getItem('token');
        if (!token) {
            // Not authenticated yet — retry after 2 seconds
            reconnectTimer.current = setTimeout(connect, 2000);
            return;
        }

        const apiBase = process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000/api';
        const wsBase = process.env.REACT_APP_WS_BASE || apiBase.replace(/^http/, 'ws').replace('/api', '/ws');
        const socketUrl = `${wsBase}/system/?token=${token}`;

        // Close any existing socket before reconnecting
        if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
            socketRef.current.onclose = null; // suppress reconnect from old close
            socketRef.current.close();
        }

        const ws = new WebSocket(socketUrl);
        socketRef.current = ws;

        ws.onopen = () => {
            if (!isMounted.current) { ws.close(); return; }
            reconnectDelay.current = 1000; // reset backoff on success

            // Heartbeat: send a ping every 25s to keep Railway from dropping idle WS
            clearInterval(heartbeatTimer.current);
            heartbeatTimer.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    try { ws.send(JSON.stringify({ type: 'ping' })); } catch (_) {}
                }
            }, 25000);
        };

        ws.onmessage = (e) => {
            if (!isMounted.current) return;
            try {
                const data = JSON.parse(e.data);
                if (data.type === 'new_ride') {
                    setNewRide(data.ride);
                } else if (data.type === 'driver_location') {
                    setDriverLocation({
                        id: data.driver_id,
                        username: data.username,
                        lat: data.lat,
                        lng: data.lng,
                        status: data.status,
                        is_online: data.is_online
                    });
                } else if (data.type === 'new_signup') {
                    setNewSignup(data.user);
                } else if (data.type === 'emergency_alert') {
                    setEmergencyAlert(data);
                } else if ([
                    'system_event',
                    'config_update',
                    'withdrawal_request',
                    'withdrawal_update',
                    'safety_alert',
                    'safety_update',
                    'review_posted',
                    'ride_activity',
                    'driver_verified',
                    'new_broadcast'
                ].includes(data.type)) {
                    setSystemEvent(data);
                }

                // ignore 'pong' / unknown types silently
            } catch (err) {
                console.warn('[SystemEvents] Failed to parse WS message', err);
            }
        };

        ws.onerror = (err) => {
            console.warn('[SystemEvents] WebSocket error:', err);
        };

        ws.onclose = (event) => {
            clearInterval(heartbeatTimer.current);
            if (!isMounted.current) return;

            console.warn(`[SystemEvents] WS closed (code=${event.code}). Reconnecting in ${reconnectDelay.current}ms…`);

            // Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (cap)
            reconnectTimer.current = setTimeout(() => {
                if (isMounted.current) {
                    reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
                    connect();
                }
            }, reconnectDelay.current);
        };
    }, []); // stable — no deps that change

    useEffect(() => {
        isMounted.current = true;
        connect();

        return () => {
            isMounted.current = false;
            clearTimeout(reconnectTimer.current);
            clearInterval(heartbeatTimer.current);
            if (socketRef.current) {
                socketRef.current.onclose = null; // prevent reconnect on cleanup
                socketRef.current.close();
            }
        };
    }, [connect]);

    return { newRide, driverLocation, newSignup, emergencyAlert, systemEvent };
};

export default useSystemEvents;
