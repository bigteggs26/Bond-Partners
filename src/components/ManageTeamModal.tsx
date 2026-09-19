import React, { useState } from 'react';
import { Profile } from '../types';
import { supabase } from '../lib/supabase';
import {
  X,
  Users,
  Shield,
  UserCheck,
  ExternalLink,
  Copy,
  Check,
  Info,
  RefreshCw,
} from 'lucide-react';

interface ManageTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: Profile[];
  onRefreshProfiles: () => Promise<void>;
}

export const ManageTeamModal: React.FC<ManageTeamModalProps> = ({
  isOpen,
  onClose,
  profiles,
  onRefreshProfiles,
}) => {
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleCopySnippet = () => {
    const snippet = `INSERT INTO profiles (id, name, role) VALUES ('<USER_AUTH_ID>', 'Lawyer Full Name', 'lawyer');`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefreshProfiles();
    setRefreshing(false);
  };

  const lawyers = profiles.filter((p) => p.role === 'lawyer');
  const bosses = profiles.filter((p) => p.role === 'boss');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#131620] border border-[#2d3448] rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#212638] bg-[#0d0f16]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#c5a059]/15 border border-[#c5a059]/30 text-[#e5c378]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-lg font-bold text-slate-100"
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                Firm Roster & Team Management
              </h2>
              <p className="text-xs text-slate-400">
                Bond Partners Attorney Directory & Onboarding Architecture
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1f2433] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Important Law Firm Security Protocol Box */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#181c28] to-[#11141c] border border-[#c5a059]/30 space-y-3">
            <div className="flex items-center gap-2 text-[#e5c378]">
              <Info className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider">
                How Lawyer Accounts Are Added
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              To preserve strict law-firm security, lawyer accounts are not created through public in-app forms. As Managing Partner, you provision counsel accounts directly within the Supabase administration console:
            </p>

            <ol className="list-decimal list-inside text-xs text-slate-300 space-y-2 pl-1 bg-[#0a0c12] p-3.5 rounded-lg border border-[#24293a]">
              <li>
                <strong className="text-slate-100">Create Auth Account:</strong> Open Supabase Dashboard →{' '}
                <span className="text-[#e5c378] font-mono">Authentication</span> →{' '}
                <span className="text-[#e5c378] font-mono">Users</span> → click{' '}
                <strong className="text-slate-100">Add User</strong> (enter the lawyer's email and initial password).
              </li>
              <li>
                <strong className="text-slate-100">Create Directory Profile:</strong> Go to{' '}
                <span className="text-[#e5c378] font-mono">Table Editor</span> →{' '}
                <span className="text-[#e5c378] font-mono">profiles</span> table. Insert a new row with:
                <ul className="list-disc list-inside pl-4 mt-1 text-slate-400 font-mono text-[11px] space-y-0.5">
                  <li><code>id</code>: copy the User UID generated in Step 1</li>
                  <li><code>name</code>: Counsel's full legal name (e.g. "Evelyn Reed, Esq.")</li>
                  <li><code>role</code>: <code>lawyer</code></li>
                </ul>
              </li>
              <li>
                <strong className="text-slate-100">Instant Live Sync:</strong> The new attorney will instantly appear in all assignment dropdowns across the firm!
              </li>
            </ol>

            <div className="p-3 rounded-lg bg-[#0d1017] border border-[#272d40] text-[11px] text-slate-300 space-y-1">
              <span className="font-semibold text-[#e5c378] block">Tip for fast onboarding & zero email limits:</span>
              <p className="text-slate-400">
                In Supabase Dashboard → <strong>Authentication</strong> → <strong>Providers</strong> → <strong>Email</strong>, turn off <span className="text-slate-200">"Confirm email"</span>. This removes Supabase's hourly email rate limit and allows instant logins with either a plain username (like <span className="font-mono text-slate-200">alex</span>) or email!
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <a
                href="https://supabase.com/dashboard/project/neyhwgzefhtphwtaqfua"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#c5a059] hover:bg-[#d4af37] text-[#0d0f15] shadow transition-colors"
              >
                <span>Open Supabase Console</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={handleCopySnippet}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e2332] hover:bg-[#282f42] text-slate-200 border border-[#2f374d] transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied SQL Template</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#c5a059]" />
                    <span>Copy SQL Template</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Current Roster */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Current Registered Profiles ({profiles.length})
              </h3>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 text-xs text-[#e5c378] hover:underline cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Sync Directory</span>
              </button>
            </div>

            <div className="border border-[#222738] rounded-xl overflow-hidden bg-[#0c0e15] divide-y divide-[#1e2333]">
              {/* Boss section */}
              {bosses.map((boss) => (
                <div key={boss.id} className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#c5a059]/20 border border-[#c5a059] text-[#faebd0] flex items-center justify-center font-bold text-xs">
                      {boss.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">{boss.name}</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#c5a059]/20 text-[#faebd0] border border-[#c5a059]/40">
                          <Shield className="w-2.5 h-2.5" /> Managing Partner (Boss)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">UID: {boss.id}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-medium">Administrator</span>
                </div>
              ))}

              {/* Lawyers section */}
              {lawyers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  <Users className="w-6 h-6 mx-auto mb-1 text-slate-600" />
                  No associate lawyers registered yet in the profiles table. Follow the steps above to add counsel.
                </div>
              ) : (
                lawyers.map((lawyer) => (
                  <div key={lawyer.id} className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs">
                        {lawyer.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200">{lawyer.name}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                            Lawyer
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">UID: {lawyer.id}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400">Firm Counsel</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-[#212638] bg-[#0d0f16] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#1a1f2d] hover:bg-[#23293c] text-xs font-semibold text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
