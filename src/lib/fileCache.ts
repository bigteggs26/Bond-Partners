import { CaseFile } from '../types';

const FILES_CACHE_KEY_PREFIX = 'bond_partners_case_files_';

export function getLocalCaseFiles(caseId: string): CaseFile[] {
  try {
    const raw = localStorage.getItem(`${FILES_CACHE_KEY_PREFIX}${caseId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to load cached case files:', e);
    return [];
  }
}

export function saveLocalCaseFile(file: CaseFile): void {
  try {
    const existing = getLocalCaseFiles(file.case_id);
    const filtered = existing.filter((f) => f.id !== file.id && f.file_url !== file.file_url);
    const updated = [file, ...filtered];
    localStorage.setItem(`${FILES_CACHE_KEY_PREFIX}${file.case_id}`, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to cache case file:', e);
  }
}

export function removeLocalCaseFile(caseId: string, fileId: string): void {
  try {
    const existing = getLocalCaseFiles(caseId);
    const updated = existing.filter((f) => f.id !== fileId);
    localStorage.setItem(`${FILES_CACHE_KEY_PREFIX}${caseId}`, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to remove cached case file:', e);
  }
}

// Merge server files with local cache
export function mergeCaseFiles(serverFiles: CaseFile[], caseId: string): CaseFile[] {
  const local = getLocalCaseFiles(caseId);
  const map = new Map<string, CaseFile>();

  // Add server files
  for (const f of serverFiles) {
    map.set(f.file_url, f);
  }

  // Add local files that might not have synchronized to server yet
  for (const f of local) {
    if (!map.has(f.file_url)) {
      map.set(f.file_url, f);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );
}
