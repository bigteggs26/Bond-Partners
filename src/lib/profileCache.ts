import { Profile } from '../types';

const PROFILE_CACHE_KEY_PREFIX = 'bp_profile_';
const ALL_PROFILES_CACHE_KEY = 'bp_all_profiles';

export function saveLocalProfile(profile: Profile): void {
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
      return JSON.parse(raw) as Profile;
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
      return JSON.parse(raw) as Profile[];
    }
    return [];
  } catch (err) {
    return [];
  }
}

export function saveLocalProfilesList(profiles: Profile[]): void {
  try {
    localStorage.setItem(ALL_PROFILES_CACHE_KEY, JSON.stringify(profiles));
    profiles.forEach((p) => {
      localStorage.setItem(PROFILE_CACHE_KEY_PREFIX + p.id, JSON.stringify(p));
    });
  } catch (err) {
    console.warn('Could not write profiles to localStorage:', err);
  }
}
