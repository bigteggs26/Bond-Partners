import { CaseStage } from '../types';

export interface StageConfig {
  label: CaseStage;
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export const STAGE_CONFIGS: Record<CaseStage, StageConfig> = {
  Pending: {
    label: 'Pending',
    bg: 'bg-amber-950/40',
    text: 'text-amber-300',
    border: 'border-amber-700/50',
    dot: 'bg-amber-400',
  },
  Active: {
    label: 'Active',
    bg: 'bg-emerald-950/40',
    text: 'text-emerald-300',
    border: 'border-emerald-700/50',
    dot: 'bg-emerald-400',
  },
  Postponed: {
    label: 'Postponed',
    bg: 'bg-slate-800/60',
    text: 'text-slate-300',
    border: 'border-slate-600/50',
    dot: 'bg-slate-400',
  },
  'Under review': {
    label: 'Under review',
    bg: 'bg-purple-950/40',
    text: 'text-purple-300',
    border: 'border-purple-700/50',
    dot: 'bg-purple-400',
  },
  'On appeal': {
    label: 'On appeal',
    bg: 'bg-indigo-950/40',
    text: 'text-indigo-300',
    border: 'border-indigo-700/50',
    dot: 'bg-indigo-400',
  },
  Settled: {
    label: 'Settled',
    bg: 'bg-blue-950/40',
    text: 'text-blue-300',
    border: 'border-blue-700/50',
    dot: 'bg-blue-400',
  },
  'Closed — won': {
    label: 'Closed — won',
    bg: 'bg-[#c5a059]/20',
    text: 'text-[#faebd0]',
    border: 'border-[#c5a059]/60',
    dot: 'bg-[#e5c378]',
  },
  'Closed — lost': {
    label: 'Closed — lost',
    bg: 'bg-rose-950/40',
    text: 'text-rose-300',
    border: 'border-rose-700/50',
    dot: 'bg-rose-400',
  },
  Dismissed: {
    label: 'Dismissed',
    bg: 'bg-zinc-800/50',
    text: 'text-zinc-300',
    border: 'border-zinc-600/40',
    dot: 'bg-zinc-400',
  },
};

export function getStageConfig(stage: CaseStage | string): StageConfig {
  if (stage in STAGE_CONFIGS) {
    return STAGE_CONFIGS[stage as CaseStage];
  }
  return {
    label: 'Pending',
    bg: 'bg-slate-800/50',
    text: 'text-slate-300',
    border: 'border-slate-600/40',
    dot: 'bg-slate-400',
  };
}
