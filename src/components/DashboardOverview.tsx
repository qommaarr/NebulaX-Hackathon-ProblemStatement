import React from 'react';
import {
  ShieldCheck,
  AlertCircle,
  Clock,
  Zap,
  TrendingDown,
  CalendarCheck,
  CalendarDays,
  CheckCircle,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Eye,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  ValidationReport,
  FullDataset,
  ContractResult,
  ScenarioType,
  DisruptionEvent,
  DisruptionImpactReport,
} from '../types';
import { ActiveTab } from './Navbar';
import { ScenarioDataPackage } from '../utils/scenarioStateMachine';
import { FullCalendarSchedule } from './FullCalendarSchedule';

interface DashboardOverviewProps {
  dataset: FullDataset;
  report: ValidationReport;
  results: ContractResult[];
  scenario: ScenarioType;
  activeScenario?: ScenarioType;
  isPreviewing?: boolean;
  onSelectScenario: (s: ScenarioType) => void;
  onHoverScenario: (s: ScenarioType | null) => void;
  setActiveTab: (t: ActiveTab) => void;
  scenarioPackage?: ScenarioDataPackage;
  allPackages?: Record<ScenarioType, ScenarioDataPackage>;
  onUpdateActivityDate?: (activityId: string, newStartDate: string) => void;
  onResetActivities?: () => void;
  disruptions?: DisruptionEvent[];
  onRunReoptimization?: () => void;
  isReoptimizing?: boolean;
  impactReport?: DisruptionImpactReport | null;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  dataset,
  report,
  results,
  scenario,
  activeScenario = scenario,
  isPreviewing = false,
  onSelectScenario,
  onHoverScenario,
  setActiveTab,
  scenarioPackage,
  allPackages,
  onUpdateActivityDate,
  onResetActivities,
  disruptions = [],
  onRunReoptimization,
  isReoptimizing = false,
  impactReport,
}) => {
  const { soft_scores, hard_violations, feasible, detail } = report;
  const priorityOverrun = soft_scores.priority_overrun || { '1': 0, '2': 0, '3': 0 };

  const scenarioMeta: Record<
    ScenarioType,
    {
      title: string;
      subtitle: string;
      focus: string;
      formula: string;
      penaltyDescription: string;
      color: string;
      accentBorder: string;
    }
  > = {
    A: {
      title: 'Scenario A: Strict Supply, Flexible Schedule',
      subtitle:
        'Zero excess capacity permitted, ECLO hard-forbidden. Optimization minimizes priority-weighted delay days.',
      focus: 'Zero Capacity Flex • Schedule Slips Penalized',
      formula: 'Score = 100×P1_delay + 10×P2_delay + 1×P3_delay',
      penaltyDescription: 'Heavily penalizes Priority 1 delays (100x), moderate on Priority 2 (10x), lowest on Priority 3 (1x).',
      color: 'blue',
      accentBorder: 'border-blue-500',
    },
    B: {
      title: 'Scenario B: Strict Schedule (0d Delay), Flexible Supply',
      subtitle:
        'Planned completion dates are non-negotiable (0d overrun permitted). Extra supply nights and ECLO (+1.5h) absorb demand.',
      focus: 'Zero Overrun Permitted • Extra Nights & ECLO Cost',
      formula: 'Score = 7 × Extra_Supply_Nights + 5 × ECLO_Nights',
      penaltyDescription: 'Zero project delay permitted. Costs are driven by additional possession nights and passenger disruption.',
      color: 'emerald',
      accentBorder: 'border-emerald-500',
    },
    C: {
      title: 'Scenario C: Balanced Trade-off & Elastic Capacity',
      subtitle:
        'Pareto trade-off: allows up to 1 excess night/location-week + 2-week ECLO continuity window, balancing delay vs disruption.',
      focus: 'Elastic Cap (+1 night/loc) • Dual Multi-Objective',
      formula: 'Score = Overrun_Penalties + 7×Extra_Nights + 5×ECLO_Nights',
      penaltyDescription: 'Balances commuter disruption penalties against contract schedule slippages.',
      color: 'purple',
      accentBorder: 'border-purple-500',
    },
  };

  const currentMeta = scenarioMeta[scenario];

  return (
    <div className="space-y-6">
      {/* Preview Notification Banner */}
      {isPreviewing && (
        <div className="bg-amber-950/70 border border-amber-500/80 rounded-xl p-3 flex items-center justify-between shadow-lg text-amber-200 animate-pulse">
          <div className="flex items-center space-x-2.5">
            <Eye className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold">
              Hover-Previewing <strong className="font-mono text-white">Scenario {scenario}</strong>. Metrics, Gantt bars, and contract tables are actively displaying Scenario {scenario} data.
            </span>
          </div>
          <button
            onClick={() => onSelectScenario(scenario)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
          >
            <span>Lock Scenario {scenario}</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Scenario Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 rounded-xl p-6 relative overflow-hidden shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                <Sliders className="h-3 w-3" /> Active Policy: Scenario {scenario}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Horizon: {dataset.parameters.horizon_weeks} Weeks (From {dataset.parameters.horizon_start})
              </span>
              {activeScenario === scenario && !isPreviewing && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-mono font-semibold">
                  Locked
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">{currentMeta.title}</h1>
            <p className="text-sm text-slate-400 leading-relaxed">{currentMeta.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('calendar')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center space-x-1.5"
            >
              <CalendarDays className="h-4 w-4" />
              <span>View Nightly Calendar</span>
            </button>
            <button
              onClick={() => setActiveTab('optimizer')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all flex items-center space-x-1.5"
            >
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>Optimizer</span>
            </button>
            <button
              onClick={() => setActiveTab('topology')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all flex items-center space-x-1.5"
            >
              <span>Network Map</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Reactive Scenario Selector Tabs with hover and click listeners */}
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400">
              Interactive Scenario State Machine (Hover to preview instantly, Click to lock):
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Active: Scenario {activeScenario} {isPreviewing && `(Previewing ${scenario})`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['A', 'B', 'C'] as ScenarioType[]).map((sc) => {
              const isEffective = scenario === sc;
              const isLocked = activeScenario === sc;
              const meta = scenarioMeta[sc];
              const pkg = allPackages ? allPackages[sc] : null;

              return (
                <div
                  key={sc}
                  onClick={() => onSelectScenario(sc)}
                  onMouseEnter={() => onHoverScenario(sc)}
                  onMouseLeave={() => onHoverScenario(null)}
                  className={`text-left p-3.5 rounded-xl border cursor-pointer transition-all relative ${
                    isEffective
                      ? 'bg-blue-950/40 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-100 font-mono">Scenario {sc}</span>
                      {isLocked && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                          Active
                        </span>
                      )}
                      {isEffective && isPreviewing && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 animate-pulse">
                          Previewing
                        </span>
                      )}
                    </div>
                    {pkg && (
                      <span className="text-xs font-bold font-mono text-blue-400">
                        Score: {pkg.summary.combined_score}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 font-medium mt-1">{meta.focus}</p>
                  <div className="text-[11px] text-slate-500 font-mono mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                    <span>{meta.formula}</span>
                  </div>

                  {pkg && (
                    <div className="mt-2.5 flex items-center gap-2 text-[10px] font-mono">
                      <span className={`px-1.5 py-0.5 rounded ${pkg.summary.total_overrun_days === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {pkg.summary.total_overrun_days === 0 ? '0d Delay' : `+${pkg.summary.total_overrun_days}d Overrun`}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                        {pkg.summary.eclo_nights} ECLO
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {pkg.summary.excess_supply_nights} Extra Nights
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic Disruption & Urgent Maintenance Re-Optimization Banner */}
      <div className="bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                  Dynamic Disruption &amp; Urgent Maintenance Auto-Replan
                </h3>
                {disruptions.filter((d) => d.active).length > 0 ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    {disruptions.filter((d) => d.active).length} Bottleneck(s) Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                    Normal Quota
                  </span>
                )}
                {impactReport && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Re-Optimized ({impactReport.scenarios[scenario]?.stabilityRatePercent}% Stability)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                {disruptions.filter((d) => d.active).length > 0 ? (
                  <>
                    Mid-horizon disruption active: <strong className="text-amber-300 font-mono">{disruptions.filter((d) => d.active)[0]?.location_id}</strong> quota reduced from <strong className="text-slate-100">{disruptions.filter((d) => d.active)[0]?.normal_capacity}</strong> to <strong className="text-amber-400">{disruptions.filter((d) => d.active)[0]?.reduced_capacity}</strong> nights (W{disruptions.filter((d) => d.active)[0]?.start_week}–W{disruptions.filter((d) => d.active)[0]?.end_week}).
                  </>
                ) : (
                  <>Simulate unexpected mid-horizon quota reductions (e.g. 4 → 1–2 nights) and evaluate automated re-planning with minimal churn on unaffected work.</>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setActiveTab('disruptions')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              Configure Disruptions
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {onRunReoptimization && (
              <button
                onClick={onRunReoptimization}
                disabled={isReoptimizing || disruptions.filter((d) => d.active).length === 0}
                className={`px-4 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all ${
                  disruptions.filter((d) => d.active).length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : isReoptimizing
                    ? 'bg-amber-600/60 text-white cursor-wait animate-pulse'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-amber-500/20'
                }`}
                title="Run Re-Optimization across all 3 scenarios with minimal churn"
              >
                <Play className={`w-3.5 h-3.5 fill-current ${isReoptimizing ? 'animate-spin' : ''}`} />
                {isReoptimizing ? 'Re-Planning...' : 'Run Re-Optimization'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic FullCalendar View below the Scenario Controls */}
      {onUpdateActivityDate && (
        <FullCalendarSchedule
          dataset={dataset}
          scenario={scenario}
          onUpdateActivityDate={onUpdateActivityDate}
          onResetActivities={onResetActivities}
        />
      )}

      {/* Key Metric Scorecards with Dynamic Scenario Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Feasibility Audit */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Safety & Hard Feasibility</span>
            <div
              className={`p-2 rounded-lg ${
                feasible ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}
            >
              {feasible ? <ShieldCheck className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl font-bold font-mono ${
                feasible ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {feasible ? '100% FEASIBLE' : `${hard_violations.length} VIOLATIONS`}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              {feasible ? '0 Hard physical safety breaches' : 'Non-negotiable rule breach'}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Pass Rate:</span>
            <span className="text-emerald-400 font-bold">{10 - hard_violations.length}/10 Checks</span>
          </div>
        </div>

        {/* Card 2: Objective Soft Score */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Objective Penalty Score</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-slate-100">
              {soft_scores.combined_penalty_score}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              Scenario {scenario} weighted objective cost
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Formula:</span>
            <span className="text-blue-400 truncate max-w-[170px]" title={currentMeta.formula}>
              {currentMeta.formula}
            </span>
          </div>
        </div>

        {/* Card 3: Priority Delay Overrun Days */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Contract Slippage</span>
            <div className={`p-2 rounded-lg ${soft_scores.overrun_days_total === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-bold font-mono ${soft_scores.overrun_days_total === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {soft_scores.overrun_days_total} <span className="text-sm font-normal text-slate-400">days</span>
            </span>
            <p className="text-xs text-slate-400 mt-1">
              {soft_scores.contracts_overrunning === 0
                ? 'All 14 contracts hit planned completion date'
                : `Across ${soft_scores.contracts_overrunning} overrunning contracts`}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>By Tier:</span>
            <span className="text-slate-300">
              P1: <strong className={priorityOverrun['1'] > 0 ? 'text-rose-400' : 'text-slate-400'}>{priorityOverrun['1'] || 0}d</strong> • P2: {priorityOverrun['2'] || 0}d • P3: {priorityOverrun['3'] || 0}d
            </span>
          </div>
        </div>

        {/* Card 4: Supply Flex & ECLO */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Operational Adjustments</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Zap className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-purple-400">
              {soft_scores.excess_access_nights_total} <span className="text-sm font-normal text-slate-400">extra nights</span>
            </span>
            <p className="text-xs text-slate-400 mt-1">
              {soft_scores.eclo_nights_total} ECLO nights (+1.5h engineering time)
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Cost Multiplier:</span>
            <span className="text-purple-300 font-bold">7×Extra + 5×ECLO</span>
          </div>
        </div>
      </div>

      {/* Contract Delivery Matrix Table with Exact Calculated Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-semibold text-slate-100">Contract Delivery Matrix & Overrun Breakdown</h2>
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                14 Contracts • 54 Activities
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Simulated completion vs contractual planned completion date under Scenario {scenario} policy.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                <span>{14 - soft_scores.contracts_overrunning} On Track</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-400"></span>
                <span>{soft_scores.contracts_overrunning} Delayed</span>
              </span>
            </div>

            <button
              onClick={() => setActiveTab('gantt')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center space-x-1"
            >
              <span>Open Gantt Grid</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Contract</th>
                <th className="py-2.5 px-3 font-semibold">Description</th>
                <th className="py-2.5 px-3 font-semibold">Type / Nature</th>
                <th className="py-2.5 px-3 font-semibold text-center">Tier</th>
                <th className="py-2.5 px-3 font-semibold text-center">Max Access</th>
                <th className="py-2.5 px-3 font-semibold">Planned End</th>
                <th className="py-2.5 px-3 font-semibold">Simulated End</th>
                <th className="py-2.5 px-3 font-semibold">Overrun</th>
                <th className="py-2.5 px-3 font-semibold">Status Badge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {dataset.contracts.map((c) => {
                const res = results.find((r) => r.contract_number === c.contract_number);
                const overrun = res ? res.overrun_days : 0;
                const simDate = res ? res.simulated_completion_date : c.planned_completion_date;
                const isOnTrack = overrun === 0;

                const priorityBadge =
                  c.contract_priority === 1
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : c.contract_priority === 2
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700';

                return (
                  <tr key={c.contract_number} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-100">{c.contract_number}</td>
                    <td className="py-2.5 px-3 text-slate-300 truncate max-w-[200px]">{c.contract_description}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] ${
                          c.nature_of_activity === 'Live'
                            ? 'bg-red-500/20 text-red-400 font-bold border border-red-500/30'
                            : c.nature_of_activity === 'Non-live (Consist)'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {c.nature_of_activity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${priorityBadge}`}>
                        P{c.contract_priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-300">
                      {c.number_of_maximum_access_per_week} nights/wk
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{c.planned_completion_date}</td>
                    <td className="py-2.5 px-3 text-slate-200 font-medium">{simDate}</td>
                    <td className="py-2.5 px-3">
                      {overrun > 0 ? (
                        <span className="text-rose-400 font-bold font-mono">+{overrun}d</span>
                      ) : (
                        <span className="text-emerald-400 font-bold font-mono">0d</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {isOnTrack ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle className="h-3 w-3 text-emerald-400" />
                          <span>ON TRACK</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          <AlertTriangle className="h-3 w-3 text-rose-400" />
                          <span>DELAYED (+{overrun}d)</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
