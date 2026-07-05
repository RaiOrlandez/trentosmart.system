import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './auth/ProtectedRoute';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineFallback';

// Lazy load route components for code splitting (Performance Optimization)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PassengerHome = lazy(() => import('./pages/passenger/PassengerHome'));
const DriverHome = lazy(() => import('./pages/driver/DriverHome'));
const DriverVerification = lazy(() => import('./pages/driver/DriverVerification'));
const EarningsDashboard = lazy(() => import('./pages/driver/EarningsDashboard'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const Login = lazy(() => import('./pages/auth/Login'));
const AdminLogin = lazy(() => import('./pages/auth/AdminLogin'));
const Register = lazy(() => import('./pages/auth/Register'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const Wallet = lazy(() => import('./pages/Wallet'));
const RideHistory = lazy(() => import('./pages/RideHistory'));
const ScheduledRides = lazy(() => import('./pages/ScheduledRides'));
const Profile = lazy(() => import('./pages/Profile'));
const MyReviews = lazy(() => import('./pages/passenger/MyReviews'));
const SupportComplaints = lazy(() => import('./pages/passenger/SupportComplaints'));
const DriverReviews = lazy(() => import('./pages/driver/DriverReviews'));
const MaintenanceLogs = lazy(() => import('./pages/driver/MaintenanceLogs'));
const PublicTracking = lazy(() => import('./pages/PublicTracking'));
const GCashGateway = lazy(() => import('./pages/GCashGateway'));

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ErrorBoundary>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Navbar />
            <OfflineBanner />
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            }>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/admin-login" element={<AdminLogin />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/track/:token" element={<PublicTracking />} />
                <Route path="/gcash-gateway" element={<GCashGateway />} />

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

                <Route path="*" element={
                  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-center px-6">
                    <span className="text-8xl mb-6">🗺️</span>
                    <h1 className="text-3xl font-black text-secondary dark:text-white mb-3">Page Not Found</h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">The page you're looking for doesn't exist.</p>
                    <Link to="/" className="bg-primary text-secondary font-black px-8 py-3 rounded-2xl hover:scale-105 transition-all shadow-lg shadow-primary/20">
                      Go Home
                    </Link>
                  </div>
                } />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
