import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, MessageSquare, CheckCircle2, ThumbsUp } from 'lucide-react';
import api from '../api/axios';

// ─── Quick-feedback tag presets ────────────────────────────────────────────────
const DRIVER_TAGS = [
  { label: 'Friendly', emoji: '😊' },
  { label: 'Safe Driver', emoji: '🛡️' },
  { label: 'On Time', emoji: '⏱️' },
  { label: 'Clean Vehicle', emoji: '✨' },
  { label: 'Good Route', emoji: '🗺️' },
  { label: 'Smooth Ride', emoji: '🤙' },
];

const PASSENGER_TAGS = [
  { label: 'Polite', emoji: '🙏' },
  { label: 'On Time', emoji: '⏱️' },
  { label: 'Easy to Find', emoji: '📍' },
  { label: 'Good Communication', emoji: '💬' },
  { label: 'Respectful', emoji: '👍' },
];

// ─── Star rating label helper ──────────────────────────────────────────────────
const STAR_LABELS = {
  1: { text: 'Very Poor', color: 'text-red-500', bg: 'bg-red-50' },
  2: { text: 'Poor', color: 'text-orange-500', bg: 'bg-orange-50' },
  3: { text: 'Okay', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  4: { text: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' },
  5: { text: 'Excellent!', color: 'text-green-600', bg: 'bg-green-50' },
};

const RatingModal = ({ isOpen, onClose, rideId, targetName, targetRole = 'Driver' }) => {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const tags = targetRole.toLowerCase() === 'driver' ? DRIVER_TAGS : PASSENGER_TAGS;
  const displayRating = hover || rating;
  const starLabel = STAR_LABELS[displayRating];

  const toggleTag = (label) => {
    setSelectedTags(prev =>
      prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]
    );
  };

  const handleSubmit = async () => {
    if (!rideId) {
      alert('No ride ID provided. Please try again.');
      return;
    }

    // Build comment from tags + manual input
    const tagText = selectedTags.length > 0 ? selectedTags.join(', ') : '';
    const fullComment = tagText && comment
      ? `${tagText}. ${comment}`
      : tagText || comment;

    setIsSubmitting(true);
    try {
      await api.post('/reviews/', {
        ride: rideId,
        rating,
        comment: fullComment,
      });
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
        setIsSuccess(false);
        setRating(5);
        setComment('');
        setSelectedTags([]);
      }, 2200);
    } catch (err) {
      console.error('Failed to submit review', err);
      let errorMessage = 'Failed to submit review';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') errorMessage = err.response.data;
        else if (err.response.data.detail) errorMessage = err.response.data.detail;
        else if (err.response.data.non_field_errors) errorMessage = err.response.data.non_field_errors.join(', ');
        else if (err.response.data.ride) errorMessage = `Ride error: ${err.response.data.ride.join(', ')}`;
        else errorMessage = JSON.stringify(err.response.data);
      }
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-secondary/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.88, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.88, opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-black/30 relative overflow-hidden"
        >
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-yellow-300 to-primary" />

          {/* ── Success overlay ─────────────────────────────────────────────── */}
          <AnimatePresence>
            {isSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center text-center p-8 rounded-[2.5rem]"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                  className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-200"
                >
                  <CheckCircle2 size={48} />
                </motion.div>
                <h2 className="text-2xl font-black text-secondary uppercase tracking-tight mb-2">Thank You!</h2>
                <p className="text-slate-500 font-medium leading-relaxed">
                  Your feedback helps build a better Trento transport community. ❤️
                </p>
                {/* Animated stars */}
                <motion.div
                  className="flex gap-2 mt-6"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {[1,2,3,4,5].map((s, i) => (
                    <motion.div
                      key={s}
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.4 + i * 0.08, type: 'spring', stiffness: 300 }}
                    >
                      <Star size={28} className={s <= rating ? 'fill-primary text-primary' : 'text-slate-200'} />
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-8 pt-10">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-secondary transition-all"
            >
              <X size={18} />
            </button>

            {/* Avatar + title */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-primary/15 rounded-3xl flex items-center justify-center mx-auto mb-4 overflow-hidden border-2 border-primary/20 shadow-lg shadow-primary/10">
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${targetName || 'user'}`}
                  alt={targetRole}
                />
              </div>
              <h2 className="text-2xl font-black text-secondary uppercase tracking-tight">Rate Your Trip</h2>
              <p className="text-slate-500 font-medium mt-1">
                How was your experience with{' '}
                <span className="text-secondary font-bold">{targetName || `the ${targetRole.toLowerCase()}`}</span>?
              </p>
            </div>

            {/* ── Stars ────────────────────────────────────────────────────── */}
            <div className="flex justify-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = (hover || rating) >= star;
                return (
                  <motion.button
                    key={star}
                    whileHover={{ scale: 1.25, rotate: [-5, 5, 0] }}
                    whileTap={{ scale: 0.85 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    className="focus:outline-none relative"
                  >
                    <Star
                      size={44}
                      className={`transition-all duration-150 ${
                        isActive
                          ? 'fill-primary text-primary drop-shadow-[0_0_8px_rgba(250,204,21,0.7)]'
                          : 'text-slate-200'
                      }`}
                    />
                  </motion.button>
                );
              })}
            </div>

            {/* Star label */}
            <AnimatePresence mode="wait">
              <motion.div
                key={displayRating}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className={`flex items-center justify-center gap-2 mb-6 py-2 px-4 rounded-full mx-auto w-fit ${starLabel.bg}`}
              >
                <ThumbsUp size={14} className={starLabel.color} />
                <span className={`text-sm font-black ${starLabel.color}`}>{starLabel.text}</span>
              </motion.div>
            </AnimatePresence>

            {/* ── Quick Feedback Tags ───────────────────────────────────────── */}
            <div className="mb-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                <span>Quick Feedback</span>
                <span className="text-slate-300">(optional)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {tags.map(({ label, emoji }) => {
                  const active = selectedTags.includes(label);
                  return (
                    <motion.button
                      key={label}
                      type="button"
                      whileTap={{ scale: 0.93 }}
                      onClick={() => toggleTag(label)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                        active
                          ? 'bg-primary text-secondary border-primary shadow-md shadow-primary/20'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      <span>{emoji}</span>
                      <span>{label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* ── Comment ──────────────────────────────────────────────────── */}
            <div className="mb-6">
              <div className="flex items-center gap-2 ml-1 mb-2 text-slate-400">
                <MessageSquare size={13} />
                <label className="text-[10px] font-black uppercase tracking-widest">
                  Additional Comments
                </label>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us more about your experience..."
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:border-primary outline-none transition-all min-h-[90px] resize-none placeholder:text-slate-300"
              />
            </div>

            {/* ── Submit & Skip ─────────────────────────────────────────────── */}
            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-secondary text-white font-black py-5 rounded-[1.5rem] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Star size={18} className="fill-primary text-primary" />
                    <span>Submit Feedback</span>
                  </>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-4 rounded-[1.5rem] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span>Skip & Exit</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RatingModal;
