import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare, Send, X, User, Wifi, WifiOff,
    ImagePlus, Loader2, ZoomIn, Download
} from 'lucide-react';

// ─── Image helpers ────────────────────────────────────────────────────────────

/** Returns true if the message text is an embedded image data-URL or a URL to an image */
const isImageMessage = (text = '') =>
    text.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(text);

/**
 * Compress an image File using Canvas.
 * Resizes to max 900px on the longest side, then encodes as JPEG at quality 0.78.
 * Returns a data-URL string.
 */
const compressImage = (file) =>
    new Promise((resolve, reject) => {
        const MAX_DIM  = 900;
        const QUALITY  = 0.78;

        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload  = (ev) => {
            const img = new Image();
            img.onerror = reject;
            img.onload  = () => {
                let { width, height } = img;

                // Scale down while preserving aspect ratio
                if (width > MAX_DIM || height > MAX_DIM) {
                    if (width >= height) {
                        height = Math.round((height / width) * MAX_DIM);
                        width  = MAX_DIM;
                    } else {
                        width  = Math.round((width / height) * MAX_DIM);
                        height = MAX_DIM;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width  = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', QUALITY));
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

// ─── Lightbox (full-screen image viewer) ─────────────────────────────────────
const Lightbox = ({ src, onClose }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
        onClick={onClose}
    >
        <motion.img
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            src={src}
            alt="Full size"
            className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
        />
        <div className="flex gap-3 mt-4" onClick={(e) => e.stopPropagation()}>
            <a
                href={src}
                download="chat-image.jpg"
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
                <Download size={16} /> Save Image
            </a>
            <button
                onClick={onClose}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
                <X size={16} /> Close
            </button>
        </div>
    </motion.div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ChatWindow — Real-time driver ↔ passenger chat with image sharing.
 *
 * Props
 * ─────
 * messages        Array<{ text, sender, timestamp, msgType? }>
 * onSendMessage   (text, senderName, msgType?) => void
 * currentUser     string
 * partnerName     string
 * isConnected     bool (optional)
 * isOpen          bool (optional)  — controlled
 * onToggle        () => void (optional)  — controlled
 */
const ChatWindow = ({
    messages = [],
    onSendMessage,
    currentUser,
    partnerName,
    isConnected = true,
    isOpen: isOpenProp,
    onToggle,
}) => {
    // ── Open/close state (controlled or internal) ─────────────────────────────
    const [isOpenInternal, setIsOpenInternal] = useState(false);
    const isControlled = isOpenProp !== undefined && onToggle !== undefined;
    const isOpen = isControlled ? isOpenProp : isOpenInternal;

    // ── Local state ───────────────────────────────────────────────────────────
    const [inputText,     setInputText]     = useState('');
    const [unreadCount,   setUnreadCount]   = useState(0);
    const [imagePreview,  setImagePreview]  = useState(null); // data-URL pending send
    const [isCompressing, setIsCompressing] = useState(false);
    const [lightboxSrc,   setLightboxSrc]   = useState(null);

    // ── Refs ──────────────────────────────────────────────────────────────────
    const scrollRef        = useRef(null);
    const inputRef         = useRef(null);
    const fileInputRef     = useRef(null);
    const prevMsgCount     = useRef(messages.length);

    // ── Unread badge ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen && messages.length > prevMsgCount.current) {
            const newMsgs  = messages.slice(prevMsgCount.current);
            const incoming = newMsgs.filter(m => m.sender !== currentUser);
            if (incoming.length > 0) setUnreadCount(prev => prev + incoming.length);
        }
        prevMsgCount.current = messages.length;
    }, [messages, isOpen, currentUser]);

    // ── Reset badge + focus on open ───────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    // ── Auto-scroll ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (scrollRef.current && isOpen) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen, imagePreview]);

    // ── Toggle ────────────────────────────────────────────────────────────────
    const handleToggle = () => {
        if (isControlled) onToggle();
        else setIsOpenInternal(prev => !prev);
    };

    // ── Send text ─────────────────────────────────────────────────────────────
    const handleSendText = (e) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text || !onSendMessage) return;
        onSendMessage(text, currentUser, 'text');
        setInputText('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) handleSendText(e);
    };

    // ── Send image ────────────────────────────────────────────────────────────
    const handleFileChange = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file (JPG, PNG, GIF, WebP).');
            return;
        }

        // Validate size (max 10 MB before compression)
        if (file.size > 10 * 1024 * 1024) {
            alert('Image is too large. Please choose a file under 10 MB.');
            return;
        }

        setIsCompressing(true);
        try {
            const dataUrl = await compressImage(file);
            setImagePreview(dataUrl);
        } catch {
            alert('Could not load image. Please try a different file.');
        } finally {
            setIsCompressing(false);
            // Reset input so the same file can be re-selected
            e.target.value = '';
        }
    }, []);

    const handleSendImage = () => {
        if (!imagePreview || !onSendMessage) return;
        onSendMessage(imagePreview, currentUser, 'image');
        setImagePreview(null);
    };

    const handleCancelImage = () => setImagePreview(null);

    // ── Render a single message bubble ───────────────────────────────────────
    const renderBubble = (msg, i) => {
        const isMine   = msg.sender === currentUser;
        const isImg    = msg.msgType === 'image' || isImageMessage(msg.text);
        const baseRow  = `flex flex-col ${isMine ? 'items-end' : 'items-start'}`;
        const bubbleCls = isImg
            ? `overflow-hidden rounded-2xl shadow-md ${isMine ? 'rounded-br-sm' : 'rounded-bl-sm'}`
            : `max-w-[80%] px-4 py-2.5 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm ${
                isMine
                    ? 'bg-secondary text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-bl-sm'
              }`;

        return (
            <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={baseRow}
            >
                <div className={bubbleCls}>
                    {isImg ? (
                        <div className="relative group cursor-pointer max-w-[200px]"
                            onClick={() => setLightboxSrc(msg.text)}
                        >
                            <img
                                src={msg.text}
                                alt="Shared"
                                className="block max-w-full max-h-48 object-cover"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded-2xl">
                                <ZoomIn size={24} className="text-white drop-shadow" />
                            </div>
                        </div>
                    ) : (
                        msg.text
                    )}
                </div>
                <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest px-1">
                    {msg.timestamp}
                </span>
            </motion.div>
        );
    };

    // ── JSX ───────────────────────────────────────────────────────────────────
    return (
        <>
            {/* ── Lightbox ─────────────────────────────────────────────────── */}
            <AnimatePresence>
                {lightboxSrc && (
                    <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
                )}
            </AnimatePresence>

            <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            key="chat-panel"
                            initial={{ opacity: 0, scale: 0.85, y: 24 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.85, y: 24 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            className="bg-white dark:bg-slate-900 w-80 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-white/10 flex flex-col overflow-hidden mb-4"
                            style={{ height: imagePreview ? '520px' : '460px' }}
                        >
                            {/* ── Header ───────────────────────────────────── */}
                            <div className="bg-secondary text-white px-5 py-4 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                                        <User size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm tracking-tight leading-none">
                                            {partnerName || 'Chat'}
                                        </h3>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            {isConnected ? (
                                                <>
                                                    <Wifi size={10} className="text-green-400" />
                                                    <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Live</span>
                                                </>
                                            ) : (
                                                <>
                                                    <WifiOff size={10} className="text-red-400" />
                                                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Offline</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleToggle}
                                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                                    aria-label="Close chat"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* ── Messages ─────────────────────────────────── */}
                            <div
                                ref={scrollRef}
                                className="flex-1 overflow-y-auto p-4 space-y-3"
                                style={{ scrollBehavior: 'smooth' }}
                            >
                                {messages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-6 gap-3">
                                        <MessageSquare size={36} />
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-widest">Safety First</p>
                                            <p className="text-[10px] mt-1 leading-relaxed">
                                                Keep messages respectful. Tap <ImagePlus size={10} className="inline" /> to share images with your {partnerName ? partnerName.split(' ')[0] : 'partner'}.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    messages.map(renderBubble)
                                )}
                            </div>

                            {/* ── Image preview strip (before sending) ─────── */}
                            <AnimatePresence>
                                {imagePreview && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="px-3 pt-3 shrink-0 overflow-hidden"
                                    >
                                        <div className="relative inline-block">
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="h-20 rounded-xl border-2 border-primary object-cover shadow-md"
                                            />
                                            <button
                                                onClick={handleCancelImage}
                                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                                                aria-label="Cancel image"
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                                            Tap Send ↗ to share this image
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Input row ────────────────────────────────── */}
                            <form
                                onSubmit={imagePreview ? (e) => { e.preventDefault(); handleSendImage(); } : handleSendText}
                                className="p-3 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 flex gap-2 items-center shrink-0"
                            >
                                {/* Hidden file input */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileChange}
                                    disabled={!isConnected}
                                />

                                {/* + Image button */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={!isConnected || isCompressing || !!imagePreview}
                                    className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                    title="Send an image"
                                    aria-label="Attach image"
                                >
                                    {isCompressing ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <ImagePlus size={16} />
                                    )}
                                </button>

                                {/* Text input (hidden when image is ready) */}
                                {!imagePreview && (
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Type a message…"
                                        disabled={!isConnected}
                                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-semibold outline-none focus:border-primary transition-colors disabled:opacity-50"
                                    />
                                )}

                                {/* Image ready label */}
                                {imagePreview && (
                                    <span className="flex-1 text-xs font-bold text-primary truncate">
                                        Image ready to send
                                    </span>
                                )}

                                {/* Send button */}
                                <button
                                    type="submit"
                                    disabled={(!inputText.trim() && !imagePreview) || !isConnected || isCompressing}
                                    className="w-10 h-10 bg-secondary text-primary rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-40 disabled:scale-100 shrink-0"
                                    aria-label="Send"
                                >
                                    <Send size={16} />
                                </button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Floating toggle button ────────────────────────────────── */}
                <motion.button
                    whileHover={{ scale: 1.07 }}
                    whileTap={{ scale: 0.93 }}
                    onClick={handleToggle}
                    className={`w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center relative transition-colors ${
                        isOpen
                            ? 'bg-white text-secondary border-2 border-secondary/20'
                            : 'bg-secondary text-primary'
                    }`}
                    aria-label={isOpen ? 'Close chat' : 'Open chat'}
                >
                    <AnimatePresence mode="wait">
                        {isOpen ? (
                            <motion.span key="x"
                                initial={{ rotate: -90, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ rotate: 90, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <X size={22} />
                            </motion.span>
                        ) : (
                            <motion.span key="msg"
                                initial={{ rotate: 90, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ rotate: -90, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <MessageSquare size={22} />
                            </motion.span>
                        )}
                    </AnimatePresence>

                    {/* Unread badge */}
                    {!isOpen && unreadCount > 0 && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-md"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </motion.div>
                    )}
                </motion.button>
            </div>
        </>
    );
};

export default ChatWindow;
