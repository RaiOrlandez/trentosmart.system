import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, Calendar, MapPin, Navigation2, MessageSquare, TrendingUp,
  Award, ArrowLeft, Trophy, Bell, RefreshCw, ChevronDown,
  ThumbsUp, ThumbsDown, Sparkles, Radio
} from 'lucide-react';
import api from '../../api/axios';
import { Link } from 'react-router-dom';

// ─── Real-time polling interval (ms) ──────────────────────────────────────────
const POLL_INTERVAL = 30_000; // 30 seconds

const DriverReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('newest'); // newest | oldest | highest | lowest
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [newReviewToast, setNewReviewToast] = useState(null);
  const [isLive, setIsLive] = useState(false); // Pulse when a live poll runs
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const knownIdsRef = useRef(new Set());
  const pollingRef = useRef(null);

  const [stats, setStats] = useState({
    totalReviews: 0,
    averageRating: 0,
    fiveStarCount: 0,
    fourStarCount: 0,
    threeStarCount: 0,
    twoStarCount: 0,
    oneStarCount: 0,
    mostRecentRating: 0,
    ratingDistribution: {}
  });

  // ── Compute stats from review array ──────────────────────────────────────────
  const computeStats = useCallback((reviewsData) => {
    const total = reviewsData.length;
    const avg = total > 0
      ? (reviewsData.reduce((s, r) => s + r.rating, 0) / total).toFixed(1)
      : 0;
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviewsData.forEach(r => { if (counts[r.rating] !== undefined) counts[r.rating]++; });
    setStats({
      totalReviews: total,
      averageRating: avg,
      fiveStarCount: counts[5],
      fourStarCount: counts[4],
      threeStarCount: counts[3],
      twoStarCount: counts[2],
      oneStarCount: counts[1],
      mostRecentRating: total > 0 ? reviewsData[0].rating : 0,
      ratingDistribution: counts
    });
  }, []);

  // ── Fetch reviews (initial + polling) ────────────────────────────────────────
  const fetchReviews = useCallback(async (isPolling = false) => {
    try {
      if (isPolling) setIsLive(true);
      const res = await api.get('/reviews/');
      const data = Array.isArray(res.data) ? res.data : [];

      // Detect brand-new reviews that arrived since the last fetch
      if (isPolling && knownIdsRef.current.size > 0) {
        const incoming = data.filter(r => !knownIdsRef.current.has(r.id));
        if (incoming.length > 0) {
          const newest = incoming[0];
          setNewReviewToast({
            id: newest.id,
            reviewer: newest.reviewer?.username || 'Someone',
            rating: newest.rating,
          });
          // Auto-dismiss toast after 5 s
          setTimeout(() => setNewReviewToast(null), 5000);
        }
      }

      // Update known ID set
      knownIdsRef.current = new Set(data.map(r => r.id));
      setReviews(data);
      computeStats(data);
      setLastFetchTime(new Date());
    } catch (err) {
      console.error('Failed to fetch reviews', err);
    } finally {
      setLoading(false);
      if (isPolling) setTimeout(() => setIsLive(false), 600);
    }
  }, [computeStats]);

  // ── Mount: initial fetch + start polling ─────────────────────────────────────
  useEffect(() => {
    fetchReviews(false);
    pollingRef.current = setInterval(() => fetchReviews(true), POLL_INTERVAL);
    return () => clearInterval(pollingRef.current);
  }, [fetchReviews]);

  // ── Sort reviews ─────────────────────────────────────────────────────────────
  const sortedReviews = [...reviews].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
    if (sortBy === 'highest') return b.rating - a.rating;
    if (sortBy === 'lowest') return a.rating - b.rating;
    return 0;
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

  const renderStars = (rating, size = 18) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} size={size}
          className={s <= rating ? 'fill-primary text-primary' : 'text-slate-200'} />
      ))}
    </div>
  );

  const getRatingColor = (rating) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 3.5) return 'text-blue-600';
    if (rating >= 2.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Sentiment border/bg based on star rating for each review card
  const getSentimentStyle = (rating) => {
    if (rating === 5) return { border: 'border-l-green-400', bg: 'bg-green-50/50 dark:bg-green-900/10' };
    if (rating === 4) return { border: 'border-l-blue-400', bg: 'bg-blue-50/50 dark:bg-blue-900/10' };
    if (rating === 3) return { border: 'border-l-yellow-400', bg: 'bg-yellow-50/50 dark:bg-yellow-900/10' };
    if (rating === 2) return { border: 'border-l-orange-400', bg: 'bg-orange-50/50 dark:bg-orange-900/10' };
    return { border: 'border-l-red-400', bg: 'bg-red-50/50 dark:bg-red-900/10' };
  };

  const getRatingBadge = (avg) => {
    const n = parseFloat(avg);
    if (n >= 4.8) return { label: 'Excellent ⭐', color: 'bg-green-100 text-green-700' };
    if (n >= 4.5) return { label: 'Great', color: 'bg-blue-100 text-blue-700' };
    if (n >= 4.0) return { label: 'Good', color: 'bg-cyan-100 text-cyan-700' };
    if (n >= 3.5) return { label: 'Average', color: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Needs Improvement', color: 'bg-red-100 text-red-700' };
  };

  const sortLabels = {
    newest: 'Newest First',
    oldest: 'Oldest First',
    highest: 'Highest Rated',
    lowest: 'Lowest Rated'
  };

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen pt-20 pb-10 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-bold">Loading your reviews...</p>
        </div>
      </div>
    );
  }

  const badge = getRatingBadge(stats.averageRating);

  return (
    <div className="min-h-screen pt-20 pb-10 bg-slate-100 dark:bg-slate-950 px-4 md:px-6">
      <div className="max-w-6xl mx-auto">

        {/* ── Live "New Review" Toast ─────────────────────────────────────────── */}
        <AnimatePresence>
          {newReviewToast && (
            <motion.div
              initial={{ y: -80, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -80, opacity: 0, scale: 0.9 }}
              className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-4 bg-white dark:bg-slate-900 border-2 border-primary shadow-2xl shadow-primary/20 rounded-2xl px-6 py-4 max-w-sm w-[90vw]"
            >
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0 animate-bounce">
                <Bell size={18} className="text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">New Review!</p>
                <p className="text-sm font-bold text-secondary dark:text-white truncate">
                  {newReviewToast.reviewer} gave you {newReviewToast.rating} star{newReviewToast.rating !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-0.5 shrink-0">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={12}
                    className={s <= newReviewToast.rating ? 'fill-primary text-primary' : 'text-slate-200'} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <Link to="/driver" className="inline-flex items-center gap-2 text-slate-500 hover:text-primary transition-colors mb-4">
            <ArrowLeft size={20} />
            <span className="font-bold">Back to Dashboard</span>
          </Link>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-4xl font-black text-secondary dark:text-white">My Reviews</h1>
                {/* Live indicator */}
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
                  isLive
                    ? 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-200'
                    : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-white/10'
                }`}>
                  <Radio size={10} className={isLive ? 'animate-pulse' : ''} />
                  Live
                </div>
              </div>
              <p className="text-slate-500 font-medium">
                Real-time passenger feedback · Updates every 30s
                {lastFetchTime && (
                  <span className="ml-2 text-[11px] text-slate-400">
                    · Last checked {lastFetchTime.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {stats.totalReviews > 0 && (
                <div className={`px-5 py-2.5 rounded-2xl font-black text-sm ${badge.color}`}>
                  {badge.label}
                </div>
              )}
              <button
                onClick={() => fetchReviews(true)}
                title="Refresh now"
                className="w-10 h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl flex items-center justify-center text-slate-500 hover:text-primary transition-colors shadow-sm"
              >
                <RefreshCw size={16} className={isLive ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats Cards ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              icon: <MessageSquare className="text-primary" size={22} />,
              bg: 'bg-primary/10',
              label: 'Total Reviews',
              value: stats.totalReviews,
              color: 'text-secondary dark:text-white'
            },
            {
              icon: <TrendingUp className="text-blue-600" size={22} />,
              bg: 'bg-blue-100 dark:bg-blue-900/30',
              label: 'Avg Rating',
              value: stats.averageRating,
              color: getRatingColor(parseFloat(stats.averageRating))
            },
            {
              icon: <Award className="text-yellow-600" size={22} />,
              bg: 'bg-yellow-100 dark:bg-yellow-900/30',
              label: '5-Star Reviews',
              value: stats.fiveStarCount,
              color: 'text-secondary dark:text-white'
            },
            {
              icon: <Star className="text-green-600 fill-green-600" size={22} />,
              bg: 'bg-green-100 dark:bg-green-900/30',
              label: 'Latest Rating',
              value: stats.mostRecentRating,
              color: 'text-secondary dark:text-white'
            }
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm"
            >
              <div className={`w-11 h-11 ${card.bg} rounded-2xl flex items-center justify-center mb-3`}>
                {card.icon}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
              <p className={`text-3xl font-black ${card.color}`}>{card.value}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Rating Distribution ──────────────────────────────────────────────── */}
        {stats.totalReviews > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-white/5 shadow-sm mb-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Trophy className="text-primary" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-secondary dark:text-white">Rating Distribution</h2>
                <p className="text-[11px] text-slate-400 font-medium">Based on {stats.totalReviews} reviews</p>
              </div>
            </div>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = stats.ratingDistribution[rating] || 0;
                const pct = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
                const barColor = rating === 5 ? 'bg-green-500' : rating === 4 ? 'bg-blue-500' :
                  rating === 3 ? 'bg-yellow-500' : rating === 2 ? 'bg-orange-500' : 'bg-red-500';
                return (
                  <div key={rating} className="flex items-center gap-4">
                    <div className="flex items-center gap-1 w-16 shrink-0">
                      <span className="text-sm font-black text-slate-600 dark:text-slate-300">{rating}</span>
                      <Star size={13} className="fill-primary text-primary" />
                    </div>
                    <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className={`h-full ${barColor} rounded-full`}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-20 text-right shrink-0">
                      {count} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Reviews List ─────────────────────────────────────────────────────── */}
        {reviews.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 text-center border border-slate-100 dark:border-white/5">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageSquare size={40} className="text-slate-300" />
            </div>
            <h3 className="text-2xl font-black text-secondary dark:text-white mb-2">No Reviews Yet</h3>
            <p className="text-slate-500 font-medium mb-6">Complete rides to receive passenger feedback!</p>
            <Link to="/driver" className="inline-block bg-primary text-secondary font-black px-8 py-4 rounded-2xl hover:bg-primary-dark transition-all">
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <div>
            {/* Sort bar */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-secondary dark:text-white">
                All Reviews
                <span className="ml-2 text-sm font-bold text-slate-400">({reviews.length})</span>
              </h2>

              {/* Sort Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(prev => !prev)}
                  className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-xl text-sm font-bold text-secondary dark:text-white hover:border-primary transition-colors shadow-sm"
                >
                  <span>{sortLabels[sortBy]}</span>
                  <ChevronDown size={14} className={`transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showSortMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden min-w-[160px]"
                    >
                      {Object.entries(sortLabels).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => { setSortBy(key); setShowSortMenu(false); }}
                          className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${
                            sortBy === key
                              ? 'bg-primary/10 text-primary'
                              : 'text-secondary dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="space-y-4">
              {sortedReviews.map((review, index) => {
                const sentiment = getSentimentStyle(review.rating);
                return (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.04, 0.4) }}
                    className={`bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-white/5 border-l-4 ${sentiment.border} ${sentiment.bg} shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Left: Reviewer info */}
                      <div className="flex-shrink-0">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm">
                            <img
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${review.reviewer?.username || 'reviewer'}`}
                              alt="Reviewer"
                            />
                          </div>
                          <div>
                            <p className="font-black text-secondary dark:text-white">{review.reviewer?.username || 'Passenger'}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Passenger</p>
                          </div>
                        </div>
                        {/* Stars */}
                        <div className="flex items-center gap-2 mb-2">
                          {renderStars(review.rating)}
                          <span className="text-sm font-black text-slate-600 dark:text-slate-300">({review.rating}/5)</span>
                        </div>
                        {/* Sentiment icon */}
                        <div className="flex items-center gap-1 mb-2">
                          {review.rating >= 4
                            ? <ThumbsUp size={14} className="text-green-500" />
                            : <ThumbsDown size={14} className="text-red-500" />
                          }
                          <span className={`text-[10px] font-black uppercase tracking-wide ${
                            review.rating >= 4 ? 'text-green-600' : review.rating >= 3 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {review.rating === 5 ? 'Excellent' : review.rating === 4 ? 'Good' :
                              review.rating === 3 ? 'Okay' : review.rating === 2 ? 'Poor' : 'Very Poor'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                          <Calendar size={12} />
                          <span>{formatDate(review.created_at)}</span>
                        </div>
                      </div>

                      {/* Right: Ride details + comment */}
                      <div className="flex-1">
                        {review.ride && (
                          <div className="mb-4 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                            <div className="flex items-start gap-3 mb-2">
                              <MapPin size={14} className="text-primary mt-0.5 shrink-0" />
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pickup</p>
                                <p className="text-sm font-medium text-secondary dark:text-white">{review.ride.pickup_address || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <Navigation2 size={14} className="text-accent mt-0.5 shrink-0" />
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Destination</p>
                                <p className="text-sm font-medium text-secondary dark:text-white">{review.ride.dest_address || 'N/A'}</p>
                              </div>
                            </div>
                            {review.ride.fare && (
                              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                <p className="text-[10px] font-bold text-slate-400">Fare</p>
                                <p className="text-xs font-black text-primary">₱{review.ride.fare}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Comment */}
                        {review.comment ? (
                          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles size={13} className="text-primary" />
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Passenger Feedback</p>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed italic">
                              "{review.comment}"
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No additional comments provided</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverReviews;
