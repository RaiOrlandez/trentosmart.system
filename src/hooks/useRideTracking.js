import { useState, useEffect, useRef, useCallback } from 'react';

const useRideTracking = (rideId, isDriver = false, isGuest = false, shareToken = null) => {
    const [location, setLocation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);
    // Track optimistically-sent messages to avoid duplicates on server echo
    const pendingEchos = useRef(new Set());

    useEffect(() => {
        if (!rideId) {
            setMessages([]);
            return;
        }

        const wsBase = process.env.REACT_APP_WS_BASE || 'ws://127.0.0.1:8000/ws';
        // For guests, we use the shareToken in the query string if available
        const token = isGuest ? shareToken : localStorage.getItem('token');
        
        if (!isGuest && (!token || token === 'null' || token === 'undefined')) {
            console.warn("No valid authentication token found for ride tracking. Skipping connection.");
            setConnected(false);
            return;
        }

        const socketUrl = `${wsBase}/ride/${rideId}/?token=${token}${isGuest ? '&guest=true' : ''}`;

        console.log(`Connecting to ride socket: ${socketUrl}`);
        socketRef.current = new WebSocket(socketUrl);

        socketRef.current.onopen = () => {
            console.log('Ride socket connected');
            setConnected(true);
        };

        socketRef.current.onmessage = (e) => {
            const data = JSON.parse(e.data);

            if (data.type === 'location') {
                // If I am driver, this is passenger location. If I am passenger, this is driver location.
                setLocation({
                    lat: data.lat,
                    lng: data.lng,
                    status: data.status,
                    sender: data.sender || (isDriver ? 'passenger' : 'driver')
                });
            } else if (data.type === 'chat') {
                // Deduplicate — if we optimistically added this message, skip server echo
                const echoKey = `${data.sender}::${data.message}`;
                if (pendingEchos.current.has(echoKey)) {
                    pendingEchos.current.delete(echoKey);
                } else {
                    setMessages(prev => [...prev, {
                        text: data.message,
                        sender: data.sender,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }]);
                }
            } else if (data.type === 'status_update') {
                setLocation(prev => ({ ...prev, ...data }));
            }
        };

        socketRef.current.onclose = () => {
            console.log('Ride socket disconnected');
            setConnected(false);
        };

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, [rideId, isDriver, isGuest, shareToken]);

    // Function to send location (used by driver)
    const sendLocation = useCallback((lat, lng, heading = 0) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'location', lat, lng, heading }));
        }
    }, []);

    // Function to send chat message (with optimistic local add)
    const sendMessage = useCallback((text, senderName) => {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        // Optimistically add to local state right away
        setMessages(prev => [...prev, { text, sender: senderName, timestamp }]);

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            // Mark this message so we skip the server echo
            pendingEchos.current.add(`${senderName}::${text}`);
            socketRef.current.send(JSON.stringify({
                type: 'chat',
                message: text,
                sender: senderName
            }));
        }
        // If socket is not open, the message still appears locally (graceful degradation)
    }, []);

    return { location, connected, messages, sendLocation, sendMessage };
};

export default useRideTracking;

