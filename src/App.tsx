import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { Profile, CaseItem } from './types';
import { Navbar } from './components/Navbar';
import { AuthScreens } from './components/AuthScreens';
import { DashboardView } from './components/DashboardView';
import { NewCaseModal } from './components/NewCaseModal';
import { CaseDetailModal } from './components/CaseDetailModal';
import { ManageTeamModal } from './components/ManageTeamModal';
import { Loader2 } from 'lucide-react';
import { BrandLogo } from './components/BrandLogo';
import {
  saveLocalProfile,
  getLocalProfile,
  getLocalProfilesList,
  saveLocalProfilesList,
} from './lib/profileCache';

export default function App() {
  // App initialization state
  const [initializing, setInitializing] = useState(true);
  const [hasBossAccount, setHasBossAccount] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  // Data states
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // Modals
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // 1. Load Profiles & verify if a Boss account exists (resilient to RLS errors)
  const checkBossAndLoadProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) {
        console.warn('Notice loading profiles from database:', error.message);
        // Fall back to local profiles cache
        const cached = getLocalProfilesList();
        if (cached.length > 0) {
          setProfiles(cached);
          const bossExists = cached.some((p) => p.role === 'boss');
          setHasBossAccount(bossExists);
          return cached;
        }
        return [];
      }
      const loadedProfiles = (data || []) as Profile[];
      setProfiles(loadedProfiles);
      saveLocalProfilesList(loadedProfiles);

      const bossExists = loadedProfiles.some((p) => p.role === 'boss');
      setHasBossAccount(bossExists);
      return loadedProfiles;
    } catch (err) {
      console.warn('Failed to verify profiles:', err);
      const cached = getLocalProfilesList();
      if (cached.length > 0) {
        setProfiles(cached);
        setHasBossAccount(cached.some((p) => p.role === 'boss'));
        return cached;
      }
      return [];
    }
  }, []);

  // 2. Load Cases
  const loadCases = useCallback(async (currentProfilesList?: Profile[]) => {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .order('case_date', { ascending: false });

      if (error) {
        console.error('Error fetching cases:', error);
        return;
      }

      const activeProfiles = currentProfilesList || profiles;
      const casesWithLawyers: CaseItem[] = (data || []).map((c: any) => {
        const assigned = activeProfiles.find((p) => p.id === c.assigned_lawyer_id) || null;
        return {
          ...c,
          assigned_lawyer: assigned,
        };
      });

      setCases(casesWithLawyers);
    } catch (err) {
      console.error('Failed to load cases:', err);
    }
  }, [profiles]);

  // 3. Initialize Auth Session & Profiles Check
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const loadedProfiles = await checkBossAndLoadProfiles();

        // Check if there is an active Supabase session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          // Find matching profile in loaded list or local cache
          let matched = loadedProfiles.find((p) => p.id === session.user.id);
          if (!matched) {
            matched = getLocalProfile(session.user.id) || undefined;
          }

          if (!matched) {
            // Check direct profile row
            try {
              const { data: profData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

              if (profData) {
                matched = profData as Profile;
              }
            } catch (pErr) {
              console.warn('Profile direct query notice:', pErr);
            }
          }

          if (matched) {
            setCurrentUser(matched);
            saveLocalProfile(matched);
          } else {
            // Create fallback if user exists in auth
            const fallbackRole =
              session.user.user_metadata?.role ||
              (session.user.email?.toLowerCase().includes('boss') ? 'boss' : 'lawyer');
            const fallbackName =
              session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Counsel';
            const fallbackProf: Profile = {
              id: session.user.id,
              name: fallbackName,
              role: fallbackRole,
            };
            saveLocalProfile(fallbackProf);
            setCurrentUser(fallbackProf);
          }
        }
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        if (mounted) {
          setInitializing(false);
        }
      }
    }

    init();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setCurrentUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        let matched = getLocalProfile(session.user.id);
        if (!matched) {
          try {
            const { data: profData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profData) {
              matched = profData as Profile;
            }
          } catch (pErr) {
            console.warn('Auth state change profile lookup notice:', pErr);
          }
        }

        if (matched) {
          setCurrentUser(matched);
          saveLocalProfile(matched);
        } else {
          const fallbackRole =
            session.user.user_metadata?.role ||
            (session.user.email?.toLowerCase().includes('boss') ? 'boss' : 'lawyer');
          const fallbackName =
            session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Counsel';
          const prof: Profile = {
            id: session.user.id,
            name: fallbackName,
            role: fallbackRole,
          };
          saveLocalProfile(prof);
          setCurrentUser(prof);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkBossAndLoadProfiles]);

  // 4. Load cases whenever user logs in or profiles change
  useEffect(() => {
    if (currentUser) {
      loadCases();
    }
  }, [currentUser, loadCases]);

  // 5. Supabase Realtime Subscriptions for live cross-device synchronization
  useEffect(() => {
    if (!currentUser) return;

    // Cases realtime channel
    const casesChannel = supabase
      .channel('bond-partners-cases-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as any;
            setCases((prev) => {
              // Prevent duplicates
              if (prev.some((c) => c.id === newRow.id)) return prev;
              const assigned = profiles.find((p) => p.id === newRow.assigned_lawyer_id) || null;
              const newItem: CaseItem = { ...newRow, assigned_lawyer: assigned };
              return [newItem, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as any;
            setCases((prev) =>
              prev.map((c) => {
                if (c.id === updatedRow.id) {
                  const assigned =
                    profiles.find((p) => p.id === updatedRow.assigned_lawyer_id) || null;
                  return { ...c, ...updatedRow, assigned_lawyer: assigned };
                }
                return c;
              })
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setCases((prev) => prev.filter((c) => c.id !== deletedId));
            if (selectedCaseId === deletedId) {
              setSelectedCaseId(null);
            }
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    // Profiles realtime channel (when lawyers are added or modified)
    const profilesChannel = supabase
      .channel('bond-partners-profiles-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        async () => {
          const freshProfiles = await checkBossAndLoadProfiles();
          loadCases(freshProfiles);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(casesChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [currentUser, profiles, selectedCaseId, checkBossAndLoadProfiles, loadCases]);

  // Handlers
  const handleAuthSuccess = async (profile: Profile) => {
    setCurrentUser(profile);
    const freshProfiles = await checkBossAndLoadProfiles();
    await loadCases(freshProfiles);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSelectedCaseId(null);
    setIsNewCaseOpen(false);
    setIsManageTeamOpen(false);
  };

  const handleCaseCreated = (newCaseId: string) => {
    setSelectedCaseId(newCaseId);
    loadCases();
  };

  const handleCaseDeleted = (deletedId: string) => {
    setCases((prev) => prev.filter((c) => c.id !== deletedId));
    if (selectedCaseId === deletedId) {
      setSelectedCaseId(null);
    }
  };

  const handleCaseUpdated = (updatedCase: CaseItem) => {
    setCases((prev) =>
      prev.map((c) => (c.id === updatedCase.id ? { ...c, ...updatedCase } : c))
    );
  };

  // 6. Loading screen during first-time initialization
  if (initializing) {
    return (
      <div className="min-h-screen bg-[#0d0f16] flex flex-col items-center justify-center gap-4 text-slate-300">
        <BrandLogo variant="icon" />
        <div className="flex items-center gap-2.5 mt-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#c5a059]" />
          <span
            className="text-xs uppercase tracking-[0.2em] font-semibold text-[#c5a059]"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            Bond Partners — Synchronizing
          </span>
        </div>
      </div>
    );
  }

  // 7. Not Authenticated: Render Setup or Login
  if (!currentUser) {
    return (
      <AuthScreens
        hasBossAccount={hasBossAccount ?? false}
        onAuthSuccess={handleAuthSuccess}
        onRefreshBossCheck={checkBossAndLoadProfiles}
      />
    );
  }

  // 8. Authenticated: Render Main Application
  return (
    <div className="min-h-screen bg-[#0c0e15] text-slate-100 flex flex-col font-sans selection:bg-[#c5a059]/30 selection:text-[#faebd0]">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onOpenNewCase={() => setIsNewCaseOpen(true)}
        onOpenManageTeam={() => setIsManageTeamOpen(true)}
        onSignOut={handleSignOut}
        realtimeConnected={realtimeConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        <DashboardView
          cases={cases}
          currentUser={currentUser}
          lawyers={profiles}
          onSelectCase={(id) => setSelectedCaseId(id)}
          onOpenNewCase={() => setIsNewCaseOpen(true)}
        />
      </main>

      {/* Modals */}
      {/* New Case Modal (Available to Boss & Lawyers) */}
      {isNewCaseOpen && (
        <NewCaseModal
          isOpen={isNewCaseOpen}
          onClose={() => setIsNewCaseOpen(false)}
          onSuccess={handleCaseCreated}
          lawyers={profiles}
          currentUser={currentUser}
        />
      )}

      {/* Manage Team Modal (Boss only) */}
      {currentUser.role === 'boss' && (
        <ManageTeamModal
          isOpen={isManageTeamOpen}
          onClose={() => setIsManageTeamOpen(false)}
          profiles={profiles}
          onRefreshProfiles={async () => {
            const refreshed = await checkBossAndLoadProfiles();
            await loadCases(refreshed);
          }}
        />
      )}

      {/* Case Detail Modal (Viewable, and document upload by both Boss & Lawyers; case editing/deletion by Boss) */}
      {selectedCaseId && (
        <CaseDetailModal
          caseId={selectedCaseId}
          currentUser={currentUser}
          lawyers={profiles}
          onClose={() => setSelectedCaseId(null)}
          onCaseDeleted={handleCaseDeleted}
          onCaseUpdated={handleCaseUpdated}
        />
      )}
    </div>
  );
}
