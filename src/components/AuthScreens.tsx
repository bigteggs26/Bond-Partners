import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { Lock, Mail, User, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

interface AuthScreensProps {
  hasBossAccount: boolean;
  onAuthSuccess: (profile: Profile) => void;
  onRefreshBossCheck: () => void;
}

export const AuthScreens: React.FC<AuthScreensProps> = ({
  hasBossAccount,
  onAuthSuccess,
  onRefreshBossCheck,
}) => {
  // If no boss exists, start in 'setup' mode, otherwise 'login'
  const [mode, setMode] = useState<'setup' | 'login'>(hasBossAccount ? 'login' : 'setup');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleBossSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please enter the Managing Partner (Boss) name.');
      return;
    }
    if (!email.trim() || !password) {
      setErrorMsg('Please enter a valid email and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      // 1. Sign up user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            name: name.trim(),
            role: 'boss',
          },
        },
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Could not create authentication user.');
      }

      // If session was not auto-started (e.g. if email confirmation is required), attempt signIn
      if (!authData.session) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (signInErr && signInErr.message.includes('Email not confirmed')) {
          setInfoMsg(
            'Account created! A confirmation email was sent. Please confirm your email, or if confirmations are disabled, log in below.'
          );
          setMode('login');
          setLoading(false);
          return;
        }
      }

      // 2. Insert profile into `profiles` table with role: 'boss'
      const { error: profileError } = await supabase.from('profiles').insert([
        {
          id: authData.user.id,
          name: name.trim(),
          role: 'boss',
        },
      ]);

      if (profileError) {
        // If row already exists or RLS issue, try upsert
        console.warn('Profile insert warning, attempting upsert:', profileError);
        const { error: upsertErr } = await supabase.from('profiles').upsert([
          {
            id: authData.user.id,
            name: name.trim(),
            role: 'boss',
          },
        ]);
        if (upsertErr) {
          throw new Error(`Profile creation failed: ${upsertErr.message}`);
        }
      }

      const bossProfile: Profile = {
        id: authData.user.id,
        name: name.trim(),
        role: 'boss',
        created_at: new Date().toISOString(),
      };

      onAuthSuccess(bossProfile);
    } catch (err: any) {
      console.error('Setup error:', err);
      setErrorMsg(err.message || 'Failed to complete Boss setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      // 1. Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error('No user returned from login.');
      }

      // 2. Fetch profile from `profiles` table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(`Error loading profile: ${profileError.message}`);
      }

      if (!profileData) {
        // Fallback: If user exists in Auth but not in profiles yet, check metadata or prompt
        const metaRole = authData.user.user_metadata?.role || 'lawyer';
        const metaName = authData.user.user_metadata?.name || email.split('@')[0];
        
        const { data: newProf, error: insErr } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              name: metaName,
              role: metaRole,
            },
          ])
          .select()
          .single();

        if (insErr) {
          throw new Error('No matching profile found in Bond Partners directory. Please ask the Managing Partner to verify your account in the profiles table.');
        }

        onAuthSuccess(newProf as Profile);
        return;
      }

      onAuthSuccess(profileData as Profile);
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
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
          {mode === 'setup' ? (
            <div>
              <div className="mb-6 pb-4 border-b border-[#252a38]">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#c5a059]/15 text-[#e5c378] border border-[#c5a059]/30 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Initial Setup
                </div>
                <h2
                  className="text-xl font-bold tracking-wide text-slate-100"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                >
                  Register Managing Partner
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  No Managing Partner account was detected. Initialize the firm by registering the first Boss account.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-5 p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {infoMsg && (
                <div className="mb-5 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs">
                  {infoMsg}
                </div>
              )}

              <form onSubmit={handleBossSetup} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Managing Partner Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Richard Bond, Esq."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#0d0f15] border border-[#2a2f3f] rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Official Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="boss@bondpartners.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#0d0f15] border border-[#2a2f3f] rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Master Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#0d0f15] border border-[#2a2f3f] rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] transition-colors"
                    />
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
                      Creating Managing Partner...
                    </>
                  ) : (
                    'Initialize Boss Account'
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-[#252a38] text-center">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-slate-400 hover:text-[#e5c378] transition-colors"
                >
                  Already registered? <span className="underline">Go to Login</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-6 pb-4 border-b border-[#252a38]">
                <h2
                  className="text-xl font-bold tracking-wide text-slate-100"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                >
                  Attorney & Staff Login
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Sign in with your Bond Partners credentials to access synchronized firm cases.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-5 p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {infoMsg && (
                <div className="mb-5 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs">
                  {infoMsg}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="attorney@bondpartners.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#0d0f15] border border-[#2a2f3f] rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#0d0f15] border border-[#2a2f3f] rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] transition-colors"
                    />
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
                  <span className="text-[#e5c378] font-semibold block mb-0.5">Lawyer Onboarding:</span>
                  Lawyer accounts are provisioned directly by the Managing Partner via the Supabase Auth dashboard.
                </div>

                {!hasBossAccount && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setMode('setup')}
                      className="text-xs text-[#e5c378] hover:underline"
                    >
                      Need to run first-time Managing Partner setup? Click here.
                    </button>
                  </div>
                )}
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
