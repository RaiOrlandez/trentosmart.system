import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle2, Lock, ArrowRight, Loader2, RefreshCw, Smartphone, KeyRound } from 'lucide-react';

const GCashGateway = () => {
  const [searchParams] = useSearchParams();
  const sourceId = searchParams.get('source_id') || 'src_mock_default';
  const amount = parseFloat(searchParams.get('amount') || '0').toFixed(2);
  const successUrl = searchParams.get('success_url') || '/wallet';
  const failedUrl = searchParams.get('failed_url') || '/wallet';

  const [step, setStep] = useState('phone'); // phone | otp | mpin | confirm | receipt | processing
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [mpin, setMpin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [refNo, setRefNo] = useState('');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Generate a random real-looking transaction reference number
    const randomRef = 'REF-' + Math.floor(100000000 + Math.random() * 900000000);
    setRefNo(randomRef);
  }, []);

  // Countdown timer for automatic redirect on receipt screen
  useEffect(() => {
    if (step === 'receipt' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (step === 'receipt' && countdown === 0) {
      handleRedirect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, countdown]);

  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter your 10-digit GCash mobile number.');
      return;
    }
    setError('');
    setStep('otp');
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    if (otp.some(digit => digit === '')) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }
    setError('');
    setStep('mpin');
  };

  const handleMpinChange = (index, value) => {
    if (isNaN(value)) return;
    const newMpin = [...mpin];
    newMpin[index] = value.slice(-1);
    setMpin(newMpin);

    // Auto focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`mpin-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleMpinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !mpin[index] && index > 0) {
      const prevInput = document.getElementById(`mpin-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleMpinSubmit = (e) => {
    e.preventDefault();
    if (mpin.some(digit => digit === '')) {
      setError('Please enter your 4-digit MPIN.');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const handlePay = () => {
    setStep('processing');
    setTimeout(() => {
      setStep('receipt');
    }, 2200);
  };

  const handleCancel = () => {
    const separator = failedUrl.includes('?') ? '&' : '?';
    window.location.href = `${failedUrl}${separator}status=failed&source_id=${sourceId}`;
  };

  const handleRedirect = () => {
    const separator = successUrl.includes('?') ? '&' : '?';
    window.location.href = `${successUrl}${separator}source_id=${sourceId}`;
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col font-sans text-slate-700">
      
      {/* ── GCash Header Branding ── */}
      <header className="bg-[#007DFE] text-white py-5 px-6 flex items-center justify-between shadow-md shadow-blue-500/10 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
            <span className="text-[#007DFE] text-2xl font-black italic select-none">G</span>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">GCash</h1>
            <p className="text-[8px] font-black text-blue-100 uppercase tracking-widest mt-0.5">Secure Gateway Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs font-bold text-blue-50">
          <Shield size={12} className="text-blue-200 animate-pulse" />
          <span className="text-[10px] tracking-wide font-black uppercase">Demo Mode</span>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 overflow-hidden border border-slate-200">
          
          {/* Top Bar for merchant info */}
          {step !== 'receipt' && step !== 'processing' && (
            <div className="bg-slate-50 border-b border-slate-100 px-7 py-5 flex justify-between items-center">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Merchant</p>
                <p className="font-black text-secondary text-sm">TrentoSmart System</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Amount Due</p>
                <p className="font-black text-[#007DFE] text-lg">₱{amount}</p>
              </div>
            </div>
          )}

          {/* Form Content steps */}
          <div className="p-7">
            
            {/* Step 1: Mobile Phone Number */}
            {step === 'phone' && (
              <form onSubmit={handlePhoneSubmit} className="space-y-6">
                <div className="text-center space-y-2 mb-4">
                  <div className="w-12 h-12 bg-blue-50 text-[#007DFE] rounded-2xl flex items-center justify-center mx-auto mb-2 border border-blue-100 shadow-sm">
                    <Smartphone size={20} />
                  </div>
                  <h2 className="text-lg font-black text-secondary uppercase tracking-tight">GCash Account Login</h2>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">Please enter your GCash mobile number to proceed with the payment.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider block ml-2">Mobile Number</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm border-r border-slate-200 pr-3">+63</span>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9XX XXX XXXX"
                      className="w-full bg-slate-50 border-2 border-slate-150 rounded-2xl py-4 pl-16 pr-4 font-black text-base text-secondary focus:border-[#007DFE] outline-none transition-all placeholder:text-slate-300 tracking-wide"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs font-bold text-red-500 bg-red-50 py-2.5 px-4 rounded-xl border border-red-100">{error}</p>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#007DFE] hover:bg-[#0069d9] text-white font-black py-4.5 rounded-2xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 text-sm active:scale-97"
                >
                  <span>Next</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            )}

            {/* Step 2: Simulated OTP */}
            {step === 'otp' && (
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div className="text-center space-y-2 mb-4">
                  <div className="w-12 h-12 bg-blue-50 text-[#007DFE] rounded-2xl flex items-center justify-center mx-auto mb-2 border border-blue-100 shadow-sm">
                    <KeyRound size={20} />
                  </div>
                  <h2 className="text-lg font-black text-secondary uppercase tracking-tight">Security Verification</h2>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">Enter the 6-digit authentication code sent to +63 9** *** {phoneNumber.slice(-4)}</p>
                  <p className="text-[9px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full inline-block mt-2 border border-green-100 uppercase tracking-wider">💡 Demo Mode: Enter any digits</p>
                </div>

                <div className="flex justify-center gap-2 max-w-[290px] mx-auto py-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      maxLength="1"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-10 h-12 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-black text-xl text-[#007DFE] focus:border-[#007DFE] outline-none transition-all shadow-sm"
                    />
                  ))}
                </div>

                {error && (
                  <p className="text-xs font-bold text-red-500 bg-red-50 py-2.5 px-4 rounded-xl border border-red-100">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('phone')}
                    className="flex-1 border-2 border-slate-200 hover:bg-slate-50 text-slate-500 font-black py-4 rounded-2xl transition-all text-center text-sm shadow-sm"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#007DFE] hover:bg-[#0069d9] text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-200 text-sm active:scale-97"
                  >
                    Submit
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: MPIN Code Entry */}
            {step === 'mpin' && (
              <form onSubmit={handleMpinSubmit} className="space-y-6">
                <div className="text-center space-y-2 mb-4">
                  <div className="w-12 h-12 bg-blue-50 text-[#007DFE] rounded-2xl flex items-center justify-center mx-auto mb-2 border border-blue-100 shadow-sm">
                    <Lock size={20} />
                  </div>
                  <h2 className="text-lg font-black text-secondary uppercase tracking-tight">Enter GCash MPIN</h2>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">Enter your 4-digit security PIN to authorize this transaction</p>
                  <p className="text-[9px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full inline-block mt-2 border border-green-100 uppercase tracking-wider">💡 Demo Mode: Enter any digits</p>
                </div>

                <div className="flex justify-center gap-3.5 max-w-[200px] mx-auto py-2">
                  {mpin.map((digit, index) => (
                    <input
                      key={index}
                      id={`mpin-${index}`}
                      type="password"
                      maxLength="1"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      value={digit}
                      onChange={(e) => handleMpinChange(index, e.target.value)}
                      onKeyDown={(e) => handleMpinKeyDown(index, e)}
                      className="w-11 h-12 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-black text-xl text-[#007DFE] focus:border-[#007DFE] outline-none transition-all shadow-sm"
                    />
                  ))}
                </div>

                {error && (
                  <p className="text-xs font-bold text-red-500 bg-red-50 py-2.5 px-4 rounded-xl border border-red-100">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('otp')}
                    className="flex-1 border-2 border-slate-200 hover:bg-slate-50 text-slate-500 font-black py-4 rounded-2xl transition-all text-center text-sm shadow-sm"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#007DFE] hover:bg-[#0069d9] text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-200 text-sm active:scale-97"
                  >
                    Authorize
                  </button>
                </div>
              </form>
            )}

            {/* Step 4: Pay Confirmation */}
            {step === 'confirm' && (
              <div className="space-y-6">
                <div className="text-center space-y-2 mb-4">
                  <h2 className="text-lg font-black text-secondary uppercase tracking-tight">Review & Pay</h2>
                  <p className="text-xs text-slate-400 font-medium">Verify your payment details before checkout</p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-150 space-y-3 text-xs font-semibold">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account:</span>
                    <span className="font-bold text-secondary">GCash (09** *** {phoneNumber.slice(-4)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Merchant Name:</span>
                    <span className="font-bold text-secondary">TrentoSmart System</span>
                  </div>
                  <div className="border-t border-slate-200 my-2 pt-2 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-600">Total Charge:</span>
                    <span className="font-black text-[#007DFE] text-lg">₱{amount}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 border-2 border-slate-200 hover:bg-slate-50 text-slate-500 font-black py-4 rounded-2xl transition-all text-center text-sm shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePay}
                    className="flex-[1.5] bg-[#007DFE] hover:bg-[#0069d9] text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-1.5 text-sm active:scale-97"
                  >
                    <span>Authorize Pay</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Processing Animation */}
            {step === 'processing' && (
              <div className="py-12 flex flex-col items-center justify-center space-y-6 text-center">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-slate-100 rounded-full" />
                  <div className="absolute inset-0 border-4 border-[#007DFE] rounded-full border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={30} className="text-[#007DFE] animate-spin" style={{ animationDuration: '1.2s' }} />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-black text-secondary">Processing Payment</h3>
                  <p className="text-xs text-slate-450 mt-1 font-semibold leading-relaxed">Securing payment connection and compiling transaction receipt...</p>
                </div>
              </div>
            )}

            {/* Step 6: Receipt screen (UPGRADED TICKET UI DESIGN) */}
            {step === 'receipt' && (
              <div className="space-y-6 text-center select-none">
                <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 border border-green-150 shadow-md">
                  <CheckCircle2 size={32} />
                </div>
                
                <div>
                  <h2 className="text-lg font-black text-secondary uppercase tracking-tight">Payment Successful</h2>
                  <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">Transaction Complete</p>
                </div>

                {/* ticket view */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl text-left relative overflow-hidden">
                  {/* Left Ticket Notch */}
                  <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border border-slate-200" />
                  {/* Right Ticket Notch */}
                  <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border border-slate-200" />
                  
                  <div className="p-5 pb-3 space-y-2 text-xs font-semibold">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Paid to:</span>
                      <span className="font-bold text-secondary">TrentoSmart System</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Reference No:</span>
                      <span className="font-bold text-[#007DFE] font-mono text-[13px]">{refNo}</span>
                    </div>
                  </div>

                  {/* Cut Line */}
                  <div className="border-t border-dashed border-slate-350 mx-4" />

                  <div className="p-5 pt-3 space-y-2.5 text-xs font-semibold">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Amount Paid:</span>
                      <span className="font-black text-green-600 text-sm">₱{amount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Date & Time:</span>
                      <span className="font-bold text-secondary">{new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1.5">
                    <RefreshCw size={10} className="animate-spin text-[#007DFE]" />
                    <span>Auto returning to portal dashboard in {countdown}s...</span>
                  </p>

                  <button
                    onClick={handleRedirect}
                    className="w-full bg-[#007DFE] hover:bg-[#0069d9] text-white font-black py-4.5 rounded-2xl transition-all shadow-lg shadow-blue-200 text-sm active:scale-97"
                  >
                    Done & Return
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Footer security labels */}
          {step !== 'receipt' && step !== 'processing' && (
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest select-none">
              <span className="flex items-center gap-1.5">
                <Lock size={10} className="text-slate-400" />
                <span>Secure 256-Bit SSL</span>
              </span>
              <span>TrentoSmart Simulation</span>
            </div>
          )}
          
        </div>
      </main>

      {/* Basic Footer */}
      <footer className="py-4 text-center text-[10px] text-slate-400 font-semibold bg-slate-100 border-t border-slate-200/50 shrink-0 select-none">
        TrentoSmart GCash Gateway Simulation • Capstone Demonstration Purposes Only
      </footer>
    </div>
  );
};

export default GCashGateway;
