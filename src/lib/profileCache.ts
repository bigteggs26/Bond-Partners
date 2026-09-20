import { Profile } from '../types';

const PROFILE_CACHE_KEY_PREFIX = 'bp_profile_';
const ALL_PROFILES_CACHE_KEY = 'bp_all_profiles';

const KNOWN_DEMO_NAMES = [
  'sarah jenkins',
  'rachel zane',
  'mike ross',
  'harvey specter',
  'evelyn reed',
  'demo lawyer',
  'demo counsel',
  'demo user',
  'demo attorney',
];

export function isDemoProfile(profile?: Partial<Profile> | null): boolean {
  if (!profile || !profile.name) return true;
  const nameLower = profile.name.toLowerCase().trim();
  if (nameLower.includes('demo') || nameLower.includes('sample') || KNOWN_DEMO_NAMES.includes(nameLower)) {
    return true;
  }
  const idStr = String(profile.id || '').toLowerCase();
  if (!idStr || idStr.includes('demo') || idStr.length < 15) {
    return true;
  }
  return false;
}

export function purgeDemoProfilesFromStorage(): void {
  try {
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
