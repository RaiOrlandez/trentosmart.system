import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { ensureImageUrl } from '../utils/url';
import { Menu, X, LogOut, User, LayoutDashboard, Zap, Wallet, Calendar, History as HistoryIcon, Sun, Moon, Star, LifeBuoy, ChevronDown, Grid } from 'lucide-react';

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
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 bg-primary rounded-[14px] flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 shadow-md shadow-primary/20">
            <Zap size={22} className="text-secondary" />
          </div>
          <span className="text-secondary font-black text-2xl tracking-[0.15em] uppercase flex items-center">
            TRENTO <span className="text-primary-dark ml-2">SMART</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          {user ? (
            <>
              {user.role === 'passenger' && (
                <>
                  <Link to="/passenger" className="nav-link flex items-center space-x-2 font-bold hover:text-primary transition-colors">
                    <LayoutDashboard size={18} />
                    <span>Dashboard</span>
                  </Link>

                  {/* Dropdown for Features */}
                  <div className="relative group">
                    <button className="nav-link flex items-center space-x-2 font-bold hover:text-primary transition-colors cursor-pointer outline-none">
                      <Grid size={18} />
                      <span>Features</span>
                      <ChevronDown size={14} className="group-hover:rotate-180 transition-transform duration-200" />
                    </button>
                    {/* Dropdown Menu Container */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 min-w-[240px]">
                      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-white/5 p-3 flex flex-col gap-1 relative overflow-hidden">

                        {/* Decorative background element */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2"></div>

                        <Link to="/scheduled" className="flex items-center space-x-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-primary transition-all group/item">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 group-hover/item:bg-primary/10 text-slate-500 group-hover/item:text-primary flex items-center justify-center transition-colors">
                            <Calendar size={18} />
                          </div>
                          <div>
                            <span className="font-bold text-sm block">Scheduled</span>
                            <span className="text-[10px] text-slate-400 font-medium">Manage booked rides</span>
                          </div>
                        </Link>

                        <Link to="/history" className="flex items-center space-x-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-primary transition-all group/item">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 group-hover/item:bg-primary/10 text-slate-500 group-hover/item:text-primary flex items-center justify-center transition-colors">
                            <HistoryIcon size={18} />
                          </div>
                          <div>
                            <span className="font-bold text-sm block">History</span>
                            <span className="text-[10px] text-slate-400 font-medium">View past trips</span>
                          </div>
                        </Link>

                        <Link to="/wallet" className="flex items-center space-x-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-primary transition-all group/item">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 group-hover/item:bg-primary/10 text-slate-500 group-hover/item:text-primary flex items-center justify-center transition-colors">
                            <Wallet size={18} />
                          </div>
                          <div>
                            <span className="font-bold text-sm block">Wallet</span>
                            <span className="text-[10px] text-slate-400 font-medium">Balances & Top-ups</span>
                          </div>
                        </Link>

                        <Link to="/passenger/reviews" className="flex items-center space-x-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-primary transition-all group/item">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 group-hover/item:bg-primary/10 text-slate-500 group-hover/item:text-primary flex items-center justify-center transition-colors">
                            <Star size={18} />
                          </div>
                          <div>
                            <span className="font-bold text-sm block">Reviews</span>
                            <span className="text-[10px] text-slate-400 font-medium">Your given ratings</span>
                          </div>
                        </Link>

                        <div className="h-px w-full bg-slate-100 dark:bg-white/5 my-1"></div>

                        <Link to="/passenger/support" className="flex items-center space-x-4 p-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/10 text-slate-700 dark:text-slate-300 hover:text-red-600 transition-all group/item">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 group-hover/item:bg-red-100 text-slate-500 group-hover/item:text-red-600 flex items-center justify-center transition-colors">
                            <LifeBuoy size={18} />
                          </div>
                          <div>
                            <span className="font-bold text-sm block">Support</span>
                            <span className="text-[10px] text-slate-400 font-medium">Help center & reports</span>
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>
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
                  <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                    <img src={ensureImageUrl(user.profile_picture, user.username)} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-sm dark:text-slate-300 font-black tracking-tight">{user.username || user.email}</span>
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
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800 mb-4 flex items-center space-x-3">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img src={ensureImageUrl(user.profile_picture, user.username)} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-black text-secondary dark:text-white uppercase tracking-tight">{user.username || 'User'}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{user.role}</p>
                </div>
              </div>
              {user.role === 'passenger' && (
                <>
                  <Link to="/passenger" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>Dashboard</Link>
                  <Link to="/scheduled" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>Scheduled Rides</Link>
                  <Link to="/history" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>Ride History</Link>
                  <Link to="/wallet" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>Smart Wallet</Link>
                  <Link to="/passenger/reviews" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>My Reviews</Link>
                  <Link to="/passenger/support" className="block nav-link py-2" onClick={() => setIsMenuOpen(false)}>Support Center</Link>
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
