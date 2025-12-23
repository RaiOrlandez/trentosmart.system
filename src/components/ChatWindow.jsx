import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, User } from 'lucide-react';

const ChatWindow = ({ messages, onSendMessage, currentUser, partnerName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        onSendMessage(inputText, currentUser);
        setInputText('');
    };

    return (
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20, transformOrigin: 'bottom right' }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        className="bg-white dark:bg-slate-900 w-80 h-[450px] rounded-[2rem] shadow-2xl border border-slate-100 dark:border-white/10 flex flex-col overflow-hidden mb-4"
                    >
                        {/* Header */}
                        <div className="bg-secondary text-white p-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                                    <User size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm tracking-tight">{partnerName || 'Chat'}</h3>
                                    <div className="flex items-center gap-1.5 ">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Connected</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
                        >
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-6">
                                    <MessageSquare size={40} className="mb-2" />
                                    <p className="text-xs font-bold uppercase tracking-widest">Safety Tip:</p>
                                    <p className="text-[10px]">Avoid sharing private info like credit card numbers.</p>
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div key={i} className={`flex flex-col ${msg.sender === currentUser ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-bold ${msg.sender === currentUser
                                                ? 'bg-primary text-secondary rounded-tr-none'
                                                : 'bg-slate-100 dark:bg-slate-800 text-secondary dark:text-white rounded-tl-none'
                                            }`}>
                                            {msg.text}
                                        </div>
                                        <span className="text-[8px] font-black text-slate-400 mt-1 uppercase tracking-tighter">
                                            {msg.timestamp}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSend} className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 flex gap-2">
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Write a message..."
                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-primary transition-colors"
                            />
                            <button type="submit" className="w-10 h-10 bg-secondary text-primary rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg">
                                <Send size={18} />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center relative transition-all ${isOpen ? 'bg-white text-secondary' : 'bg-secondary text-primary'
                    }`}
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
                {!isOpen && messages.length > 0 && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                        {messages.length}
                    </div>
                )}
            </motion.button>
        </div>
    );
};

export default ChatWindow;
