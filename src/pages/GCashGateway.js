import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle2, Lock, ArrowRight, Loader2, RefreshCw } from 'lucide-react';

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
  }, [step, countdown]);

  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid GCash mobile number.');
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
      document.getElementById(`otp-${index + 1}`).focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`).focus();
    }
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    if (otp.some(digit => digit === '')) {
      setError('Please enter the complete 6-digit OTP code.');
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
      document.getElementById(`mpin-${index + 1}`).focus();
    }
  };

  const handleMpinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !mpin[index] && index > 0) {
      document.getElementById(`mpin-${index - 1}`).focus();
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
    }, 2000);
  };

  const handleCancel = () => {
    // Append source_id to failed redirect url
    const separator = failedUrl.includes('?') ? '&' : '?';
    window.location.href = `${failedUrl}${separator}status=failed&source_id=${sourceId}`;
  };

  const handleRedirect = () => {
    const separator = successUrl.includes('?') ? '&' : '?';
    window.location.href = `${successUrl}${separator}source_id=${sourceId}`;
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col font-sans text-slate-800">
      {/* Blue GCash Header branding */}
      <header className="bg-[#007DFE] text-white py-4 px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black tracking-tighter uppercase italic">G</span>
          <div className="leading-none">
            <h1 className="text-lg font-black tracking-tight uppercase">GCash</h1>
            <p className="text-[9px] font-bold text-blue-100 uppercase tracking-widest">Sandbox Gateway</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-bold">
          <Shield size={12} className="text-blue-100 animate-pulse" />
          <span className="text-[10px] text-blue-50">Demo Portal</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] overflow-hidden border border-slate-100">
          
          {/* Top Bar for merchant info */}
          {step !== 'receipt' && step !== 'processing' && (
            <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Merchant</p>
                <p className="font-extrabold text-secondary text-sm">TrentoSmart System</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Amount Due</p>
                <p className="font-black text-[#007DFE] text-lg">₱{amount}</p>
              </div>
            </div>
          )}

          {/* Form Content steps */}
          <div className="p-8">
            
            {/* Step 1: Mobile Phone Number */}
            {step === 'phone' && (
              <form onSubmit={handlePhoneSubmit} className="space-y-6">
                <div className="text-center space-y-2 mb-6">
                  <h2 className="text-xl font-black text-secondary">GCash Login</h2>
                  <p className="text-xs text-slate-400 font-medium">Enter your GCash registered mobile number</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider block ml-2">Mobile Number</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">+63</span>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9XX XXX XXXX"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-4 font-bold text-lg focus:border-[#007DFE] outline-none transition-all placeholder:text-slate-300"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs font-bold text-red-500 bg-red-50 py-2.5 px-4 rounded-xl border border-red-100">{error}</p>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#007DFE] hover:bg-[#0069d9] text-white font-black py-4.5 rounded-2xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-98"
                >
                  <span>Next</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            )}

            {/* Step 2: Simulated OTP */}
            {step === 'otp' && (
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div className="text-center space-y-2 mb-6">
                  <h2 className="text-xl font-black text-secondary">Verify Mobile Number</h2>
                  <p className="text-xs text-slate-400 font-medium">Enter the 6-digit authentication code sent to you</p>
                  <p className="text-[10px] text-green-600 bg-green-50 px-3 py-1 rounded-full inline-block font-bold mt-1">💡 Demo Mode: Enter any digits</p>
                </div>

                <div className="flex justify-between gap-2 max-w-[280px] mx-auto">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-10 h-12 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-black text-xl text-[#007DFE] focus:border-[#007DFE] outline-none transition-all"
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
                    className="flex-1 border-2 border-slate-100 hover:bg-slate-50 text-slate-500 font-bold py-4 rounded-2xl transition-all text-center"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#007DFE] hover:bg-[#0069d9] text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-200"
                  >
                    Submit
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: MPIN Code Entry */}
            {step === 'mpin' && (
              <form onSubmit={handleMpinSubmit} className="space-y-6">
                <div className="text-center space-y-2 mb-6">
                  <h2 className="text-xl font-black text-secondary">Enter GCash MPIN</h2>
                  <p className="text-xs text-slate-400 font-medium">Input your 4-digit security PIN to authorize transaction</p>
                  <p className="text-[10px] text-green-600 bg-green-50 px-3 py-1 rounded-full inline-block font-bold mt-1">💡 Demo Mode: Enter any 4 digits</p>
                </div>

                <div className="flex justify-center gap-4 max-w-[200px] mx-auto">
                  {mpin.map((digit, index) => (
                    <input
                      key={index}
                      id={`mpin-${index}`}
                      type="password"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleMpinChange(index, e.target.value)}
                      onKeyDown={(e) => handleMpinKeyDown(index, e)}
                      className="w-12 h-14 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-black text-2xl text-[#007DFE] focus:border-[#007DFE] outline-none transition-all"
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
                    className="flex-1 border-2 border-slate-100 hover:bg-slate-50 text-slate-500 font-bold py-4 rounded-2xl transition-all text-center"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#007DFE] hover:bg-[#0069d9] text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-200"
                  >
                    Authenticate
                  </button>
                </div>
              </form>
            )}

            {/* Step 4: Pay Confirmation */}
            {step === 'confirm' && (
              <div className="space-y-6">
                <div className="text-center space-y-2 mb-6">
                  <h2 className="text-xl font-black text-secondary">Confirm Payment</h2>
                  <p className="text-xs text-slate-400 font-medium">Review and authorize this checkout transaction</p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4 text-sm font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Source Account:</span>
                    <span className="font-extrabold text-secondary">GCash Wallet (09** *** {phoneNumber.slice(-4)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Merchant:</span>
                    <span className="font-extrabold text-secondary">TrentoSmart System</span>
                  </div>
                  <div className="h-px bg-slate-200"></div>
                  <div className="flex justify-between text-base items-center">
                    <span className="text-slate-500 font-black">Total Charge:</span>
                    <span className="font-black text-[#007DFE] text-lg">₱{amount}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 border-2 border-slate-100 hover:bg-slate-50 text-slate-500 font-bold py-4 rounded-2xl transition-all text-center"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePay}
                    className="flex-1 bg-[#007DFE] hover:bg-[#0069d9] text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    <span>Authorize Pay</span>
                    <ArrowRight size={16} />
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
                    <Loader2 size={30} className="text-[#007DFE] animate-spin" style={{ animationDuration: '1.5s' }} />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-black text-secondary">Processing Secure Payment</h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Validating GCash funds and issuing receipt...</p>
                </div>
              </div>
            )}

            {/* Step 6: Receipt screen */}
            {step === 'receipt' && (
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                  <CheckCircle2 size={36} />
                </div>
                
                <div>
                  <h2 className="text-xl font-black text-secondary">Payment Successful</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Transaction Approved</p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-left space-y-3.5 text-xs font-semibold">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Merchant Name:</span>
                    <span className="font-bold text-secondary">TrentoSmart System</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reference No:</span>
                    <span className="font-bold text-blue-600 font-mono text-sm">{refNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Paid Amount:</span>
                    <span className="font-black text-green-600 text-sm">₱{amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Date/Time:</span>
                    <span className="font-bold text-secondary">{new Date().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-bold text-green-600">COMPLETED</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1.5">
                  <RefreshCw size={10} className="animate-spin" />
                  <span>Redirecting to merchant dashboard in {countdown}s...</span>
                </p>

                <button
                  onClick={handleRedirect}
                  className="w-full bg-[#007DFE] hover:bg-[#0069d9] text-white font-black py-4.5 rounded-2xl transition-all shadow-lg shadow-blue-200"
                >
                  Return to Dashboard
                </button>
              </div>
            )}

          </div>

          {/* Footer security labels */}
          {step !== 'receipt' && step !== 'processing' && (
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span className="flex items-center gap-1.5">
                <Lock size={10} />
                <span>256-Bit SSL</span>
              </span>
              <span>Demo Mode</span>
            </div>
          )}
          
        </div>
      </main>

      {/* Basic Footer */}
      <footer className="py-4 text-center text-[10px] text-slate-400 font-semibold bg-slate-100 border-t border-slate-200/50">
        TrentoSmart GCash Gateway Simulation • Capstone Project Demonstration Purposes Only
      </footer>
    </div>
  );
};

export default GCashGateway;
