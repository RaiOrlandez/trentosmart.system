import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, MessageSquare, CheckCircle2 } from 'lucide-react';
import api from '../api/axios';

const RatingModal = ({ isOpen, onClose, rideId, targetName, targetRole = 'Driver' }) => {
    const [rating, setRating] = useState(5);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async () => {
        if (!rideId) {
            alert('No ride ID provided. Please try again.');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post('/reviews/', {
                ride: rideId,
                rating: rating,
                comment: comment
            });
            setIsSuccess(true);
            setTimeout(() => {
                onClose();
                setIsSuccess(false);
                setRating(5);
                setComment('');
            }, 2000);
        } catch (err) {
            console.error('Failed to submit review', err);
            console.error('Error response:', err.response);

            // Extract detailed error message
            let errorMessage = 'Failed to submit review';
            if (err.response?.data) {
                if (typeof err.response.data === 'string') {
                    errorMessage = err.response.data;
                } else if (err.response.data.detail) {
                    errorMessage = err.response.data.detail;
                } else if (err.response.data.non_field_errors) {
                    errorMessage = err.response.data.non_field_errors.join(', ');
                } else if (err.response.data.ride) {
                    errorMessage = `Ride error: ${err.response.data.ride.join(', ')}`;
                } else {
                    errorMessage = JSON.stringify(err.response.data);
                }
            }

            alert(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-secondary/80 backdrop-blur-md">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-10 relative overflow-hidden"
                >
                    {/* Success State */}
                    <AnimatePresence>
                        {isSuccess && (
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center text-center p-8"
                            >
                                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                                    <CheckCircle2 size={40} />
                                </div>
                                <h2 className="text-2xl font-black text-secondary uppercase tracking-tight mb-2">Thank You!</h2>
                                <p className="text-slate-500 font-medium">Your feedback helps improve the Trento transport community.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-secondary transition-colors">
                        <X size={24} />
                    </button>

                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-6 overflow-hidden">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${targetName || 'user'}`} alt={targetRole} />
                        </div>
                        <h2 className="text-2xl font-black text-secondary uppercase tracking-tight">Rate Your Trip</h2>
                        <p className="text-slate-500 font-medium">How was your experience with <span className="text-secondary font-bold">{targetName || 'the ' + targetRole.toLowerCase()}</span>?</p>
                    </div>

                    <div className="flex justify-center gap-2 mb-8">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <motion.button
                                key={star}
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setRating(star)}
                                onMouseEnter={() => setHover(star)}
                                onMouseLeave={() => setHover(0)}
                                className="focus:outline-none"
                            >
                                <Star
                                    size={40}
                                    className={`transition-colors duration-200 ${(hover || rating) >= star ? 'fill-primary text-primary' : 'text-slate-200'
                                        }`}
                                />
                            </motion.button>
                        ))}
                    </div>

                    <div className="space-y-2 mb-8">
                        <div className="flex items-center gap-2 ml-2 text-slate-400">
                            <MessageSquare size={14} />
                            <label className="text-[10px] font-black uppercase tracking-widest">Additional Comments</label>
                        </div>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Tell us about your experience..."
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:border-primary outline-none transition-all min-h-[100px] resize-none"
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full bg-secondary text-white font-black py-5 rounded-[2rem] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <span>Submit Feedback</span>
                            </>
                        )}
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default RatingModal;
