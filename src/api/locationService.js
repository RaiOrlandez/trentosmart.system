import api from './axios';

/**
 * locationService
 * ──────────────────────────────────────────────────────────────────
 * API helpers for real-time GPS location management in TransMart.
 * ──────────────────────────────────────────────────────────────────
 */

/**
 * Push the current user's location to the backend.
 * Works for ALL user roles (passenger / driver / admin).
 *
 * POST /api/location/update/
 *   Body: { lat: number, lng: number }
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<object>} server response data
 */
export const updateMyLocation = async (lat, lng, extras = {}) => {
    const res = await api.post('/location/update/', {
        lat,
        lng,
        heading:  extras.heading  ?? null,
        accuracy: extras.accuracy ?? null,
        speed:    extras.speed    ?? null,
    });
    return res.data;
};

/**
 * Fetch the latest locations for nearby online users.
 * Useful for displaying multiple markers (e.g. nearby drivers).
 *
 * GET /api/location/nearby/?role=driver&lat=8.2965&lng=126.063
 *
 * @param {object} params – optional query params { role, lat, lng }
 * @returns {Promise<Array>} array of user location objects
 */
export const getNearbyLocations = async (params = {}) => {
    const res = await api.get('/location/nearby/', { params });
    return res.data;
};
