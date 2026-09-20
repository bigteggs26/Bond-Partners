import { Profile, CaseItem } from '../types';

const PROFILE_CACHE_KEY_PREFIX = 'bp_profile_';
const ALL_PROFILES_CACHE_KEY = 'bp_all_profiles';
const DISMISSED_PROFILES_KEY = 'bp_dismissed_profiles';

export const KNOWN_DEMO_IDS = new Set([
  '6430a1b8-f3c8-40fe-abae-7fe652e42a68', // Test Lawyer
  '7037c9d3-1ccd-454c-80e8-c2dd81d5cb9a', // Test Counsel
  'eea2da9c-352c-4472-b670-7ed67be37ef6', // Attorney Jenkins
  '7f5c20b7-b764-4b67-b242-57316398b9e2', // sarah
]);

export const KNOWN_DEMO_NAMES = [
  'test lawyer',
  'test counsel',
  'test attorney',
  'test user',
  'attorney jenkins',
  'sarah jenkins',
  'sarah',
  'jenkins',
  'rachel zane',
  'rachel',
  'zane',
  'mike ross',
  'harvey specter',
  'evelyn reed',
  'demo lawyer',
  'demo counsel',
  'demo user',
  'demo attorney',
];

export function getDismissedProfiles(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_PROFILES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isDismissedProfile(idOrName: string): boolean {
  if (!idOrName) return false;
  const clean = idOrName.toLowerCase().trim();
  const dismissed = getDismissedProfiles();
  return dismissed.includes(clean);
}

export function dismissProfile(idOrName: string): void {
  try {
    const clean = idOrName.toLowerCase().trim();
    const dismissed = getDismissedProfiles();
    if (!dismissed.includes(clean)) {
      dismissed.push(clean);
      localStorage.setItem(DISMISSED_PROFILES_KEY, JSON.stringify(dismissed));
    }
  } catch (err) {
    console.warn('Could not save dismissed profile:', err);
  }
}

export function isDemoProfile(
  profile?: Partial<Profile> | null,
  currentUserId?: string | null
): boolean {
  if (!profile) return true;
  const idStr = String(profile.id || '').toLowerCase().trim();

  // Never flag the active logged-in user as demo
  if (currentUserId && idStr === currentUserId.toLowerCase().trim()) {
    return false;
  }

  // Check known demo IDs
  if (KNOWN_DEMO_IDS.has(idStr) || isDismissedProfile(idStr)) {
    return true;
  }

  if (!profile.name) return true;
  const nameLower = profile.name.toLowerCase().trim();

  // Check dismissed by name
  if (isDismissedProfile(nameLower)) {
    return true;
  }

  // Check demo, test, sample prefixes/substrings
  if (
    nameLower.includes('demo') ||
    nameLower.includes('sample') ||
    nameLower.startsWith('test') ||
    nameLower.includes('test lawyer') ||
    nameLower.includes('test counsel') ||
    nameLower.includes('test_') ||
    nameLower === 'test' ||
    KNOWN_DEMO_NAMES.some((dn) => nameLower === dn || nameLower.includes(dn))
  ) {
    return true;
  }

  // Fallback check for missing or short placeholder IDs
  if (!idStr || idStr.includes('demo') || idStr.length < 15) {
    return true;
  }

  return false;
}

export function isDemoCase(caseItem?: Partial<CaseItem> | null): boolean {
  if (!caseItem) return true;
  const nameLower = (caseItem.case_name || '').toLowerCase().trim();
  if (
    nameLower.includes('test lawyer') ||
    nameLower.includes('demo case') ||
    nameLower.startsWith('test case') ||
    nameLower.includes('sample case')
  ) {
    return true;
  }
  return false;
}

export function purgeDemoProfilesFromStorage(): void {
  try {
    // Also seed dismissed profiles with known demo IDs
    KNOWN_DEMO_IDS.forEach((id) => dismissProfile(id));
    KNOWN_DEMO_NAMES.forEach((name) => dismissProfile(name));

    const raw = localStorage.getItem(ALL_PROFILES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Profile[];
      const cleaned = parsed.filter((p) => !isDemoProfile(p));
      localStorage.setItem(ALL_PROFILES_CACHE_KEY, JSON.stringify(cleaned));
    }

    // Clean individual profile keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PROFILE_CACHE_KEY_PREFIX)) {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const p = JSON.parse(val);
            if (isDemoProfile(p)) {
              localStorage.removeItem(key);
            }
          } catch {
            localStorage.removeItem(key);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not purge demo profiles from storage:', err);
  }
}

// Automatically purge demo profiles on module load
purgeDemoProfilesFromStorage();

export function saveLocalProfile(profile: Profile): void {
  if (isDemoProfile(profile)) return;
  try {
    localStorage.setItem(PROFILE_CACHE_KEY_PREFIX + profile.id, JSON.stringify(profile));
    
    // Also update in all-profiles list
    const existing = getLocalProfilesList();
    const idx = existing.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      existing[idx] = profile;
    } else {
      existing.push(profile);
    }
    localStorage.setItem(ALL_PROFILES_CACHE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('Could not write profile to localStorage:', err);
  }
}

export function getLocalProfile(id: string): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY_PREFIX + id);
    if (raw) {
      const parsed = JSON.parse(raw) as Profile;
      if (!isDemoProfile(parsed)) {
        return parsed;
      }
      localStorage.removeItem(PROFILE_CACHE_KEY_PREFIX + id);
      return null;
    }
    const all = getLocalProfilesList();
    const found = all.find((p) => p.id === id);
    return found || null;
  } catch (err) {
    return null;
  }
}

export function getLocalProfilesList(): Profile[] {
  try {
    const raw = localStorage.getItem(ALL_PROFILES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Profile[];
      const valid = parsed.filter((p) => !isDemoProfile(p));
      if (valid.length !== parsed.length) {
        localStorage.setItem(ALL_PROFILES_CACHE_KEY, JSON.stringify(valid));
      }
      return valid;
    }
    return [];
  } catch (err) {
    return [];
  }
}

export function saveLocalProfilesList(profiles: Profile[]): void {
  try {
    const valid = profiles.filter((p) => !isDemoProfile(p));
    localStorage.setItem(ALL_PROFILES_CACHE_KEY, JSON.stringify(valid));
    valid.forEach((p) => {
      localStorage.setItem(PROFILE_CACHE_KEY_PREFIX + p.id, JSON.stringify(p));
    });
  } catch (err) {
    console.warn('Could not write profiles to localStorage:', err);
  }
}
