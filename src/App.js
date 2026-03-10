import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './auth/ProtectedRoute';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import PassengerHome from './pages/passenger/PassengerHome';
import DriverHome from './pages/driver/DriverHome';
import DriverVerification from './pages/driver/DriverVerification';
import EarningsDashboard from './pages/driver/EarningsDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Wallet from './pages/Wallet';
import RideHistory from './pages/RideHistory';
import ScheduledRides from './pages/ScheduledRides';
import Profile from './pages/Profile';
import MyReviews from './pages/passenger/MyReviews';
import SupportComplaints from './pages/passenger/SupportComplaints';
import DriverReviews from './pages/driver/DriverReviews';
import MaintenanceLogs from './pages/driver/MaintenanceLogs';
import PublicTracking from './pages/PublicTracking';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/track/:token" element={<PublicTracking />} />

            <Route path="/passenger" element={<ProtectedRoute role="passenger"><PassengerHome /></ProtectedRoute>} />
            <Route path="/passenger/home" element={<ProtectedRoute role="passenger"><PassengerHome /></ProtectedRoute>} />
            <Route path="/passenger/reviews" element={<ProtectedRoute role="passenger"><MyReviews /></ProtectedRoute>} />
            <Route path="/passenger/support" element={<ProtectedRoute role="passenger"><SupportComplaints /></ProtectedRoute>} />
            <Route path="/driver" element={<ProtectedRoute role="driver"><DriverHome /></ProtectedRoute>} />
            <Route path="/driver/verify" element={<ProtectedRoute role="driver"><DriverVerification /></ProtectedRoute>} />
            <Route path="/driver/earnings" element={<ProtectedRoute role="driver"><EarningsDashboard /></ProtectedRoute>} />
            <Route path="/driver/reviews" element={<ProtectedRoute role="driver"><DriverReviews /></ProtectedRoute>} />
            <Route path="/driver/maintenance" element={<ProtectedRoute role="driver"><MaintenanceLogs /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><RideHistory /></ProtectedRoute>} />
            <Route path="/scheduled" element={<ProtectedRoute><ScheduledRides /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            <Route path="*" element={<div style={{ padding: 12 }}>Not found. <Link to="/">Home</Link></div>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
