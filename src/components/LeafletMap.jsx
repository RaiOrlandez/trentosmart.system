import React, { useEffect, useRef, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Navigation removed as it was unused

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

const TRENTO_BOUNDS = [
    [7.950, 125.950], // Southwest
    [8.150, 126.200]  // Northeast
];

// Component to control map view
function MapController({ markers, center }) {
    const map = useMap();
    const isFirstLoad = useRef(true);

    useEffect(() => {
        if (markers && markers.length > 0) {
            const focusMarker = markers.find(m => m.forceFocus);
            if (focusMarker) {
                map.panTo([focusMarker.lat, focusMarker.lng]);
                map.setZoom(16);
            } else if (markers.length === 1) {
                map.panTo([markers[0].lat, markers[0].lng]);
            } else {
                const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }
    }, [markers, map]);

    return null;
}

const LeafletMap = ({ center = { lat: 8.050, lng: 126.062 }, zoom = 14, markers = [] }) => {
    const { isDarkMode } = useContext(ThemeContext);

    // Dark mode tile layer
    const tileLayer = isDarkMode
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const attribution = isDarkMode
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    return (
        <div className="w-full h-full min-h-[400px] rounded-3xl overflow-hidden border-4 border-white/50 dark:border-slate-800 shadow-2xl">
            <MapContainer
                center={[center.lat, center.lng]}
                zoom={zoom}
                minZoom={12}
                maxZoom={18}
                maxBounds={TRENTO_BOUNDS}
                maxBoundsViscosity={1.0}
                style={{ height: '100%', width: '100%' }}
                className="z-0"
            >
                <TileLayer
                    attribution={attribution}
                    url={tileLayer}
                />

                {markers.map((marker, index) => (
                    <Marker
                        key={index}
                        position={[marker.lat, marker.lng]}
                        icon={marker.isDriver ? driverIcon : new L.Icon.Default()}
                    >
                        {marker.info && (
                            <Popup>
                                <div className="text-sm">
                                    <strong>{marker.title}</strong>
                                    <br />
                                    {marker.info}
                                </div>
                            </Popup>
                        )}
                    </Marker>
                ))}

                <MapController markers={markers} />
            </MapContainer>
        </div>
    );
};

export default LeafletMap;
