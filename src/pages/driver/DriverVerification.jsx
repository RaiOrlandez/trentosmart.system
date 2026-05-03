import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { motion } from 'framer-motion';
import { ShieldCheck, Upload, FileText, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const DriverVerification = () => {
    const [licenseNum, setLicenseNum] = useState('');
    const [permitNum, setPermitNum] = useState('');
    const [licenseImg, setLicenseImg] = useState(null); // File object for upload
    const [permitImg, setPermitImg] = useState(null);   // File object for upload
    const [existingLicenseImg, setExistingLicenseImg] = useState(null); // URL string
    const [existingPermitImg, setExistingPermitImg] = useState(null);   // URL string

    const [status, setStatus] = useState('loading'); // loading, idle, uploading, success, error
    const [verificationStatus, setVerificationStatus] = useState(false); // is_verified_driver
    const [msg, setMsg] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/user/profile/');
            const data = res.data;
            setLicenseNum(data.license_number || '');
            setPermitNum(data.permit_number || '');
            setExistingLicenseImg(data.license_image);
            setExistingPermitImg(data.permit_image);
            setVerificationStatus(data.is_verified_driver);
            setIsEditing(!data.is_verified_driver);
            setStatus('idle');
        } catch (err) {
            console.error(err);
            setStatus('idle');
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        setStatus('uploading');
        setMsg('');

        const formData = new FormData();
        formData.append('license_number', licenseNum);
        formData.append('permit_number', permitNum);
        if (licenseImg) formData.append('license_image', licenseImg);
        if (permitImg) formData.append('permit_image', permitImg);

        console.log('Submitting verification data:', {
            license_number: licenseNum,
            permit_number: permitNum,
            has_license_image: !!licenseImg,
            has_permit_image: !!permitImg
        });
        console.log('API Base URL:', api.defaults.baseURL);

        try {
            const response = await api.post('/driver/verify/', formData);
            console.log('Verification SUCCESS:', response.data);
            setStatus('success');
            setVerificationStatus(false);
            setMsg(response.data.detail || 'Your documents have been submitted for review.');
        } catch (err) {
            console.error('=== VERIFICATION ERROR ===');
            console.error('Full error object:', err);
            console.error('Error message:', err.message);
            console.error('Error response:', err.response);
            console.error('Error config:', err.config);
            console.error('Request URL:', err.config?.url);
            console.error('Base URL:', err.config?.baseURL);
            setStatus('error');

            // Detailed error diagnosis
            let errorMsg = 'Failed to submit documents. ';

            if (!err.response) {
                // Network error - request never reached server
                console.error('NO RESPONSE - Network error or CORS issue');
                if (err.message.includes('Network Error')) {
                    errorMsg += 'Cannot connect to server. Please ensure the backend is running on http://127.0.0.1:8000. Check browser console for CORS errors.';
                } else if (err.code === 'ECONNABORTED') {
                    errorMsg += 'Request timeout. Server took too long to respond.';
                } else {
                    errorMsg += `Network error: ${err.message}. Backend may not be running.`;
                }
            } else if (err.response.status === 404) {
                errorMsg += `Endpoint not found (404). URL: ${err.config?.url}. Check if /api/driver/verify/ exists.`;
            } else if (err.response.status === 403) {
                errorMsg += 'Permission denied (403). You must be logged in as a driver.';
            } else if (err.response.status === 401) {
                errorMsg += 'Authentication failed (401). Please log in again.';
            } else if (err.response.status === 400) {
                // Validation errors
                if (err.response.data?.errors) {
                    const errors = err.response.data.errors;
                    const errorDetails = Object.entries(errors)
                        .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
                        .join('; ');
                    errorMsg += errorDetails;
                } else if (err.response.data?.detail) {
                    errorMsg += err.response.data.detail;
                } else {
                    errorMsg += 'Validation failed. Please check all required fields.';
                }
            } else if (err.response.status >= 500) {
                errorMsg += `Server error (${err.response.status}). Backend crashed or misconfigured.`;
            } else {
                errorMsg += `HTTP ${err.response.status}: ${err.response.data?.detail || 'Unknown error'}`;
            }

            setMsg(errorMsg);
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 bg-slate-100 flex items-center justify-center px-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl w-full glass-card p-10 rounded-[3rem] shadow-2xl bg-white relative overflow-hidden"
            >
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-[5rem] -z-0"></div>

                <Link to="/profile" className="absolute top-8 left-8 text-slate-400 hover:text-secondary transition-colors z-10">
                    <ArrowLeft size={24} />
                </Link>

                <div className="text-center mb-10 relative z-10">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${verificationStatus && !isEditing ? 'bg-green-600 text-white shadow-lg shadow-green-200' : 'bg-primary/20 text-primary-dark animate-pulse'}`}>
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-2xl font-black text-secondary uppercase tracking-tight">
                        {verificationStatus && !isEditing ? 'Verified Driver Profile' : 'Document Submission'}
                    </h1>
                    <p className="text-slate-500 text-sm mt-2 font-medium">
                        {verificationStatus && !isEditing
                            ? 'Your credentials are active and verified by Trento LGU.'
                            : 'Update your driver credentials for administrative review.'}
                    </p>
                </div>

                {status === 'success' ? (
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center p-8 bg-green-50 rounded-3xl border border-green-100 relative z-10">
                        <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                        <h2 className="text-lg font-bold text-green-800 mb-2">Update Sent!</h2>
                        <p className="text-green-700 text-sm">{msg}</p>
                        <button
                            onClick={() => window.location.href = '/driver'}
                            className="mt-6 w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg"
                        >
                            Return to Dashboard
                        </button>
                    </motion.div>
                ) : (
                    <form onSubmit={handleUpload} className="space-y-6 relative z-10">
                        {status === 'error' && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold">
                                <div className="flex items-start gap-3">
                                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-black mb-1">ERROR:</p>
                                        <p className="text-xs leading-relaxed">{msg}</p>
                                        <p className="text-xs mt-2 opacity-75">Check browser console (F12) for detailed logs.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {verificationStatus && !isEditing && (
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3 text-blue-700 text-xs font-bold mb-4">
                                <ShieldCheck size={18} />
                                <span>Your account is currently verified. Changes will trigger a re-audit.</span>
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(true)}
                                    className="ml-auto text-blue-600 underline hover:text-blue-800"
                                >
                                    Update?
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">License Number</label>
                                <input
                                    type="text"
                                    value={licenseNum}
                                    onChange={(e) => setLicenseNum(e.target.value)}
                                    placeholder="e.g. D12-34-567890"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-secondary disabled:bg-slate-100 disabled:text-slate-400"
                                    required
                                    disabled={!isEditing}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">Operator Permit ID</label>
                                <input
                                    type="text"
                                    value={permitNum}
                                    onChange={(e) => setPermitNum(e.target.value)}
                                    placeholder="e.g. TR-2025-001"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-secondary disabled:bg-slate-100 disabled:text-slate-400"
                                    required
                                    disabled={!isEditing}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">Driver's License</label>
                                <label className={`flex flex-col items-center justify-center border-2 border-dashed border-slate-200 bg-slate-50 rounded-2 group hover:border-primary/50 transition-all p-8 text-center rounded-3xl ${!isEditing ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                                    {licenseImg ? (
                                        <div className="text-secondary font-bold text-xs truncate w-full">
                                            <FileText size={24} className="mx-auto text-primary mb-2" />
                                            {licenseImg.name}
                                        </div>
                                    ) : existingLicenseImg ? (
                                        <div className="text-secondary font-bold text-xs w-full">
                                            <img src={existingLicenseImg} alt="License" className="h-20 mx-auto mb-2 object-contain rounded-lg shadow-sm" />
                                            <span className="text-primary text-[10px] uppercase font-black">Verified Image</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload size={24} className="text-slate-300 mb-2 group-hover:text-primary transition-colors" />
                                            <span className="text-xs font-bold text-slate-400">Click to upload photo</span>
                                        </>
                                    )}
                                    <input type="file" className="hidden" onChange={(e) => setLicenseImg(e.target.files[0])} accept="image/*" disabled={!isEditing} />
                                </label>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">Tricycle Permit</label>
                                <label className={`flex flex-col items-center justify-center border-2 border-dashed border-slate-200 bg-slate-50 rounded-2 group hover:border-primary/50 transition-all p-8 text-center rounded-3xl ${!isEditing ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                                    {permitImg ? (
                                        <div className="text-secondary font-bold text-xs truncate w-full">
                                            <FileText size={24} className="mx-auto text-primary mb-2" />
                                            {permitImg.name}
                                        </div>
                                    ) : existingPermitImg ? (
                                        <div className="text-secondary font-bold text-xs w-full">
                                            <img src={existingPermitImg} alt="Permit" className="h-20 mx-auto mb-2 object-contain rounded-lg shadow-sm" />
                                            <span className="text-primary text-[10px] uppercase font-black">Verified Image</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload size={24} className="text-slate-300 mb-2 group-hover:text-primary transition-colors" />
                                            <span className="text-xs font-bold text-slate-400">Click to upload photo</span>
                                        </>
                                    )}
                                    <input type="file" className="hidden" onChange={(e) => setPermitImg(e.target.files[0])} accept="image/*" disabled={!isEditing} />
                                </label>
                            </div>
                        </div>

                        {isEditing ? (
                            <div className="pt-4 space-y-4">
                                <button
                                    type="submit"
                                    disabled={status === 'uploading'}
                                    className="w-full bg-secondary text-white font-black py-5 rounded-[2rem] hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
                                >
                                    {status === 'uploading' ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Submitting Update...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck size={20} className="text-primary" />
                                            <span>Save & Request Review</span>
                                        </>
                                    )}
                                </button>
                                {verificationStatus && (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(false)}
                                        className="w-full text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-secondary transition-colors"
                                    >
                                        Cancel & Stay Verified
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="p-6 bg-slate-50 text-slate-500 text-[10px] font-black text-center rounded-[2rem] border border-slate-100 uppercase tracking-[0.2em] leading-relaxed">
                                <CheckCircle size={16} className="mx-auto mb-2 text-green-500" />
                                Account Fully Verified
                                <br />
                                <span className="opacity-50">Standard Audit Complete</span>
                            </div>
                        )}
                    </form>
                )}

            </motion.div>
        </div>
    );
};

export default DriverVerification;
