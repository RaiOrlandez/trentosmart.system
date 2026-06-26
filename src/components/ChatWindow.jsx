import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, User, Wifi, WifiOff } from 'lucide-react';

/**
 * ChatWindow — Real-time driver ↔ passenger chat.
 *
 * Props
 * ─────
 * messages        Array<{ text, sender, timestamp }>  — incoming messages from hook
 * onSendMessage   (text, senderName) => void          — callback to send via WS
 * currentUser     string                              — username of the current user
 * partnerName     string                              — display name of chat partner
 * isConnected     bool (optional)                     — WS connection state
 * isOpen          bool (optional)                     — controlled open state
 * onToggle        () => void (optional)               — controlled toggle callback
 */
const ChatWindow = ({
    messages = [],
    onSendMessage,
    currentUser,
    partnerName,
    isConnected = true,
    // Controlled mode (from parent panel button)
    isOpen: isOpenProp,
    onToggle,
}) => {
    // Support both controlled and uncontrolled modes
    const [isOpenInternal, setIsOpenInternal] = useState(false);
    const isControlled = isOpenProp !== undefined && onToggle !== undefined;
    const isOpen = isControlled ? isOpenProp : isOpenInternal;

    const [inputText, setInputText] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const prevMessageCount = useRef(messages.length);

    // Track unread messages (those received while chat is closed)
    useEffect(() => {
        if (!isOpen && messages.length > prevMessageCount.current) {
            const newMessages = messages.slice(prevMessageCount.current);
            const incoming = newMessages.filter(m => m.sender !== currentUser);
            if (incoming.length > 0) {
                setUnreadCount(prev => prev + incoming.length);
            }
        }
        prevMessageCount.current = messages.length;
    }, [messages, isOpen, currentUser]);

    // Reset unread count when chat opens
    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
            // Auto-focus input
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    // Auto-scroll to latest message
    useEffect(() => {
        if (scrollRef.current && isOpen) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleToggle = () => {
        if (isControlled) {
            onToggle();
        } else {
            setIsOpenInternal(prev => !prev);
        }
    };

    const handleSend = (e) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text || !onSendMessage) return;
        onSendMessage(text, currentUser);
        setInputText('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            handleSend(e);
        }
    };

    return (
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="chat-panel"
                        initial={{ opacity: 0, scale: 0.85, y: 24, transformOrigin: 'bottom right' }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.85, y: 24 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="bg-white dark:bg-slate-900 w-80 h-[460px] rounded-[2rem] shadow-2xl border border-slate-100 dark:border-white/10 flex flex-col overflow-hidden mb-4"
                    >
                        {/* ── Header ─────────────────────────────────────── */}
                        <div className="bg-secondary text-white px-5 py-4 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                                    <User size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm tracking-tight leading-none">{partnerName || 'Chat'}</h3>
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

                        {/* ── Messages ───────────────────────────────────── */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
                            style={{ scrollBehavior: 'smooth' }}
                        >
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-6 gap-3">
                                    <MessageSquare size={36} />
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest">Safety First</p>
                                        <p className="text-[10px] mt-1 leading-relaxed">
                                            Keep messages respectful. Never share card numbers or passwords.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg, i) => {
                                    const isMine = msg.sender === currentUser;
                                    return (
                                        <div key={i} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                            <div
                                                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm ${
                                                    isMine
                                                        ? 'bg-secondary text-white rounded-br-sm'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-bl-sm'
                                                }`}
                                            >
                                                {msg.text}
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest px-1">
                                                {msg.timestamp}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* ── Input ──────────────────────────────────────── */}
                        <form
                            onSubmit={handleSend}
                            className="p-3 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 flex gap-2 shrink-0"
                        >
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
                            <button
                                type="submit"
                                disabled={!inputText.trim() || !isConnected}
                                className="w-10 h-10 bg-secondary text-primary rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-40 disabled:scale-100"
                                aria-label="Send message"
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Floating Toggle Button ─────────────────────────────── */}
            <motion.button
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.93 }}
                onClick={handleToggle}
                className={`w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center relative transition-colors ${
                    isOpen ? 'bg-white text-secondary border-2 border-secondary/20' : 'bg-secondary text-primary'
                }`}
                aria-label={isOpen ? 'Close chat' : 'Open chat'}
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                            <X size={22} />
                        </motion.span>
                    ) : (
                        <motion.span key="msg" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
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
    );
};

export default ChatWindow;
