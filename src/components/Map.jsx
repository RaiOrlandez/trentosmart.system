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
  north: 8.080,
  south: 8.020,
  east: 126.100,
  west: 126.020,
};

const Map = ({
  center = { lat: 8.03555, lng: 126.06432 },
  zoom = 15,
  markers = [],
  heatPoints = [],
  routeCoordinates = null,
  secondaryRouteCoordinates = null,
  onMapClick = null,
  mapClickEnabled = false,
  fitBoundsPoints = null,
  fitBoundsKey = 0,
  onSelectPickup = null,
  onSelectDestination = null,
}) => {
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
      // Use a custom icon if it's a driver
      let icon = null;
      if (m.isDriver) {
        icon = {
          path: 'M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z', // Professional Navigation Arrow
          fillColor: '#FFD700',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#000',
          scale: 1.5,
          anchor: new window.google.maps.Point(12, 12),
          rotation: m.heading || 0
        };
      } else if (m.isPickup) {
        icon = {
          url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
        };
      } else if (m.isDestination) {
        icon = {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
        };
      }

      const marker = new window.google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: mapRef.current,
        title: m.title || '',
        icon: icon,
        optimized: true
      });

      if (m.info) {
        const infowindow = new window.google.maps.InfoWindow({ content: m.info });
        marker.addListener('click', () => infowindow.open(mapRef.current, marker));
      }
      markersRef.current.push(marker);
    });

    if (markers.length > 0) {
      const focusMarker = markers.find(m => m.forceFocus || m.isTracking);
      if (focusMarker) {
        // If forceFocus is a timestamp (from button click), we do a hard zoom and pan
        // If it's isTracking (continuous), we just pan smoothly
        if (typeof focusMarker.forceFocus === 'number') {
          mapRef.current.setZoom(17);
          mapRef.current.panTo({ lat: focusMarker.lat, lng: focusMarker.lng });
        } else {
          mapRef.current.panTo({ lat: focusMarker.lat, lng: focusMarker.lng });
        }
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
    return (
      <LeafletMap
        center={center}
        zoom={zoom}
        markers={markers}
        routeCoordinates={routeCoordinates}
        secondaryRouteCoordinates={secondaryRouteCoordinates}
        heatPoints={heatPoints}
        onMapClick={onMapClick}
        mapClickEnabled={mapClickEnabled}
        fitBoundsPoints={fitBoundsPoints}
        fitBoundsKey={fitBoundsKey}
        onSelectPickup={onSelectPickup}
        onSelectDestination={onSelectDestination}
      />
    );
  }

  return <div ref={ref} className="absolute inset-0 w-full h-full min-h-[400px]" />;
};

export default Map;
