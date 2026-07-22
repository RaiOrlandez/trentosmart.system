/**
 * reverseGeocode.js
 * Converts GPS coordinates (lat, lng) into a human-readable Philippine address
 * using the FREE OpenStreetMap Nominatim API (no API key required).
 *
 * Output format (example):
 *   "Purok 5, Brgy. Poblacion, Trento, Agusan del Sur"
 *
 * Rate limit: Nominatim allows ~1 request/second. We cache results in a
 * module-level Map to avoid repeated calls within the same session.
 */

const cache = new Map();

/**
 * Convert lat/lng → human-readable address string
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string>} e.g. "Brgy. Poblacion, Trento, Agusan del Sur"
 */
export async function reverseGeocode(lat, lng) {
    if (lat == null || lng == null) return null;

    const key = `${parseFloat(lat).toFixed(5)},${parseFloat(lng).toFixed(5)}`;
    if (cache.has(key)) return cache.get(key);

    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            {
                headers: {
                    // Nominatim requires a User-Agent describing your app
                    'Accept-Language': 'en',
                    'User-Agent': 'TrentoSmartTricycleSystem/1.0 (capstone-lgu@trento.gov.ph)',
                },
            }
        );

        if (!res.ok) {
            cache.set(key, null);
            return null;
        }

        const data = await res.json();
        const addr = data.address || {};

        // Build a clean Philippine-style address string
        const parts = [];

        // Sub-village / hamlet / suburb (Purok level)
        if (addr.hamlet)    parts.push(addr.hamlet);
        else if (addr.suburb) parts.push(addr.suburb);

        // Barangay / village
        if (addr.village)   parts.push(`Brgy. ${addr.village}`);
        else if (addr.residential) parts.push(`Brgy. ${addr.residential}`);
        else if (addr.neighbourhood) parts.push(addr.neighbourhood);

        // City / municipality
        if (addr.city)      parts.push(addr.city);
        else if (addr.town)  parts.push(addr.town);
        else if (addr.municipality) parts.push(addr.municipality);

        // Province / state
        if (addr.province)  parts.push(addr.province);
        else if (addr.state) parts.push(addr.state);

        // Nearest road/highway (for highway names)
        const road = addr.road || addr.pedestrian || addr.path || null;

        const displayAddress = parts.length > 0 ? parts.join(', ') : (data.display_name || null);
        const result = {
            display: displayAddress,
            road: road,
            full: data.display_name,
            raw: addr,
        };

        cache.set(key, result);
        return result;
    } catch (e) {
        console.warn('[reverseGeocode] Failed:', e.message);
        cache.set(key, null);
        return null;
    }
}
