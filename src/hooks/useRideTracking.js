import { useState, useEffect, useRef, useCallback } from 'react';

const useRideTracking = (rideId, isDriver = false) => {
    const [location, setLocation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);

    useEffect(() => {
        if (!rideId) {
            setMessages([]);
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socketUrl = `${protocol}//${window.location.hostname}:8000/ws/ride/${rideId}/`;

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
                setLocation({ lat: data.lat, lng: data.lng, sender: data.sender || (isDriver ? 'passenger' : 'driver') });
            } else if (data.type === 'chat') {
                // Anyone receives chat
                setMessages(prev => [...prev, {
                    text: data.message,
                    sender: data.sender,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
            } else if (data.type === 'status_update') {
                // Passengers receive status updates (Accepted, Arrived, etc)
                setLocation(data);
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
    }, [rideId, isDriver]);

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
