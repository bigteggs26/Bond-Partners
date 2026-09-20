import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { BrandLogo } from './BrandLogo';
import { Lock, Mail, Loader2, AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface StaffGateScreenProps {
  onVerified: () => void;
}

export const StaffGateScreen: React.FC<StaffGateScreenProps> = ({ onVerified }) => {
  const [email, setEmail] = useState('staff@bondpartners.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = (email || '').trim() || 'staff@bondpartners.com';
    const cleanPassword = password.trim();

    if (!cleanPassword) {
      setErrorMsg('Please enter the staff access password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Authenticate against shared staff account in Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error || !data.user) {
        setErrorMsg(error?.message || 'Invalid staff access credentials. Please verify and try again.');
        setLoading(false);
        return;
      }

      // 2. Immediately sign out so this does NOT count as a real logged-in lawyer/boss session
      await supabase.auth.signOut();

      // 3. Store verified flag in sessionStorage for this browser session
      try {
        sessionStorage.setItem('staffGateVerified', 'true');
      } catch (storageErr) {
        console.warn('Could not store staffGateVerified in sessionStorage:', storageErr);
      }

      // 4. Proceed to normal Boss/Lawyer Login/Setup screen
      onVerified();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0e15] flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 font-sans selection:bg-[#c5a059]/30 selection:text-[#faebd0]">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-[#c5a059]/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <BrandLogo variant="hero" />
          <div className="inline-flex items-center gap-2 mt-4 px-3 py-1 rounded-full bg-[#161a26] border border-[#c5a059]/30 text-xs font-semibold text-[#e5c98d] uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5 text-[#c5a059]" />
            <span>Staff Access Gate</span>
          </div>
          <p className="text-sm text-slate-400 mt-2 max-w-xs">
            Restricted firm portal. Authorized Bond &amp; Partners staff authentication required.
          </p>
        </div>

        {/* Access Card */}
        <div className="bg-[#12151e] border border-slate-800/90 rounded-xl p-6 sm:p-8 shadow-2xl shadow-black/70 backdrop-blur-sm">
          {errorMsg && (
            <div
              id="staff-gate-error-alert"
              className="mb-5 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5 leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="staff-gate-email-input"
                className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider"
              >
                Staff Account Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="staff-gate-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@bondpartners.com"
                  required
                  autoComplete="username"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#0a0c12] border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="staff-gate-password-input"
                className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider"
              >
                Staff Access Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="staff-gate-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter staff password"
                  required
                  autoFocus
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-[#0a0c12] border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] transition-all"
                />
                <button
                  type="button"
                  id="staff-gate-toggle-password-visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="staff-gate-submit-button"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-[#c5a059] via-[#d4af37] to-[#b38b38] hover:from-[#d4af37] hover:to-[#c5a059] text-[#0c0e15] font-semibold text-sm shadow-lg shadow-[#c5a059]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#0c0e15]" />
                    <span>Verifying Staff Access...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#0c0e15]" />
                    <span>Enter Firm Portal</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500">
              Bond &amp; Partners Law Practice Management System &bull; Private Network
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
