import React, { useEffect, useRef, useContext, useState } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker, Circle } from 'react-leaflet';
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

// ── Icon Builders ────────────────────────────────────────────────────────────

// Driver icon — rotatable arrow, dynamically built with heading
const buildDriverIcon = (headingDeg = 0) => new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="#FFD700" stroke="#1e293b" stroke-width="2.5" filter="url(#s)"/>
      <defs>
        <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
        </filter>
      </defs>
      <polygon points="20,7 26,27 20,22 14,27" fill="#1e293b" transform="rotate(${headingDeg},20,20)"/>
    </svg>
  `),
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
});

const pickupIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <defs>
        <filter id="s">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
        </filter>
      </defs>
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 24 16 24S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="#22c55e" filter="url(#s)"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>
  `),
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -42],
});

const destIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <defs>
        <filter id="s">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
        </filter>
      </defs>
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 24 16 24S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="#ef4444" filter="url(#s)"/>
      <path d="M12 12 L20 20 M20 12 L12 20" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `),
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -42],
});

const youAreHereIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="white" stroke-width="3" filter="url(#s)"/>
      <defs>
        <filter id="s">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.4"/>
        </filter>
      </defs>
    </svg>
  `),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
});

// ── Easing helper ────────────────────────────────────────────────────────────
// Ease-out cubic — produces smooth, decelerating motion (feels natural, not robotic)
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// ── Map Controller ────────────────────────────────────────────────────────────
// Only fly if center changed by more than ~15 m to prevent rubber-banding on GPS jitter
const DEAD_ZONE_DEG = 0.00015; // ≈ 15 m in latitude degrees

function MapController({ markers, center }) {
    const map = useMap();
    const lastCenterRef = useRef({ lat: center.lat, lng: center.lng });
    const isFirstLoad = useRef(true);

    // Smart pan: only flyTo if moved significantly, with a fast animation for tracking
    useEffect(() => {
        if (!center?.lat || !center?.lng) return;
        const latDiff = Math.abs(center.lat - lastCenterRef.current.lat);
        const lngDiff = Math.abs(center.lng - lastCenterRef.current.lng);

        if (latDiff > DEAD_ZONE_DEG || lngDiff > DEAD_ZONE_DEG) {
            map.flyTo([center.lat, center.lng], map.getZoom(), {
                animate: true,
                duration: 0.8,   // Faster than default 1.5s for live tracking
                easeLinearity: 0.5,
            });
            lastCenterRef.current = { lat: center.lat, lng: center.lng };
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [center.lat, center.lng, map]);

    // Fit bounds to show all markers on first load or focus marker
    useEffect(() => {
        if (!markers?.length) return;

        const focusMarker = markers.find(m => m.forceFocus);
        if (focusMarker) {
            map.flyTo([focusMarker.lat, focusMarker.lng], 17, { animate: true, duration: 0.8 });
            return;
        }

        if (isFirstLoad.current) {
            if (markers.length === 1) {
                map.panTo([markers[0].lat, markers[0].lng]);
            } else {
                try {
                    const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
                    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17, animate: true });
                } catch (_) {}
            }
            isFirstLoad.current = false;
        }
    }, [markers, map]);

    return null;
}

// ── Smooth Marker ─────────────────────────────────────────────────────────────
const SmoothMarker = ({ position, icon, isDriver, heading, children }) => {
    const markerRef     = useRef(null);
    const requestRef    = useRef();
    const startTimeRef  = useRef(null);
    const startPosRef   = useRef(position);
    const targetPosRef  = useRef(position);

    useEffect(() => {
        if (!markerRef.current) return;
        const currentLatLng = markerRef.current.getLatLng();
        startPosRef.current = { lat: currentLatLng.lat, lng: currentLatLng.lng };
        targetPosRef.current = { lat: position[0], lng: position[1] };
        startTimeRef.current = null;

        // Rotate driver icon using real GPS heading if available,
        // else calculate bearing from movement direction
        if (isDriver) {
            let angle = heading ?? null;
            if (angle === null) {
                const dy = targetPosRef.current.lat - startPosRef.current.lat;
                const dx = targetPosRef.current.lng - startPosRef.current.lng;
                if (Math.abs(dx) > 0.000005 || Math.abs(dy) > 0.000005) {
                    angle = Math.atan2(dx, dy) * (180 / Math.PI);
                }
            }
            if (angle !== null) {
                // Apply rotation via CSS transform on the DOM element
                const el = markerRef.current.getElement();
                if (el) {
                    el.style.transition = 'transform 0.5s ease-out';
                    el.style.transformOrigin = 'center center';
                    el.style.transform = `rotate(${angle}deg)`;
                }
            }
        }

        const animate = (timestamp) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            const progress = (timestamp - startTimeRef.current) / 900; // 900 ms animation
            const t = easeOutCubic(Math.min(progress, 1));

            const lat = startPosRef.current.lat + (targetPosRef.current.lat - startPosRef.current.lat) * t;
            const lng = startPosRef.current.lng + (targetPosRef.current.lng - startPosRef.current.lng) * t;

            if (markerRef.current) markerRef.current.setLatLng([lat, lng]);

            if (progress < 1) {
                requestRef.current = requestAnimationFrame(animate);
            }
        };

        cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [position[0], position[1], isDriver, heading]);

    useEffect(() => () => cancelAnimationFrame(requestRef.current), []);

    return (
        <Marker ref={markerRef} position={position} icon={icon}>
            {children}
        </Marker>
    );
};

// ── Main Map Component ────────────────────────────────────────────────────────
const LeafletMap = ({ center = { lat: 8.050, lng: 126.062 }, zoom = 15, markers = [], routeCoordinates = null, heatPoints = [] }) => {
    const { isDarkMode } = useContext(ThemeContext);
    const [history, setHistory] = useState([]);

    // Track driver movement history for trajectory trail
    useEffect(() => {
        const driver = markers.find(m => m.isDriver);
        if (driver) {
            setHistory(prev => {
                const latest = prev[prev.length - 1];
                if (!latest || (latest[0] !== driver.lat || latest[1] !== driver.lng)) {
                    return [...prev, [driver.lat, driver.lng]].slice(-75); // Keep last 75 points
                }
                return prev;
            });
        }
    }, [markers]);

    // High-quality tile layers
    const tileLayer = isDarkMode
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const attribution = isDarkMode
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    const pickup      = markers.find(m => m.isPickup);
    const destination = markers.find(m => m.isDestination);
    const driver      = markers.find(m => m.isDriver);

    return (
        <div className="absolute inset-0 w-full h-full rounded-[2.5rem] overflow-hidden border-4 border-white/50 dark:border-slate-800 shadow-2xl z-0">
            <MapContainer
                center={[center.lat, center.lng]}
                zoom={zoom}
                minZoom={10}
                maxZoom={19}
                style={{ height: '100%', width: '100%', touchAction: 'none' }}
                className="z-0"
                zoomControl={false}
            >
                <TileLayer attribution={attribution} url={tileLayer} />

                {/* Trajectory History — driver's past path */}
                {history.length > 1 && (
                    <Polyline
                        positions={history}
                        pathOptions={{ color: '#FFD700', weight: 3.5, opacity: 0.35, dashArray: '5, 10' }}
                    />
                )}

                {/* OSRM Road Route */}
                {routeCoordinates && routeCoordinates.length > 0 ? (
                    <>
                        {/* Route shadow for depth */}
                        <Polyline
                            positions={routeCoordinates}
                            pathOptions={{ color: '#1e293b', weight: 10, opacity: 0.15 }}
                        />
                        <Polyline
                            positions={routeCoordinates}
                            pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.9 }}
                        />
                    </>
                ) : (
                    <>
                        {/* Fallback straight-line dashes when no road route */}
                        {driver && pickup && (
                            <Polyline
                                positions={[[driver.lat, driver.lng], [pickup.lat, pickup.lng]]}
                                pathOptions={{ color: '#22c55e', weight: 2.5, opacity: 0.6, dashArray: '10, 10' }}
                            />
                        )}
                        {pickup && destination && (
                            <Polyline
                                positions={[[pickup.lat, pickup.lng], [destination.lat, destination.lng]]}
                                pathOptions={{ color: isDarkMode ? '#94a3b8' : '#475569', weight: 1.5, opacity: 0.3, dashArray: '6, 6' }}
                            />
                        )}
                    </>
                )}

                {/* Demand Heatmap */}
                {heatPoints && heatPoints.map((point, i) => (
                    <React.Fragment key={`heat-${i}`}>
                        <CircleMarker center={[point.lat, point.lng]} pathOptions={{ color: 'transparent', fillColor: '#ef4444', fillOpacity: 0.12 }} radius={45} />
                        <CircleMarker center={[point.lat, point.lng]} pathOptions={{ color: 'transparent', fillColor: '#ef4444', fillOpacity: 0.3  }} radius={22} />
                        <CircleMarker center={[point.lat, point.lng]} pathOptions={{ color: 'transparent', fillColor: '#ef4444', fillOpacity: 0.7  }} radius={8}  />
                    </React.Fragment>
                ))}

                {/* Destination pulse ring */}
                {destination && (
                    <Circle
                        center={[destination.lat, destination.lng]}
                        radius={30}
                        pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 2 }}
                    />
                )}

                {/* GPS Accuracy Confidence Circle — shows how precise the driver location is */}
                {driver && driver.accuracy && driver.accuracy > 0 && driver.accuracy < 500 && (
                    <Circle
                        center={[driver.lat, driver.lng]}
                        radius={driver.accuracy}
                        pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.06, weight: 1.5, dashArray: '4, 4' }}
                    />
                )}

                {/* Markers */}
                {markers.map((marker, index) => {
                    let icon;
                    if (marker.isDriver)      icon = buildDriverIcon(marker.heading ?? 0);
                    else if (marker.isPickup) icon = pickupIcon;
                    else if (marker.isDestination) icon = destIcon;
                    else                      icon = youAreHereIcon;

                    return (
                        <SmoothMarker
                            key={marker.id || index}
                            position={[marker.lat, marker.lng]}
                            icon={icon}
                            isDriver={marker.isDriver}
                            heading={marker.heading}
                        >
                            <Popup className="custom-popup">
                                <div className="text-sm font-bold p-2 min-w-[160px]">
                                    {marker.isDriver && (
                                        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100">
                                            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary bg-slate-100 flex-shrink-0">
                                                <img
                                                    src={ensureImageUrl(marker.profile_picture, marker.username || marker.title)}
                                                    alt="Driver"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-primary leading-tight">Driver</div>
                                                <div className="text-secondary truncate font-black">{marker.title}</div>
                                                {marker.accuracy && (
                                                    <div className="text-[9px] text-slate-400 font-bold mt-0.5">
                                                        ±{Math.round(marker.accuracy)} m accuracy
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {!marker.isDriver && (
                                        <div className="text-primary-dark uppercase text-[10px] font-black tracking-widest mb-1">{marker.title}</div>
                                    )}
                                    <div className="text-slate-600 text-xs font-medium leading-relaxed italic">{marker.info}</div>
                                </div>
                            </Popup>
                        </SmoothMarker>
                    );
                })}

                <MapController markers={markers} center={center} />
            </MapContainer>

            {/* Live Legend */}
            <div className="absolute bottom-6 left-6 z-[400] bg-white/85 dark:bg-slate-900/85 backdrop-blur-md px-4 py-2 rounded-2xl border border-black/5 shadow-xl pointer-events-none">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-slate-400"></div>
                        <span className="text-[10px] font-black uppercase text-slate-500">Driver</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                        <span className="text-[10px] font-black uppercase text-slate-500">Pickup</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                        <span className="text-[10px] font-black uppercase text-slate-500">Dest</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeafletMap;
