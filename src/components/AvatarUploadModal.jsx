import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, UploadCloud, X, CheckCircle2, ImageIcon, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import { ensureImageUrl } from '../utils/url';

const MAX_SIZE_MB = 5;

const AvatarUploadModal = ({ isOpen, onClose, currentUsername, currentPicture, onSuccess }) => {
    const [dragging, setDragging] = useState(false);
    const [preview, setPreview] = useState(null);
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const inputRef = useRef(null);

    const resetState = () => {
        setPreview(null);
        setFile(null);
        setError('');
        setDone(false);
        setUploading(false);
        setDragging(false);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const processFile = useCallback((selectedFile) => {
        setError('');
        if (!selectedFile) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(selectedFile.type)) {
            setError('Invalid file type. Please upload a JPG, PNG, WebP, or GIF.');
            return;
        }

        if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) {
            setError(`Image is too large. Max allowed size is ${MAX_SIZE_MB}MB.`);
            return;
        }

        setFile(selectedFile);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(selectedFile);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        processFile(dropped);
    }, [processFile]);

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragging(true);
    };

    const handleDragLeave = () => setDragging(false);

    const handleInputChange = (e) => {
        processFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('profile_picture', file);
            const res = await api.patch('/user/profile/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setDone(true);
            setTimeout(() => {
                if (onSuccess) onSuccess(res.data);
                handleClose();
            }, 1800);
        } catch (err) {
            setError('Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[999] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
                    onClick={handleClose}
                >
                    <motion.div
                        initial={{ scale: 0.85, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.85, opacity: 0, y: 30 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="relative px-8 pt-8 pb-6">
                            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-yellow-400 via-primary to-amber-300 opacity-20 rounded-t-[2.5rem]" />
                            <div className="relative flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-black text-secondary dark:text-white tracking-tight">
                                        Update Photo
                                    </h2>
                                    <p className="text-xs text-slate-400 font-medium mt-1">
                                        JPG, PNG, WebP or GIF · Max {MAX_SIZE_MB}MB
                                    </p>
                                </div>
                                <button
                                    onClick={handleClose}
                                    className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="px-8 pb-8 space-y-6">
                            {/* Current Avatar Preview */}
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg ring-4 ring-slate-100 dark:ring-white/10 flex-shrink-0">
                                    <img
                                        src={preview || ensureImageUrl(currentPicture, currentUsername)}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-secondary dark:text-white">
                                        {preview ? 'New photo ready' : 'Current photo'}
                                    </p>
                                    <p className="text-xs text-slate-400 font-medium">
                                        {preview ? 'Looking great! Click Upload to save.' : 'Upload a new one below.'}
                                    </p>
                                    {preview && (
                                        <button
                                            onClick={resetState}
                                            className="text-xs text-red-500 font-bold mt-1 hover:underline"
                                        >
                                            Remove selection
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Drop Zone */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onClick={() => inputRef.current?.click()}
                                className={`relative border-2 border-dashed rounded-[1.5rem] p-8 text-center cursor-pointer transition-all duration-200 group ${dragging
                                        ? 'border-primary bg-primary/10 scale-105'
                                        : preview
                                            ? 'border-green-400 bg-green-50 dark:bg-green-900/10'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5'
                                    }`}
                            >
                                <input
                                    ref={inputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleInputChange}
                                />
                                {done ? (
                                    <motion.div
                                        initial={{ scale: 0.5 }}
                                        animate={{ scale: 1 }}
                                        className="flex flex-col items-center gap-3"
                                    >
                                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                            <CheckCircle2 className="text-green-500" size={32} />
                                        </div>
                                        <p className="font-black text-green-600 dark:text-green-400">Upload Successful!</p>
                                    </motion.div>
                                ) : preview ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <ImageIcon className="text-green-500" size={32} />
                                        <p className="font-bold text-green-700 dark:text-green-400 text-sm">{file?.name}</p>
                                        <p className="text-xs text-slate-400">Click to choose a different file</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${dragging ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-primary/10'}`}>
                                            <UploadCloud
                                                size={28}
                                                className={`transition-colors ${dragging ? 'text-secondary' : 'text-slate-400 group-hover:text-primary'}`}
                                            />
                                        </div>
                                        <div>
                                            <p className="font-black text-secondary dark:text-white text-sm">
                                                {dragging ? 'Drop to upload!' : 'Drag & drop your photo here'}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">or click to browse files</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Error Message */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl"
                                    >
                                        <AlertCircle className="text-red-500 flex-shrink-0" size={18} />
                                        <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleClose}
                                    disabled={uploading}
                                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={!file || uploading || done}
                                    className="flex-1 py-4 bg-secondary dark:bg-primary dark:text-secondary text-white font-black rounded-2xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-xl"
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                            Uploading...
                                        </>
                                    ) : done ? (
                                        <>
                                            <CheckCircle2 size={18} /> Done!
                                        </>
                                    ) : (
                                        <>
                                            <Camera size={18} /> Upload Photo
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AvatarUploadModal;
