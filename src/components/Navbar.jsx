import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { Menu, X, LogOut, User, LayoutDashboard, Zap, Wallet, Calendar, History as HistoryIcon, Sun, Moon, Star } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsMenuOpen(false);
  };

  return (
    <nav className="fixed w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2 group">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
            <Zap size={20} className="text-secondary" />
          </div>
          <span className="text-secondary font-bold text-xl tracking-tight uppercase">Trento<span className="text-primary-dark">Smart</span></span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          {user ? (
            <>
              {user.role === 'passenger' && (
                <>
                  <Link to="/passenger" className="nav-link flex items-center space-x-1">
                    <LayoutDashboard size={18} />
                    <span>Dashboard</span>
                  </Link>
                  <Link to="/scheduled" className="nav-link flex items-center space-x-1">
                    <Calendar size={18} />
                    <span>Scheduled</span>
                  </Link>
                  <Link to="/history" className="nav-link flex items-center space-x-1">
                    <HistoryIcon size={18} />
                    <span>History</span>
                  </Link>
                  <Link to="/wallet" className="nav-link flex items-center space-x-1">
                    <Wallet size={18} />
                    <span>Wallet</span>
                  </Link>
                  <Link to="/passenger/reviews" className="nav-link flex items-center space-x-1">
                    <Star size={18} />
                    <span>My Reviews</span>
                  </Link>
                </>
              )}
              {user.role === 'driver' && (
                <>
                  <Link to="/driver" className="nav-link flex items-center space-x-1">
                    <LayoutDashboard size={18} />
                    <span>Drive</span>
                  </Link>
                  <Link to="/driver/reviews" className="nav-link flex items-center space-x-1">
                    <Star size={18} />
                    <span>Reviews</span>
                  </Link>
                </>
              )}
              {user.role === 'admin' && (
                <Link to="/admin" className="nav-link flex items-center space-x-1">
                  <LayoutDashboard size={18} />
                  <span>Admin Panel</span>
                </Link>
              )}
              <div className="flex items-center space-x-4 border-l pl-8 border-slate-200 dark:border-slate-800">
                <Link to="/profile" className="flex items-center space-x-2 text-slate-700 font-medium hover:text-primary transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                    <User size={16} />
                  </div>
                  <span className="text-sm">{user.username || user.email}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Sign In</Link>
              <Link to="/register" className="btn-primary py-2 px-6">
                Get Started
              </Link>
            </>
          )}

          <button
            onClick={toggleTheme}
            className="p-2 ml-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-primary hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-transparent dark:border-slate-700"
            title={isDarkMode ? "Light Mode" : "Dark Mode"}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 text-slate-600"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-6 space-y-4 animate-in slide-in-from-top duration-300">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Settings</span>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-primary transition-all"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
          {user ? (
            <>
              <div className="pb-4 border-b border-slate-100 mb-4 flex items-center space-x-3">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                  <User size={20} />
                </div>
                <div>
                  <p className="font-bold text-secondary">{user.username || 'User'}</p>
                  <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                </div>
              </div>
              {user.role === 'passenger' && (
                <>
                  <Link to="/passenger" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>Dashboard</Link>
                  <Link to="/scheduled" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>Scheduled Rides</Link>
                  <Link to="/history" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>Ride History</Link>
                  <Link to="/wallet" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>Smart Wallet</Link>
                  <Link to="/passenger/reviews" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>My Reviews</Link>
                  <Link to="/profile" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>My Profile</Link>
                </>
              )}
              {user.role === 'driver' && (
                <>
                  <Link to="/driver" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>Drive</Link>
                  <Link to="/driver/reviews" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>My Reviews</Link>
                </>
              )}
              {user.role === 'admin' && <Link to="/admin" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>Admin Panel</Link>}
              <button
                onClick={handleLogout}
                className="w-full mt-4 flex items-center justify-center space-x-2 py-3 bg-red-50 text-red-600 rounded-xl font-semibold"
              >
                <LogOut size={20} />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>Sign In</Link>
              <Link to="/register" className="block btn-primary text-center py-3" onClick={() => setIsMenuOpen(false)}>
                Get Started
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
