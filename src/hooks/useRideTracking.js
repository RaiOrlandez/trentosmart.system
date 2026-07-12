import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useRideTracking
 * ───────────────
 * Opens a WebSocket to the ride channel and exposes:
 *   - location    : latest location update from the other party
 *   - connected   : true when the socket is OPEN
 *   - messages    : chat history
 *   - sendLocation: (lat, lng, heading?) → void  — driver broadcasts position
 *   - sendMessage : (text, senderName)   → void  — both parties send chat
 *
 * Automatic reconnection (exponential back-off, max 30 s) is built in so
 * the chat window recovers from brief network drops without a page refresh.
 */
const useRideTracking = (rideId, isDriver = false, isGuest = false, shareToken = null) => {
    const [location, setLocation]   = useState(null);
    const [messages, setMessages]   = useState([]);
    const [connected, setConnected] = useState(false);

    const socketRef       = useRef(null);
    const pendingEchos    = useRef(new Set());   // deduplicate optimistic-send echoes
    const retryCount      = useRef(0);
    const retryTimer      = useRef(null);
    const isMounted       = useRef(true);
    const rideIdRef       = useRef(rideId);      // keep latest value in refs for closures

    rideIdRef.current = rideId;

    // ── Build WebSocket URL ───────────────────────────────────────────────────
    const buildUrl = useCallback(() => {
        const wsBase = process.env.REACT_APP_WS_BASE || 'ws://127.0.0.1:8000/ws';
        const token  = isGuest ? shareToken : localStorage.getItem('token');

        if (!isGuest && (!token || token === 'null' || token === 'undefined')) {
            return null;   // no valid JWT — skip connection
        }

        return `${wsBase}/ride/${rideId}/?token=${token}${isGuest ? '&guest=true' : ''}`;
    }, [rideId, isGuest, shareToken]);

    // ── Open WebSocket ────────────────────────────────────────────────────────
    const connect = useCallback(() => {
        if (!isMounted.current) return;
        if (!rideIdRef.current)  return;

        const url = buildUrl();
        if (!url) {
            console.warn('[RideTracking] No valid auth token — skipping WS connection.');
            setConnected(false);
            return;
        }

        // Clean up any existing socket first
        if (socketRef.current) {
            socketRef.current.onclose = null; // prevent reconnect loop on intentional close
            socketRef.current.close();
        }

        console.log(`[RideTracking] Connecting → ${url}`);
        const ws = new WebSocket(url);
        socketRef.current = ws;

        ws.onopen = () => {
            if (!isMounted.current) return;
            console.log('[RideTracking] ✅ Connected');
            setConnected(true);
            retryCount.current = 0;
        };

        ws.onmessage = (e) => {
            if (!isMounted.current) return;
            let data;
            try { data = JSON.parse(e.data); } catch { return; }

            if (data.type === 'location') {
                // If this is our own location update echoed back from the server, ignore it
                const isMyOwnEcho = isDriver ? (data.sender_role === 'driver') : (data.sender_role === 'passenger');
                if (isMyOwnEcho) {
                    return; // Ignore our own location echo
                }

                setLocation({
                    lat:      data.lat,
                    lng:      data.lng,
                    heading:  data.heading || 0,
                    accuracy: data.accuracy || null,
                    status:   data.status,
                    sender:   data.sender || (isDriver ? 'passenger' : 'driver'),
                });
            } else if (data.type === 'chat') {
                // Deduplicate — skip the server echo for messages we sent optimistically
                const echoKey = `${data.sender}::${data.message}`;
                if (pendingEchos.current.has(echoKey)) {
                    pendingEchos.current.delete(echoKey);
                } else {
                    setMessages(prev => [...prev, {
                        text:      data.message,
                        sender:    data.sender,
                        msgType:   data.msg_type || 'text',
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }]);
                }
            } else if (data.type === 'status_update') {
                setLocation(prev => ({ ...prev, ...data }));
            }
        };

        ws.onclose = (evt) => {
            if (!isMounted.current) return;
            console.warn(`[RideTracking] Disconnected (code=${evt.code})`);
            setConnected(false);

            // Do not retry on auth failures (4001 = bad share token, 4003 = not authenticated)
            if (evt.code === 4001 || evt.code === 4003) {
                console.error('[RideTracking] Auth error — will not retry.');
                return;
            }

            // Exponential back-off: 1 s → 2 s → 4 s → 8 s → 16 s → 30 s cap
            if (rideIdRef.current) {
                const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
                retryCount.current += 1;
                console.log(`[RideTracking] Reconnecting in ${delay / 1000}s (attempt ${retryCount.current})…`);
                retryTimer.current = setTimeout(connect, delay);
            }
        };

        ws.onerror = (err) => {
            console.error('[RideTracking] WebSocket error:', err);
        };
    }, [buildUrl, isDriver]);

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    useEffect(() => {
        isMounted.current = true;

        if (!rideId) {
            setMessages([]);
            setLocation(null); // ✅ Reset stale location data (prevents completed modal loop)
            setConnected(false);
            return;
        }

        retryCount.current = 0;
        connect();

        // ── iOS Safari Visibility Fix ─────────────────────────────────────────
        // iOS aggressively kills WebSocket connections when the browser tab is
        // backgrounded or the screen is locked. When the user returns to the
        // tab, the existing exponential backoff can wait up to 30 seconds.
        // Listening to visibilitychange gives us an immediate reconnect.
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isMounted.current) {
                const ws = socketRef.current;
                const isDisconnected = !ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING;
                if (isDisconnected) {
                    console.log('[RideTracking] Tab became visible — reconnecting WebSocket immediately.');
                    clearTimeout(retryTimer.current);
                    retryCount.current = 0; // reset backoff on user-initiated resume
                    connect();
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isMounted.current = false;
            clearTimeout(retryTimer.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (socketRef.current) {
                socketRef.current.onclose = null; // suppress reconnect on unmount
                socketRef.current.close();
            }
        };
    }, [rideId, isDriver, isGuest, shareToken, connect]);

    // ── Send location (driver → passenger) ───────────────────────────────────
    const sendLocation = useCallback((lat, lng, heading = 0, accuracy = null) => {
        const ws = socketRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'location', lat, lng, heading, accuracy }));
        }
    }, []);

    // ── Send chat message (optimistic + WS broadcast) ────────────────────────
    const sendMessage = useCallback((text, senderName, msgType = 'text') => {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Show immediately in local state (optimistic update)
        setMessages(prev => [...prev, { text, sender: senderName, msgType, timestamp }]);

        const ws = socketRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Register echo key so we don't show the message again when server broadcasts it
            pendingEchos.current.add(`${senderName}::${text}`);
            ws.send(JSON.stringify({ type: 'chat', message: text, sender: senderName, msg_type: msgType }));
        }
        // If offline: message still visible locally — will be lost on the other side until reconnect
    }, []);

    return { location, connected, messages, sendLocation, sendMessage };
};

export default useRideTracking;
