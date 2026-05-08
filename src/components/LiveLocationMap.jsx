import React, { useEffect, useRef, useCallback } from 'react';
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Circle,
    useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useGeoLocation from '../hooks/useGeoLocation';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Fix Leaflet default icon paths broken by Webpack ───────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ─── "You are here" custom icon ─────────────────────────────────────────────
const youAreHereIcon = new L.DivIcon({
    className: '',
    html: `
        <div style="position:relative; width:40px; height:40px;">
            <!-- Outer pulse ring -->
            <div style="
                position:absolute; inset:0;
                border-radius:50%;
                background:rgba(99,102,241,0.25);
                animation: tmPulse 2s ease-out infinite;
            "></div>
            <!-- Inner dot -->
            <div style="
                position:absolute; top:50%; left:50%;
                transform:translate(-50%,-50%);
                width:18px; height:18px;
                background: linear-gradient(135deg,#6366f1,#8b5cf6);
                border-radius:50%;
                border:3px solid white;
                box-shadow:0 2px 12px rgba(99,102,241,0.6);
            "></div>
        </div>
        <style>
            @keyframes tmPulse {
                0%   { transform: scale(0.8); opacity:0.8; }
                70%  { transform: scale(2.2); opacity:0;   }
                100% { transform: scale(0.8); opacity:0;   }
            }
        </style>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
});



// ─── Sub-component: smoothly re-center map when location changes ─────────────
function AutoCenter({ lat, lng }) {
    const map = useMap();
    const prevRef = useRef(null);

    useEffect(() => {
        if (!lat || !lng) return;
        const prev = prevRef.current;
        // Only pan if moved more than ~1 metre to avoid jitter
        if (!prev || Math.abs(prev.lat - lat) > 0.00001 || Math.abs(prev.lng - lng) > 0.00001) {
            map.panTo([lat, lng], { animate: true, duration: 1.2 });
            prevRef.current = { lat, lng };
        }
    }, [lat, lng, map]);

    return null;
}

// ─── Status badge component ──────────────────────────────────────────────────
function StatusBadge({ status, error, accuracy }) {
    const configs = {
        loading: {
            bg: 'rgba(15,23,42,0.85)',
            dot: '#94a3b8',
            pulse: false,
            label: 'Acquiring location…',
            sub: 'Please allow location access',
        },
        live: {
            bg: 'rgba(15,23,42,0.87)',
            dot: '#22c55e',
            pulse: true,
            label: 'Tracking live location',
            sub: accuracy ? `±${Math.round(accuracy)} m accuracy` : 'GPS active',
        },

        error: {
            bg: 'rgba(15,23,42,0.87)',
            dot: '#ef4444',
            pulse: false,
            label: 'Location error',
            sub: error || 'Unable to get location',
        },
    };

    const cfg = configs[status] || configs.loading;

    return (
        <div style={{
            background: cfg.bg,
            backdropFilter: 'blur(12px)',
            borderRadius: '999px',
            padding: '8px 16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            userSelect: 'none',
        }}>
            {/* Status dot */}
            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {cfg.pulse && (
                    <span style={{
                        position: 'absolute',
                        inset: -4,
                        borderRadius: '50%',
                        background: cfg.dot,
                        opacity: 0.35,
                        animation: 'tmStatusPulse 1.8s ease-out infinite',
                    }} />
                )}
                <span style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: cfg.dot,
                    boxShadow: `0 0 8px ${cfg.dot}`,
                    display: 'inline-block',
                }} />
            </span>

            <div style={{ lineHeight: 1.2 }}>
                <div style={{ color: 'white', fontSize: 12, fontWeight: 700, letterSpacing: '0.02em' }}>
                    {cfg.label}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 500, marginTop: 1 }}>
                    {cfg.sub}
                </div>
            </div>

            <style>{`
                @keyframes tmStatusPulse {
                    0%   { transform:scale(1);   opacity:0.4; }
                    70%  { transform:scale(2.2); opacity:0;   }
                    100% { transform:scale(1);   opacity:0;   }
                }
            `}</style>
        </div>
    );
}

// ─── Coords badge ─────────────────────────────────────────────────────────────
function CoordsBadge({ lat, lng }) {
    if (!lat || !lng) return null;
    return (
        <div style={{
            background: 'rgba(15,23,42,0.82)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            padding: '8px 14px',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            pointerEvents: 'none',
        }}>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                Your Coordinates
            </div>
            <div style={{ color: 'white', fontFamily: 'monospace', fontSize: 11, fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>Lat: <span style={{ color: '#818cf8' }}>{lat.toFixed(6)}</span></span>
                <span>Lng: <span style={{ color: '#818cf8' }}>{lng.toFixed(6)}</span></span>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
/**
 * LiveLocationMap
 * ─────────────────────────────────────────────────────────────────
 * Displays the current user GPS position on a Leaflet map.
 * Falls back to Trento ADS demo location if GPS is unavailable.
 *
 * Props:
 *   height       – CSS height string (default '480px')
 *   zoom         – initial zoom level (default 16)
 *   showCoords   – show lat/lng overlay badge (default true)
 *   onLocation   – callback({ lat, lng, isDemo }) when location updates
 *   className    – extra CSS class on wrapper
 * ─────────────────────────────────────────────────────────────────
 */
const LiveLocationMap = ({
    height = '480px',
    zoom = 16,
    showCoords = true,
    onLocation,
    className = '',
    extraMarkers = [], // [{ lat, lng, icon, label }]
}) => {
    const { location, status, error, retry } = useGeoLocation();

    // Expose location to parent via callback
    const onLocationRef = useRef(onLocation);
    onLocationRef.current = onLocation;

    useEffect(() => {
        if (location && onLocationRef.current) {
            onLocationRef.current(location);
        }
    }, [location]);

    const center = location
        ? [location.lat, location.lng]
        : [8.2965, 126.0630]; // Default Trento while loading

    const accuracyRadius = location && location.accuracy > 0
        ? location.accuracy
        : 0;

    const markerIcon = youAreHereIcon;
    const popupLabel = '📍 You are here';

    return (
        <div
            className={className}
            style={{
                position: 'relative',
                width: '100%',
                height,
                borderRadius: 24,
                overflow: 'hidden',
                boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
            }}
        >
            {/* ─── Map ─────────────────────────────────────────────────── */}
            <MapContainer
                center={center}
                zoom={zoom}
                minZoom={11}
                maxZoom={19}
                style={{ width: '100%', height: '100%', touchAction: 'none' }}
                zoomControl={true}
            >
                {/* Tile layer – CartoDB Voyager (clean, modern) */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />

                {/* Auto-center on location update */}
                {location && <AutoCenter lat={location.lat} lng={location.lng} />}

                {/* GPS accuracy circle */}
                {accuracyRadius > 0 && (
                    <Circle
                        center={[location.lat, location.lng]}
                        radius={accuracyRadius}
                        pathOptions={{
                            color: '#6366f1',
                            fillColor: '#6366f1',
                            fillOpacity: 0.12,
                            weight: 1.5,
                            dashArray: '4 4',
                        }}
                    />
                )}

                {/* User / Demo marker */}
                {location && (
                    <Marker position={[location.lat, location.lng]} icon={markerIcon}>
                        <Popup className="tm-popup">
                            <div style={{ fontWeight: 700, fontSize: 13, minWidth: 160, padding: '4px 0' }}>
                                {popupLabel}
                                {location.accuracy > 0 && (
                                    <div style={{ fontWeight: 400, fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                        Accuracy: ±{Math.round(location.accuracy)} m
                                    </div>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Additional markers (e.g. nearby drivers) */}
                {extraMarkers.map((m, i) => (
                    <Marker key={i} position={[m.lat, m.lng]} icon={m.icon}>
                        {m.label && (
                            <Popup>
                                <div style={{ fontWeight: 600, fontSize: 12 }}>{m.label}</div>
                            </Popup>
                        )}
                    </Marker>
                ))}
            </MapContainer>

            {/* ─── Status badge (top-centre) ───────────────────────────── */}
            <div style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                whiteSpace: 'nowrap',
            }}>
                <StatusBadge status={status} error={error} accuracy={location?.accuracy} />
            </div>

            {/* ─── Coordinates badge (bottom-left) ─────────────────────── */}
            <AnimatePresence>
                {showCoords && location && (
                    <motion.div
                        key="coords"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'absolute',
                            bottom: 16,
                            left: 16,
                            zIndex: 1000,
                        }}
                    >
                        <CoordsBadge lat={location.lat} lng={location.lng} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Retry button (if GPS error & not demo) ───────────────── */}
            {status === 'error' && (
                <div style={{
                    position: 'absolute',
                    bottom: 16,
                    right: 16,
                    zIndex: 1000,
                }}>
                    <button
                        onClick={retry}
                        style={{
                            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 12,
                            padding: '8px 16px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                        }}
                    >
                        🔄 Retry GPS
                    </button>
                </div>
            )}

            {/* ─── Loading skeleton overlay ─────────────────────────────── */}
            <AnimatePresence>
                {status === 'loading' && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 999,
                            background: 'rgba(15,23,42,0.55)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            gap: 12,
                        }}
                    >
                        <div style={{
                            width: 48,
                            height: 48,
                            border: '4px solid rgba(255,255,255,0.15)',
                            borderTop: '4px solid #6366f1',
                            borderRadius: '50%',
                            animation: 'tmSpin 0.9s linear infinite',
                        }} />
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, letterSpacing: '0.02em' }}>
                            Getting your location…
                        </div>
                        <style>{`
                            @keyframes tmSpin {
                                to { transform: rotate(360deg); }
                            }
                        `}</style>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LiveLocationMap;
