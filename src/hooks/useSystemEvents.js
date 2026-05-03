import { useState, useEffect, useRef } from 'react';

const useSystemEvents = () => {
    const [newRide, setNewRide] = useState(null);
    const [driverLocation, setDriverLocation] = useState(null);
    const [newSignup, setNewSignup] = useState(null);
    const [emergencyAlert, setEmergencyAlert] = useState(null);
    const [systemEvent, setSystemEvent] = useState(null);
    const socketRef = useRef(null);

    useEffect(() => {
        let socketUrl;
        const token = localStorage.getItem('access');
        
        // If API URL is explicitly set (like in Vercel for production)
        if (process.env.REACT_APP_API_URL) {
            const baseUrl = process.env.REACT_APP_API_URL.replace(/^http/, 'ws');
            socketUrl = `${baseUrl}/ws/system/?token=${token}`;
        } else {
            // Local fallback
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            socketUrl = `${protocol}//${window.location.hostname}:8000/ws/system/?token=${token}`;
        }

        socketRef.current = new WebSocket(socketUrl);

        socketRef.current.onmessage = (e) => {
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
            } else if (data.type === 'system_event') {
                setSystemEvent(data);
            }
        };

        return () => {
            if (socketRef.current) socketRef.current.close();
        };
    }, []);

    return { newRide, driverLocation, newSignup, emergencyAlert, systemEvent };
};

export default useSystemEvents;
