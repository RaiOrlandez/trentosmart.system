import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// role param can be a string or array of strings
const ProtectedRoute = ({ children, role }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Short timeout to allow auth context to initialize
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <div style={{ padding: 12 }}>Loading...</div>;
  }

  if (!user) {
    if (role === 'admin' || (Array.isArray(role) && role.includes('admin'))) {
      return <Navigate to="/admin-login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
