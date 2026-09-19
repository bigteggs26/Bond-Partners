import { createClient } from '@supabase/supabase-js';

// Project credentials provided in specification
const DEFAULT_SUPABASE_URL = 'https://neyhwgzefhtphwtaqfua.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5leWh3Z3plZmh0cGh3dGFxZnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NTkyODAsImV4cCI6MjEwNTMzNTI4MH0.Zjn_v2tC1Wh24-0O60JoAn-kYdw_nxpWC73Q9PEnXUk';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const STORAGE_BUCKET = 'case-files';
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB per file limit

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
