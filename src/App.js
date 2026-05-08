import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './auth/ProtectedRoute';
import Navbar from './components/Navbar';

// Lazy load route components for code splitting (Performance Optimization)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PassengerHome = lazy(() => import('./pages/passenger/PassengerHome'));
const DriverHome = lazy(() => import('./pages/driver/DriverHome'));
const DriverVerification = lazy(() => import('./pages/driver/DriverVerification'));
const EarningsDashboard = lazy(() => import('./pages/driver/EarningsDashboard'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const Wallet = lazy(() => import('./pages/Wallet'));
const RideHistory = lazy(() => import('./pages/RideHistory'));
const ScheduledRides = lazy(() => import('./pages/ScheduledRides'));
const Profile = lazy(() => import('./pages/Profile'));
const MyReviews = lazy(() => import('./pages/passenger/MyReviews'));
const SupportComplaints = lazy(() => import('./pages/passenger/SupportComplaints'));
const DriverReviews = lazy(() => import('./pages/driver/DriverReviews'));
const MaintenanceLogs = lazy(() => import('./pages/driver/MaintenanceLogs'));
const PublicTracking = lazy(() => import('./pages/PublicTracking'));

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Navbar />
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          }>
            <Routes>
              <Route path="/" element={<LandingPage />} />
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
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
