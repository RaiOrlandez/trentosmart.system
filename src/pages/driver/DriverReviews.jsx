import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Calendar, MapPin, Navigation2, MessageSquare, TrendingUp, Award, ArrowLeft, User, Trophy, Target } from 'lucide-react';
import api from '../../api/axios';
import { Link } from 'react-router-dom';

const DriverReviews = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
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

    useEffect(() => {
        fetchReviews();
    }, []);

    const fetchReviews = async () => {
        try {
            const res = await api.get('/reviews/');
            const reviewsData = Array.isArray(res.data) ? res.data : [];
            setReviews(reviewsData);

            // Calculate comprehensive stats
            const totalReviews = reviewsData.length;
            const averageRating = totalReviews > 0
                ? (reviewsData.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
                : 0;

            const ratingCounts = {
                5: reviewsData.filter(r => r.rating === 5).length,
                4: reviewsData.filter(r => r.rating === 4).length,
                3: reviewsData.filter(r => r.rating === 3).length,
                2: reviewsData.filter(r => r.rating === 2).length,
                1: reviewsData.filter(r => r.rating === 1).length,
            };

            const mostRecentRating = reviewsData.length > 0 ? reviewsData[0].rating : 0;

            setStats({
                totalReviews,
                averageRating,
                fiveStarCount: ratingCounts[5],
                fourStarCount: ratingCounts[4],
                threeStarCount: ratingCounts[3],
                twoStarCount: ratingCounts[2],
                oneStarCount: ratingCounts[1],
                mostRecentRating,
                ratingDistribution: ratingCounts
            });
        } catch (err) {
            console.error('Failed to fetch reviews', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderStars = (rating) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={20}
                        className={`${star <= rating ? 'fill-primary text-primary' : 'text-slate-200'}`}
                    />
                ))}
            </div>
        );
    };

    const getRatingColor = (rating) => {
        if (rating >= 4.5) return 'text-green-600 dark:text-green-400';
        if (rating >= 3.5) return 'text-blue-600 dark:text-blue-400';
        if (rating >= 2.5) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    const getRatingBadge = (avgRating) => {
        if (avgRating >= 4.8) return { label: 'Excellent', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
        if (avgRating >= 4.5) return { label: 'Great', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
        if (avgRating >= 4.0) return { label: 'Good', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' };
        if (avgRating >= 3.5) return { label: 'Average', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
        return { label: 'Needs Improvement', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    };

    if (loading) {
        return (
            <div className="min-h-screen pt-20 pb-10 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500 font-bold">Loading your reviews...</p>
                </div>
            </div>
        );
    }

    const badge = getRatingBadge(parseFloat(stats.averageRating));

    return (
        <div className="min-h-screen pt-20 pb-10 bg-slate-100 dark:bg-slate-950 px-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link to="/driver" className="inline-flex items-center gap-2 text-slate-500 hover:text-primary transition-colors mb-4">
                        <ArrowLeft size={20} />
                        <span className="font-bold">Back to Dashboard</span>
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-black text-secondary dark:text-white mb-2">My Reviews</h1>
                            <p className="text-slate-500 font-medium">See what passengers are saying about your service</p>
                        </div>
                        {stats.totalReviews > 0 && (
                            <div className={`px-6 py-3 rounded-2xl font-black text-lg ${badge.color}`}>
                                {badge.label}
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                                <MessageSquare className="text-primary" size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Reviews</p>
                                <p className="text-3xl font-black text-secondary dark:text-white">{stats.totalReviews}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                                <TrendingUp className="text-blue-600 dark:text-blue-400" size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Avg Rating</p>
                                <p className={`text-3xl font-black ${getRatingColor(parseFloat(stats.averageRating))}`}>{stats.averageRating}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl flex items-center justify-center">
                                <Award className="text-yellow-600 dark:text-yellow-400" size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">5-Star Reviews</p>
                                <p className="text-3xl font-black text-secondary dark:text-white">{stats.fiveStarCount}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center">
                                <Star className="text-green-600 dark:text-green-400 fill-green-600 dark:fill-green-400" size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Latest Rating</p>
                                <p className="text-3xl font-black text-secondary dark:text-white">{stats.mostRecentRating}</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Rating Distribution */}
                {stats.totalReviews > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-white/5 shadow-sm mb-8"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <Trophy className="text-primary" size={24} />
                            <h2 className="text-xl font-black text-secondary dark:text-white">Rating Distribution</h2>
                        </div>
                        <div className="space-y-3">
                            {[5, 4, 3, 2, 1].map((rating) => {
                                const count = stats.ratingDistribution[rating] || 0;
                                const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
                                return (
                                    <div key={rating} className="flex items-center gap-4">
                                        <div className="flex items-center gap-1 w-24">
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{rating}</span>
                                            <Star size={16} className="fill-primary text-primary" />
                                        </div>
                                        <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full transition-all duration-500"
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400 w-16 text-right">
                                            {count} ({percentage.toFixed(0)}%)
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Reviews List */}
                {reviews.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 text-center border border-slate-100 dark:border-white/5">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                            <MessageSquare size={40} className="text-slate-300" />
                        </div>
                        <h3 className="text-2xl font-black text-secondary dark:text-white mb-2">No Reviews Yet</h3>
                        <p className="text-slate-500 font-medium mb-6">Complete rides and provide great service to receive passenger feedback!</p>
                        <Link to="/driver" className="inline-block bg-primary text-secondary font-black px-8 py-4 rounded-2xl hover:bg-primary-dark transition-all">
                            Back to Dashboard
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-black text-secondary dark:text-white">All Reviews ({reviews.length})</h2>
                        </div>
                        {reviews.map((review, index) => (
                            <motion.div
                                key={review.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex flex-col md:flex-row gap-6">
                                    {/* Left: Reviewer Info & Rating */}
                                    <div className="flex-shrink-0">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden">
                                                <img
                                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${review.reviewer?.username || 'reviewer'}`}
                                                    alt="Reviewer"
                                                />
                                            </div>
                                            <div>
                                                <p className="font-black text-secondary dark:text-white text-lg">{review.reviewer?.username || 'Reviewer'}</p>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Reviewer</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            {renderStars(review.rating)}
                                            <span className="text-sm font-bold text-slate-500">({review.rating}/5)</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                            <Calendar size={14} />
                                            <span>{formatDate(review.created_at)}</span>
                                        </div>
                                    </div>

                                    {/* Right: Ride Details & Comment */}
                                    <div className="flex-1">
                                        {/* Ride Route */}
                                        {review.ride && (
                                            <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                                <div className="flex items-start gap-3 mb-2">
                                                    <MapPin size={16} className="text-primary mt-1" />
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pickup</p>
                                                        <p className="text-sm font-medium text-secondary dark:text-white">{review.ride.pickup_address || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <Navigation2 size={16} className="text-accent mt-1" />
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Destination</p>
                                                        <p className="text-sm font-medium text-secondary dark:text-white">{review.ride.dest_address || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                {review.ride.fare && (
                                                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                                        <p className="text-xs text-slate-400 font-bold">Fare: <span className="text-primary">₱{review.ride.fare}</span></p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Comment */}
                                        {review.comment ? (
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <MessageSquare size={14} className="text-slate-400" />
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Passenger Feedback</p>
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
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DriverReviews;
