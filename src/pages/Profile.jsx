import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { ensureImageUrl } from '../utils/url';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowUpRight,
    User,
    Mail,
    Phone,
    ShieldAlert,
    Save,
    Camera,
    LogOut,
    CheckCircle2,
    ShieldCheck,
    Car,
    Home,
    Calendar,
    Lock,
    KeyRound,
    MailCheck,
    Eye,
    EyeOff,
    X,
    Loader2
} from 'lucide-react';
import SecurityPINModal from '../components/SecurityPINModal';
import AvatarUploadModal from '../components/AvatarUploadModal';

const Profile = () => {
    const { logout, getProfile } = useContext(AuthContext);
    const navigate = useNavigate();
    const [profile, setProfile] = useState({
        username: '',
        email: '',
        emergency_contact_phone: '',
        emergency_contact_name: '',
        address: '',
        date_of_birth: '',
        gender: '',
        body_number: '',
        license_expiry_date: '',
        profile_picture: null,
        role: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [showAvatarModal, setShowAvatarModal] = useState(false);

    // Change Password state
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);

    // Change Email state
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailStep, setEmailStep] = useState(1); // 1 = enter new email, 2 = enter OTP
    const [emailForm, setEmailForm] = useState({ new_email: '', password: '', otp: '' });
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailMsg, setEmailMsg] = useState({ type: '', text: '' });

    // Full screen picture viewer
    const [showPictureViewer, setShowPictureViewer] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await api.get('/user/profile/');
            let data = res.data;

            // Convert YYYY-MM-DD to DD/MM/YYYY for display
            if (data.date_of_birth && data.date_of_birth.includes('-')) {
                const parts = data.date_of_birth.split('-');
                data.date_of_birth = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            if (data.license_expiry_date && data.license_expiry_date.includes('-')) {
                const parts = data.license_expiry_date.split('-');
                data.license_expiry_date = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }

            setProfile(data);
        } catch (err) {
            console.error('Failed to load profile', err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        // Handle date formatting for DD/MM/YYYY
        if (name === 'date_of_birth' || name === 'license_expiry_date') {
            let val = value.replace(/\D/g, '');
            if (val.length > 8) val = val.slice(0, 8);

            let formatted = '';
            if (val.length > 0) formatted += val.slice(0, 2);
            if (val.length > 2) formatted += '/' + val.slice(2, 4);
            if (val.length > 4) formatted += '/' + val.slice(4, 8);

            setProfile({ ...profile, [name]: formatted });
            return;
        }

        setProfile({ ...profile, [name]: value });
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Limit to 5MB to handle "oversize" issue
            if (file.size > 5 * 1024 * 1024) {
                alert("Selected image is too large! Please choose an image smaller than 5MB to ensure it displays correctly.");
                return;
            }

            setProfile({ ...profile, profile_picture: file });

            // Show preview
            const reader = new FileReader();
            reader.onload = (event) => {
                const imgElement = document.getElementById('profile-preview');
                if (imgElement) imgElement.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSuccessMsg('');

        try {
            const formData = new FormData();
            const imageFields = [
                'profile_picture', 'license_image', 'permit_image',
                'nbi_clearance_image', 'barangay_residency_image', 'government_id_image'
            ];

            Object.keys(profile).forEach(key => {
                let value = profile[key];

                // Convert back to YYYY-MM-DD for backend
                if ((key === 'date_of_birth' || key === 'license_expiry_date') && value && value.includes('/')) {
                    const parts = value.split('/');
                    if (parts.length === 3) {
                        value = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    }
                }

                if (value !== null && value !== undefined && value !== '') {
                    if (imageFields.includes(key)) {
                        // Only append images if a NEW file was selected
                        if (value instanceof File) {
                            formData.append(key, value);
                        }
                    } else {
                        formData.append(key, value);
                    }
                }
            });

            await api.patch('/user/profile/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSuccessMsg('Profile updated successfully!');
            setIsEditing(false);
            setTimeout(() => setSuccessMsg(''), 3000);
            await getProfile(); // Sync global auth context
            fetchProfile(); // Reload local state
        } catch (err) {
            console.error('Update failed', err);
            alert("Update Failed: " + (err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message));
        } finally {
            setSaving(false);
        }
    };

    // ── Change Password Handler ──
    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordMsg({ type: '', text: '' });
        setPasswordLoading(true);
        try {
            const res = await api.post('/user/change-password/', passwordForm);
            setPasswordMsg({ type: 'success', text: res.data.detail });
            setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
            setTimeout(() => { setShowPasswordModal(false); setPasswordMsg({ type: '', text: '' }); logout(); }, 2500);
        } catch (err) {
            setPasswordMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to change password.' });
        } finally {
            setPasswordLoading(false);
        }
    };

    // ── Change Email Handler (Step 1: Send OTP) ──
    const handleRequestEmailChange = async (e) => {
        e.preventDefault();
        setEmailMsg({ type: '', text: '' });
        setEmailLoading(true);
        try {
            const res = await api.post('/user/change-email/', { new_email: emailForm.new_email, password: emailForm.password });
            setEmailMsg({ type: 'success', text: res.data.detail });
            setEmailStep(2);
        } catch (err) {
            setEmailMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to request email change.' });
        } finally {
            setEmailLoading(false);
        }
    };

    // ── Change Email Handler (Step 2: Verify OTP) ──
    const handleConfirmEmailChange = async (e) => {
        e.preventDefault();
        setEmailMsg({ type: '', text: '' });
        setEmailLoading(true);
        try {
            const res = await api.post('/user/confirm-email-change/', { new_email: emailForm.new_email, otp: emailForm.otp });
            setEmailMsg({ type: 'success', text: res.data.detail });
            setEmailForm({ new_email: '', password: '', otp: '' });
            await getProfile();
            fetchProfile();
            setTimeout(() => { setShowEmailModal(false); setEmailStep(1); setEmailMsg({ type: '', text: '' }); }, 2000);
        } catch (err) {
            setEmailMsg({ type: 'error', text: err.response?.data?.detail || 'Invalid verification code.' });
        } finally {
            setEmailLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 bg-slate-50 dark:bg-slate-950 px-6 transition-colors duration-500">
            <div className="max-w-4xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Avatar & Quick Actions */}
                    <div className="lg:col-span-1 space-y-6">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-center relative overflow-hidden border border-slate-100 dark:border-slate-800"
                        >
                            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-br from-primary via-secondary to-slate-900 opacity-10"></div>

                            <div className="relative z-10">
                                <div className="w-32 h-32 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full p-1 shadow-2xl mb-4 relative group">
                                    <div
                                        className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-slate-700 cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => setShowPictureViewer(true)}
                                    >
                                        <img
                                            id="profile-preview"
                                            src={ensureImageUrl(profile.profile_picture, profile.username, profile.profile_picture_url)}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    {/* Always-visible camera button — no edit mode required */}
                                    <button
                                        type="button"
                                        onClick={() => setShowAvatarModal(true)}
                                        className="absolute bottom-1 right-1 p-2 bg-secondary text-white rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
                                        title="Change profile photo"
                                    >
                                        <Camera size={16} />
                                    </button>
                                </div>

                                <h2 className="text-2xl font-black text-secondary dark:text-white tracking-tight mb-1">
                                    {profile.username}
                                </h2>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">
                                    {profile.role || 'Wanderer'}
                                </p>

                                <div className="flex justify-center gap-2 mb-8">
                                    {profile.is_verified_driver && (
                                        <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black uppercase rounded-full flex items-center gap-1">
                                            <ShieldCheck size={12} /> Verified Driver
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={logout}
                                    className="w-full py-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-bold rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
                                >
                                    <LogOut size={18} /> Sign Out
                                </button>
                            </div>
                        </motion.div>

                        {/* Driver Specific Card */}
                        {profile.role === 'driver' && (
                            <div className="bg-primary p-6 rounded-[2rem] text-secondary shadow-lg relative overflow-hidden">
                                <Car size={120} className="absolute -right-6 -bottom-6 opacity-10" />
                                <h3 className="font-bold text-lg mb-1">Driver Portal</h3>
                                <p className="text-xs font-medium opacity-80 mb-4">Manage your vehicle and documents</p>
                                <button
                                    onClick={() => navigate('/driver/verify')}
                                    className="w-full py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl font-bold text-sm transition-all"
                                >
                                    View Documents
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Settings Form */}
                    <div className="lg:col-span-2">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-xl border border-slate-100 dark:border-slate-800"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black text-secondary dark:text-white uppercase tracking-tight">Account Details</h3>
                                <div className="flex items-center gap-2">
                                    <AnimatePresence>
                                        {successMsg && (
                                            <motion.div
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0 }}
                                                className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold flex items-center gap-2"
                                            >
                                                <CheckCircle2 size={14} /> {successMsg}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    {!isEditing && (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            Edit Details
                                        </button>
                                    )}
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-3 flex items-center gap-2">
                                            <User size={12} /> Username
                                        </label>
                                        <input
                                            type="text"
                                            disabled
                                            value={profile.username}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-3 px-4 font-bold text-slate-500 cursor-not-allowed"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-3 flex items-center gap-2">
                                            <Mail size={12} /> Email Address
                                        </label>
                                        <input
                                            type="email"
                                            value={profile.email}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-3 px-4 font-bold text-slate-500 cursor-not-allowed"
                                            disabled
                                        />
                                        <p className="text-[10px] text-slate-400 pl-3 font-medium">Use "Change Email" in Security section below</p>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-3 flex items-center gap-2">
                                            <Phone size={12} /> Phone Number
                                        </label>
                                        <input
                                            type="tel"
                                            name="phone_number"
                                            value={profile.phone_number || ''}
                                            onChange={handleChange}
                                            placeholder="+63 900 000 0000"
                                            className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none transition-colors ${isEditing ? 'border-slate-100 dark:border-slate-700 focus:border-primary' : 'border-transparent bg-transparent pl-0'}`}
                                            disabled={!isEditing}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-3 flex items-center gap-2">
                                            <Calendar size={12} /> Date of Birth
                                        </label>
                                        <input
                                            type="text"
                                            name="date_of_birth"
                                            value={profile.date_of_birth || ''}
                                            onChange={handleChange}
                                            placeholder="DD/MM/YYYY"
                                            maxLength="10"
                                            className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none transition-colors ${isEditing ? 'border-slate-100 dark:border-slate-700 focus:border-primary' : 'border-transparent bg-transparent pl-0'}`}
                                            disabled={!isEditing}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-3 flex items-center gap-2">
                                            <User size={12} /> Gender Identity
                                        </label>
                                        <select
                                            name="gender"
                                            value={profile.gender || ''}
                                            onChange={handleChange}
                                            className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none transition-colors ${isEditing ? 'border-slate-100 dark:border-slate-700 focus:border-primary' : 'border-transparent bg-transparent pl-0 appearance-none'}`}
                                            disabled={!isEditing}
                                        >
                                            <option value="">Select Gender</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-3 flex items-center gap-2">
                                        <Home size={12} /> Detailed Residential Address
                                    </label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={profile.address || ''}
                                        onChange={handleChange}
                                        placeholder="Block/Lot, Street, Barangay, Trento"
                                        className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none transition-colors ${isEditing ? 'border-slate-100 dark:border-slate-700 focus:border-primary' : 'border-transparent bg-transparent pl-0'}`}
                                        disabled={!isEditing}
                                    />
                                </div>

                                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3 mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl">
                                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center flex-shrink-0 animate-pulse">
                                            <ShieldAlert size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-red-700 dark:text-red-300 text-sm">Emergency Trust Contact</h4>
                                            <p className="text-xs text-red-600/80 dark:text-red-400/70 font-medium">This contact will be notified immediately of your location during an SOS event.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase text-red-400 tracking-widest pl-3 flex items-center gap-2">
                                                <User size={12} /> Contact Name
                                            </label>
                                            <input
                                                type="text" name="emergency_contact_name"
                                                value={profile.emergency_contact_name || ''}
                                                onChange={handleChange}
                                                placeholder="e.g. Maria Clara"
                                                className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none transition-colors ${isEditing ? 'border-red-100 dark:border-red-900/30 focus:border-red-400' : 'border-transparent bg-transparent pl-0'}`}
                                                disabled={!isEditing}
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase text-red-400 tracking-widest pl-3 flex items-center gap-2">
                                                <Phone size={12} /> Contact Number
                                            </label>
                                            <input
                                                type="tel" name="emergency_contact_phone"
                                                value={profile.emergency_contact_phone || ''}
                                                onChange={handleChange}
                                                placeholder="+63 900 000 0000"
                                                className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none transition-colors ${isEditing ? 'border-red-100 dark:border-red-900/30 focus:border-red-400' : 'border-transparent bg-transparent pl-0'}`}
                                                disabled={!isEditing}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {profile.role === 'driver' && (
                                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-6">
                                        <h4 className="text-[10px] font-black uppercase text-primary tracking-widest pl-3 flex items-center gap-2">
                                            <Car size={12} /> Vehicle Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-3">Vehicle Model</label>
                                                <input
                                                    type="text"
                                                    name="vehicle_model"
                                                    value={profile.vehicle_model || ''}
                                                    onChange={handleChange}
                                                    placeholder="e.g. Honda TMX 125"
                                                    className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none transition-colors ${isEditing ? 'border-slate-100 dark:border-slate-700 focus:border-primary' : 'border-transparent bg-transparent pl-0'}`}
                                                    disabled={!isEditing}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-3">Plate Number</label>
                                                <input
                                                    type="text"
                                                    name="vehicle_plate"
                                                    value={profile.vehicle_plate || ''}
                                                    onChange={handleChange}
                                                    placeholder="e.g. RT-1024"
                                                    className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none transition-colors ${isEditing ? 'border-slate-100 dark:border-slate-700 focus:border-primary' : 'border-transparent bg-transparent pl-0'}`}
                                                    disabled={!isEditing}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-primary tracking-widest pl-3 border-l-2 border-primary ml-1">LGU Unit/Body #</label>
                                                <input
                                                    type="text" name="body_number"
                                                    value={profile.body_number || ''}
                                                    onChange={handleChange}
                                                    placeholder="e.g. UNIT-402"
                                                    className={`w-full bg-primary/10 dark:bg-primary/5 border-2 rounded-2xl py-3 px-4 font-black text-secondary dark:text-primary outline-none transition-colors ${isEditing ? 'border-primary/20 focus:border-primary' : 'border-transparent bg-transparent pl-0'}`}
                                                    disabled={!isEditing}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-3">License Expiry</label>
                                                <input
                                                    type="text" name="license_expiry_date"
                                                    value={profile.license_expiry_date || ''}
                                                    onChange={handleChange}
                                                    placeholder="DD/MM/YYYY"
                                                    maxLength="10"
                                                    className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none transition-colors ${isEditing ? 'border-slate-100 dark:border-slate-700 focus:border-primary' : 'border-transparent bg-transparent pl-0'}`}
                                                    disabled={!isEditing}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-3">Vehicle Color</label>
                                                <input
                                                    type="text"
                                                    name="vehicle_color"
                                                    value={profile.vehicle_color || ''}
                                                    onChange={handleChange}
                                                    placeholder="e.g. Royal Blue"
                                                    className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none transition-colors ${isEditing ? 'border-slate-100 dark:border-slate-700 focus:border-primary' : 'border-transparent bg-transparent pl-0'}`}
                                                    disabled={!isEditing}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-3">Sidecar Type</label>
                                                <select
                                                    name="sidecar_type"
                                                    value={profile.sidecar_type || ''}
                                                    onChange={handleChange}
                                                    className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none transition-colors ${isEditing ? 'border-slate-100 dark:border-slate-700 focus:border-primary' : 'border-transparent bg-transparent pl-0 appearance-none'}`}
                                                    disabled={!isEditing}
                                                >
                                                    <option value="">Select Type</option>
                                                    <option value="Standard">Standard</option>
                                                    <option value="Roofed">Roofed</option>
                                                    <option value="Open">Open-Air</option>
                                                    <option value="Extended">Extended</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 flex justify-end">
                                    {isEditing && (
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    fetchProfile(); // Reset changes
                                                }}
                                                className="bg-slate-100 text-slate-500 font-bold py-4 px-8 rounded-2xl hover:bg-slate-200 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={saving}
                                                className="bg-secondary dark:bg-white dark:text-secondary text-white font-black py-4 px-8 rounded-2xl hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-xl flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {saving ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Save size={18} /> Save Changes
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </form>
                        </motion.div>

                        {/* Security Section */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl p-8 mb-8 border border-slate-100 dark:border-white/5"
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center">
                                    <Lock size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-secondary dark:text-white uppercase tracking-tight">Account Security</h3>
                                    <p className="text-slate-500 text-xs font-bold">Manage your transaction PIN and security settings</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowPinModal(true)}
                                className="w-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-secondary dark:text-white font-black py-4 rounded-2xl border-2 border-slate-100 dark:border-white/5 transition-all flex items-center justify-between px-6 group"
                            >
                                <span className="uppercase tracking-widest text-sm">Manage Transaction PIN</span>
                                <div className="w-8 h-8 bg-white dark:bg-white/10 rounded-full flex items-center justify-center text-slate-400 group-hover:text-secondary dark:group-hover:text-white transition-colors">
                                    <ArrowUpRight size={16} />
                                </div>
                            </button>

                            <button
                                onClick={() => { setShowPasswordModal(true); setPasswordMsg({ type: '', text: '' }); setPasswordForm({ current_password: '', new_password: '', confirm_password: '' }); }}
                                className="w-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-secondary dark:text-white font-black py-4 rounded-2xl border-2 border-slate-100 dark:border-white/5 transition-all flex items-center justify-between px-6 group mt-3"
                            >
                                <span className="uppercase tracking-widest text-sm flex items-center gap-2"><KeyRound size={16} /> Change Password</span>
                                <div className="w-8 h-8 bg-white dark:bg-white/10 rounded-full flex items-center justify-center text-slate-400 group-hover:text-secondary dark:group-hover:text-white transition-colors">
                                    <ArrowUpRight size={16} />
                                </div>
                            </button>

                            <button
                                onClick={() => { setShowEmailModal(true); setEmailMsg({ type: '', text: '' }); setEmailStep(1); setEmailForm({ new_email: '', password: '', otp: '' }); }}
                                className="w-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-secondary dark:text-white font-black py-4 rounded-2xl border-2 border-slate-100 dark:border-white/5 transition-all flex items-center justify-between px-6 group mt-3"
                            >
                                <span className="uppercase tracking-widest text-sm flex items-center gap-2"><MailCheck size={16} /> Change Email</span>
                                <div className="w-8 h-8 bg-white dark:bg-white/10 rounded-full flex items-center justify-center text-slate-400 group-hover:text-secondary dark:group-hover:text-white transition-colors">
                                    <ArrowUpRight size={16} />
                                </div>
                            </button>
                        </motion.div>
                    </div>
                </div>
            </div>
            <SecurityPINModal isOpen={showPinModal} onClose={() => setShowPinModal(false)} />

            {/* ── Change Password Modal ── */}
            <AnimatePresence>
                {showPasswordModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 relative">
                            <button onClick={() => setShowPasswordModal(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X size={20} /></button>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-primary/20 text-primary rounded-2xl flex items-center justify-center"><KeyRound size={24} /></div>
                                <div>
                                    <h3 className="text-lg font-black text-secondary dark:text-white">Change Password</h3>
                                    <p className="text-xs text-slate-400 font-bold">You'll be logged out after changing</p>
                                </div>
                            </div>
                            <form onSubmit={handleChangePassword} className="space-y-4">
                                <div className="relative">
                                    <input type={showCurrentPw ? 'text' : 'password'} value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} placeholder="Current Password" required className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 pr-12 font-bold text-secondary dark:text-white outline-none focus:border-primary transition-colors" />
                                    <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{showCurrentPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                </div>
                                <div className="relative">
                                    <input type={showNewPw ? 'text' : 'password'} value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} placeholder="New Password (min 6 chars)" required minLength={6} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 pr-12 font-bold text-secondary dark:text-white outline-none focus:border-primary transition-colors" />
                                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                </div>
                                <input type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} placeholder="Confirm New Password" required className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none focus:border-primary transition-colors" />
                                {passwordMsg.text && <div className={`p-3 rounded-xl text-sm font-bold ${passwordMsg.type === 'success' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>{passwordMsg.text}</div>}
                                <button type="submit" disabled={passwordLoading} className="w-full bg-secondary dark:bg-white text-white dark:text-secondary font-black py-4 rounded-2xl hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                                    {passwordLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : <><KeyRound size={18} /> Update Password</>}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Change Email Modal ── */}
            <AnimatePresence>
                {showEmailModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 relative">
                            <button onClick={() => setShowEmailModal(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X size={20} /></button>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center"><MailCheck size={24} /></div>
                                <div>
                                    <h3 className="text-lg font-black text-secondary dark:text-white">Change Email</h3>
                                    <p className="text-xs text-slate-400 font-bold">Current: {profile.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 my-4">
                                <div className={`flex-1 h-1 rounded-full ${emailStep >= 1 ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                <div className={`flex-1 h-1 rounded-full ${emailStep >= 2 ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                            </div>

                            {emailStep === 1 ? (
                                <form onSubmit={handleRequestEmailChange} className="space-y-4">
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Step 1: Enter your new email and confirm your password</p>
                                    <input type="email" value={emailForm.new_email} onChange={(e) => setEmailForm({ ...emailForm, new_email: e.target.value.toLowerCase() })} placeholder="New Email Address" required className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none focus:border-blue-500 transition-colors" />
                                    <input type="password" value={emailForm.password} onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })} placeholder="Confirm Your Password" required className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 font-bold text-secondary dark:text-white outline-none focus:border-blue-500 transition-colors" />
                                    {emailMsg.text && <div className={`p-3 rounded-xl text-sm font-bold ${emailMsg.type === 'success' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>{emailMsg.text}</div>}
                                    <button type="submit" disabled={emailLoading} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                                        {emailLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending Code...</> : <>Send Verification Code</>}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleConfirmEmailChange} className="space-y-4">
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Step 2: Enter the 6-digit code sent to <span className="text-blue-600 dark:text-blue-400">{emailForm.new_email}</span></p>
                                    <input type="text" value={emailForm.otp} onChange={(e) => setEmailForm({ ...emailForm, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="6-digit verification code" required maxLength={6} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-4 font-black text-2xl text-center tracking-[0.5em] text-secondary dark:text-white outline-none focus:border-blue-500 transition-colors" />
                                    {emailMsg.text && <div className={`p-3 rounded-xl text-sm font-bold ${emailMsg.type === 'success' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>{emailMsg.text}</div>}
                                    <button type="submit" disabled={emailLoading || emailForm.otp.length < 6} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                                        {emailLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : <><MailCheck size={18} /> Confirm Email Change</>}
                                    </button>
                                    <button type="button" onClick={() => { setEmailStep(1); setEmailMsg({ type: '', text: '' }); }} className="w-full text-slate-500 font-bold text-sm hover:text-secondary dark:hover:text-white transition-colors">← Go Back</button>
                                </form>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Full Screen Picture Viewer ── */}
            <AnimatePresence>
                {showPictureViewer && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
                        onClick={() => setShowPictureViewer(false)}
                    >
                        <button
                            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                            onClick={() => setShowPictureViewer(false)}
                        >
                            <X size={24} />
                        </button>
                        <motion.img
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            src={ensureImageUrl(profile.profile_picture, profile.username, profile.profile_picture_url)}
                            alt="Profile Full Size"
                            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            <AvatarUploadModal
                isOpen={showAvatarModal}
                onClose={() => setShowAvatarModal(false)}
                currentUsername={profile.username}
                currentPicture={profile.profile_picture}
                onSuccess={(updatedProfile) => {
                    // Update the avatar preview immediately without full page reload
                    const imgEl = document.getElementById('profile-preview');
                    const newSrc = ensureImageUrl(
                        updatedProfile.profile_picture,
                        updatedProfile.username,
                        updatedProfile.profile_picture_url
                    );
                    if (imgEl) imgEl.src = newSrc;
                    setProfile(prev => ({
                        ...prev,
                        profile_picture: updatedProfile.profile_picture,
                        profile_picture_url: updatedProfile.profile_picture_url
                    }));
                    getProfile(); // Sync nav bar avatar
                }}
            />
        </div >
    );
};

export default Profile;
