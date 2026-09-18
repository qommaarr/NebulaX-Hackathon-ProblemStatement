import React, { useState, useMemo } from 'react';
import {
  FullDataset,
  ScheduleAccess,
  ScheduleOccupancy,
  Activity,
  ContractProject,
} from '../types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Zap,
  ShieldAlert,
  Clock,
  Train,
  CheckCircle2,
  Users,
  Grid,
  Columns,
  CalendarDays,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { getNightDate, dateToWeek, weekToDate } from '../utils/pathUtils';
import {
  calculateActivityDurationWeeks,
  calculateActivityEndDate,
} from '../utils/scenarioStateMachine';

interface NightlyCalendarProps {
  dataset: FullDataset;
  accesses: ScheduleAccess[];
  occupancies: ScheduleOccupancy[];
}

type CalendarViewMode = 'columns' | 'roster' | 'monthly';

export const NightlyCalendar: React.FC<NightlyCalendarProps> = ({
  dataset,
  accesses,
  occupancies,
}) => {
  const [selectedWeek, setSelectedWeek] = useState<number>(17);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('columns');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContract, setSelectedContract] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedNature, setSelectedNature] = useState<string>('ALL');
  const [selectedLine, setSelectedLine] = useState<string>('ALL');
  const [inspectedActivity, setInspectedActivity] = useState<Activity | null>(null);
  const [inspectedNight, setInspectedNight] = useState<number | null>(null);

  const horizonStart = dataset.parameters.horizon_start || '2027-01-04';
  const totalWeeks = dataset.parameters.horizon_weeks || 30;

  const activityMap = useMemo(
    () => new Map<string, Activity>(dataset.activities.map((a) => [a.activity_id, a])),
    [dataset.activities]
  );

  const contractMap = useMemo(
    () => new Map<string, ContractProject>(dataset.contracts.map((c) => [c.contract_number, c])),
    [dataset.contracts]
  );

  // Group accesses by week and night
  const weekAccesses = useMemo(() => {
    return accesses.filter((a) => a.week === selectedWeek);
  }, [accesses, selectedWeek]);

  // Filter accesses according to user filters
  const filteredWeekAccesses = useMemo(() => {
    return weekAccesses.filter((acc) => {
      const act = activityMap.get(acc.activity_id);
      if (!act) return false;
      const contract = contractMap.get(act.contract_number);
      if (!contract) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesActId = act.activity_id.toLowerCase().includes(q);
        const matchesContract = contract.contract_number.toLowerCase().includes(q);
        const matchesDesc = (contract.contract_description || '').toLowerCase().includes(q);
        const matchesLoc = (act.start_location_id + act.end_location_id).toLowerCase().includes(q);
        if (!matchesActId && !matchesContract && !matchesDesc && !matchesLoc) return false;
      }

      if (selectedContract !== 'ALL' && act.contract_number !== selectedContract) return false;
      if (selectedPriority !== 'ALL' && String(contract.contract_priority) !== selectedPriority) return false;
      if (selectedNature !== 'ALL' && contract.nature_of_activity !== selectedNature) return false;
      if (selectedLine !== 'ALL') {
        const line = act.start_location_id.includes(':ALP:') ? 'ALP' : 'BET';
        if (line !== selectedLine) return false;
      }

      return true;
    });
  }, [weekAccesses, searchQuery, selectedContract, selectedPriority, selectedNature, selectedLine, activityMap, contractMap]);

  // Night 1 to Night 7 buckets
  const nightBuckets = useMemo(() => {
    const buckets: Record<number, ScheduleAccess[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
    for (const acc of filteredWeekAccesses) {
      if (buckets[acc.access_night]) {
        buckets[acc.access_night].push(acc);
      }
    }
    return buckets;
  }, [filteredWeekAccesses]);

  // Occupancies for current week map: (activity_id, location_id)
  const weekOccupancyMap = useMemo(() => {
    const map = new Map<string, ScheduleOccupancy[]>();
    for (const occ of occupancies) {
      if (occ.week === selectedWeek) {
        if (!map.has(occ.activity_id)) {
          map.set(occ.activity_id, []);
        }
        map.get(occ.activity_id)!.push(occ);
      }
    }
    return map;
  }, [occupancies, selectedWeek]);

  // Week date range
  const weekStartDate = getNightDate(selectedWeek, 1, horizonStart);
  const weekEndDate = getNightDate(selectedWeek, 7, horizonStart);

  // Quick stats for this week
  const stats = useMemo(() => {
    let totalNights = weekAccesses.length;
    let ecloCount = 0;
    let liveCount = 0;
    const distinctNights = new Set<number>();

    for (const a of weekAccesses) {
      distinctNights.add(a.access_night);
      if (a.eclo === 1) ecloCount++;
      const act = activityMap.get(a.activity_id);
      if (act) {
        const c = contractMap.get(act.contract_number);
        if (c?.nature_of_activity === 'Live') liveCount++;
      }
    }

    return { totalNights, ecloCount, liveCount, activeNightsCount: distinctNights.size };
  }, [weekAccesses, activityMap, contractMap]);

  return (
    <div className="space-y-5">
      {/* Top Header & Week Navigation Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Night Possession Calendar
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {weekStartDate.formatted} — {weekEndDate.formatted}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <span>Week {selectedWeek} Nightly Allocations</span>
              <span className="text-xs font-normal text-slate-400 font-mono">({stats.totalNights} accesses scheduled)</span>
            </h1>
          </div>

          {/* Week Selector / Scrubber Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1">
              <button
                onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                disabled={selectedWeek <= 1}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Previous Week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="px-3 py-1 flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-400">Week</span>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-amber-400 font-mono cursor-pointer focus:outline-none"
                >
                  {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => {
                    const mon = getNightDate(w, 1, horizonStart);
                    return (
                      <option key={w} value={w} className="bg-slate-900 text-slate-200">
                        W{w} ({mon.formatted})
                      </option>
                    );
                  })}
                </select>
                <span className="text-xs font-mono text-slate-500">/ {totalWeeks}</span>
              </div>

              <button
                onClick={() => setSelectedWeek(Math.min(totalWeeks, selectedWeek + 1))}
                disabled={selectedWeek >= totalWeeks}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Next Week"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* View Mode Toggle Buttons */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('columns')}
                className={`px-3 py-1 text-xs font-semibold rounded flex items-center space-x-1.5 transition-all ${
                  viewMode === 'columns'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="7-Night Column View"
              >
                <Columns className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">7-Night Calendar</span>
              </button>
              <button
                onClick={() => setViewMode('roster')}
                className={`px-3 py-1 text-xs font-semibold rounded flex items-center space-x-1.5 transition-all ${
                  viewMode === 'roster'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="Contract Roster Matrix"
              >
                <Grid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Contract Roster</span>
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-1 text-xs font-semibold rounded flex items-center space-x-1.5 transition-all ${
                  viewMode === 'monthly'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="4-Week Macro Overview"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">4-Week Macro</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Week Metrics Pill Bar */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            <span>{stats.totalNights} Activity Accesses Active</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="h-2 w-2 rounded-full bg-blue-400"></span>
            <span>{stats.activeNightsCount} of 7 Nights Booked</span>
          </div>
          <div className="flex items-center space-x-2 text-purple-300">
            <Zap className="h-3.5 w-3.5 text-purple-400" />
            <span>{stats.ecloCount} ECLO Nights (00:00–05:00, 5.0h)</span>
          </div>
          <div className="flex items-center space-x-2 text-red-300">
            <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
            <span>{stats.liveCount} Live 750V Isolations (Power Cut)</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search activity ID, contract, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        {/* Contract filter */}
        <div className="flex items-center space-x-1.5">
          <span className="text-xs text-slate-400">Contract:</span>
          <select
            value={selectedContract}
            onChange={(e) => setSelectedContract(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none font-mono"
          >
            <option value="ALL">All Contracts</option>
            {dataset.contracts.map((c) => (
              <option key={c.contract_number} value={c.contract_number}>
                {c.contract_number} (P{c.contract_priority})
              </option>
            ))}
          </select>
        </div>

        {/* Priority filter */}
        <div className="flex items-center space-x-1.5">
          <span className="text-xs text-slate-400">Tier:</span>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none font-mono"
          >
            <option value="ALL">All Tiers</option>
            <option value="1">P1 (Critical)</option>
            <option value="2">P2 (High)</option>
            <option value="3">P3 (Routine)</option>
          </select>
        </div>

        {/* Nature filter */}
        <div className="flex items-center space-x-1.5">
          <span className="text-xs text-slate-400">Nature:</span>
          <select
            value={selectedNature}
            onChange={(e) => setSelectedNature(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none font-mono"
          >
            <option value="ALL">All Natures</option>
            <option value="Live">Live (750V)</option>
            <option value="Non-live (Consist)">Non-live Consist</option>
            <option value="Non-live (Others)">Non-live Others</option>
          </select>
        </div>

        {/* Line filter */}
        <div className="flex items-center space-x-1.5">
          <span className="text-xs text-slate-400">Line:</span>
          <select
            value={selectedLine}
            onChange={(e) => setSelectedLine(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none font-mono"
          >
            <option value="ALL">Alpha & Beta</option>
            <option value="ALP">Line Alpha (Red)</option>
            <option value="BET">Line Beta (Green)</option>
          </select>
        </div>
      </div>

      {/* VIEW MODE 1: 7-Night Column View */}
      {viewMode === 'columns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {[1, 2, 3, 4, 5, 6, 7].map((night) => {
            const dateInfo = getNightDate(selectedWeek, night, horizonStart);
            const nightAccesses = nightBuckets[night] || [];
            const hasLive = nightAccesses.some((acc) => {
              const act = activityMap.get(acc.activity_id);
              return act ? contractMap.get(act.contract_number)?.nature_of_activity === 'Live' : false;
            });
            const hasEclo = nightAccesses.some((acc) => acc.eclo === 1);

            return (
              <div
                key={night}
                className={`bg-slate-900/90 border rounded-xl flex flex-col min-h-[500px] transition-all ${
                  inspectedNight === night
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Column Header */}
                <div
                  onClick={() => setInspectedNight(inspectedNight === night ? null : night)}
                  className={`p-3 border-b border-slate-800/80 rounded-t-xl cursor-pointer ${
                    hasLive ? 'bg-red-950/20' : hasEclo ? 'bg-purple-950/20' : 'bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                      Night {night}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                        nightAccesses.length > 0
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {nightAccesses.length}
                    </span>
                  </div>

                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-slate-300">{dateInfo.dayName}</span>
                    <span className="text-[11px] font-mono text-slate-400">{dateInfo.formatted}</span>
                  </div>

                  {/* Window tag */}
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-500" />
                      {hasEclo ? '00:00–05:00' : '01:30–05:00'}
                    </span>
                    {hasLive && (
                      <span className="flex items-center gap-0.5 text-red-400 font-semibold" title="Live 750V isolation required">
                        <Zap className="h-3 w-3 text-red-400" /> Live Cut
                      </span>
                    )}
                  </div>
                </div>

                {/* Activities inside this night */}
                <div className="p-2.5 flex-1 space-y-2 overflow-y-auto max-h-[640px]">
                  {nightAccesses.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-center p-3 text-slate-500 text-xs">
                      <span className="text-slate-600 font-mono mb-1">— Clear —</span>
                      <span>No track access booked for Night {night}</span>
                    </div>
                  ) : (
                    nightAccesses.map((acc) => {
                      const act = activityMap.get(acc.activity_id);
                      if (!act) return null;
                      const contract = contractMap.get(act.contract_number);
                      const isLive = contract?.nature_of_activity === 'Live';
                      const isConsist = contract?.nature_of_activity === 'Non-live (Consist)';
                      const isEclo = acc.eclo === 1;

                      const priorityStyle =
                        contract?.contract_priority === 1
                          ? 'border-rose-500/40 text-rose-300 bg-rose-500/10'
                          : contract?.contract_priority === 2
                          ? 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                          : 'border-slate-700 text-slate-300 bg-slate-800/40';

                      return (
                        <div
                          key={acc.activity_id}
                          onClick={() => setInspectedActivity(act)}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all hover:scale-[1.01] shadow-sm ${
                            isLive
                              ? 'bg-red-950/20 border-red-500/40 hover:border-red-400'
                              : isEclo
                              ? 'bg-purple-950/20 border-purple-500/40 hover:border-purple-400'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Top row: Activity ID & Priority Badge */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-slate-100">
                              {acc.activity_id}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold border ${priorityStyle}`}>
                              P{contract?.contract_priority || 3}
                            </span>
                          </div>

                          {/* Contract code and description */}
                          <div className="mt-1">
                            <span className="text-[11px] font-bold text-blue-400 font-mono">
                              {act.contract_number}
                            </span>
                            <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight mt-0.5">
                              {contract?.contract_description || act.activity_type}
                            </p>
                          </div>

                          {/* Location Span */}
                          <div className="mt-2 pt-1.5 border-t border-slate-800/60 text-[10px] font-mono text-slate-400">
                            <div className="truncate text-slate-300" title={act.start_location_id}>
                              {act.start_location_id.replace('SEC:', '').replace('PLAT:', '')}
                            </div>
                            <div className="text-slate-500 text-[9px]">➔ to {act.end_location_id.replace('SEC:', '').replace('PLAT:', '')}</div>
                          </div>

                          {/* Badges footer */}
                          <div className="mt-2 flex flex-wrap items-center gap-1 text-[9px] font-mono">
                            {isLive && (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/30 flex items-center gap-0.5">
                                <Zap className="h-2.5 w-2.5" /> 750V Live
                              </span>
                            )}
                            {isConsist && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Consist
                              </span>
                            )}
                            {isEclo && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                                ECLO 1.5x
                              </span>
                            )}
                            <span className="px-1 py-0.5 rounded bg-slate-800 text-slate-400">
                              Seq {acc.access_seq}/{act.total_accesses}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: Contract Roster Matrix */}
      {viewMode === 'roster' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Grid className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-100">
                Weekly Contract Night Roster (Week {selectedWeek})
              </h3>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Ensures no contract exceeds its granted Max Nights / Week
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 min-w-[200px]">Contract & Workfronts</th>
                  <th className="py-2.5 px-2 text-center">Max/Wk</th>
                  <th className="py-2.5 px-2 text-center">Used</th>
                  {[1, 2, 3, 4, 5, 6, 7].map((night) => {
                    const d = getNightDate(selectedWeek, night, horizonStart);
                    return (
                      <th key={night} className="py-2.5 px-2 text-center min-w-[110px] border-l border-slate-800/80">
                        <div>Night {night}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{d.dayName.slice(0, 3)}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {dataset.contracts.map((c) => {
                  const contractActs = filteredWeekAccesses.filter((acc) => {
                    const act = activityMap.get(acc.activity_id);
                    return act?.contract_number === c.contract_number;
                  });

                  // Nights used
                  const usedNights = new Set(contractActs.map((a) => a.access_night));
                  const isExceeded = usedNights.size > c.number_of_maximum_access_per_week;

                  return (
                    <tr key={c.contract_number} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-100">{c.contract_number}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-sans ${
                              c.contract_priority === 1
                                ? 'bg-rose-500/20 text-rose-300'
                                : c.contract_priority === 2
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            P{c.contract_priority}
                          </span>
                          <span className="text-[10px] text-slate-500 font-sans">
                            (Cap: {c.number_of_workfronts} wf)
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate max-w-[200px] font-sans">
                          {c.contract_description}
                        </p>
                      </td>

                      <td className="py-2.5 px-2 text-center text-slate-300">
                        {c.number_of_maximum_access_per_week}
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`font-bold ${
                            isExceeded ? 'text-rose-400' : usedNights.size > 0 ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {usedNights.size}
                        </span>
                      </td>

                      {[1, 2, 3, 4, 5, 6, 7].map((night) => {
                        const nightActs = contractActs.filter((a) => a.access_night === night);
                        const isOverWorkfront = nightActs.length > c.number_of_workfronts;

                        return (
                          <td
                            key={night}
                            className={`py-2 px-2 border-l border-slate-800/80 align-top ${
                              nightActs.length > 0 ? 'bg-slate-950/40' : ''
                            }`}
                          >
                            {nightActs.length > 0 ? (
                              <div className="space-y-1">
                                {nightActs.map((acc) => (
                                  <div
                                    key={acc.activity_id}
                                    onClick={() => setInspectedActivity(activityMap.get(acc.activity_id) || null)}
                                    className={`p-1.5 rounded text-[10px] cursor-pointer hover:opacity-90 font-mono shadow-sm flex items-center justify-between ${
                                      acc.eclo === 1 ? 'bg-purple-900/40 text-purple-200 border border-purple-600/40' : 'bg-blue-900/40 text-blue-200 border border-blue-600/40'
                                    }`}
                                  >
                                    <span className="font-bold">{acc.activity_id}</span>
                                    {acc.eclo === 1 && <span className="text-[9px] text-purple-300">ECLO</span>}
                                  </div>
                                ))}
                                {isOverWorkfront && (
                                  <span className="text-[9px] text-rose-400 font-bold block">
                                    Workfront exceeded!
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="h-6 flex items-center justify-center text-slate-800">•</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 3: 4-Week Macro Overview */}
      {viewMode === 'monthly' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-400" />
                <span>4-Week Calendar Density (Weeks {selectedWeek} to {Math.min(totalWeeks, selectedWeek + 3)})</span>
              </h3>
              <p className="text-xs text-slate-400">
                Bird's-eye view across 28 consecutive engineering nights. Click any day to jump straight to that week.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((offset) => {
              const weekNum = selectedWeek + offset;
              if (weekNum > totalWeeks) return null;
              const mon = getNightDate(weekNum, 1, horizonStart);
              const sun = getNightDate(weekNum, 7, horizonStart);
              const curWeekActs = accesses.filter((a) => a.week === weekNum);

              return (
                <div
                  key={weekNum}
                  onClick={() => setSelectedWeek(weekNum)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    weekNum === selectedWeek
                      ? 'bg-blue-950/40 border-blue-500/80 shadow-md'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-100">Week {weekNum}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {curWeekActs.length} Accesses
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-1">
                    {mon.formatted} – {sun.formatted}
                  </div>

                  {/* 7 mini night indicator dots */}
                  <div className="mt-4 grid grid-cols-7 gap-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                      const nActs = curWeekActs.filter((a) => a.access_night === n);
                      const hasL = nActs.some((a) => {
                        const act = activityMap.get(a.activity_id);
                        return contractMap.get(act?.contract_number || '')?.nature_of_activity === 'Live';
                      });

                      return (
                        <div
                          key={n}
                          className={`h-9 rounded flex flex-col items-center justify-center text-[10px] font-mono ${
                            nActs.length > 0
                              ? hasL
                                ? 'bg-red-500/30 text-red-200 border border-red-500/40 font-bold'
                                : 'bg-blue-500/30 text-blue-200 border border-blue-500/40 font-bold'
                              : 'bg-slate-900 text-slate-600'
                          }`}
                          title={`Night ${n}: ${nActs.length} activities`}
                        >
                          <span className="text-[8px] opacity-70">N{n}</span>
                          <span>{nActs.length}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity Details Modal / Inspector */}
      {inspectedActivity && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-base font-mono font-bold">
                  {inspectedActivity.activity_id}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {contractMap.get(inspectedActivity.contract_number)?.contract_description || inspectedActivity.activity_type}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Contract {inspectedActivity.contract_number} • Priority Tier {inspectedActivity.activity_priority}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectedActivity(null)}
                className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Nature of Activity:</span>
                  <p className="text-slate-200 font-bold mt-1">
                    {contractMap.get(inspectedActivity.contract_number)?.nature_of_activity}
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Possession Type:</span>
                  <p className="text-slate-200 font-bold mt-1">
                    {contractMap.get(inspectedActivity.contract_number)?.access_type}
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Total Accesses Required:</span>
                  <p className="text-emerald-400 font-bold mt-1">
                    {inspectedActivity.total_accesses} nights
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Planned Start Date:</span>
                  <p className="text-slate-200 font-bold mt-1">
                    {inspectedActivity.planned_start_date}
                  </p>
                </div>
              </div>

              {(() => {
                const c = contractMap.get(inspectedActivity.contract_number);
                const maxAccess = c ? c.number_of_maximum_access_per_week : 3;
                const duration = calculateActivityDurationWeeks(inspectedActivity.total_accesses, maxAccess);
                const endDate = calculateActivityEndDate(inspectedActivity.planned_start_date, duration);

                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-slate-500">Calculated Duration:</span>
                      <p className="text-blue-400 font-bold mt-1">{duration} weeks</p>
                      <span className="text-[10px] text-slate-500">
                        Math.ceil({inspectedActivity.total_accesses} / {maxAccess})
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-slate-500">Calculated End Date:</span>
                      <p className="text-slate-200 font-bold mt-1">{endDate}</p>
                      <span className="text-[10px] text-slate-500">
                        Start Date + {duration} wks
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500">Occupied Track Extent:</span>
                <p className="text-blue-400 font-bold mt-1 truncate">
                  {inspectedActivity.start_location_id}
                </p>
                <span className="text-slate-400 text-[11px] block mt-0.5">
                  to {inspectedActivity.end_location_id}
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500">Predecessor Dependency (FS+0):</span>
                <p className="text-slate-300 font-bold mt-1">
                  {inspectedActivity.predecessor_activity_id ? (
                    <span className="text-amber-400">Activity {inspectedActivity.predecessor_activity_id} (Must complete first)</span>
                  ) : (
                    <span className="text-emerald-400">None (Free to start from planned date)</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
