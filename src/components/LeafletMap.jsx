import React, { useEffect, useRef, useContext, useState } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { ensureImageUrl } from '../utils/url';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom driver icon
const driverIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#FFD700" stroke="#333" stroke-width="2"/>
      <path d="M16 8 L20 16 L16 14 L12 16 Z" fill="#333"/>
    </svg>
  `),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

// Pickup Icon
const pickupIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  `),
    iconSize: [30, 30],
    iconAnchor: [15, 30]
});

// Destination Icon
const destIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
    </svg>
  `),
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});

// Reference bounds for Trento (not enforced – map can follow real GPS anywhere)
const TRENTO_BOUNDS = [
    [8.020, 126.020],
    [8.080, 126.100]
];

// Component to control map view
function MapController({ markers, center }) {
    const map = useMap();
    const isFirstLoad = useRef(true);

    // Auto-pan following the center prop from GPS tracking
    useEffect(() => {
        if (center && center.lat && center.lng) {
            // Using flyTo for a smoother animation when updating center
            map.flyTo([center.lat, center.lng], map.getZoom(), {
                animate: true,
                duration: 1.5
            });
        }
    }, [center.lat, center.lng, map]);

    useEffect(() => {
        if (markers && markers.length > 0) {
            const focusMarker = markers.find(m => m.forceFocus);
            if (focusMarker) {
                map.panTo([focusMarker.lat, focusMarker.lng]);
                // map.setZoom(16);
            } else if (markers.length === 1 && isFirstLoad.current) {
                map.panTo([markers[0].lat, markers[0].lng]);
            } else if (isFirstLoad.current) {
                const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }
        if (markers && markers.length > 0) {
            isFirstLoad.current = false;
        }
    }, [markers, map]);

    return null;
}

// Smooth Marker Component with Animation and Rotation
const SmoothMarker = ({ position, icon, isDriver, children }) => {
    const markerRef = useRef(null);
    const requestRef = useRef();
    const startTimeRef = useRef(null);
    const startPosRef = useRef(position);
    const targetPosRef = useRef(position);
    const [rotation, setRotation] = useState(0);

    // Update target when prop changes
    useEffect(() => {
        if (markerRef.current) {
            const currentLatLng = markerRef.current.getLatLng();
            startPosRef.current = { lat: currentLatLng.lat, lng: currentLatLng.lng };
            targetPosRef.current = { lat: position[0], lng: position[1] };
            startTimeRef.current = null;

            // Calculate rotation angle if it's a driver
            if (isDriver) {
                const dy = targetPosRef.current.lat - startPosRef.current.lat;
                const dx = targetPosRef.current.lng - startPosRef.current.lng;
                if (Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001) {
                    // Convert to degrees and adjust for SVG orientation (bearing style)
                    const angle = Math.atan2(dx, dy) * (180 / Math.PI);
                    setRotation(angle);
                }
            }

            // Start animation loop
            const animate = (timestamp) => {
                if (!startTimeRef.current) startTimeRef.current = timestamp;
                const progress = timestamp - startTimeRef.current;
                const duration = 1000;

                if (progress < duration) {
                    const ratio = progress / duration;
                    const lat = startPosRef.current.lat + (targetPosRef.current.lat - startPosRef.current.lat) * ratio;
                    const lng = startPosRef.current.lng + (targetPosRef.current.lng - startPosRef.current.lng) * ratio;

                    if (markerRef.current) {
                        markerRef.current.setLatLng([lat, lng]);
                    }
                    requestRef.current = requestAnimationFrame(animate);
                } else {
                    if (markerRef.current) {
                        markerRef.current.setLatLng([targetPosRef.current.lat, targetPosRef.current.lng]);
                    }
                }
            };

            cancelAnimationFrame(requestRef.current);
            requestRef.current = requestAnimationFrame(animate);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [position[0], position[1], isDriver]);

    useEffect(() => cancelAnimationFrame(requestRef.current), []);

    return (
        <Marker
            ref={markerRef}
            position={position}
            icon={icon}
            rotationAngle={rotation} // Using a standard property name (though vanilla Leaflet needs plugin for this, we can use rotation props if available or handle via CSS)
            // Manual rotation via CSS on the icon
            eventHandlers={{
                add: (e) => {
                    if (isDriver) {
                        const iconElem = e.target.getElement();
                        if (iconElem) iconElem.style.transition = 'transform 0.5s';
                    }
                }
            }}
        >
            {children}
            {/* Custom CSS for rotation since standard Marker doesn't support rotationAngle without plugin */}
            {isDriver && (
                <style>{`
                    .leaflet-marker-icon {
                        transform-origin: center center;
                    }
                `}</style>
            )}
        </Marker>
    );
};


const LeafletMap = ({ center = { lat: 8.050, lng: 126.062 }, zoom = 15, markers = [], routeCoordinates = null }) => {
    const { isDarkMode } = useContext(ThemeContext);
    const [history, setHistory] = useState([]);

    // Update history for driver trajectory
    useEffect(() => {
        const driver = markers.find(m => m.isDriver);
        if (driver) {
            setHistory(prev => {
                const latest = prev[prev.length - 1];
                if (!latest || (latest[0] !== driver.lat || latest[1] !== driver.lng)) {
                    return [...prev, [driver.lat, driver.lng]].slice(-50); // Keep last 50 points
                }
                return prev;
            });
        }
    }, [markers]);

    // Dark mode tile layer
    const tileLayer = isDarkMode
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const attribution = isDarkMode
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    // Extract pickup and destination for route drawing
    const pickup = markers.find(m => m.isPickup);
    const destination = markers.find(m => m.isDestination);
    const driver = markers.find(m => m.isDriver);

    return (
        <div className="absolute inset-0 w-full h-full rounded-[2.5rem] overflow-hidden border-4 border-white/50 dark:border-slate-800 shadow-2xl z-0">
            <MapContainer
                center={[center.lat, center.lng]}
                zoom={zoom}
                minZoom={10}
                maxZoom={19}
                style={{ height: '100%', width: '100%', touchAction: 'none' }}
                className="z-0"
            >
                <TileLayer
                    attribution={attribution}
                    url={tileLayer}
                />

                {/* Trajectory History */}
                {history.length > 1 && (
                    <Polyline
                        positions={history}
                        pathOptions={{ color: '#FFD700', weight: 4, opacity: 0.4, dashArray: '5, 10' }}
                    />
                )}

                {/* Active Ride Route */}
                {driver && pickup && (
                    <Polyline
                        positions={[[driver.lat, driver.lng], [pickup.lat, pickup.lng]]}
                        pathOptions={{ color: '#22c55e', weight: 3, opacity: 0.6, dashArray: '10, 10' }}
                    />
                )}

                {routeCoordinates && routeCoordinates.length > 0 ? (
                    <Polyline
                        positions={routeCoordinates}
                        pathOptions={{ color: '#3b82f6', weight: 6, opacity: 0.8 }}
                    />
                ) : (
                    pickup && destination && (
                        <Polyline
                            positions={[[pickup.lat, pickup.lng], [destination.lat, destination.lng]]}
                            pathOptions={{ color: isDarkMode ? '#fff' : '#333', weight: 2, opacity: 0.2 }}
                        />
                    )
                )}

                {/* Markers */}
                {markers.map((marker, index) => {
                    let icon = new L.Icon.Default();
                    if (marker.isDriver) icon = driverIcon;
                    if (marker.isPickup) icon = pickupIcon;
                    if (marker.isDestination) icon = destIcon;

                    return (
                        <SmoothMarker
                            key={marker.id || index}
                            position={[marker.lat, marker.lng]}
                            icon={icon}
                            isDriver={marker.isDriver}
                        >
                            <Popup className="custom-popup">
                                <div className="text-sm font-bold p-2 min-w-[150px]">
                                    {marker.isDriver && (
                                        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-white/10">
                                            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                                                <img
                                                    src={ensureImageUrl(marker.profile_picture, marker.title)}
                                                    alt="Driver"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-primary leading-tight">Driver</div>
                                                <div className="text-secondary dark:text-white truncate font-black">{marker.title}</div>
                                            </div>
                                        </div>
                                    )}
                                    {!marker.isDriver && (
                                        <div className="text-primary-dark uppercase text-[10px] font-black tracking-widest mb-1">{marker.title}</div>
                                    )}
                                    <div className="text-slate-600 dark:text-slate-400 text-xs font-medium leading-relaxed italic">
                                        {marker.info}
                                    </div>
                                </div>
                            </Popup>
                        </SmoothMarker>
                    );
                })}

                {/* Destination Pulse */}
                {destination && (
                    <CircleMarker
                        center={[destination.lat, destination.lng]}
                        pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2 }}
                        radius={20}
                    />
                )}

                <MapController markers={markers} center={center} />
            </MapContainer>

            {/* Live Legend Watermark */}
            <div className="absolute bottom-6 left-6 z-[400] bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-black/5 shadow-xl pointer-events-none">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="text-[10px] font-black uppercase text-slate-500">Driver</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-[10px] font-black uppercase text-slate-500">Pickup</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-[10px] font-black uppercase text-slate-500">Dest</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeafletMap;

