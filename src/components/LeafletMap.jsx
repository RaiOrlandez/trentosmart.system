import React, { useEffect, useRef, useContext, useState } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ensureImageUrl } from '../utils/url';
import { TRENTO_LANDMARKS } from '../data/trentoLandmarks';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ── Icon Builders ────────────────────────────────────────────────────────────

const driverIconCache = {};
const buildDriverIcon = (headingDeg = 0) => {
    // Round to nearest 5 degrees to keep cache size bounded (max 72 items)
    const roundedHeading = Math.round((headingDeg % 360) / 5) * 5;
    const cacheKey = `${roundedHeading}`;
    if (driverIconCache[cacheKey]) {
        return driverIconCache[cacheKey];
    }

    const icon = new L.Icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
          <defs>
            <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.4"/>
            </filter>
          </defs>
          <circle cx="22" cy="22" r="20" fill="#FFD700" stroke="#1e293b" stroke-width="2.5" filter="url(#s)"/>
          <circle cx="22" cy="22" r="16" fill="#FFC300" stroke="none"/>
          <polygon points="22,8 29,30 22,24 15,30" fill="#1e293b" transform="rotate(${roundedHeading},22,22)"/>
        </svg>
      `),
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -24],
    });
    driverIconCache[cacheKey] = icon;
    return icon;
};

// ── POI Icon Builders & Style Colors ──────────────────────────────────────────
const categoryColors = {
    Government: '#3b82f6', // blue
    Health: '#ef4444',     // red
    Education: '#a855f7',  // purple
    Commerce: '#f97316',   // orange
    Transport: '#06b6d4',  // cyan
    Food: '#eab308',       // yellow
    Bank: '#10b981',       // green
    Church: '#ec4899',     // pink
    Barangay: '#64748b',   // slate
};

const buildPoiIcon = (category, emoji) => new L.DivIcon({
    html: `
        <div style="
            width: 28px;
            height: 28px;
            background: white;
            border: 2px solid ${categoryColors[category] || '#3b82f6'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            transition: all 0.2s;
        " class="poi-icon-inner hover:scale-110">
            ${emoji || '📍'}
        </div>
    `,
    className: 'custom-poi-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
});

const pickupIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
      <defs>
        <filter id="s">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path d="M18 0C8.059 0 0 8.059 0 18c0 11.5 18 28 18 28S36 29.5 36 18C36 8.059 27.941 0 18 0z" fill="#22c55e" filter="url(#s)"/>
      <circle cx="18" cy="18" r="8" fill="white"/>
      <circle cx="18" cy="18" r="4" fill="#22c55e"/>
    </svg>
  `),
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -48],
});

const destIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
      <defs>
        <filter id="s">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path d="M18 0C8.059 0 0 8.059 0 18c0 11.5 18 28 18 28S36 29.5 36 18C36 8.059 27.941 0 18 0z" fill="#ef4444" filter="url(#s)"/>
      <path d="M13 13 L23 23 M23 13 L13 23" stroke="white" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `),
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -48],
});

const youAreHereIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <defs>
        <filter id="s">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity="0.45"/>
        </filter>
      </defs>
      <circle cx="14" cy="14" r="12" fill="#3b82f6" stroke="white" stroke-width="3.5" filter="url(#s)"/>
      <circle cx="14" cy="14" r="5" fill="white" opacity="0.9"/>
    </svg>
  `),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
});

// ── Easing helper ────────────────────────────────────────────────────────────
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// ── Map Controller ────────────────────────────────────────────────────────────
const DEAD_ZONE_DEG = 0.00015;

function MapController({ markers, center }) {
    const map = useMap();
    const lastCenterRef = useRef({ lat: center.lat, lng: center.lng });
    const isFirstLoad = useRef(true);
    const lastHandledFocusRef = useRef(null);
    const [userInteracted, setUserInteracted] = useState(false);
    const userInteractedTimerRef = useRef(null);

    useMapEvents({
        dragstart() {
            setUserInteracted(true);
            clearTimeout(userInteractedTimerRef.current);
            userInteractedTimerRef.current = setTimeout(() => {
                setUserInteracted(false);
            }, 30000);
        },
        zoomstart() {
            setUserInteracted(true);
            clearTimeout(userInteractedTimerRef.current);
            userInteractedTimerRef.current = setTimeout(() => {
                setUserInteracted(false);
            }, 30000);
        }
    });

    useEffect(() => {
        return () => clearTimeout(userInteractedTimerRef.current);
    }, []);

    useEffect(() => {
        if (!center?.lat || !center?.lng || userInteracted) return;
        const latDiff = Math.abs(center.lat - lastCenterRef.current.lat);
        const lngDiff = Math.abs(center.lng - lastCenterRef.current.lng);

        if (latDiff > DEAD_ZONE_DEG || lngDiff > DEAD_ZONE_DEG) {
            map.panTo([center.lat, center.lng], {
                animate: true,
                duration: 0.6,
            });
            lastCenterRef.current = { lat: center.lat, lng: center.lng };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [center.lat, center.lng, map, userInteracted]);

    useEffect(() => {
        if (!markers?.length) return;

        const focusMarker = markers.find(m => m.forceFocus);
        if (focusMarker && focusMarker.forceFocus !== lastHandledFocusRef.current) {
            setUserInteracted(false);
            map.flyTo([focusMarker.lat, focusMarker.lng], 17, { animate: true, duration: 0.8 });
            lastHandledFocusRef.current = focusMarker.forceFocus;
            return;
        }

        if (isFirstLoad.current) {
            if (markers.length === 1) {
                map.panTo([markers[0].lat, markers[0].lng]);
            } else {
                try {
                    const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
                    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17, animate: true });
                } catch (_) { }
            }
            isFirstLoad.current = false;
        }
    }, [markers, map]);

    return (
        userInteracted ? (
            <div className="absolute md:bottom-6 md:right-6 bottom-20 right-4 z-[1000]" style={{ pointerEvents: 'auto' }}>
                <button
                    onClick={() => {
                        setUserInteracted(false);
                        if (center) {
                            map.flyTo([center.lat, center.lng], 15, { animate: true, duration: 0.8 });
                        } else if (markers.length > 0) {
                            const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
                            map.fitBounds(bounds, { padding: [40, 40], animate: true });
                        }
                    }}
                    style={{
                        background: '#FFD700',
                        color: '#0f172a',
                        fontWeight: 'black',
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '10px 18px',
                        borderRadius: '999px',
                        border: '2px solid white',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                        cursor: 'pointer'
                    }}
                    className="hover:scale-105 active:scale-95 transition-transform"
                >
                    🎯 Recenter Map
                </button>
            </div>
        ) : null
    );
}

// ── FitBoundsController — auto-fits map to a set of [lat,lng] points ─────────
// Pass `fitBoundsKey` (any incrementing value) to trigger a new fit.
function FitBoundsController({ points, fitBoundsKey }) {
    const map = useMap();
    const lastKeyRef = useRef(null);

    useEffect(() => {
        if (!points || points.length < 2) return;
        if (fitBoundsKey === lastKeyRef.current) return;
        lastKeyRef.current = fitBoundsKey;

        try {
            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [70, 70], maxZoom: 17, animate: true, duration: 1.0 });
        } catch (_) { }
    }, [map, points, fitBoundsKey]);

    return null;
}

// ── Map Click Handler ────────────────────────────────────────────────────────
function MapClickHandler({ onMapClick, enabled }) {
    useMapEvents({
        click(e) {
            if (enabled && onMapClick) {
                onMapClick(e.latlng.lat, e.latlng.lng);
            }
        },
    });
    return null;
}

// ── Smooth Marker ─────────────────────────────────────────────────────────────
// snapToPosition: when true, skips the 900ms glide animation and snaps directly
// to the new coordinates. Use this for the passenger's own "You are here" pin
// so it always reflects the exact real-time GPS reading without any lag.
const SmoothMarker = ({ position, icon, isDriver, heading, autoOpenPopup, snapToPosition, children }) => {
    const markerRef = useRef(null);
    const requestRef = useRef();
    const startTimeRef = useRef(null);
    const startPosRef = useRef(position);
    const targetPosRef = useRef(position);

    // Auto-open popup when marker first mounts (e.g., after a custom pin drop)
    useEffect(() => {
        if (autoOpenPopup && markerRef.current) {
            // Small delay to ensure popup is attached
            const t = setTimeout(() => {
                if (markerRef.current) markerRef.current.openPopup();
            }, 250);
            return () => clearTimeout(t);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoOpenPopup]);

    // Position interpolation effect (smoothly glides the marker on position change)
    useEffect(() => {
        if (!markerRef.current) return;

        // ✅ snapToPosition: skip animation — snap the pin directly to GPS coords
        if (snapToPosition) {
            cancelAnimationFrame(requestRef.current);
            markerRef.current.setLatLng([position[0], position[1]]);
            startPosRef.current = { lat: position[0], lng: position[1] };
            targetPosRef.current = { lat: position[0], lng: position[1] };
            return;
        }

        const currentLatLng = markerRef.current.getLatLng();

        // Jump guard: if the new position is more than ~200 m away, snap immediately.
        // This prevents the driver icon from slowly gliding across the map when the
        // server sends a corrected GPS fix after a large position error. The threshold
        // 0.0018° ≈ 200 m at Philippine latitudes (1° lat ≈ 111 km).
        const latDelta = Math.abs(position[0] - currentLatLng.lat);
        const lngDelta = Math.abs(position[1] - currentLatLng.lng);
        if (latDelta > 0.0018 || lngDelta > 0.0018) {
            cancelAnimationFrame(requestRef.current);
            markerRef.current.setLatLng([position[0], position[1]]);
            startPosRef.current = { lat: position[0], lng: position[1] };
            targetPosRef.current = { lat: position[0], lng: position[1] };
            return;
        }

        startPosRef.current = { lat: currentLatLng.lat, lng: currentLatLng.lng };
        targetPosRef.current = { lat: position[0], lng: position[1] };
        startTimeRef.current = null;

        const animate = (timestamp) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            // 800ms — snappier than the original 1500ms so the icon reaches the real
            // driver position before the next WebSocket update can interrupt it.
            const progress = (timestamp - startTimeRef.current) / 800;
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
    }, [position[0], position[1], snapToPosition]);

    useEffect(() => () => cancelAnimationFrame(requestRef.current), []);

    return (
        <Marker
            ref={markerRef}
            position={position}
            icon={icon}
            eventHandlers={{
                click: () => {
                    if (markerRef.current) {
                        markerRef.current.openPopup();
                    }
                }
            }}
        >
            {children}
        </Marker>
    );
};

// ── Map Zoom Listener ────────────────────────────────────────────────────────
function ZoomListener({ onChange }) {
    useMapEvents({
        zoomend(e) {
            onChange(e.target.getZoom());
        }
    });
    return null;
}

// ── Main Map Component ────────────────────────────────────────────────────────
const LeafletMap = ({
    center = { lat: 8.03555, lng: 126.06432 },
    zoom = 15,
    markers = [],
    routeCoordinates = null,          // Primary route: driver→pickup or pickup→dest
    secondaryRouteCoordinates = null, // Secondary route: pickup→destination (dashed preview)
    heatPoints = [],
    onMapClick = null,
    mapClickEnabled = false,
    fitBoundsPoints = null,           // Array of [lat,lng] to auto-fit map bounds
    fitBoundsKey = 0,                 // Increment to trigger a new fit
    onSelectPickup = null,            // Callback to set pickup from POI
    onSelectDestination = null,       // Callback to set destination from POI
}) => {
    const { isDarkMode } = useContext(ThemeContext);
    const [history, setHistory] = useState([]);
    const [currentZoom, setCurrentZoom] = useState(zoom);

    useEffect(() => {
        const driver = markers.find(m => m.isDriver);
        if (driver) {
            setHistory(prev => {
                const latest = prev[prev.length - 1];
                if (!latest || (latest[0] !== driver.lat || latest[1] !== driver.lng)) {
                    return [...prev, [driver.lat, driver.lng]].slice(-75);
                }
                return prev;
            });
        }
    }, [markers]);

    const tileLayer = isDarkMode
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

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
                style={{ height: '100%', width: '100%', touchAction: 'pan-x pan-y' }}
                className="z-0"
                zoomControl={false}
            >
                <TileLayer attribution={attribution} url={tileLayer} />
                <ZoomListener onChange={setCurrentZoom} />

                {/* Trajectory History — driver's past path */}
                {history.length > 1 && (
                    <Polyline
                        positions={history}
                        pathOptions={{ color: '#FFD700', weight: 3, opacity: 0.3, dashArray: '5, 10' }}
                    />
                )}

                {/* ── PRIMARY ROUTE (Blue solid) — driver→pickup or active navigation ── */}
                {routeCoordinates && routeCoordinates.length > 0 ? (
                    <>
                        {/* Glow shadow */}
                        <Polyline
                            positions={routeCoordinates}
                            pathOptions={{ color: '#93c5fd', weight: 14, opacity: 0.2 }}
                        />
                        {/* Outer stroke */}
                        <Polyline
                            positions={routeCoordinates}
                            pathOptions={{ color: '#1d4ed8', weight: 7, opacity: 0.5 }}
                        />
                        {/* Primary line */}
                        <Polyline
                            positions={routeCoordinates}
                            pathOptions={{ color: '#3b82f6', weight: 5, opacity: 1.0 }}
                        />
                    </>
                ) : (
                    <>
                        {/* Fallback: straight-line dash driver→pickup */}
                        {driver && pickup && (
                            <Polyline
                                positions={[[driver.lat, driver.lng], [pickup.lat, pickup.lng]]}
                                pathOptions={{ color: '#22c55e', weight: 2, opacity: 0.5, dashArray: '8, 8' }}
                            />
                        )}
                        {/* Fallback: straight-line dash pickup→dest */}
                        {pickup && destination && !secondaryRouteCoordinates && (
                            <Polyline
                                positions={[[pickup.lat, pickup.lng], [destination.lat, destination.lng]]}
                                pathOptions={{ color: isDarkMode ? '#94a3b8' : '#64748b', weight: 1.5, opacity: 0.3, dashArray: '6, 6' }}
                            />
                        )}
                    </>
                )}

                {/* ── SECONDARY ROUTE (Dashed slate) — pickup→destination preview ── */}
                {secondaryRouteCoordinates && secondaryRouteCoordinates.length > 0 && (
                    <>
                        <Polyline
                            positions={secondaryRouteCoordinates}
                            pathOptions={{ color: '#64748b', weight: 4, opacity: 0.25 }}
                        />
                        <Polyline
                            positions={secondaryRouteCoordinates}
                            pathOptions={{ color: '#94a3b8', weight: 2.5, opacity: 0.7, dashArray: '10, 8' }}
                        />
                    </>
                )}

                {/* Demand Heatmap */}
                {heatPoints && heatPoints.map((point, i) => (
                    <React.Fragment key={`heat-${i}`}>
                        <CircleMarker center={[point.lat, point.lng]} pathOptions={{ color: 'transparent', fillColor: '#ef4444', fillOpacity: 0.12 }} radius={45} />
                        <CircleMarker center={[point.lat, point.lng]} pathOptions={{ color: 'transparent', fillColor: '#ef4444', fillOpacity: 0.3 }} radius={22} />
                        <CircleMarker center={[point.lat, point.lng]} pathOptions={{ color: 'transparent', fillColor: '#ef4444', fillOpacity: 0.7 }} radius={8} />
                    </React.Fragment>
                ))}

                {/* Destination pulse ring */}
                {destination && (
                    <Circle
                        center={[destination.lat, destination.lng]}
                        radius={35}
                        pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.12, weight: 2, dashArray: '6, 4' }}
                    />
                )}

                {/* Pickup pulse ring */}
                {pickup && (
                    <Circle
                        center={[pickup.lat, pickup.lng]}
                        radius={28}
                        pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.1, weight: 1.5 }}
                    />
                )}

                {/* GPS Accuracy Confidence Ring (Driver) — only show when fix is good (≤80m) */}
                {driver && driver.accuracy && driver.accuracy > 0 && driver.accuracy <= 80 && (
                    <Circle
                        center={[driver.lat, driver.lng]}
                        radius={driver.accuracy}
                        pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.07, weight: 1.5, opacity: 0.4 }}
                    />
                )}

                {/* GPS Accuracy Confidence Ring (Passenger "You are here") — shows accuracy margin visually */}
                {(() => {
                    const youPin = markers.find(m => m.id === 'you_are_here');
                    if (!youPin || !youPin.accuracy || youPin.accuracy <= 0 || youPin.accuracy > 200) return null;
                    return (
                        <Circle
                            center={[youPin.lat, youPin.lng]}
                            radius={youPin.accuracy}
                            pathOptions={{ color: '#3b82f6', fillColor: '#60a5fa', fillOpacity: 0.10, weight: 1.5, opacity: 0.45, dashArray: '5, 5' }}
                        />
                    );
                })()}

                {/* ── INTERACTIVE POI LANDMARKS ── */}
                {currentZoom >= 14 && TRENTO_LANDMARKS.map((lm) => {
                    // Check if this landmark is already represented by an active pickup/destination pin
                    // to avoid overlapping duplicate markers
                    const isOccupied = markers.some(m =>
                        (m.isPickup || m.isDestination) &&
                        Math.abs(m.lat - lm.lat) < 0.00005 &&
                        Math.abs(m.lng - lm.lng) < 0.00005
                    );
                    if (isOccupied) return null;

                    const icon = buildPoiIcon(lm.category, lm.icon);

                    return (
                        <Marker
                            key={lm.id}
                            position={[lm.lat, lm.lng]}
                            icon={icon}
                        >
                            <Popup className="custom-popup">
                                <div className="text-sm font-bold p-2 min-w-[200px]">
                                    <div className="text-primary-dark uppercase text-[10px] font-black tracking-widest mb-1 flex items-center gap-1">
                                        <span>{lm.icon}</span>
                                        <span>{lm.category}</span>
                                    </div>
                                    <div className="text-secondary font-black text-sm leading-snug">
                                        {lm.name}
                                    </div>
                                    <div className="text-slate-400 text-[9px] font-bold mt-0.5">
                                        Trento ADS Landmark
                                    </div>
                                    {(onSelectPickup || onSelectDestination) && (
                                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                                            {onSelectPickup && (
                                                <button
                                                    onClick={() => {
                                                        onSelectPickup(lm.name, lm.lat, lm.lng);
                                                    }}
                                                    className="flex-1 bg-green-50 hover:bg-green-100 text-green-600 font-black py-1.5 px-2 rounded-lg text-[9px] transition-all border border-green-200/50 uppercase tracking-wider"
                                                >
                                                    Set Pickup
                                                </button>
                                            )}
                                            {onSelectDestination && (
                                                <button
                                                    onClick={() => {
                                                        onSelectDestination(lm.name, lm.lat, lm.lng);
                                                    }}
                                                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-500 font-black py-1.5 px-2 rounded-lg text-[9px] transition-all border border-red-200/50 uppercase tracking-wider"
                                                >
                                                    Set Dest
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Markers */}
                {markers.map((marker, index) => {
                    let icon;
                    // Identify the passenger's own location pin
                    const isYouAreHere = marker.id === 'you_are_here';

                    if (marker.isDriver) icon = buildDriverIcon(marker.heading ?? 0);
                    else if (marker.isPickup) icon = pickupIcon;
                    else if (marker.isDestination) icon = destIcon;
                    else icon = youAreHereIcon;

                    return (
                        <SmoothMarker
                            key={marker.id || index}
                            position={[marker.lat, marker.lng]}
                            icon={icon}
                            isDriver={marker.isDriver}
                            heading={marker.heading}
                            autoOpenPopup={!!marker.autoOpenPopup}
                            snapToPosition={isYouAreHere}
                        >
                            <Popup className="custom-popup">
                                <div className="text-sm font-bold p-1 min-w-[210px]">
                                    {marker.isDriver && (
                                        <div className="space-y-2">
                                            {/* Driver Header with Photo and Name */}
                                            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                                                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-400 bg-amber-50 flex-shrink-0 shadow-sm">
                                                    <img
                                                        src={ensureImageUrl(marker.profile_picture, marker.title || 'Driver')}
                                                        alt="Driver"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-[9px] font-black uppercase tracking-wider text-amber-600 leading-tight">
                                                        🛺 Tricycle Driver
                                                    </div>
                                                    <div className="text-slate-900 font-extrabold text-sm truncate leading-tight">
                                                        {marker.title && marker.title !== 'Driver' ? marker.title : (marker.driverDetails?.username || 'Assigned Driver')}
                                                    </div>
                                                    {marker.driverDetails?.average_rating && (
                                                        <div className="text-[10px] font-bold text-amber-500 flex items-center gap-1 mt-0.5">
                                                            ⭐ {parseFloat(marker.driverDetails.average_rating).toFixed(1)} Rating
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Vehicle & Plate details if available */}
                                            {(marker.driverDetails?.vehicle_plate || marker.driverDetails?.body_number || marker.driverDetails?.vehicle_model) && (
                                                <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300 space-y-1">
                                                    {marker.driverDetails.vehicle_model && (
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-400 font-medium">Model:</span>
                                                            <span className="font-bold">{marker.driverDetails.vehicle_model}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between gap-2">
                                                        {marker.driverDetails.vehicle_plate && marker.driverDetails.vehicle_plate !== 'N/A' && (
                                                            <div><span className="text-slate-400 font-medium">Plate:</span> <span className="font-black text-slate-800 dark:text-slate-200">{marker.driverDetails.vehicle_plate}</span></div>
                                                        )}
                                                        {marker.driverDetails.body_number && marker.driverDetails.body_number !== 'N/A' && (
                                                            <div><span className="text-slate-400 font-medium">Unit:</span> <span className="font-black text-amber-600">#{marker.driverDetails.body_number}</span></div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Status / ETA */}
                                            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 pt-1">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
                                                <span className="leading-tight">{marker.info}</span>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] pt-1 text-slate-400 border-t border-slate-100">
                                                {marker.eta ? (
                                                    <span className="font-bold text-blue-600">⏱️ ~{marker.eta} min away</span>
                                                ) : <span />}
                                                {marker.accuracy ? (
                                                    <span className="font-bold text-slate-400">📍 ±{Math.round(marker.accuracy)}m GPS</span>
                                                ) : <span />}
                                            </div>

                                            {/* Quick Call Action */}
                                            {marker.driverDetails?.phone && marker.driverDetails.phone !== 'N/A' && (
                                                <a
                                                    href={`tel:${marker.driverDetails.phone}`}
                                                    className="mt-2 w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-all shadow-sm no-underline"
                                                >
                                                    📞 Call {marker.title?.split(' ')[0] || 'Driver'} ({marker.driverDetails.phone})
                                                </a>
                                            )}
                                        </div>
                                    )}
                                    {marker.isDestination && !marker.isDriver && (
                                        <div className="mb-1">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">📍 Destination</div>
                                            <div className="text-secondary font-black text-sm leading-snug">{marker.title?.replace('📍 ', '')}</div>
                                            <div className="text-slate-500 text-[11px] font-medium leading-relaxed italic mt-1">{marker.info}</div>
                                        </div>
                                    )}
                                    {!marker.isDriver && !marker.isDestination && (
                                        marker.passengerDetails ? (
                                            <div className="space-y-2 min-w-[200px]">
                                                {/* Passenger Header */}
                                                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-emerald-500 bg-emerald-50 flex-shrink-0 shadow-sm">
                                                        <img
                                                            src={ensureImageUrl(marker.passengerDetails.profile_picture, marker.passengerDetails.username || 'Passenger')}
                                                            alt="Passenger"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[9px] font-black uppercase tracking-wider text-emerald-600 leading-tight">
                                                            👤 Passenger Pickup
                                                        </div>
                                                        <div className="text-slate-900 font-extrabold text-sm truncate leading-tight">
                                                            {marker.passengerDetails.username || 'Passenger'}
                                                        </div>
                                                        {marker.passengerDetails.passenger_count && (
                                                            <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                                                                👥 {marker.passengerDetails.passenger_count} Passenger(s)
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Pickup Address */}
                                                <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                                    <div className="text-slate-400 font-medium text-[9px] uppercase tracking-wider mb-0.5">📍 Pickup Address:</div>
                                                    <div className="font-extrabold text-slate-800 dark:text-slate-200 leading-snug">{marker.passengerDetails.pickup_address || marker.info}</div>
                                                </div>

                                                {/* Fare & Payment Method */}
                                                {(marker.passengerDetails.fare || marker.passengerDetails.payment_method) && (
                                                    <div className="flex items-center justify-between text-[10px] font-extrabold bg-emerald-50 text-emerald-700 p-1.5 rounded-lg">
                                                        <span>Fare: ₱{marker.passengerDetails.fare}</span>
                                                        <span className="uppercase text-[9px] bg-emerald-200/60 px-1.5 py-0.5 rounded">{marker.passengerDetails.payment_method || 'CASH'}</span>
                                                    </div>
                                                )}

                                                <div className="text-slate-500 text-[10px] font-medium leading-relaxed italic">{marker.info}</div>

                                                {/* Quick Call Action */}
                                                {marker.passengerDetails.phone && (
                                                    <a
                                                        href={`tel:${marker.passengerDetails.phone}`}
                                                        className="mt-1 w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-all shadow-sm no-underline"
                                                    >
                                                        📞 Call {marker.passengerDetails.username?.split(' ')[0] || 'Passenger'} ({marker.passengerDetails.phone})
                                                    </a>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="text-primary-dark uppercase text-[10px] font-black tracking-widest mb-1">{marker.title}</div>
                                                <div className="text-slate-500 text-[11px] font-medium leading-relaxed italic mt-1">{marker.info}</div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </Popup>
                        </SmoothMarker>
                    );
                })}

                <MapController markers={markers} center={center} />
                <MapClickHandler onMapClick={onMapClick} enabled={mapClickEnabled} />
                {/* Auto-fit controller — triggers map.fitBounds when fitBoundsPoints changes */}
                {fitBoundsPoints && fitBoundsPoints.length >= 2 && (
                    <FitBoundsController points={fitBoundsPoints} fitBoundsKey={fitBoundsKey} />
                )}
            </MapContainer>

            {/* Live Legend */}
            <div className="absolute bottom-6 left-6 z-[400] bg-white/85 dark:bg-slate-900/85 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-black/5 shadow-xl pointer-events-none">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-yellow-400 border border-yellow-600 shadow-sm"></div>
                        <span className="text-[10px] font-black uppercase text-slate-500">Driver</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
                        <span className="text-[10px] font-black uppercase text-slate-500">Pickup</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div>
                        <span className="text-[10px] font-black uppercase text-slate-500">Dest</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-8 h-1 rounded-full" style={{ background: 'linear-gradient(to right, #3b82f6, #1d4ed8)' }}></div>
                        <span className="text-[10px] font-black uppercase text-slate-500">Route</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeafletMap;
