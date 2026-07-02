import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import jwtDecode from 'jwt-decode';
import { requestForToken } from '../firebase';

export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Return a dummy object if outside provider to prevent crashes during initial build/render
    // but normally we want this to error. Since we are troubleshooting "not found" error:
    return { user: null, login: () => { }, logout: () => { } };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({ ...decoded });
        // Fetch full profile to get profile_picture and other details not in token
        getProfile();
      } catch (err) {
        localStorage.removeItem('token');
      }
    }
  }, []);

  const getProfile = async () => {
    try {
      const res = await api.get('/user/profile/');
      setUser(prev => ({ ...prev, ...res.data }));
      return res.data;
    } catch (err) {
      console.error("Failed to fetch profile", err);
    }
  };

  const enableNotifications = async () => {
    try {
      const fcmToken = await requestForToken();
      if (fcmToken) {
        await api.post('/auth/update-fcm-token/', { token: fcmToken });
        localStorage.setItem('fcm_token', fcmToken);
      }
    } catch (err) {
      console.log("Push notifications not enabled or blocked", err);
    }
  };

  const login = async (credentials) => {
    const { email, password } = credentials;
    const identifier = (email || '').trim();
    try {
      const res = await api.post('/auth/login/', {
        username: identifier,
        email: identifier,
        password,
      });
      const { access, refresh } = res.data;
      const token = access;
      localStorage.setItem('token', token);
      if (refresh) localStorage.setItem('refresh', refresh);
      const decoded = jwtDecode(token);
      setUser(decoded);
      // Immediately get full profile
      getProfile();
      // Ask user for push notification permission
      enableNotifications();
      return decoded;
    } catch (error) {
      if (error.code === 'ERR_NETWORK') {
        throw new Error('Network error. Unable to connect to the authentication server.');
      }
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh');
    localStorage.removeItem('driver_is_online'); // Clear persisted online status on logout
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, getProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
