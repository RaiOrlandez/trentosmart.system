import React, { useEffect, useRef, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import LeafletMap from './LeafletMap';

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
];

const lightMapStyle = [
  { featureType: "all", elementType: "labels.text.fill", stylers: [{ saturation: 36 }, { color: "#333333" }, { lightness: 40 }] }
];

// Simple Google Maps loader and marker manager (no external lib required)
const loadGoogleMaps = (key) => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve(window.google.maps);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=visualization`;
    script.async = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};
const TRENTO_BOUNDS = {
  north: 8.150,
  south: 7.950,
  east: 126.200,
  west: 125.950,
};

const Map = ({ center = { lat: 8.050, lng: 126.062 }, zoom = 14, markers = [], heatPoints = [] }) => {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const heatmapRef = useRef(null);
  const { isDarkMode } = useContext(ThemeContext);
  const key = process.env.REACT_APP_GOOGLE_MAPS_KEY || '';

  // GOOGLE MAPS HOOKS (Must always run for Rule of Hooks)
  useEffect(() => {
    if (!key || key === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') return;

    let mounted = true;
    loadGoogleMaps(key)
      .then((maps) => {
        if (!mounted || !ref.current) return;
        mapRef.current = new maps.Map(ref.current, {
          center,
          zoom,
          styles: isDarkMode ? darkMapStyle : lightMapStyle,
          restriction: {
            latLngBounds: TRENTO_BOUNDS,
            strictBounds: false
          },
          minZoom: 12,
          maxZoom: 18,
          mapTypeControl: false,
          streetViewControl: false
        });
      })
      .catch((e) => console.error('Failed to load Google Maps', e));

    return () => {
      mounted = false;
    };
  }, [key, center, zoom, isDarkMode]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    // Heatmap Logic
    if (heatmapRef.current) heatmapRef.current.setMap(null);

    if (heatPoints.length > 0) {
      const data = heatPoints.map(p => new window.google.maps.LatLng(p.lat, p.lng));
      heatmapRef.current = new window.google.maps.visualization.HeatmapLayer({
        data: data,
        map: mapRef.current,
        radius: 30,
        opacity: 0.8
      });
    }

    // clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    markers.forEach((m) => {
      const marker = new window.google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: mapRef.current,
        title: m.title || '',
        icon: m.isDriver ? {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 5,
          fillColor: "#FFD700",
          fillOpacity: 1,
          strokeWeight: 2,
          rotation: 0
        } : null
      });
      if (m.info) {
        const infowindow = new window.google.maps.InfoWindow({ content: m.info });
        marker.addListener('click', () => infowindow.open(mapRef.current, marker));
      }
      markersRef.current.push(marker);
    });

    if (markers.length > 0) {
      const focusMarker = markers.find(m => m.forceFocus);
      if (focusMarker) {
        mapRef.current.panTo({ lat: focusMarker.lat, lng: focusMarker.lng });
        mapRef.current.setZoom(16);
      } else {
        const bounds = new window.google.maps.LatLngBounds();
        markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
        mapRef.current.fitBounds(bounds);
      }
    }
  }, [markers, heatPoints]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setOptions({ styles: isDarkMode ? darkMapStyle : lightMapStyle });
    }
  }, [isDarkMode]);

  // If no Google Maps key, use Leaflet fallback
  if (!key || key === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    return <LeafletMap center={center} zoom={zoom} markers={markers} />;
  }

  return <div ref={ref} className="w-full h-full min-h-[400px]" />;
};

export default Map;
