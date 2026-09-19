import React, { useState, useMemo } from 'react';
import { CaseItem, Profile, CaseStage, CASE_STAGES } from '../types';
import { getStageConfig } from '../lib/stages';
import {
  Search,
  Filter,
  Calendar,
  User,
  FileText,
  Briefcase,
  ChevronRight,
  Plus,
  ArrowUpDown,
  LayoutGrid,
  List,
  Sparkles,
  X,
} from 'lucide-react';

// Helper to match dates in multiple formats (e.g., "2026-09-18", "Sep 18", "September", "2026")
function matchesCaseDate(caseDate: string, query: string): boolean {
  if (!caseDate || !query) return false;
  const q = query.trim().toLowerCase();

  // 1. Raw date substring match (e.g., "2026-09-18", "2026-09", "09-18", "2026")
  if (caseDate.toLowerCase().includes(q)) return true;
  const slashDate = caseDate.replace(/-/g, '/');
  if (slashDate.includes(q)) return true;

  try {
    const d = new Date(caseDate + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      const fullDate = d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).toLowerCase(); // "september 18, 2026"

      const shortDate = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).toLowerCase(); // "sep 18, 2026"

      const monthLong = d.toLocaleDateString('en-US', { month: 'long' }).toLowerCase(); // "september"
      const monthShort = d.toLocaleDateString('en-US', { month: 'short' }).toLowerCase(); // "sep"
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(); // "friday"
      const dayNum = d.getDate().toString(); // "18"
      const yearStr = d.getFullYear().toString(); // "2026"

      if (
        fullDate.includes(q) ||
        shortDate.includes(q) ||
        monthLong.includes(q) ||
        monthShort.includes(q) ||
        dayName.includes(q) ||
        yearStr === q ||
        `${monthShort} ${dayNum}`.includes(q) ||
        `${monthLong} ${dayNum}`.includes(q)
      ) {
        return true;
      }
    }
  } catch {
    // ignore
  }

  return false;
}

interface DashboardViewProps {
  cases: CaseItem[];
  currentUser: Profile;
  lawyers: Profile[];
  onSelectCase: (caseId: string) => void;
  onOpenNewCase: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  cases,
  currentUser,
  lawyers,
  onSelectCase,
  onOpenNewCase,
}) => {
  const isBoss = currentUser.role === 'boss';

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedLawyerId, setSelectedLawyerId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name-asc'>('date-desc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Metrics
  const stats = useMemo(() => {
    const total = cases.length;
    const active = cases.filter((c) => c.stage === 'Active').length;
    const pendingReview = cases.filter((c) =>
      ['Pending', 'Under review', 'On appeal'].includes(c.stage)
    ).length;
    const resolved = cases.filter((c) =>
      ['Settled', 'Closed — won'].includes(c.stage)
    ).length;
    return { total, active, pendingReview, resolved };
  }, [cases]);

  // Filtered & Sorted Cases
  const filteredCases = useMemo(() => {
    return cases
      .filter((item) => {
        // Search filter by Case Name OR Date (and lawyer name)
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase().trim();
          const matchName = item.case_name.toLowerCase().includes(query);
          const matchDate = matchesCaseDate(item.case_date, query);
          const matchLawyer = item.assigned_lawyer?.name.toLowerCase().includes(query);
          if (!matchName && !matchDate && !matchLawyer) return false;
        }

        // Specific Date Picker Filter
        if (selectedDate && item.case_date !== selectedDate) {
          return false;
        }

        // Stage filter
        if (selectedStage !== 'all' && item.stage !== selectedStage) {
          return false;
        }

        // Lawyer filter
        if (selectedLawyerId !== 'all') {
          if (selectedLawyerId === 'unassigned') {
            if (item.assigned_lawyer_id) return false;
          } else if (item.assigned_lawyer_id !== selectedLawyerId) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return new Date(b.case_date).getTime() - new Date(a.case_date).getTime();
        }
        if (sortBy === 'date-asc') {
          return new Date(a.case_date).getTime() - new Date(b.case_date).getTime();
        }
        return a.case_name.localeCompare(b.case_name);
      });
  }, [cases, searchTerm, selectedDate, selectedStage, selectedLawyerId, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner / Hero Overview */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[#212638]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-xs uppercase tracking-[0.22em] font-bold text-[#c5a059]"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Case Management Docket
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-400">Live Cross-Device Synchronization</span>
          </div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-wide text-slate-100"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            Bond Partners Litigation Register
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Centralized firm registry. All active, pending, and resolved legal proceedings with real-time updates.
          </p>
        </div>

        {isBoss && (
          <button
            type="button"
            onClick={onOpenNewCase}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold tracking-wide bg-gradient-to-r from-[#d4af37] via-[#c5a059] to-[#a38035] hover:brightness-110 active:brightness-95 text-[#0d0f15] shadow-lg shadow-[#c5a059]/20 transition-all cursor-pointer shrink-0 self-start md:self-end"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ File New Case</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total */}
        <div className="p-4 rounded-xl bg-[#131622]/90 border border-[#23293b] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">
              Total Dockets
            </span>
            <span className="text-2xl font-bold text-slate-100 font-mono mt-0.5 block">
              {stats.total}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#1c2233] border border-[#2b334a] flex items-center justify-center text-[#c5a059]">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        {/* Active */}
        <div className="p-4 rounded-xl bg-[#131622]/90 border border-[#23293b] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-emerald-400 uppercase tracking-wider block font-semibold">
              Active Matters
            </span>
            <span className="text-2xl font-bold text-emerald-300 font-mono mt-0.5 block">
              {stats.active}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* In Review / Appeal */}
        <div className="p-4 rounded-xl bg-[#131622]/90 border border-[#23293b] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-purple-400 uppercase tracking-wider block font-semibold">
              Pending / Appeal
            </span>
            <span className="text-2xl font-bold text-purple-300 font-mono mt-0.5 block">
              {stats.pendingReview}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-950/40 border border-purple-800/40 flex items-center justify-center text-purple-400">
            <ArrowUpDown className="w-5 h-5" />
          </div>
        </div>

        {/* Settled / Won */}
        <div className="p-4 rounded-xl bg-[#131622]/90 border border-[#23293b] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#e5c378] uppercase tracking-wider block font-semibold">
              Settled / Won
            </span>
            <span className="text-2xl font-bold text-[#faebd0] font-mono mt-0.5 block">
              {stats.resolved}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#c5a059]/15 border border-[#c5a059]/30 flex items-center justify-center text-[#e5c378]">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl bg-[#12151f] border border-[#232839] space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Unified Search Bar (By Name or Date) */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search cases by name or date (e.g., 'Meridian', '2026-09-18', or 'Sep')..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0a0c12] border border-[#262c3e] rounded-lg pl-9 pr-9 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-200 transition-colors rounded-full"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Picker Filter */}
          <div className="relative shrink-0 flex items-center">
            <div className="relative w-full sm:w-auto">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                title="Filter by exact case date"
                className="bg-[#0a0c12] border border-[#262c3e] rounded-lg pl-8.5 pr-8 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#c5a059] cursor-pointer"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-slate-200 transition-colors"
                  title="Clear date filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Secondary Controls Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Stage Filter */}
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="bg-[#0a0c12] border border-[#262c3e] rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#c5a059]"
            >
              <option value="all">All Stages ({cases.length})</option>
              {CASE_STAGES.map((stg) => (
                <option key={stg} value={stg}>
                  {stg}
                </option>
              ))}
            </select>

            {/* Lawyer Filter */}
            <select
              value={selectedLawyerId}
              onChange={(e) => setSelectedLawyerId(e.target.value)}
              className="bg-[#0a0c12] border border-[#262c3e] rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#c5a059]"
            >
              <option value="all">All Lawyers</option>
              <option value="unassigned">Unassigned Only</option>
              {lawyers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#0a0c12] border border-[#262c3e] rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#c5a059]"
            >
              <option value="date-desc">Newest Date</option>
              <option value="date-asc">Oldest Date</option>
              <option value="name-asc">Case Name A-Z</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#0a0c12] border border-[#262c3e] rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[#1e2436] text-[#e5c378]'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Grid Card View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === 'table'
                    ? 'bg-[#1e2436] text-[#e5c378]'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Table Row View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Active filter pills & results counter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1a1e2b] text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span>Filtering:</span>
            {searchTerm && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1e2332] text-[#e5c378] border border-[#2b3349]">
                Search: "{searchTerm}"
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="hover:text-rose-400"
                  title="Remove search query"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedDate && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1e2332] text-[#e5c378] border border-[#2b3349]">
                Date: {selectedDate}
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="hover:text-rose-400"
                  title="Remove date filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedStage !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1e2332] text-[#e5c378] border border-[#2b3349]">
                Stage: {selectedStage}
                <button
                  type="button"
                  onClick={() => setSelectedStage('all')}
                  className="hover:text-rose-400"
                  title="Reset stage"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedLawyerId !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1e2332] text-[#e5c378] border border-[#2b3349]">
                Lawyer: {lawyers.find((l) => l.id === selectedLawyerId)?.name || selectedLawyerId}
                <button
                  type="button"
                  onClick={() => setSelectedLawyerId('all')}
                  className="hover:text-rose-400"
                  title="Reset lawyer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {(searchTerm || selectedDate || selectedStage !== 'all' || selectedLawyerId !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedDate('');
                  setSelectedStage('all');
                  setSelectedLawyerId('all');
                }}
                className="text-[#c5a059] hover:underline font-medium ml-1"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="text-slate-400">
            Showing <strong className="text-slate-200">{filteredCases.length}</strong> of{' '}
            <strong className="text-slate-200">{cases.length}</strong> cases
          </div>
        </div>
      </div>

      {/* Cases List Display */}
      {filteredCases.length === 0 ? (
        <div className="p-16 rounded-2xl border border-dashed border-[#262c3e] bg-[#0d0f16] text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#181c28] border border-[#2b3348] flex items-center justify-center mx-auto text-[#c5a059]">
            <Briefcase className="w-7 h-7" />
          </div>
          <div>
            <h3
              className="text-lg font-bold text-slate-200"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              {cases.length === 0 ? 'No Cases Filed Yet' : 'No Matching Cases Found'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {cases.length === 0
                ? isBoss
                  ? 'Get started by creating your first legal case docket. Cases sync in real time across all firm devices.'
                  : 'No active dockets have been recorded by the Managing Partner yet. They will appear here immediately once filed.'
                : 'Try adjusting your search criteria or stage filter to find what you are looking for.'}
            </p>
          </div>

          {cases.length === 0 && isBoss && (
            <button
              type="button"
              onClick={onOpenNewCase}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-[#c5a059] hover:bg-[#d4af37] text-[#0d0f15] shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create First Case Docket</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCases.map((caseItem) => {
            const stageConfig = getStageConfig(caseItem.stage);
            return (
              <div
                key={caseItem.id}
                onClick={() => onSelectCase(caseItem.id)}
                className="group relative rounded-xl bg-[#131621] border border-[#252a3b] hover:border-[#c5a059]/60 hover:shadow-xl hover:shadow-[#c5a059]/5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
              >
                {/* Thumbnail / Header */}
                <div className="relative h-44 bg-[#0a0c12] overflow-hidden border-b border-[#1f2434]">
                  {caseItem.photo_url ? (
                    <img
                      src={caseItem.photo_url}
                      alt={caseItem.case_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#141824] to-[#0c0e15]">
                      <Briefcase className="w-10 h-10 text-[#c5a059]/40 mb-2 group-hover:text-[#c5a059]/70 transition-colors" />
                      <span
                        className="text-[11px] font-semibold tracking-widest uppercase text-slate-500"
                        style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                      >
                        Bond Partners Docket
                      </span>
                    </div>
                  )}

                  {/* Stage Badge on Thumbnail */}
                  <div className="absolute top-3 right-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-md shadow-md ${stageConfig.bg} ${stageConfig.text} ${stageConfig.border}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${stageConfig.dot}`} />
                      <span>{caseItem.stage}</span>
                    </span>
                  </div>

                  {/* Filing Date Badge */}
                  <div className="absolute bottom-3 left-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-black/75 text-slate-300 border border-slate-700/60 backdrop-blur-sm">
                      <Calendar className="w-3 h-3 text-[#c5a059]" />
                      <span>{caseItem.case_date}</span>
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3
                      className="text-base font-bold text-slate-100 group-hover:text-[#faebd0] transition-colors leading-snug line-clamp-2"
                      style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                    >
                      {caseItem.case_name}
                    </h3>
                  </div>

                  {/* Footer with Lawyer & Action */}
                  <div className="pt-3 border-t border-[#1d2232] flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-[#1e2332] border border-[#2f374e] flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                        {caseItem.assigned_lawyer?.name
                          ? caseItem.assigned_lawyer.name.slice(0, 2).toUpperCase()
                          : 'BP'}
                      </div>
                      <span className="text-xs text-slate-300 font-medium truncate">
                        {caseItem.assigned_lawyer?.name || 'Unassigned'}
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1 text-xs text-[#c5a059] font-semibold group-hover:translate-x-0.5 transition-transform shrink-0">
                      <span>View Docket</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE ROW VIEW */
        <div className="border border-[#222738] rounded-xl overflow-hidden bg-[#0d0f16] shadow-sm">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#121520] border-b border-[#222738] text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Case Name</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4 hidden md:table-cell">Assigned Lawyer</th>
                <th className="py-3 px-4 hidden sm:table-cell">Filing Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2333]">
              {filteredCases.map((caseItem) => {
                const stageCfg = getStageConfig(caseItem.stage);
                return (
                  <tr
                    key={caseItem.id}
                    onClick={() => onSelectCase(caseItem.id)}
                    className="hover:bg-[#141824] transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-100 group-hover:text-[#faebd0]">
                      <div className="flex items-center gap-3">
                        {caseItem.photo_url ? (
                          <img
                            src={caseItem.photo_url}
                            alt=""
                            className="w-9 h-9 rounded object-cover border border-[#282f42] shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded bg-[#181c28] border border-[#282f42] flex items-center justify-center text-[#c5a059] shrink-0">
                            <Briefcase className="w-4 h-4" />
                          </div>
                        )}
                        <span className="truncate max-w-xs md:max-w-md">{caseItem.case_name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${stageCfg.bg} ${stageCfg.text} ${stageCfg.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${stageCfg.dot}`} />
                        <span>{caseItem.stage}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 hidden md:table-cell text-slate-300">
                      {caseItem.assigned_lawyer?.name || (
                        <span className="text-slate-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 hidden sm:table-cell text-slate-400 font-mono text-[11px]">
                      {caseItem.case_date}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1a1f2d] group-hover:bg-[#252c3f] text-[#c5a059] font-medium text-xs">
                        Open <ChevronRight className="w-3 h-3" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
