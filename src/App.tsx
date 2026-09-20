import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  getActiveLocalUser,
  setActiveLocalUser,
  getCachedCases,
  saveCachedCases,
  isDemoProfile,
  isDemoCase,
  purgeDemoProfilesFromStorage,
} from './lib/profileCache';

export default function App() {
  // App initialization state
  const [currentUser, setCurrentUser] = useState<Profile | null>(() => getActiveLocalUser());
  const [profiles, setProfiles] = useState<Profile[]>(() => getLocalProfilesList());
  const [cases, setCases] = useState<CaseItem[]>(() => getCachedCases());
  const [hasBossAccount, setHasBossAccount] = useState<boolean | null>(() => {
    const list = getLocalProfilesList();
    return list.length > 0 ? list.some((p) => p.role === 'boss') : null;
  });

  // If we already have a cached user, show the interface immediately without blocking
  const [initializing, setInitializing] = useState(() => !getActiveLocalUser());
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // Modals
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Stable references to prevent cascading effect recalculations
  const currentUserRef = useRef<Profile | null>(currentUser);
  currentUserRef.current = currentUser;

  const profilesRef = useRef<Profile[]>(profiles);
  profilesRef.current = profiles;

  const selectedCaseIdRef = useRef<string | null>(selectedCaseId);
  selectedCaseIdRef.current = selectedCaseId;

  // Clean, non-demo profiles list
  const realProfiles = useMemo(
    () => profiles.filter((p) => !isDemoProfile(p, currentUser?.id)),
    [profiles, currentUser]
  );

  // 1. Load Profiles & verify if a Boss account exists (resilient to RLS errors)
  const checkBossAndLoadProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) {
        console.warn('Notice loading profiles from database:', error.message);
        const cached = getLocalProfilesList().filter((p) => !isDemoProfile(p, currentUserRef.current?.id));
        if (cached.length > 0) {
          setProfiles(cached);
          const bossExists = cached.some((p) => p.role === 'boss');
          setHasBossAccount(bossExists);
          return cached;
        }
        return [];
      }
      const loadedProfiles = (data || []).filter((p: any) => !isDemoProfile(p, currentUserRef.current?.id)) as Profile[];
      setProfiles(loadedProfiles);
      saveLocalProfilesList(loadedProfiles);

      const bossExists = loadedProfiles.some((p) => p.role === 'boss');
      setHasBossAccount(bossExists);
      return loadedProfiles;
    } catch (err) {
      console.warn('Failed to verify profiles:', err);
      const cached = getLocalProfilesList().filter((p) => !isDemoProfile(p, currentUserRef.current?.id));
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

      const activeProfiles = (currentProfilesList || profilesRef.current).filter(
        (p) => !isDemoProfile(p, currentUserRef.current?.id)
      );
      const casesWithLawyers: CaseItem[] = (data || [])
        .filter((c: any) => !isDemoCase(c))
        .map((c: any) => {
          const assigned = activeProfiles.find((p) => p.id === c.assigned_lawyer_id) || null;
          return {
            ...c,
            assigned_lawyer: assigned,
          };
        });

      setCases(casesWithLawyers);
      saveCachedCases(casesWithLawyers);
    } catch (err) {
      console.error('Failed to load cases:', err);
    }
  }, []);

  // 3. Initialize Auth Session & Profiles Check with Fast Timeout Protection
  useEffect(() => {
    let mounted = true;

    // Safety timeout: Maximum 1000ms wait for remote network. Never hang the app.
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        setInitializing(false);
      }
    }, 1000);

    async function init() {
      try {
        // Run session check and profiles load concurrently
        const [sessionRes, loadedProfiles] = await Promise.all([
          supabase.auth.getSession(),
          checkBossAndLoadProfiles(),
        ]);

        const session = sessionRes.data.session;

        if (session?.user && mounted) {
          let matched = loadedProfiles.find((p) => p.id === session.user.id);
          if (!matched) {
            matched = getLocalProfile(session.user.id) || undefined;
          }

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
              console.warn('Profile direct query notice:', pErr);
            }
          }

          const fallbackRole =
            session.user.user_metadata?.role ||
            (session.user.email?.toLowerCase().includes('boss') ? 'boss' : 'lawyer');
          const fallbackName =
            session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Counsel';
          const activeProf: Profile = matched || {
            id: session.user.id,
            name: fallbackName,
            role: fallbackRole,
          };

          setCurrentUser(activeProf);
          setActiveLocalUser(activeProf);
          saveLocalProfile(activeProf);

          // Non-blocking background sync
          Promise.resolve(
            supabase.from('profiles').upsert([
              {
                id: activeProf.id,
                name: activeProf.name,
                role: activeProf.role,
              },
            ])
          ).catch((syncErr: unknown) => console.warn('Profile sync notice:', syncErr));

          loadCases(loadedProfiles);
        } else if (!session?.user && mounted) {
          setCurrentUser(null);
          setActiveLocalUser(null);
        }
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        if (mounted) {
          clearTimeout(safetyTimeout);
          setInitializing(false);
        }
      }
    }

    init();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        setCurrentUser(null);
        setActiveLocalUser(null);
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

        const fallbackRole =
          session.user.user_metadata?.role ||
          (session.user.email?.toLowerCase().includes('boss') ? 'boss' : 'lawyer');
        const fallbackName =
          session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Counsel';
        const activeProf: Profile = matched || {
          id: session.user.id,
          name: fallbackName,
          role: fallbackRole,
        };

        setCurrentUser(activeProf);
        setActiveLocalUser(activeProf);
        saveLocalProfile(activeProf);

        Promise.resolve(
          supabase.from('profiles').upsert([
            {
              id: activeProf.id,
              name: activeProf.name,
              role: activeProf.role,
            },
          ])
        ).catch((syncErr: unknown) => console.warn('Auth change profile sync notice:', syncErr));
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [checkBossAndLoadProfiles, loadCases]);

  // 4. Load cases whenever user logs in
  useEffect(() => {
    if (currentUser?.id) {
      loadCases();
    }
  }, [currentUser?.id, loadCases]);

  // 5. Supabase Realtime Subscriptions for live cross-device synchronization
  useEffect(() => {
    if (!currentUser?.id) return;

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
              if (prev.some((c) => c.id === newRow.id)) return prev;
              const assigned = profilesRef.current.find((p) => p.id === newRow.assigned_lawyer_id) || null;
              const newItem: CaseItem = { ...newRow, assigned_lawyer: assigned };
              const updated = [newItem, ...prev];
              saveCachedCases(updated);
              return updated;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as any;
            setCases((prev) => {
              const updated = prev.map((c) => {
                if (c.id === updatedRow.id) {
                  const assigned =
                    profilesRef.current.find((p) => p.id === updatedRow.assigned_lawyer_id) || null;
                  return { ...c, ...updatedRow, assigned_lawyer: assigned };
                }
                return c;
              });
              saveCachedCases(updated);
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setCases((prev) => {
              const updated = prev.filter((c) => c.id !== deletedId);
              saveCachedCases(updated);
              return updated;
            });
            if (selectedCaseIdRef.current === deletedId) {
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
  }, [currentUser?.id, checkBossAndLoadProfiles, loadCases]);

  // Handlers
  const handleAuthSuccess = async (profile: Profile) => {
    setCurrentUser(profile);
    setActiveLocalUser(profile);
    setInitializing(false);
    checkBossAndLoadProfiles().then((fresh) => {
      loadCases(fresh);
    });
  };

  const handleSignOut = async () => {
    setActiveLocalUser(null);
    setCurrentUser(null);
    setSelectedCaseId(null);
    setIsNewCaseOpen(false);
    setIsManageTeamOpen(false);
    await supabase.auth.signOut();
  };

  const handleCaseCreated = (newCaseId: string) => {
    setSelectedCaseId(newCaseId);
    loadCases();
  };

  const handleCaseDeleted = (deletedId: string) => {
    setCases((prev) => {
      const updated = prev.filter((c) => c.id !== deletedId);
      saveCachedCases(updated);
      return updated;
    });
    if (selectedCaseId === deletedId) {
      setSelectedCaseId(null);
    }
  };

  const handleCaseUpdated = (updatedCase: CaseItem) => {
    setCases((prev) => {
      const updated = prev.map((c) => (c.id === updatedCase.id ? { ...c, ...updatedCase } : c));
      saveCachedCases(updated);
      return updated;
    });
  };

  // 6. Loading screen during first-time initialization (only if no cached session)
  if (initializing && !currentUser) {
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
          lawyers={realProfiles}
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
          lawyers={realProfiles}
          currentUser={currentUser}
        />
      )}

      {/* Manage Team Modal (Boss only) */}
      {currentUser.role === 'boss' && (
        <ManageTeamModal
          isOpen={isManageTeamOpen}
          onClose={() => setIsManageTeamOpen(false)}
          profiles={realProfiles}
          currentUser={currentUser}
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
          lawyers={realProfiles}
          onClose={() => setSelectedCaseId(null)}
          onCaseDeleted={handleCaseDeleted}
          onCaseUpdated={handleCaseUpdated}
        />
      )}
    </div>
  );
}
