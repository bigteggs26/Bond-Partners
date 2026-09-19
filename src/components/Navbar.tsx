import React from 'react';
import { BrandLogo } from './BrandLogo';
import { Profile } from '../types';
import { Plus, Users, LogOut, Radio, Shield, UploadCloud } from 'lucide-react';

interface NavbarProps {
  currentUser: Profile;
  onOpenNewCase: () => void;
  onOpenManageTeam: () => void;
  onSignOut: () => void;
  realtimeConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onOpenNewCase,
  onOpenManageTeam,
  onSignOut,
  realtimeConnected,
}) => {
  const isBoss = currentUser.role === 'boss';

  return (
    <header className="sticky top-0 z-30 bg-[#0d0f16]/95 backdrop-blur-md border-b border-[#222736]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand Logo */}
          <div className="flex items-center gap-4">
            <BrandLogo variant="navbar" />
          </div>

          {/* Action Items */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Realtime Status Indicator */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-[#141722] border border-[#23293a] text-slate-400"
              title="Postgres realtime channel active. All browser tabs and devices update synchronously."
            >
              <span className="relative flex h-2 w-2">
                {realtimeConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    realtimeConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                ></span>
              </span>
              <span className="tracking-wide">
                {realtimeConnected ? 'Live Realtime Sync' : 'Connecting...'}
              </span>
            </div>

            {/* Team & New Case Controls */}
            <div className="flex items-center gap-2">
              {isBoss && (
                <button
                  type="button"
                  onClick={onOpenManageTeam}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#181c28] hover:bg-[#202535] text-slate-200 border border-[#2e3447] transition-colors cursor-pointer"
                  title="View registered lawyers & instructions for adding team members"
                >
                  <Users className="w-3.5 h-3.5 text-[#c5a059]" />
                  <span className="hidden sm:inline">Manage Team</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenNewCase}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide bg-gradient-to-r from-[#d4af37] via-[#c5a059] to-[#a38035] hover:brightness-110 active:brightness-95 text-[#0d0f15] shadow-md shadow-[#c5a059]/20 transition-all cursor-pointer"
                title="File a new case docket with photos and evidentiary documents"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ New Case</span>
              </button>
            </div>

            {/* User Profile Capsule */}
            <div className="flex items-center gap-2 pl-2 sm:pl-3 sm:border-l border-[#242938]">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200 leading-tight">
                  {currentUser.name}
                </span>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  {isBoss ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-[#c5a059]/20 text-[#faebd0] border border-[#c5a059]/40">
                      <Shield className="w-2.5 h-2.5 text-[#e5c378]" />
                      Boss
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                      Lawyer
                    </span>
                  )}
                </div>
              </div>

              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase border ${
                  isBoss
                    ? 'bg-[#c5a059]/20 border-[#c5a059] text-[#faebd0]'
                    : 'bg-slate-800 border-slate-600 text-slate-300'
                }`}
                title={`${currentUser.name} (${currentUser.role})`}
              >
                {currentUser.name.slice(0, 2)}
              </div>

              {/* Sign Out Button */}
              <button
                type="button"
                onClick={onSignOut}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1c202d] transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
