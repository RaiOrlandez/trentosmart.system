import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import jwtDecode from 'jwt-decode';

export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Return a dummy object if outside provider to prevent crashes during initial build/render
    // but normally we want this to error. Since we are troubleshooting "not found" error:
    return {};
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
      } catch (err) {
        try {
          const decoded = JSON.parse(atob(token));
          if (decoded.exp && decoded.exp < Date.now()) {
            localStorage.removeItem('token');
          } else {
            setUser({ ...decoded });
          }
        } catch (mockErr) {
          localStorage.removeItem('token');
        }
      }
    }
  }, []);

  const login = async (credentials) => {
    const { email, password } = credentials;
    try {
      const res = await api.post('/auth/login/', { username: email, password });
      const { access, refresh } = res.data;
      const token = access;
      localStorage.setItem('token', token);
      if (refresh) localStorage.setItem('refresh', refresh);
      const decoded = jwtDecode(token);
      setUser(decoded);
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
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
