import { useState, useEffect, useRef, useCallback } from 'react';

const useRideTracking = (rideId, isDriver = false, isGuest = false, shareToken = null) => {
    const [location, setLocation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);

    useEffect(() => {
        if (!rideId) {
            setMessages([]);
            return;
        }

        const wsBase = process.env.REACT_APP_WS_BASE || 'ws://127.0.0.1:8000/ws';
        // For guests, we use the shareToken in the query string if available
        const token = isGuest ? shareToken : localStorage.getItem('access');
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
                setMessages(prev => [...prev, {
                    text: data.message,
                    sender: data.sender,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
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
    const sendLocation = useCallback((lat, lng) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'location', lat, lng }));
        }
    }, []);

    // Function to send chat message
    const sendMessage = useCallback((text, senderName) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'chat',
                message: text,
                sender: senderName
            }));
        }
    }, []);

    return { location, connected, messages, sendLocation, sendMessage };
};

export default useRideTracking;

