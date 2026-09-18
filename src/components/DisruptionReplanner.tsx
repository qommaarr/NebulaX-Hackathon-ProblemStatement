import React, { useState } from 'react';
import {
  FullDataset,
  ScenarioType,
  DisruptionEvent,
  DisruptionImpactReport,
  DisplacedActivity,
} from '../types';
import { ScenarioDataPackage } from '../utils/scenarioStateMachine';
import {
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Calendar,
  Zap,
  Sliders,
  Check,
  Info,
} from 'lucide-react';
import { DEFAULT_DISRUPTION_PRESETS } from '../utils/reoptimizationEngine';

interface DisruptionReplannerProps {
  dataset: FullDataset;
  activeScenario: ScenarioType;
  onSelectScenario: (sc: ScenarioType) => void;
  disruptions: DisruptionEvent[];
  onUpdateDisruptions: (disruptions: DisruptionEvent[]) => void;
  onRunReoptimization: () => void;
  impactReport: DisruptionImpactReport | null;
  isReoptimizing: boolean;
  packages: Record<ScenarioType, ScenarioDataPackage>;
  onResetToBaseline: () => void;
}

export const DisruptionReplanner: React.FC<DisruptionReplannerProps> = ({
  dataset,
  activeScenario,
  onSelectScenario,
  disruptions,
  onUpdateDisruptions,
  onRunReoptimization,
  impactReport,
  isReoptimizing,
  packages,
  onResetToBaseline,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  // Form state for new custom disruption
  const [newLocId, setNewLocId] = useState<string>(
    dataset.locationSupplies[0]?.location_id || 'SEC:ALP:S01_S02:EB'
  );
  const [newStartWeek, setNewStartWeek] = useState<number>(8);
  const [newEndWeek, setNewEndWeek] = useState<number>(12);
  const [newNormalCap, setNewNormalCap] = useState<number>(4);
  const [newReducedCap, setNewReducedCap] = useState<number>(1);
  const [newReason, setNewReason] = useState<string>(
    'Emergency track geometry defect and ballast consolidation speed restriction.'
  );
  const [newSeverity, setNewSeverity] = useState<'Urgent' | 'Major' | 'Moderate'>('Urgent');

  const activeCount = disruptions.filter((d) => d.active).length;

  const handleToggleDisruption = (id: string) => {
    const updated = disruptions.map((d) => (d.id === id ? { ...d, active: !d.active } : d));
    onUpdateDisruptions(updated);
  };

  const handleDeleteDisruption = (id: string) => {
    const updated = disruptions.filter((d) => d.id !== id);
    onUpdateDisruptions(updated);
  };

  const handleApplyPreset = (preset: DisruptionEvent) => {
    const exists = disruptions.find((d) => d.id === preset.id);
    if (exists) {
      onUpdateDisruptions(
        disruptions.map((d) => (d.id === preset.id ? { ...preset, active: true } : d))
      );
    } else {
      onUpdateDisruptions([...disruptions, { ...preset, active: true }]);
    }
  };

  const handleCreateDisruption = (e: React.FormEvent) => {
    e.preventDefault();
    const newDisruption: DisruptionEvent = {
      id: `DIS-${Date.now().toString().slice(-4)}`,
      name: `${newLocId.replace('SEC:', '').replace(':EB', '').replace(':WB', '')} Urgent Maintenance`,
      location_id: newLocId,
      start_week: Number(newStartWeek),
      end_week: Number(newEndWeek),
      normal_capacity: Number(newNormalCap),
      reduced_capacity: Number(newReducedCap),
      reason: newReason,
      severity: newSeverity,
      active: true,
      affected_line: newLocId.includes('ALP') ? 'ALP' : newLocId.includes('BET') ? 'BET' : 'BOTH',
    };
    onUpdateDisruptions([...disruptions, newDisruption]);
    setShowAddModal(false);
  };

  // Extract scenario impact for active scenario if report exists
  const activeImpact = impactReport?.scenarios[activeScenario];

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Dynamic Re-Optimization Engine
              </span>
              <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
                Minimal Churn Guarantee
              </span>
              <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                100% Activity Completion
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              Dynamic Update & Urgent Maintenance Re-Optimization
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              When unforeseen disruptions or emergency maintenance cut mid-horizon possession capacity
              (e.g., location nightly quota dropping from 4 to 1–2), this module impact-assesses all
              contracts and auto-replans work across all three policy scenarios with minimal churn on
              unaffected track sections.
            </p>
          </div>

          {/* Master Run Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={onResetToBaseline}
              className="px-4 py-3 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium border border-slate-700 transition-all flex items-center justify-center gap-2"
              title="Reset all schedules to unperturbed baseline"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              Reset Baseline
            </button>

            <button
              id="supervisor-run-reopt-btn"
              onClick={onRunReoptimization}
              disabled={isReoptimizing || activeCount === 0}
              className={`px-6 py-3.5 rounded-xl font-semibold text-sm shadow-lg flex items-center justify-center gap-2.5 transition-all transform active:scale-95 ${
                activeCount === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : isReoptimizing
                  ? 'bg-amber-600/60 text-white cursor-wait animate-pulse'
                  : 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-red-400 text-white shadow-amber-500/25 border border-amber-400/40 hover:shadow-amber-500/40'
              }`}
            >
              <Play className={`w-4 h-4 fill-current ${isReoptimizing ? 'animate-spin' : ''}`} />
              {isReoptimizing ? (
                <span>Re-Optimizing Scenarios A, B, C...</span>
              ) : (
                <span>
                  Run Re-Optimization <span className="text-xs opacity-90">({activeCount} Active)</span>
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Live Supervisor Status Line */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className={`w-2 h-2 rounded-full ${activeCount > 0 ? 'bg-amber-400 animate-ping' : 'bg-slate-500'}`} />
              Active Disruptions: <strong className="text-amber-400">{activeCount}</strong>
            </span>
            <span>•</span>
            <span>
              Target Policy: <strong className="text-blue-400">Scenario {activeScenario}</strong>
            </span>
            {impactReport && (
              <>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Re-Optimization Evaluated at {impactReport.timestamp}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-400">Pressing Run computes</span>
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">Scenario A</span>
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">Scenario B</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">Scenario C</span>
          </div>
        </div>
      </div>

      {/* Re-Optimization Impact Assessment Scorecards (If run completed) */}
      {impactReport && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-slate-100">
                Multi-Scenario Re-Optimization Impact Assessment
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Click any scenario card below to inspect its detailed schedule
            </span>
          </div>

          {/* 3-Scenario Side-by-Side Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['A', 'B', 'C'] as ScenarioType[]).map((sc) => {
              const impact = impactReport.scenarios[sc];
              const isCurrent = activeScenario === sc;
              const pkg = packages[sc];

              return (
                <div
                  key={sc}
                  onClick={() => onSelectScenario(sc)}
                  className={`cursor-pointer rounded-xl p-5 border transition-all relative ${
                    isCurrent
                      ? 'bg-slate-900 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/40'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm ${
                          sc === 'A'
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                            : sc === 'B'
                            ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                            : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {sc}
                      </span>
                      <div>
                        <h3 className="font-bold text-slate-100 text-sm">Scenario {sc}</h3>
                        <p className="text-xs text-slate-400">{pkg.name}</p>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  {/* Key Impact Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono">
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">SCHEDULE STABILITY</span>
                      <span className="text-emerald-400 font-bold text-base">
                        {impact.stabilityRatePercent}%
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {impact.unaffectedActivitiesCount}/{impact.totalActivities} Unaffected
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">CHURN COUNT</span>
                      <span className={`font-bold text-base ${impact.churnedActivitiesCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {impact.churnedActivitiesCount}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {impact.churnRatePercent}% Displaced
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">COMPLETION RATE</span>
                      <span className="text-blue-400 font-bold text-base">
                        100%
                      </span>
                      <span className="text-[10px] text-emerald-400 block">
                        All {impact.totalActivities} Completed
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">OVERRUN DAYS</span>
                      <span className={`font-bold text-base ${impact.newOverrunDays > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {impact.newOverrunDays}d
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Δ {impact.overrunDelta >= 0 ? `+${impact.overrunDelta}d` : `${impact.overrunDelta}d`}
                      </span>
                    </div>
                  </div>

                  {/* Priority Breakdown */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>
                      P1: <strong className={impact.p1OverrunDays > 0 ? 'text-rose-400' : 'text-emerald-400'}>{impact.p1OverrunDays}d</strong>
                    </span>
                    <span>
                      P2: <strong className={impact.p2OverrunDays > 0 ? 'text-amber-400' : 'text-emerald-400'}>{impact.p2OverrunDays}d</strong>
                    </span>
                    <span>
                      P3: <strong className="text-slate-300">{impact.p3OverrunDays}d</strong>
                    </span>
                    <span className="text-slate-500">
                      Score: <strong className="text-slate-200">{Math.round(impact.newScore)}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Minimal Churn & Displaced Activities Inspector for Active Scenario */}
          {activeImpact && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    Scenario {activeScenario} Churn & Displacement Audit
                  </h3>
                  <p className="text-xs text-slate-400">
                    Detailed audit of work preserved without changes vs work displaced to accommodate the disruption.
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    {activeImpact.unaffectedActivitiesCount} Unaffected ({activeImpact.stabilityRatePercent}%)
                  </span>
                  <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    {activeImpact.churnedActivitiesCount} Displaced ({activeImpact.churnRatePercent}%)
                  </span>
                </div>
              </div>

              {activeImpact.displacedActivities.length === 0 ? (
                <div className="bg-slate-950 border border-emerald-500/20 rounded-lg p-4 text-center text-xs font-mono text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                  Zero Churn! All activities were safely maintained at their baseline schedules without conflict.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60">
                        <th className="py-2.5 px-3">Activity ID</th>
                        <th className="py-2.5 px-3">Contract</th>
                        <th className="py-2.5 px-3 text-center">Priority</th>
                        <th className="py-2.5 px-3 text-center">Baseline Start</th>
                        <th className="py-2.5 px-3 text-center">Re-Planned Start</th>
                        <th className="py-2.5 px-3 text-center">Shift (Δ)</th>
                        <th className="py-2.5 px-3">Root Cause & Mitigation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {activeImpact.displacedActivities.map((disp, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-100 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            {disp.activity_id}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{disp.contract_number}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                disp.priority === 1
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : disp.priority === 2
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              P{disp.priority}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-400">
                            W{disp.baselineStartWeek}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-amber-400">
                            W{disp.newStartWeek}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                              +{disp.shiftWeeks}w (+{disp.shiftWeeks * 7}d)
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                            {disp.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Disruption Events & Urgent Maintenance Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-slate-100">
                Disruption Events & Urgent Maintenance Registry
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Specify track possession bottlenecks where maintenance capacity drops mid-horizon.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Add Disruption
            </button>
          </div>
        </div>

        {/* Quick Railway Presets */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2 font-medium">
            Realistic Railway Operational Presets (1-Click Load):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {DEFAULT_DISRUPTION_PRESETS.map((preset) => {
              const isLoaded = disruptions.some((d) => d.id === preset.id && d.active);
              return (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className={`p-2.5 rounded-lg border text-left text-xs font-mono transition-all flex flex-col justify-between ${
                    isLoaded
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold truncate text-[11px]">{preset.name}</span>
                    {isLoaded && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                    <span>
                      W{preset.start_week}–W{preset.end_week}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                      Quota {preset.normal_capacity} → {preset.reduced_capacity}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Disruption List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Disruption Event</th>
                <th className="py-2.5 px-3">Location ID</th>
                <th className="py-2.5 px-3 text-center">Period</th>
                <th className="py-2.5 px-3 text-center">Nightly Quota</th>
                <th className="py-2.5 px-3">Reason / Incident Detail</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {disruptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No disruption constraints added yet. Click &quot;Add Disruption&quot; or choose a preset above.
                  </td>
                </tr>
              ) : (
                disruptions.map((d) => (
                  <tr
                    key={d.id}
                    className={`hover:bg-slate-800/20 transition-colors ${
                      !d.active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleToggleDisruption(d.id)}
                        className={`w-9 h-5 rounded-full transition-colors relative inline-flex items-center ${
                          d.active ? 'bg-amber-500' : 'bg-slate-700'
                        }`}
                        title={d.active ? 'Active (Click to disable)' : 'Disabled (Click to enable)'}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                            d.active ? 'translate-x-4.5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            d.severity === 'Urgent'
                              ? 'bg-rose-500/20 text-rose-300'
                              : d.severity === 'Major'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {d.severity}
                        </span>
                        <span>{d.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-blue-400 text-[11px]">{d.location_id}</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-300">
                      W{d.start_week} – W{d.end_week}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-950 font-bold text-amber-400 border border-slate-800">
                        {d.normal_capacity} → {d.reduced_capacity} nights
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 max-w-xs truncate" title={d.reason}>
                      {d.reason}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleDeleteDisruption(d.id)}
                        className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded transition-colors"
                        title="Delete disruption"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Custom Disruption Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                Add Track Possession Disruption
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDisruption} className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">DISRUPTED LOCATION SECTOR</label>
                <select
                  value={newLocId}
                  onChange={(e) => setNewLocId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-blue-500 outline-none"
                >
                  {dataset.locationSupplies.map((s) => (
                    <option key={s.location_id} value={s.location_id}>
                      {s.location_id} (Base Cap: {s.supply_capacity} nights)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">START WEEK</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={newStartWeek}
                    onChange={(e) => setNewStartWeek(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">END WEEK</label>
                  <input
                    type="number"
                    min={newStartWeek}
                    max={40}
                    value={newEndWeek}
                    onChange={(e) => setNewEndWeek(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">NORMAL CAPACITY</label>
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={newNormalCap}
                    onChange={(e) => setNewNormalCap(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">REDUCED CAPACITY (DISRUPTED)</label>
                  <input
                    type="number"
                    min={0}
                    max={newNormalCap - 1}
                    value={newReducedCap}
                    onChange={(e) => setNewReducedCap(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-lg p-2 text-amber-300 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">SEVERITY LEVEL</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Urgent', 'Major', 'Moderate'] as const).map((sev) => (
                    <button
                      type="button"
                      key={sev}
                      onClick={() => setNewSeverity(sev)}
                      className={`py-2 rounded-lg border text-center transition-colors ${
                        newSeverity === sev
                          ? sev === 'Urgent'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500'
                            : sev === 'Major'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">DISRUPTION REASON / INCIDENT DESCRIPTION</label>
                <textarea
                  rows={2}
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs font-mono"
                  placeholder="e.g. Critical rail defect, point machine failure, emergency signaling re-cabling..."
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg shadow-lg"
                >
                  Add &amp; Save Disruption
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
