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

// Handle global API errors gracefully and auto-refresh JWT token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If the error is 401 Unauthorized and we haven't already retried
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refresh');
      
      if (refreshToken) {
        try {
          // Send request to refresh endpoint
          const response = await axios.post(`${API_BASE}/auth/token/refresh/`, {
            refresh: refreshToken
          });
          
          // Save the new access token
          const newAccessToken = response.data.access;
          localStorage.setItem('token', newAccessToken);
          
          // Update the authorization header for the original request
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          
          // Retry the original request
          return api(originalRequest);
        } catch (refreshError) {
          // If refresh fails (e.g. refresh token is expired), log out
          localStorage.removeItem('token');
          localStorage.removeItem('refresh');
          localStorage.removeItem('user');
          if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token available, normal logout
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
