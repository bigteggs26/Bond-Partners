export type UserRole = 'boss' | 'lawyer';

export interface Profile {
  id: string; // uuid matching auth.users id
  name: string;
  role: UserRole;
  created_at?: string;
}

export type CaseStage =
  | 'Pending'
  | 'Active'
  | 'Postponed'
  | 'Under review'
  | 'On appeal'
  | 'Settled'
  | 'Closed — won'
  | 'Closed — lost'
  | 'Dismissed';

export const CASE_STAGES: CaseStage[] = [
  'Pending',
  'Active',
  'Postponed',
  'Under review',
  'On appeal',
  'Settled',
  'Closed — won',
  'Closed — lost',
  'Dismissed',
];

export interface CaseItem {
  id: string;
  case_name: string;
  case_date: string;
  stage: CaseStage;
  assigned_lawyer_id: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at?: string;
  assigned_lawyer?: Profile | null;
}

export interface CaseFile {
  id: string;
  case_id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
}
