/**
 * reverseGeocode.js
 * Multi-tiered Reverse Geocoding Utility
 * 
 * Strategy:
 * 1. Esri World Geocoding API (Free, high accuracy for Philippines, CORS enabled)
 * 2. BigDataCloud Reverse Geocoding Client API (Free fallback, CORS enabled)
 * 3. Trento Local Barangay Boundary & Landmark Lookup (Offline / Network failure fallback)
 */

const cache = new Map();

// Local Trento & Agusan del Sur Known Barangay & Landmark Geofences
const TRENTO_LOCATIONS = [
    { name: 'Brgy. Poblacion', road: 'Agusan-Davao National Highway', lat: 8.0355, lng: 126.0643 },
    { name: 'Brgy. Basa', road: 'Trento-Basa Road', lat: 8.0750, lng: 126.0420 },
    { name: 'Brgy. Cuevas', road: 'Cuevas-Bislig Road', lat: 8.1150, lng: 126.0850 },
    { name: 'Brgy. Kapatagan', road: 'Kapatagan Local Road', lat: 8.0120, lng: 126.1100 },
    { name: 'Brgy. Pulang-lupa', road: 'Pulang-lupa Highway', lat: 8.0550, lng: 126.0200 },
    { name: 'Brgy. Salvacion', road: 'Salvacion Barangay Road', lat: 8.0900, lng: 126.0100 },
    { name: 'Brgy. San Ignacio', road: 'San Ignacio Local Road', lat: 8.0050, lng: 126.0350 },
    { name: 'Brgy. San Isidro', road: 'San Isidro Road', lat: 8.0600, lng: 126.1200 },
    { name: 'Brgy. San Roque', road: 'San Roque Access Road', lat: 8.0400, lng: 126.0900 },
    { name: 'Brgy. Santa Maria', road: 'Santa Maria Barangay Road', lat: 8.1400, lng: 126.0500 },
    { name: 'Brgy. Tagbuaya', road: 'Tagbuaya Local Road', lat: 8.0200, lng: 125.9900 },
    { name: 'Brgy. New Visayas', road: 'New Visayas Road', lat: 8.0800, lng: 126.1500 },
    { name: 'Brgy. Manat', road: 'Manat Provincial Road', lat: 7.9700, lng: 126.0500 },
    { name: 'Brgy. Cebolin', road: 'Cebolin Local Road', lat: 8.1500, lng: 126.0200 },
    { name: 'Brgy. Langkilaan', road: 'Langkilaan Barangay Road', lat: 8.0100, lng: 125.9600 },
];

function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function getLocalTrentoFallback(lat, lng) {
    let closest = null;
    let minDistance = Infinity;

    for (const loc of TRENTO_LOCATIONS) {
        const dist = getDistanceKm(lat, lng, loc.lat, loc.lng);
        if (dist < minDistance) {
            minDistance = dist;
            closest = loc;
        }
    }

    if (closest && minDistance <= 15) {
        return {
            display: `${closest.name}, Trento, Agusan del Sur`,
            road: closest.road,
            full: `${closest.name}, ${closest.road}, Trento, Agusan del Sur, Philippines`,
        };
    }

    return {
        display: `Trento / Agusan del Sur Area (${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)})`,
        road: 'Agusan-Davao National Highway',
        full: `GPS Location (${lat}, ${lng})`,
    };
}

/**
 * Helper to safely extract address string from string, object, or legacy [object Object]
 */
export function formatAddress(addr, fallback = '') {
    if (!addr) return fallback;
    if (typeof addr === 'object') {
        const val = addr.display || addr.full || addr.name || addr.road || '';
        return val || fallback;
    }
    const str = String(addr).trim();
    if (!str || str.includes('[object Object]')) {
        return fallback;
    }
    return str;
}

function createGeocodeResult(display, road, full) {
    return {
        display,
        road,
        full,
        toString() {
            return this.display || this.full || '';
        }
    };
}

export async function reverseGeocode(lat, lng) {
    if (lat == null || lng == null) return null;
    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (isNaN(numLat) || isNaN(numLng)) return null;

    const key = `${numLat.toFixed(5)},${numLng.toFixed(5)}`;
    if (cache.has(key)) return cache.get(key);

    // ── Strategy 1: Esri World Geocoding API (High Accuracy Philippines) ─────
    try {
        const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${numLng},${numLat}&f=pjson`;
        const res = await fetch(esriUrl);
        if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            
            const barangay = addr.Neighborhood || addr.District || addr.Block || null;
            const road = addr.Address || addr.ShortLabel || addr.Match_addr || null;
            const city = addr.City || addr.Subregion || 'Agusan del Sur';
            const province = addr.Subregion || addr.Region || 'Caraga';

            const parts = [];
            if (barangay) parts.push(barangay.startsWith('Brgy') ? barangay : `Brgy. ${barangay}`);
            if (city) parts.push(city);
            if (province && province !== city) parts.push(province);

            const display = parts.length > 0 ? parts.join(', ') : (addr.Match_addr || null);

            if (display) {
                const result = createGeocodeResult(
                    display,
                    road !== display ? road : null,
                    addr.LongLabel || addr.Match_addr || display
                );
                cache.set(key, result);
                return result;
            }
        }
    } catch (e) {
        console.warn('[reverseGeocode] Esri failed, trying BigDataCloud:', e.message);
    }

    // ── Strategy 2: BigDataCloud Reverse Geocoding Client API ─────────
    try {
        const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${numLat}&longitude=${numLng}&localityLanguage=en`;
        const res = await fetch(bdcUrl);
        if (res.ok) {
            const data = await res.json();
            const city = data.city || data.locality || null;
            const province = data.principalSubdivision || null;

            const adminArr = data.localityInfo?.administrative || [];
            const barangayItem = adminArr.find(a => a.adminLevel === 7 || a.adminLevel === 8 || a.description?.toLowerCase().includes('village'));
            const barangay = barangayItem ? barangayItem.name : null;

            const parts = [];
            if (barangay) parts.push(barangay.startsWith('Brgy') ? barangay : `Brgy. ${barangay}`);
            if (city) parts.push(city);
            if (province) parts.push(province);

            if (parts.length > 0) {
                const result = createGeocodeResult(parts.join(', '), null, parts.join(', '));
                cache.set(key, result);
                return result;
            }
        }
    } catch (e) {
        console.warn('[reverseGeocode] BigDataCloud failed, falling back to local database:', e.message);
    }

    // ── Strategy 3: Trento Local Geofence Fallback ───────────────────
    const rawFb = getLocalTrentoFallback(numLat, numLng);
    const fallback = createGeocodeResult(rawFb.display, rawFb.road, rawFb.full);
    cache.set(key, fallback);
    return fallback;
}
