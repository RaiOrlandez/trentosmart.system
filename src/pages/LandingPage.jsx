import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Shield, Zap, CreditCard, Users, Clock, ArrowRight } from 'lucide-react';

const LandingPage = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 overflow-x-hidden font-sans transition-colors duration-500">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 md:pt-32 md:pb-48 overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="md:w-1/2 text-left"
            >
              <div className="inline-flex items-center space-x-2 bg-primary/20 text-primary-dark px-4 py-2 rounded-full mb-6 border border-primary/30 backdrop-blur-sm">
                <Zap size={16} />
                <span className="text-sm font-semibold uppercase tracking-wider">Next-Gen Urban Mobility</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-extrabold text-secondary dark:text-white leading-tight mb-6">
                Smart Tricycle <br />
                <span className="text-primary-dark dark:text-primary">Dispatch System</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-8 max-w-lg leading-relaxed">
                Revolutionizing transportation in Trento, Agusan del Sur. Experience seamless bookings, real-time tracking, and verified safety with every ride.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/register" className="btn-primary flex items-center justify-center space-x-2 px-8 py-3">
                  <span>Start a Ride</span>
                  <ArrowRight size={20} />
                </Link>
                <Link to="/login" className="btn-secondary flex items-center justify-center px-8 py-3">
                  Sign In
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="md:w-1/2 relative"
            >
              <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl border-8 border-white/50">
                <img
                  src="/hero.png"
                  alt="Smart Tricycle Trento"
                  className="w-full h-auto object-cover transform hover:scale-105 transition-transform duration-700"
                />
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-primary/30 rounded-full blur-3xl -z-10 animate-pulse"></div>
              <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-accent/20 rounded-full blur-3xl -z-10"></div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white dark:bg-slate-900 transition-colors duration-500 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold text-secondary dark:text-white mb-4">Why Trento Chooses Us?</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Built with reliability and efficiency in mind, our system addresses the core needs of local transportation.</p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {[
              { icon: <MapPin className="text-primary-dark" />, title: "Real-Time Tracking", desc: "Know exactly where your ride is with persistent GPS updates every 5 seconds." },
              { icon: <Shield className="text-green-600" />, title: "Safety First", desc: "Verified drivers, emergency SOS buttons, and trip logs for your peace of mind." },
              { icon: <Clock className="text-accent" />, title: "Instant Dispatch", desc: "Our algorithm connects you to the nearest available driver in seconds." },
              { icon: <CreditCard className="text-purple-600" />, title: "Flexible Payment", desc: "Simulated GCash and PayMaya integration for a contactless experience." },
              { icon: <Users className="text-orange-600" />, title: "Community Driven", desc: "Supporting local livelihood while providing premium service to citizens." },
              { icon: <Zap className="text-yellow-500" />, title: "Fare Transparency", desc: "Automatic fare computation based on official LGU distance rules." },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 hover:border-primary/50 dark:hover:border-primary/30 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm mb-6 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-secondary dark:text-white mb-3">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-24 bg-secondary text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold mb-4">A Solution for Everyone</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Tailored interfaces for different roles to ensure ease of use and administrative control.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { role: "Passenger", color: "bg-primary", link: "/register?role=passenger", desc: "Book rides, track trips, and enjoy safe travel around Trento." },
              { role: "Driver", color: "bg-accent", link: "/register?role=driver", desc: "Accept requests, manage earnings, and grow your transportation business." },
              { role: "Administrator", color: "bg-slate-400", link: "/login", desc: "Monitor activity, manage policies, and ensure system reliability." },
            ].map((role, idx) => (
              <div key={idx} className="glass-card p-8 bg-white/5 border-white/10 rounded-2xl hover:bg-white/10 transition-colors duration-300 flex flex-col items-center text-center">
                <div className={`w-16 h-16 ${role.color} rounded-full flex items-center justify-center mb-6 shadow-xl`}>
                  <Users size={32} className="text-secondary" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{role.role}</h3>
                <p className="text-slate-300 mb-8 flex-grow">{role.desc}</p>
                <Link to={role.link} className="text-primary hover:text-white font-semibold transition-colors flex items-center space-x-2">
                  <span>Enter Dashboard</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <Zap size={20} className="text-secondary" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">TRENTO<span className="text-primary">SMART</span></span>
          </div>
          <div className="text-center md:text-right">
            <p>&copy; 2024 Smart Tricycle Dispatch System. All rights reserved.</p>
            <p className="text-sm mt-1 flex items-center justify-center md:justify-end space-x-2">
              <MapPin size={14} />
              <span>Trento, Agusan del Sur, Philippines</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
