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

const RatingModal = ({ isOpen, onClose, rideId, targetName, targetRole = 'Driver', targetPhoto }) => {
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
          className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-black/30 relative overflow-hidden max-h-[92vh] flex flex-col"
        >
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-yellow-300 to-primary shrink-0" />

          {/* ── Success overlay ─────────────────────────────────────────────── */}
          <AnimatePresence>
            {isSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center text-center p-6 md:p-8 rounded-[2.5rem] overflow-y-auto"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                  className="w-20 h-20 md:w-24 md:h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-200"
                >
                  <CheckCircle2 size={40} className="md:size-[48px]" />
                </motion.div>
                <h2 className="text-xl md:text-2xl font-black text-secondary uppercase tracking-tight mb-2">Thank You!</h2>
                <p className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed max-w-xs">
                  Your feedback helps build a better Trento transport community. ❤️
                </p>
                {/* Animated stars */}
                <motion.div
                  className="flex gap-1.5 mt-5"
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
                      <Star size={24} className={s <= rating ? 'fill-primary text-primary' : 'text-slate-200'} />
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-6 md:p-8 pt-9 md:pt-10 overflow-y-auto w-full scrollbar-thin">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-secondary transition-all"
            >
              <X size={16} />
            </button>

            {/* Avatar + title */}
            <div className="text-center mb-5">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/15 rounded-[1.8rem] flex items-center justify-center mx-auto mb-3 overflow-hidden border-2 border-primary/20 shadow-md shadow-primary/5">
                {targetPhoto ? (
                  <img
                    src={targetPhoto}
                    alt={targetName || targetRole}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetName || 'user'}`;
                    }}
                  />
                ) : (
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${targetName || 'user'}`}
                    alt={targetRole}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <h2 className="text-xl md:text-2xl font-black text-secondary uppercase tracking-tight">Rate Your Trip</h2>
              <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
                How was your experience with{' '}
                <span className="text-secondary font-bold">{targetName || `the ${targetRole.toLowerCase()}`}</span>?
              </p>
            </div>

            {/* ── Stars ────────────────────────────────────────────────────── */}
            <div className="flex justify-center gap-1.5 mb-2.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = (hover || rating) >= star;
                return (
                  <motion.button
                    key={star}
                    whileHover={{ scale: 1.2, rotate: [-3, 3, 0] }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    className="focus:outline-none relative"
                  >
                    <Star
                      size={38}
                      className={`transition-all duration-150 ${
                        isActive
                          ? 'fill-primary text-primary drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]'
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
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className={`flex items-center justify-center gap-1.5 mb-5 py-1.5 px-3 rounded-full mx-auto w-fit ${starLabel.bg}`}
              >
                <ThumbsUp size={12} className={starLabel.color} />
                <span className={`text-xs font-black ${starLabel.color}`}>{starLabel.text}</span>
              </motion.div>
            </AnimatePresence>

            {/* ── Quick Feedback Tags ───────────────────────────────────────── */}
            <div className="mb-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                <span>Quick Feedback</span>
                <span className="text-slate-350 text-[8px] font-normal normal-case">(optional)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(({ label, emoji }) => {
                  const active = selectedTags.includes(label);
                  return (
                    <motion.button
                      key={label}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleTag(label)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border-2 transition-all ${
                        active
                          ? 'bg-primary text-secondary border-primary shadow shadow-primary/10'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-primary/30 hover:bg-primary/5'
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
            <div className="mb-5">
              <div className="flex items-center gap-1.5 ml-0.5 mb-1.5 text-slate-400">
                <MessageSquare size={12} />
                <label className="text-[9px] font-black uppercase tracking-widest">
                  Additional Comments
                </label>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us more about your experience..."
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 text-xs font-medium focus:border-primary outline-none transition-all min-h-[75px] md:min-h-[90px] resize-none placeholder:text-slate-350"
              />
            </div>

            {/* ── Submit & Skip ─────────────────────────────────────────────── */}
            <div className="space-y-3.5 text-center">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-secondary text-white font-black py-4 rounded-[1.25rem] hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Star size={16} className="fill-primary text-primary" />
                    <span>Submit Feedback</span>
                  </>
                )}
              </motion.button>

              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="inline-block text-xs font-black text-slate-400 hover:text-secondary underline underline-offset-4 decoration-slate-350 hover:decoration-secondary transition-all py-1 disabled:opacity-50"
              >
                Skip & Exit
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RatingModal;
