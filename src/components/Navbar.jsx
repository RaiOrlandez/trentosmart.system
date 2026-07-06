import React, { useContext, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { ensureImageUrl } from '../utils/url';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, LogOut, LayoutDashboard, Zap, Wallet, Calendar,
  History as HistoryIcon, Sun, Moon, Star, LifeBuoy, ChevronDown, Grid
} from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsMenuOpen(false);
  };

  const navLinkVariants = {
    hidden: { opacity: 0, y: -8 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.07, type: 'spring', stiffness: 300, damping: 24 }
    })
  };

  const mobileMenuVariants = {
    hidden: { opacity: 0, y: -16, scaleY: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scaleY: 1,
      transition: { type: 'spring', stiffness: 300, damping: 28, staggerChildren: 0.06 }
    },
    exit: {
      opacity: 0,
      y: -12,
      scaleY: 0.95,
      transition: { duration: 0.2 }
    }
  };

  const mobileItemVariants = {
    hidden: { opacity: 0, x: -12 },
    visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="fixed w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-3 group">
          <motion.div
            whileHover={{ scale: 1.12, rotate: 15 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className="w-10 h-10 bg-primary rounded-[14px] flex items-center justify-center shadow-md shadow-primary/20"
          >
            <Zap size={22} className="text-secondary" />
          </motion.div>
          <span className="text-secondary font-black text-2xl tracking-[0.15em] uppercase flex items-center dark:text-white">
            TRENTO <span className="text-primary ml-2">SMART</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          {user ? (
            <>
              {user.role === 'passenger' && (
                <>
                  <motion.div custom={0} variants={navLinkVariants} initial="hidden" animate="visible">
                    <Link
                      to="/passenger"
                      className={`nav-link flex items-center space-x-2 font-bold transition-colors ${isActive('/passenger') ? 'text-primary' : 'hover:text-primary'}`}
                    >
                      <LayoutDashboard size={18} />
                      <span>Dashboard</span>
                    </Link>
                  </motion.div>

                  {/* Dropdown for Features */}
                  <motion.div custom={1} variants={navLinkVariants} initial="hidden" animate="visible" className="relative group">
                    <button className="nav-link flex items-center space-x-2 font-bold hover:text-primary transition-colors cursor-pointer outline-none">
                      <Grid size={18} />
                      <span>Features</span>
                      <motion.div animate={{}} className="inline-flex">
                        <ChevronDown size={14} className="group-hover:rotate-180 transition-transform duration-200" />
                      </motion.div>
                    </button>
                    {/* Dropdown Menu Container */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 min-w-[240px]">
                      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-white/5 p-3 flex flex-col gap-1 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2"></div>

                        {[
                          { to: '/scheduled', icon: <Calendar size={18} />, label: 'Scheduled', sub: 'Manage booked rides' },
                          { to: '/history', icon: <HistoryIcon size={18} />, label: 'History', sub: 'View past trips' },
                          { to: '/wallet', icon: <Wallet size={18} />, label: 'Wallet', sub: 'Balances & Top-ups' },
                        ].map((item) => (
                          <Link
                            key={item.to}
                            to={item.to}
                            className="flex items-center space-x-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-primary transition-all group/item"
                          >
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 group-hover/item:bg-primary/10 text-slate-500 group-hover/item:text-primary flex items-center justify-center transition-colors">
                              {item.icon}
                            </div>
                            <div>
                              <span className="font-bold text-sm block">{item.label}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{item.sub}</span>
                            </div>
                          </Link>
                        ))}

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
                  </motion.div>
                </>
              )}

              {user.role === 'driver' && (
                <>
                  <motion.div custom={0} variants={navLinkVariants} initial="hidden" animate="visible">
                    <Link to="/driver" className={`nav-link flex items-center space-x-1 font-bold ${isActive('/driver') ? 'text-primary' : ''}`}>
                      <LayoutDashboard size={18} />
                      <span>Drive</span>
                    </Link>
                  </motion.div>
                  <motion.div custom={1} variants={navLinkVariants} initial="hidden" animate="visible">
                    <Link to="/driver/reviews" className={`nav-link flex items-center space-x-1 font-bold ${isActive('/driver/reviews') ? 'text-primary' : ''}`}>
                      <Star size={18} />
                      <span>Reviews</span>
                    </Link>
                  </motion.div>
                  <motion.div custom={2} variants={navLinkVariants} initial="hidden" animate="visible">
                    <Link to="/history" className={`nav-link flex items-center space-x-1 font-bold ${isActive('/history') ? 'text-primary' : ''}`}>
                      <HistoryIcon size={18} />
                      <span>History</span>
                    </Link>
                  </motion.div>
                </>
              )}

              {user.role === 'admin' && (
                <motion.div custom={0} variants={navLinkVariants} initial="hidden" animate="visible">
                  <Link to="/admin" className={`nav-link flex items-center space-x-1 font-bold ${isActive('/admin') ? 'text-primary' : ''}`}>
                    <LayoutDashboard size={18} />
                    <span>Admin Panel</span>
                  </Link>
                </motion.div>
              )}

              <motion.div custom={3} variants={navLinkVariants} initial="hidden" animate="visible" className="flex items-center space-x-4 border-l pl-8 border-slate-200 dark:border-slate-800">
                <Link to="/profile" className="flex items-center space-x-2 text-slate-700 font-medium hover:text-primary transition-colors">
                  <motion.div
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border-2 border-primary/20 overflow-hidden shadow-sm"
                  >
                    <img src={ensureImageUrl(user.profile_picture, user.username)} alt="Avatar" className="w-full h-full object-cover" />
                  </motion.div>
                  <span className="text-sm dark:text-slate-300 font-black tracking-tight">{user.username || user.email}</span>
                </Link>
                <motion.button
                  onClick={handleLogout}
                  whileHover={{ scale: 1.1, backgroundColor: '#fef2f2' }}
                  whileTap={{ scale: 0.92 }}
                  className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                  title="Logout"
                >
                  <LogOut size={20} />
                </motion.button>
              </motion.div>
            </>
          ) : (
            <>
              <motion.div custom={0} variants={navLinkVariants} initial="hidden" animate="visible">
                <Link to="/login" className="nav-link font-bold">Sign In</Link>
              </motion.div>
              <motion.div custom={1} variants={navLinkVariants} initial="hidden" animate="visible">
                <Link to="/register" className="btn-primary py-2 px-6">Get Started</Link>
              </motion.div>
            </>
          )}

          {/* Theme Toggle */}
          <motion.button
            onClick={toggleTheme}
            whileHover={{ scale: 1.1, rotate: isDarkMode ? -15 : 15 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 ml-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-primary hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-transparent dark:border-slate-700"
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isDarkMode ? 'sun' : 'moon'}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </motion.div>
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Mobile Menu Toggle */}
        <motion.button
          className="md:hidden p-2 text-slate-600 dark:text-slate-300"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          whileTap={{ scale: 0.9 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={isMenuOpen ? 'close' : 'open'}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </motion.div>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            variants={mobileMenuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ transformOrigin: 'top' }}
            className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-6 space-y-2 overflow-hidden"
          >
            <motion.div variants={mobileItemVariants} className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Menu</span>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-primary transition-all"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </motion.div>

            {user ? (
              <>
                <motion.div variants={mobileItemVariants} className="pb-4 border-b border-slate-100 dark:border-slate-800 mb-2 flex items-center space-x-3">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-primary/20">
                    <img src={ensureImageUrl(user.profile_picture, user.username)} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-black text-secondary dark:text-white uppercase tracking-tight">{user.username || 'User'}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{user.role}</p>
                  </div>
                </motion.div>

                {user.role === 'passenger' && (
                  <>
                    {[
                      { to: '/passenger', label: '🏠 Dashboard' },
                      { to: '/scheduled', label: '📅 Scheduled Rides' },
                      { to: '/history', label: '🕐 Ride History' },
                      { to: '/wallet', label: '💳 Smart Wallet' },
                      { to: '/passenger/support', label: '🆘 Support Center' },
                      { to: '/profile', label: '👤 My Profile' },
                    ].map((item) => (
                      <motion.div key={item.to} variants={mobileItemVariants}>
                        <Link to={item.to} className="block nav-link py-2.5 font-semibold" onClick={() => setIsMenuOpen(false)}>
                          {item.label}
                        </Link>
                      </motion.div>
                    ))}
                  </>
                )}

                {user.role === 'driver' && (
                  <>
                    {[
                      { to: '/driver', label: '🚗 Drive' },
                      { to: '/driver/earnings', label: '💰 Earnings Hub' },
                      { to: '/history', label: '🕐 Job History' },
                      { to: '/driver/reviews', label: '⭐ My Reviews' },
                      { to: '/profile', label: '👤 My Profile' },
                    ].map((item) => (
                      <motion.div key={item.to} variants={mobileItemVariants}>
                        <Link to={item.to} className="block nav-link py-2.5 font-semibold" onClick={() => setIsMenuOpen(false)}>
                          {item.label}
                        </Link>
                      </motion.div>
                    ))}
                  </>
                )}

                {user.role === 'admin' && (
                  <motion.div variants={mobileItemVariants}>
                    <Link to="/admin" className="block nav-link py-2.5 font-semibold" onClick={() => setIsMenuOpen(false)}>
                      🛡️ Admin Panel
                    </Link>
                  </motion.div>
                )}

                <motion.div variants={mobileItemVariants}>
                  <button
                    onClick={handleLogout}
                    className="w-full mt-4 flex items-center justify-center space-x-2 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl font-semibold border border-red-100 dark:border-red-800/30"
                  >
                    <LogOut size={20} />
                    <span>Sign Out</span>
                  </button>
                </motion.div>
              </>
            ) : (
              <>
                <motion.div variants={mobileItemVariants}>
                  <Link to="/login" className="block nav-link py-2.5 font-semibold" onClick={() => setIsMenuOpen(false)}>Sign In</Link>
                </motion.div>
                <motion.div variants={mobileItemVariants}>
                  <Link to="/register" className="block btn-primary text-center py-3 mt-2" onClick={() => setIsMenuOpen(false)}>
                    Get Started
                  </Link>
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
