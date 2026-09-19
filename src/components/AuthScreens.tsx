import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { BrandLogo } from './BrandLogo';
import {
  User,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  LogIn,
  Eye,
  EyeOff,
  HelpCircle,
  UserCheck,
} from 'lucide-react';
import { saveLocalProfile, getLocalProfile } from '../lib/profileCache';

interface AuthScreensProps {
  hasBossAccount?: boolean;
  onAuthSuccess: (profile: Profile) => void;
  onRefreshBossCheck?: () => void;
}

// Generate possible email variations for a given input
const getCandidateEmails = (identifier: string): string[] => {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return [];
  if (clean.includes('@')) {
    return [clean];
  }
  const sanitized = clean.replace(/[^a-z0-9._-]/g, '') || 'counsel';
  return [
    `${sanitized}@bondpartners.internal`,
    `${sanitized}@bondpartners.com`,
  ];
};

export const AuthScreens: React.FC<AuthScreensProps> = ({
  onAuthSuccess,
}) => {
  // Two clean modes: 'login' and 'signup'
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  // Form states
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  // Lawyer Sign Up Handler
  const handleLawyerSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowForgotNotice(false);

    if (!name.trim()) {
      setErrorMsg('Please enter your full attorney name.');
      return;
    }
    if (!identifier.trim() || !password) {
      setErrorMsg('Please enter a username or email, and a password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    const cleanInput = identifier.trim().toLowerCase();
    const emailToUse = cleanInput.includes('@')
      ? cleanInput
      : `${cleanInput.replace(/[^a-z0-9._-]/g, '') || 'lawyer'}@bondpartners.internal`;

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailToUse,
        password: password,
        options: {
          data: {
            name: name.trim(),
            role: 'lawyer',
          },
        },
      });

      if (authError) {
        if (authError.message?.toLowerCase().includes('already registered')) {
          setShowForgotNotice(true);
          throw new Error('This account already exists. Please switch to Sign In to log in.');
        }
        throw authError;
      }

      const authUser = authData.user;
      if (!authUser) {
        throw new Error('Could not create lawyer account.');
      }

      const lawyerProfile: Profile = {
        id: authUser.id,
        name: name.trim(),
        role: 'lawyer',
        created_at: new Date().toISOString(),
      };

      // Ensure lawyer profile exists in database profiles table for FK constraints
      try {
        await supabase.from('profiles').upsert([
          {
            id: authUser.id,
            name: lawyerProfile.name,
            role: 'lawyer',
          },
        ]);
      } catch (profErr) {
        console.warn('Lawyer profile sync notice:', profErr);
      }

      saveLocalProfile(lawyerProfile);
      onAuthSuccess(lawyerProfile);
    } catch (err: any) {
      console.error('Lawyer registration error:', err);
      setErrorMsg(err.message || 'Lawyer account setup failed.');
    } finally {
      setLoading(false);
    }
  };

  // Sign In Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowForgotNotice(false);

    if (!identifier.trim() || !password) {
      setErrorMsg('Please enter both your username/email and password.');
      return;
    }

    const candidateEmails = getCandidateEmails(identifier);

    setLoading(true);
    try {
      let authUser: any = null;
      let lastAuthError: any = null;

      // Try candidate emails sequentially (e.g. .internal then .com)
      for (const authEmail of candidateEmails) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: password,
        });

        if (!authError && authData.user) {
          authUser = authData.user;
          break;
        } else {
          lastAuthError = authError;
        }
      }

      // If initial attempt failed and password had leading/trailing whitespace, try trimmed
      if (!authUser && password.trim() !== password) {
        for (const authEmail of candidateEmails) {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: authEmail,
            password: password.trim(),
          });
          if (!authError && authData.user) {
            authUser = authData.user;
            break;
          }
        }
      }

      if (!authUser) {
        const errMsg = lastAuthError?.message || 'Invalid login credentials';
        const errorLower = errMsg.toLowerCase();

        if (errorLower.includes('email not confirmed')) {
          throw new Error(
            'Email confirmation is required. In your Supabase Dashboard: go to Authentication -> Providers -> Email and turn off "Confirm email" to enable immediate logins.'
          );
        }

        if (errorLower.includes('invalid login credentials')) {
          setShowForgotNotice(true);
          throw new Error(
            'Invalid login credentials. Please check your password spelling (click the 👁 eye icon to verify). If you registered with a custom or personal email, try entering the full email address.'
          );
        }

        throw lastAuthError || new Error('Login failed. Please verify your credentials.');
      }

      // 2. Fetch profile from `profiles` table
      let userProfile: Profile | null = null;
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (!profileError && profileData) {
          userProfile = profileData as Profile;
        } else if (profileError) {
          console.warn('Profiles table lookup notice (RLS):', profileError.message);
        }
      } catch (pErr) {
        console.warn('Profiles query exception:', pErr);
      }

      // 3. Fallback: if profile query failed or was blocked
      if (!userProfile) {
        const cached = getLocalProfile(authUser.id);
        const metaRole = authUser.user_metadata?.role || 'lawyer';
        const metaName = authUser.user_metadata?.name || identifier.split('@')[0] || 'Counsel';

        userProfile = cached || {
          id: authUser.id,
          name: metaName,
          role: metaRole as 'boss' | 'lawyer',
          created_at: new Date().toISOString(),
        };
      }

      // Ensure profile exists in database profiles table for FK constraints
      try {
        await supabase.from('profiles').upsert([
          {
            id: authUser.id,
            name: userProfile.name,
            role: userProfile.role,
          },
        ]);
      } catch (syncErr: any) {
        console.warn('Profile sync on login notice:', syncErr.message);
      }

      saveLocalProfile(userProfile);
      onAuthSuccess(userProfile);
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!identifier.trim()) {
      setErrorMsg('Please enter your username or email above first, then click "Forgot password?".');
      return;
    }

    const candidateEmails = getCandidateEmails(identifier);
    const primaryEmail = candidateEmails[0];

    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(primaryEmail, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setInfoMsg(`Password reset instructions sent to: ${primaryEmail}`);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setErrorMsg(
        err.message ||
          'Could not send reset email. Note: You can also reset the user password directly in the Supabase Dashboard under Authentication -> Users.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f15] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#c5a059]/10 via-transparent to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#1a1f2c]/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Logo Header */}
        <div className="mb-8">
          <BrandLogo variant="hero" />
        </div>

        {/* Card */}
        <div className="bg-[#141721]/90 backdrop-blur-md border border-[#2b3040] rounded-2xl shadow-2xl p-6 sm:p-8">
          {/* Two Navigation Tabs: Sign In & Lawyer Sign Up */}
          <div className="flex rounded-lg bg-[#0a0c12] p-1 mb-6 border border-[#262c3e] gap-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setInfoMsg(null);
                setShowForgotNotice(false);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#1e2436] text-[#e5c378] shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                setInfoMsg(null);
                setShowForgotNotice(false);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'signup'
                  ? 'bg-[#1e2436] text-[#e5c378] shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Lawyer Sign Up
            </button>
          </div>

          {mode === 'signup' ? (
            /* LAWYER SIGN UP */
            <div>
              <div className="mb-6 pb-4 border-b border-[#252a38]">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#c5a059]/15 text-[#e5c378] border border-[#c5a059]/30 mb-2">
                  <UserCheck className="w-3.5 h-3.5" />
                  Attorney & Counsel Registration
                </div>
                <h2
                  className="text-xl font-bold tracking-wide text-slate-100"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                >
                  Create Lawyer Account
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Register your lawyer account to file new case dockets, manage clients, and upload legal evidentiary files.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-5 p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="leading-relaxed space-y-1">
                    <p>{errorMsg}</p>
                    {showForgotNotice && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setErrorMsg(null);
                        }}
                        className="text-[#e5c378] font-medium underline hover:text-[#f3d38c] text-xs inline-block mt-1 cursor-pointer"
                      >
                        Switch to Sign In tab →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {infoMsg && (
                <div className="mb-5 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{infoMsg}</span>
                </div>
              )}

              <form onSubmit={handleLawyerSignup} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Attorney Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Jenkins, Esq."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#0d0f15] border border-[#2a2f3f] rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Username or Email
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. sarah or sarah@bondpartners.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full bg-[#0d0f15] border border-[#2a2f3f] rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    You can use a firm username (e.g. <span className="text-slate-300 font-mono">sarah</span>) or your email address.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#0d0f15] border border-[#2a2f3f] rounded-lg pl-9 pr-10 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Minimum 6 characters</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 rounded-lg font-semibold text-sm tracking-wide bg-gradient-to-r from-[#d4af37] via-[#c5a059] to-[#a38035] hover:brightness-110 active:brightness-95 text-[#0d0f15] shadow-lg shadow-[#c5a059]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registering Lawyer Account...
                    </>
                  ) : (
                    'Register as Lawyer & Enter Firm'
                  )}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-[#252a38] text-center">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-slate-400 hover:text-[#e5c378] transition-colors cursor-pointer"
                >
                  Already have an account? <span className="underline font-medium text-slate-200">Sign in here</span>
                </button>
              </div>
            </div>
          ) : (
            /* SIGN IN */
            <div>
              <div className="mb-6 pb-4 border-b border-[#252a38]">
                <h2
                  className="text-xl font-bold tracking-wide text-slate-100"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                >
                  Attorney Sign In
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Sign in with your lawyer credentials to access synchronized firm cases and dockets.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-5 p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="leading-relaxed space-y-1.5 flex-1">
                    <p>{errorMsg}</p>
                    {showForgotNotice && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setMode('signup');
                            setErrorMsg(null);
                          }}
                          className="text-[#e5c378] underline hover:text-[#f3d38c] font-medium cursor-pointer"
                        >
                          Need a new lawyer account? Register here →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {infoMsg && (
                <div className="mb-5 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{infoMsg}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Username or Email
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. sarah, rachel, or lawyer@bondpartners.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full bg-[#0d0f15] border border-[#2a2f3f] rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Enter your username (e.g. <span className="text-slate-300 font-mono">sarah</span>) or registered email.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={handleSendPasswordReset}
                      className="text-[11px] text-[#e5c378] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#0d0f15] border border-[#2a2f3f] rounded-lg pl-9 pr-10 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 rounded-lg font-semibold text-sm tracking-wide bg-gradient-to-r from-[#d4af37] via-[#c5a059] to-[#a38035] hover:brightness-110 active:brightness-95 text-[#0d0f15] shadow-lg shadow-[#c5a059]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In to Case Manager'
                  )}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-[#252a38] space-y-3">
                <div className="p-3 rounded-lg bg-[#0e1017] border border-[#232838] text-[11px] text-slate-400 leading-relaxed">
                  <div className="flex items-center gap-1.5 text-[#e5c378] font-semibold mb-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Attorney Sign-in Tips</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Use the 👁 eye icon in the password field to verify your password.</li>
                    <li>If you registered with a username (e.g. <span className="font-mono text-slate-200">sarah</span>), you can enter just that username.</li>
                  </ul>
                </div>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg(null);
                    }}
                    className="text-xs text-slate-400 hover:text-[#e5c378] transition-colors cursor-pointer"
                  >
                    Don't have an attorney account? <span className="underline font-medium text-[#e5c378]">Sign up here</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Bond Partners Legal Practitioners. Confidential & Privileged.</p>
        </div>
      </div>
    </div>
  );
};
