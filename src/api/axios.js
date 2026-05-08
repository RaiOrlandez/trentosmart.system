import axios from 'axios';

// Use environment variable or fallback to 127.0.0.1 for better reliability
const API_BASE = process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  // Don't set default Content-Type - let it be set per request
  // This allows multipart/form-data to work correctly
});

// Attach token if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Set Content-Type to application/json for non-FormData requests
  // For FormData, browser will automatically set multipart/form-data with boundary
  if (!(config.data instanceof FormData) && !config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }

  return config;
});

// Handle global API errors gracefully
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Automatically log out if JWT token expires or is invalid
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to login only if not already there
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
