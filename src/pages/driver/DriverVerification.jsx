import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, CheckCircle, AlertCircle, ArrowLeft, Camera, ChevronRight, Check, AlertTriangle, FileText, Info, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

const DriverVerification = () => {
    // Text Inputs
    const [licenseNum, setLicenseNum] = useState('');
    const [permitNum, setPermitNum] = useState('');
    const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
    const [bodyNumber, setBodyNumber] = useState('');
    const [vehicleModel, setVehicleModel] = useState('');
    const [vehiclePlate, setVehiclePlate] = useState('');
    const [vehicleColor, setVehicleColor] = useState('');
    const [sidecarType, setSidecarType] = useState('');

    // File Inputs
    const [licenseImg, setLicenseImg] = useState(null);
    const [permitImg, setPermitImg] = useState(null);
    const [nbiClearanceImg, setNbiClearanceImg] = useState(null);
    const [selfieWithLicenseImg, setSelfieWithLicenseImg] = useState(null);
    const [vehicleOrcrImg, setVehicleOrcrImg] = useState(null);
    const [tricyclePhotoImg, setTricyclePhotoImg] = useState(null);

    // Existing URLs
    const [existingLicenseImg, setExistingLicenseImg] = useState(null);
    const [existingPermitImg, setExistingPermitImg] = useState(null);
    const [existingNbiClearanceImg, setExistingNbiClearanceImg] = useState(null);
    const [existingSelfieWithLicenseImg, setExistingSelfieWithLicenseImg] = useState(null);
    const [existingVehicleOrcrImg, setExistingVehicleOrcrImg] = useState(null);
    const [existingTricyclePhotoImg, setExistingTricyclePhotoImg] = useState(null);

    const [status, setStatus] = useState('loading'); // loading, idle, uploading, success, error
    const [verificationStatus, setVerificationStatus] = useState(null);
    const [rawVerificationStatus, setRawVerificationStatus] = useState('');
    const [msg, setMsg] = useState('');
    const [isEditing, setIsEditing] = useState(true);

    // Diagnostic & Admin Feedback State
    const [adminNotes, setAdminNotes] = useState('');
    const [aiDiagnostics, setAiDiagnostics] = useState(null);

    // UI State for Hub
    const [activeSection, setActiveSection] = useState(null); // 'license', 'permit', 'clearances', 'vehicle', 'liveness'

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/user/profile/');
            const data = res.data;
            setLicenseNum(data.license_number || '');
            setPermitNum(data.permit_number || '');
            setLicenseExpiryDate(data.license_expiry_date || '');
            setBodyNumber(data.body_number || '');
            setVehicleModel(data.vehicle_model || '');
            setVehiclePlate(data.vehicle_plate || '');
            setVehicleColor(data.vehicle_color || '');
            setSidecarType(data.sidecar_type || '');
            setExistingLicenseImg(data.license_image_url || data.license_image);
            setExistingPermitImg(data.permit_image_url || data.permit_image);
            setExistingNbiClearanceImg(data.nbi_clearance_image_url || data.nbi_clearance_image);
            setExistingSelfieWithLicenseImg(data.selfie_with_license_url || data.selfie_with_license);
            setExistingVehicleOrcrImg(data.vehicle_orcr_image_url || data.vehicle_orcr_image);
            setExistingTricyclePhotoImg(data.tricycle_photo_url || data.tricycle_photo);

            setRawVerificationStatus(data.verification_status || '');
            if (data.verification_notes) {
                if (data.verification_notes.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(data.verification_notes);
                        // admin_notes is now a key inside the unified JSON
                        setAdminNotes(parsed.admin_notes || '');
                        setAiDiagnostics(parsed);
                    } catch (e) {
                        setAdminNotes(data.verification_notes);
                    }
                } else {
                    // Legacy plain-text notes (before the unified JSON format)
                    setAdminNotes(data.verification_notes);
                }
            }

            const isApproved = data.is_verified_driver && data.verification_status === 'approved';
            setVerificationStatus(isApproved);
            setIsEditing(!isApproved);
            setStatus('idle');
        } catch (err) {
            console.error(err);
            setStatus('idle');
        }
    };

    const compressImage = (file, maxWidth = 1024, maxHeight = 1024, quality = 0.7) => {
        return new Promise((resolve) => {
            if (!file || !file.type.startsWith('image/')) {
                resolve(file);
                return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                const compressedFile = new File([blob], file.name, {
                                    type: 'image/jpeg',
                                    lastModified: Date.now(),
                                });
                                resolve(compressedFile);
                            } else {
                                resolve(file);
                            }
                        },
                        'image/jpeg',
                        quality
                    );
                };
                img.onerror = () => resolve(file);
            };
            reader.onerror = () => resolve(file);
        });
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        setStatus('uploading');
        setMsg('');

        try {
            // Compress all images in parallel
            const [
                compressedLicenseImg,
                compressedPermitImg,
                compressedNbiClearanceImg,
                compressedSelfieWithLicenseImg,
                compressedVehicleOrcrImg,
                compressedTricyclePhotoImg
            ] = await Promise.all([
                licenseImg ? compressImage(licenseImg) : Promise.resolve(null),
                permitImg ? compressImage(permitImg) : Promise.resolve(null),
                nbiClearanceImg ? compressImage(nbiClearanceImg) : Promise.resolve(null),
                selfieWithLicenseImg ? compressImage(selfieWithLicenseImg) : Promise.resolve(null),
                vehicleOrcrImg ? compressImage(vehicleOrcrImg) : Promise.resolve(null),
                tricyclePhotoImg ? compressImage(tricyclePhotoImg) : Promise.resolve(null)
            ]);

            const formData = new FormData();
            formData.append('license_number', licenseNum);
            formData.append('permit_number', permitNum);
            formData.append('license_expiry_date', licenseExpiryDate);
            formData.append('body_number', bodyNumber);
            formData.append('vehicle_model', vehicleModel);
            formData.append('vehicle_plate', vehiclePlate);
            formData.append('vehicle_color', vehicleColor);
            formData.append('sidecar_type', sidecarType);

            if (compressedLicenseImg) formData.append('license_image', compressedLicenseImg);
            if (compressedPermitImg) formData.append('permit_image', compressedPermitImg);
            if (compressedNbiClearanceImg) formData.append('nbi_clearance_image', compressedNbiClearanceImg);
            if (compressedSelfieWithLicenseImg) formData.append('selfie_with_license', compressedSelfieWithLicenseImg);
            if (compressedVehicleOrcrImg) formData.append('vehicle_orcr_image', compressedVehicleOrcrImg);
            if (compressedTricyclePhotoImg) formData.append('tricycle_photo', compressedTricyclePhotoImg);

            const response = await api.post('/driver/verify/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setStatus('success');
            setVerificationStatus(false);
            setMsg(response.data.detail || 'Your documents have been submitted for review.');
            setTimeout(() => fetchData(), 1500);
        } catch (err) {
            setStatus('error');
            console.error('Upload error details:', err);
            // If the server returns details, display it, otherwise standard fallback
            const errDetail = err.response?.data?.detail;
            const errErrors = err.response?.data?.errors;
            let fullErrMsg = errDetail || 'Failed to submit documents. Please check required fields.';
            if (errErrors) {
                const firstKey = Object.keys(errErrors)[0];
                if (firstKey) {
                    fullErrMsg += ` (${firstKey}: ${errErrors[firstKey]})`;
                }
            }
            setMsg(fullErrMsg);
        }
    };

    // Calculate progress (6 required items instead of 7) & document diagnostic health
    const isLicenseExpired = licenseExpiryDate && new Date(licenseExpiryDate) < new Date();
    const licenseRegex = /^[A-Z]\d{2}-?\d{2}-?\d{4,6}$/i;
    const isLicenseFormatValid = licenseNum && licenseRegex.test(licenseNum.trim());
    const plateRegex = /^[A-Z0-9\s-]{3,10}$/i;
    const isPlateValid = vehiclePlate && plateRegex.test(vehiclePlate.trim());

    const items = [
        { ready: licenseNum.length > 5 && (licenseImg || existingLicenseImg) && licenseExpiryDate && !isLicenseExpired && isLicenseFormatValid },
        { ready: permitNum.length >= 3 && (permitImg || existingPermitImg) },
        { ready: (nbiClearanceImg || existingNbiClearanceImg) },
        { ready: (vehicleOrcrImg || existingVehicleOrcrImg) },
        { ready: bodyNumber.length > 0 && vehicleModel.length > 0 && isPlateValid && vehicleColor.length > 0 && sidecarType.length > 0 && (tricyclePhotoImg || existingTricyclePhotoImg) },
        { ready: (selfieWithLicenseImg || existingSelfieWithLicenseImg) }
    ];
    const completedCount = items.filter(i => i.ready).length;
    const progressPercent = (completedCount / 6) * 100;

    // Document Diagnostic Statuses
    const docStatuses = {
        license: isLicenseExpired 
            ? { isOk: false, label: 'Expired ⚠️', color: 'bg-amber-500/20 text-amber-500 border-amber-500/30', alert: 'Nakalipas na ang Expiration Date ng iyong lisensya. Paki-update ang date o mag-upload ng panibagong lisensya.' }
            : (!isLicenseFormatValid && licenseNum)
            ? { isOk: false, label: 'Mali ang Format ❌', color: 'bg-red-500/20 text-red-500 border-red-500/30', alert: 'Mali ang format ng LTO License number (dapat e.g. D12-34-567890 o D1234567890).' }
            : items[0].ready
            ? { isOk: true, label: 'Verified ✅', color: 'bg-green-500/20 text-green-500 border-green-500/30', alert: null }
            : { isOk: false, label: 'Incomplete ⚠️', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', alert: 'Paki-kumpleto ang License #, expiry date, at larawan.' },

        permit: items[1].ready
            ? { isOk: true, label: 'Verified ✅', color: 'bg-green-500/20 text-green-500 border-green-500/30', alert: null }
            : { isOk: false, label: 'Incomplete ⚠️', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', alert: 'Lagyan ng Trento MTOP Permit ID at larawan.' },

        clearance: items[2].ready
            ? { isOk: true, label: 'Verified ✅', color: 'bg-green-500/20 text-green-500 border-green-500/30', alert: null }
            : { isOk: false, label: 'Incomplete ⚠️', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', alert: 'Mag-upload ng malinaw na Police o NBI Clearance.' },

        vehicle: (!isPlateValid && vehiclePlate)
            ? { isOk: false, label: 'Mali ang Plate ❌', color: 'bg-red-500/20 text-red-500 border-red-500/30', alert: 'Mali ang Plate Number format.' }
            : (items[3].ready && items[4].ready)
            ? { isOk: true, label: 'Verified ✅', color: 'bg-green-500/20 text-green-500 border-green-500/30', alert: null }
            : { isOk: false, label: 'Incomplete ⚠️', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', alert: 'Paki-kumpleto ang Body #, OR/CR, at litrato ng tricycle.' },

        liveness: (aiDiagnostics && aiDiagnostics.face_similarity_score < 80)
            ? { isOk: false, label: 'Face Issue ❌', color: 'bg-red-500/20 text-red-500 border-red-500/30', alert: 'Hindi tumugma ang mukha sa Solo Selfie kumpara sa License photo. Kumuha ng malinaw na bagong litrato.' }
            : items[5].ready
            ? { isOk: true, label: 'Verified ✅', color: 'bg-green-500/20 text-green-500 border-green-500/30', alert: null }
            : { isOk: false, label: 'Incomplete ⚠️', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', alert: 'Mag-take ng malinaw na Solo Selfie kung saan kita ang mukha.' }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const DocumentUploadField = ({ id, label, file, existingUrl, setFile }) => (
        <div className="relative group cursor-pointer mt-4">
            <input
                id={id}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files[0])}
                accept="image/*"
                disabled={!isEditing}
            />
            <label htmlFor={id} className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-3xl transition-all ${!isEditing ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-80' : 'border-primary/30 bg-primary/5 hover:border-primary cursor-pointer'}`}>
                {file ? (
                    <div className="text-center p-4">
                        <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
                        <span className="text-sm font-bold text-slate-800 dark:text-white truncate block max-w-[200px]">{file.name}</span>
                        <span className="text-xs text-slate-500 mt-1">Tap to change</span>
                    </div>
                ) : existingUrl ? (
                    <div className="text-center p-4">
                        <img src={existingUrl} alt={label} className="h-16 mx-auto mb-2 object-contain rounded-lg shadow-sm" />
                        <span className="text-[10px] font-black uppercase text-green-500 tracking-widest bg-green-100 px-2 py-1 rounded-full">File Uploaded</span>
                    </div>
                ) : (
                    <div className="text-center p-4 text-slate-400 group-hover:text-primary transition-colors">
                        <Camera size={32} className="mx-auto mb-3" />
                        <span className="text-sm font-bold block">Snap or Upload {label}</span>
                    </div>
                )}
            </label>
        </div>
    );

    return (
        <div className="min-h-screen pt-24 pb-12 bg-slate-50 dark:bg-slate-950 flex flex-col items-center px-4 md:px-6 transition-colors duration-500">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link to="/profile" className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm text-slate-400 hover:text-secondary dark:hover:text-primary transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-secondary dark:text-white uppercase tracking-tight">Verification Hub</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Complete your driver profile to get on the road.</p>
                    </div>
                </div>

                {/* Status Hero Card */}
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl p-8 mb-8 border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-bl-full -z-0"></div>
                    <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                        {/* Circular Progress */}
                        <div className="relative w-32 h-32 flex-shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="40" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="8" fill="none" />
                                <circle cx="50" cy="50" r="40" className="stroke-primary transition-all duration-1000 ease-out" strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * progressPercent) / 100} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-black text-secondary dark:text-white">{completedCount}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">of 6</span>
                            </div>
                        </div>

                        <div className="text-center md:text-left flex-1">
                            {verificationStatus && !isEditing ? (
                                <>
                                    <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-3">
                                        <CheckCircle size={14} /> Approved Driver
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">You're ready to drive!</h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Your documents have been verified by Trento LGU. Stay safe on the road.</p>
                                    <button onClick={() => setIsEditing(true)} className="mt-4 text-primary font-bold text-sm hover:underline">Update Documents?</button>
                                </>
                            ) : completedCount === 6 ? (
                                <>
                                    <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-3">
                                        <ShieldCheck size={14} /> Ready to Submit
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">All tasks completed</h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Scroll down to submit your profile for administrator review.</p>
                                </>
                            ) : (
                                <>
                                    <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-3">
                                        <AlertCircle size={14} /> Action Required
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Almost there!</h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">You need to complete {6 - completedCount} more task{6 - completedCount !== 1 ? 's' : ''} before you can submit your profile.</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Admin Review Remarks Banner */}
                {adminNotes && (
                    <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-6 mb-8 relative overflow-hidden">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-amber-500/20 text-amber-500 rounded-2xl shrink-0 mt-0.5">
                                <FileText size={22} />
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest block mb-1">📢 LGU Admin Review Remarks</span>
                                <p className="text-sm font-bold text-slate-800 dark:text-white leading-relaxed italic">"{adminNotes}"</p>
                                <p className="text-[10px] text-slate-400 mt-2 font-medium">Pakisundan ang abiso ng Admin sa ibaba at i-update ang nauukol na dokumento.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* AI Document Pre-Verification Health Dashboard */}
                {Object.values(docStatuses).some(d => !d.isOk) && (
                    <div className="bg-slate-900 rounded-3xl p-6 mb-8 border border-white/10 text-white space-y-3 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={16} className="text-amber-400 animate-pulse" />
                                <h4 className="font-black uppercase tracking-wider text-xs">🤖 Document Diagnostics & Action Checklist</h4>
                            </div>
                            <span className="text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/30">
                                {Object.values(docStatuses).filter(d => !d.isOk).length} Action{Object.values(docStatuses).filter(d => !d.isOk).length > 1 ? 's' : ''} Needed
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                            {Object.entries(docStatuses).map(([key, item]) => item.alert ? (
                                <div key={key} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-start gap-2">
                                    <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
                                    <span className="text-[11px] text-slate-300 font-medium leading-tight">{item.alert}</span>
                                </div>
                            ) : null)}
                        </div>
                    </div>
                )}

                {status === 'success' ? (
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 text-center shadow-xl border border-slate-100 dark:border-slate-800">
                        <div className="w-24 h-24 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500">
                            <CheckCircle size={48} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">Submission Received</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">{msg}</p>
                        <Link to="/driver" className="inline-block w-full py-4 bg-secondary dark:bg-primary text-white dark:text-secondary font-black rounded-2xl hover:opacity-90 transition-all shadow-xl">
                            Return to Dashboard
                        </Link>
                    </motion.div>
                ) : (
                    <form onSubmit={handleUpload} className="space-y-4">
                        {/* Task 1: LTO License */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-all">
                            <button
                                type="button"
                                onClick={() => setActiveSection(activeSection === 'license' ? null : 'license')}
                                className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${items[0].ready ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
                                        {items[0].ready ? <Check size={20} /> : <span className="font-black">1</span>}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">LTO Driver's License</h3>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${docStatuses.license.color}`}>
                                                {docStatuses.license.label}
                                            </span>
                                        </div>
                                        <p className="text-slate-500 text-xs">Professional or Non-Pro license details</p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className={`text-slate-400 transition-transform ${activeSection === 'license' ? 'rotate-90' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {activeSection === 'license' && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                        <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 mt-2 space-y-4">
                                            {docStatuses.license.alert && (
                                                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500 text-xs font-bold flex items-start gap-2 mt-4">
                                                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                                    <span>{docStatuses.license.alert}</span>
                                                </div>
                                            )}
                                            <div className="space-y-4 mt-2">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 mb-2 block">License Number</label>
                                                    <input
                                                        type="text" value={licenseNum} onChange={(e) => setLicenseNum(e.target.value)} required disabled={!isEditing}
                                                        placeholder="e.g. D12-34-567890 or D1234567890"
                                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-bold text-slate-900 dark:text-white disabled:opacity-50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 mb-2 block">License Expiry Date</label>
                                                    <input
                                                        type="date" value={licenseExpiryDate} onChange={(e) => setLicenseExpiryDate(e.target.value)} required disabled={!isEditing}
                                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-bold text-slate-900 dark:text-white disabled:opacity-50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 block">License Photo</label>
                                                    <DocumentUploadField id="upload-license" label="License" file={licenseImg} existingUrl={existingLicenseImg} setFile={setLicenseImg} />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Task 2: Franchise Permit */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-all">
                            <button
                                type="button"
                                onClick={() => setActiveSection(activeSection === 'permit' ? null : 'permit')}
                                className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${items[1].ready ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
                                        {items[1].ready ? <Check size={20} /> : <span className="font-black">2</span>}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">LGU Franchise Permit</h3>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${docStatuses.permit.color}`}>
                                                {docStatuses.permit.label}
                                            </span>
                                        </div>
                                        <p className="text-slate-500 text-xs">Official Trento MTOP credentials</p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className={`text-slate-400 transition-transform ${activeSection === 'permit' ? 'rotate-90' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {activeSection === 'permit' && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                        <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 mt-2 space-y-4">
                                            {docStatuses.permit.alert && (
                                                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500 text-xs font-bold flex items-start gap-2 mt-4">
                                                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                                    <span>{docStatuses.permit.alert}</span>
                                                </div>
                                            )}
                                            <div className="space-y-4 mt-2">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 mb-2 block">Operator Permit ID</label>
                                                    <input
                                                        type="text" value={permitNum} onChange={(e) => setPermitNum(e.target.value)} required disabled={!isEditing}
                                                        placeholder="e.g. TR-2025-001"
                                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-bold text-slate-900 dark:text-white disabled:opacity-50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 block">Permit Photo</label>
                                                    <DocumentUploadField id="upload-permit" label="Permit" file={permitImg} existingUrl={existingPermitImg} setFile={setPermitImg} />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Task 3: Clearances */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-all">
                            <button
                                type="button"
                                onClick={() => setActiveSection(activeSection === 'clearances' ? null : 'clearances')}
                                className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${items[2].ready ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
                                        {items[2].ready ? <Check size={20} /> : <span className="font-black">3</span>}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Safety Clearances</h3>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${docStatuses.clearance.color}`}>
                                                {docStatuses.clearance.label}
                                            </span>
                                        </div>
                                        <p className="text-slate-500 text-xs">Police or NBI Certifications</p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className={`text-slate-400 transition-transform ${activeSection === 'clearances' ? 'rotate-90' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {activeSection === 'clearances' && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                        <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 mt-2 space-y-4">
                                            {docStatuses.clearance.alert && (
                                                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500 text-xs font-bold flex items-start gap-2 mt-4">
                                                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                                    <span>{docStatuses.clearance.alert}</span>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 gap-4 mt-2">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 block">Police or NBI Clearance</label>
                                                    <DocumentUploadField id="upload-nbi" label="Clearance" file={nbiClearanceImg} existingUrl={existingNbiClearanceImg} setFile={setNbiClearanceImg} />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Task 4: Vehicle Details & OR/CR */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-all">
                            <button
                                type="button"
                                onClick={() => setActiveSection(activeSection === 'vehicle' ? null : 'vehicle')}
                                className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${(items[3].ready && items[4].ready) ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
                                        {(items[3].ready && items[4].ready) ? <Check size={20} /> : <span className="font-black">4</span>}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Vehicle Registration & Photo</h3>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${docStatuses.vehicle.color}`}>
                                                {docStatuses.vehicle.label}
                                            </span>
                                        </div>
                                        <p className="text-slate-500 text-xs">Official LTO OR/CR & Tricycle photo</p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className={`text-slate-400 transition-transform ${activeSection === 'vehicle' ? 'rotate-90' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {activeSection === 'vehicle' && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                        <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 mt-2 space-y-4">
                                            {docStatuses.vehicle.alert && (
                                                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500 text-xs font-bold flex items-start gap-2 mt-4">
                                                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                                    <span>{docStatuses.vehicle.alert}</span>
                                                </div>
                                            )}
                                            <div className="space-y-4 mt-2">
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 italic">These details will be locked once approved by LGU admin.</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 mb-2 block">LGU Body/Unit Number</label>
                                                        <input type="text" value={bodyNumber} onChange={(e) => setBodyNumber(e.target.value)} required disabled={!isEditing} placeholder="e.g. 0542"
                                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-bold text-slate-900 dark:text-white disabled:opacity-50" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 mb-2 block">Vehicle Model</label>
                                                        <input type="text" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} required disabled={!isEditing} placeholder="e.g. Honda TMX 125"
                                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-bold text-slate-900 dark:text-white disabled:opacity-50" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 mb-2 block">Plate Number</label>
                                                        <input type="text" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} required disabled={!isEditing} placeholder="e.g. RT-1024"
                                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-bold text-slate-900 dark:text-white disabled:opacity-50" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 mb-2 block">Vehicle Color</label>
                                                        <input type="text" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} required disabled={!isEditing} placeholder="e.g. Royal Blue"
                                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-bold text-slate-900 dark:text-white disabled:opacity-50" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 mb-2 block">Sidecar Type</label>
                                                        <select value={sidecarType} onChange={(e) => setSidecarType(e.target.value)} required disabled={!isEditing}
                                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-bold text-slate-900 dark:text-white disabled:opacity-50">
                                                            <option value="">Select Type</option>
                                                            <option value="Standard">Standard</option>
                                                            <option value="Roofed">Roofed</option>
                                                            <option value="Open">Open-Air</option>
                                                            <option value="Extended">Extended</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 block">LTO OR/CR Image</label>
                                                        <DocumentUploadField id="upload-orcr" label="OR/CR" file={vehicleOrcrImg} existingUrl={existingVehicleOrcrImg} setFile={setVehicleOrcrImg} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 block">Tricycle Photo</label>
                                                        <DocumentUploadField id="upload-trike" label="Trike" file={tricyclePhotoImg} existingUrl={existingTricyclePhotoImg} setFile={setTricyclePhotoImg} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Task 5: Liveness Selfie */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-all">
                            <button
                                type="button"
                                onClick={() => setActiveSection(activeSection === 'liveness' ? null : 'liveness')}
                                className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${items[5].ready ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
                                        {items[5].ready ? <Check size={20} /> : <span className="font-black">5</span>}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Identity Verification</h3>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${docStatuses.liveness.color}`}>
                                                {docStatuses.liveness.label}
                                            </span>
                                        </div>
                                        <p className="text-slate-500 text-xs">Solo Driver Face Photo (Biometrics)</p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className={`text-slate-400 transition-transform ${activeSection === 'liveness' ? 'rotate-90' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {activeSection === 'liveness' && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                        <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 mt-2 space-y-4">
                                            {docStatuses.liveness.alert && (
                                                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500 text-xs font-bold flex items-start gap-2 mt-4">
                                                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                                    <span>{docStatuses.liveness.alert}</span>
                                                </div>
                                            )}
                                            <div className="space-y-4 mt-2">
                                                <p className="text-xs text-slate-400 ml-2 italic">Take a clear, well-lit photo of your face facing forward. Ensure your face is centered and clearly visible for AI biometrics.</p>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 block">Solo Driver Selfie</label>
                                                    <DocumentUploadField id="upload-selfie" label="Solo Selfie" file={selfieWithLicenseImg} existingUrl={existingSelfieWithLicenseImg} setFile={setSelfieWithLicenseImg} />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Error Message */}
                        {status === 'error' && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-100 dark:border-red-900/30 flex items-start gap-3">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <span className="leading-tight">{msg}</span>
                            </motion.div>
                        )}

                        {/* Submit Button */}
                        {isEditing && (
                            <div className="pt-6">
                                <button
                                    type="submit"
                                    disabled={status === 'uploading' || completedCount < 6}
                                    className="w-full bg-secondary dark:bg-primary text-white dark:text-secondary font-black py-5 rounded-3xl hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    {status === 'uploading' ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white dark:border-secondary border-t-transparent rounded-full animate-spin"></div>
                                            <span>Encrypting & Submitting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Submit Profile for Review</span>
                                            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-xs text-slate-500 mt-4 font-medium">By submitting, you consent to Trento LGU verifying these documents.</p>
                            </div>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
};

export default DriverVerification;
