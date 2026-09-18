import React, { useState } from 'react';
import {
  FullDataset,
  ScheduleAccess,
  ScheduleOccupancy,
  ContractResult,
  ScenarioType,
} from '../types';
import {
  Play,
  RotateCcw,
  Zap,
  AlertTriangle,
  Flame,
  Terminal,
  Cpu,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { runOptimizationSolver } from '../utils/scheduler';

interface OptimizerSandboxProps {
  dataset: FullDataset;
  scenario: ScenarioType;
  setScenario: (sc: ScenarioType) => void;
  onApplySchedule: (
    accesses: ScheduleAccess[],
    occupancies: ScheduleOccupancy[],
    results: ContractResult[]
  ) => void;
}

export const OptimizerSandbox: React.FC<OptimizerSandboxProps> = ({
  dataset,
  scenario,
  setScenario,
  onApplySchedule,
}) => {
  const [coSharing, setCoSharing] = useState<boolean>(true);
  const [allowEclo, setAllowEclo] = useState<boolean>(scenario !== 'A');
  const [disruptions, setDisruptions] = useState<
    Array<{ location_id: string; week: number; reduced_capacity: number }>
  >([]);

  const [disruptLoc, setDisruptLoc] = useState<string>('SEC:ALP:H01_H02:EB');
  const [disruptWeek, setDisruptWeek] = useState<number>(18);
  const [disruptCap, setDisruptCap] = useState<number>(1);

  const [logs, setLogs] = useState<string[]>([
    'Optimizer ready.',
    'Select a scenario policy and click "Run Heuristic Solver" to compute optimal track possession schedule.',
  ]);
  const [isSolving, setIsSolving] = useState<boolean>(false);

  const handleRunSolver = () => {
    setIsSolving(true);
    setLogs((prev) => [...prev, `[INIT] Executing Solver for Scenario ${scenario}...`]);

    setTimeout(() => {
      const { accesses, occupancies, results, solverLog } = runOptimizationSolver(dataset, {
        scenario,
        coSharingEnabled: coSharing,
        allowEclo: scenario !== 'A' && allowEclo,
        disruptions,
      });

      setLogs((prev) => [...prev, ...solverLog, `[SUCCESS] Schedule ready for Scenario ${scenario}!`]);
      onApplySchedule(accesses, occupancies, results);
      setIsSolving(false);
    }, 200);
  };

  const handleAddDisruption = () => {
    setDisruptions((prev) => [
      ...prev,
      { location_id: disruptLoc, week: disruptWeek, reduced_capacity: disruptCap },
    ]);
    setLogs((prev) => [
      ...prev,
      `[DISRUPTION ADDED] Emergency capacity cut at ${disruptLoc} in Week ${disruptWeek} to ${disruptCap} night(s).`,
    ]);
  };

  const handleClearDisruptions = () => {
    setDisruptions([]);
    setLogs((prev) => [...prev, `[RESET] Cleared all disruption constraints.`]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Cpu className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-bold text-slate-100">Algorithmic Solver & Disruption Sandbox</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Heuristically explores possession allocations, co-sharing permutations, and workfront balancing to
            minimize penalty scores while strictly respecting safety buffers.
          </p>
        </div>

        <button
          onClick={handleRunSolver}
          disabled={isSolving}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center space-x-2"
        >
          {isSolving ? (
            <>
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Optimizing...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" />
              <span>Run Heuristic Solver</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Solver Configuration Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <span>Policy & Optimization Settings</span>
          </h3>

          {/* Scenario Selector */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-medium">Active Policy Scenario:</label>
            <div className="grid grid-cols-3 gap-2">
              {(['A', 'B', 'C'] as ScenarioType[]).map((sc) => (
                <button
                  key={sc}
                  onClick={() => setScenario(sc)}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                    scenario === sc
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  Scenario {sc}
                </button>
              ))}
            </div>
          </div>

          {/* Co-sharing toggle */}
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">Enable Co-sharing Grouping</span>
              <input
                type="checkbox"
                checked={coSharing}
                onChange={(e) => setCoSharing(e.target.checked)}
                className="rounded accent-blue-500"
              />
            </label>
            <p className="text-[11px] text-slate-400">
              Groups non-live activities (PC + C) into shared possession slots (b1, b2, etc.) to conserve supply.
            </p>
          </div>

          {/* ECLO toggle (disabled for A) */}
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">
                Allow ECLO (+1.5 Yield)
              </span>
              <input
                type="checkbox"
                disabled={scenario === 'A'}
                checked={scenario !== 'A' && allowEclo}
                onChange={(e) => setAllowEclo(e.target.checked)}
                className="rounded accent-purple-500 disabled:opacity-40"
              />
            </label>
            <p className="text-[11px] text-slate-400">
              {scenario === 'A'
                ? 'Strictly banned in Scenario A by competition rules.'
                : 'Permits 5-hour engineering extensions when needed.'}
            </p>
          </div>

          {/* Disruption Sandbox Section */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span>Simulate Unplanned Outage</span>
              </div>
              {disruptions.length > 0 && (
                <button
                  onClick={handleClearDisruptions}
                  className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div>
                <span className="text-slate-400 text-[11px]">Location:</span>
                <select
                  value={disruptLoc}
                  onChange={(e) => setDisruptLoc(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 text-xs"
                >
                  {dataset.locationSupplies.slice(0, 15).map((s) => (
                    <option key={s.location_id} value={s.location_id}>
                      {s.location_id} (Base Cap: {s.supply_capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 text-[11px]">Week (1-30):</span>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={disruptWeek}
                    onChange={(e) => setDisruptWeek(Number(e.target.value))}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 text-xs"
                  />
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Cap (Nights):</span>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    value={disruptCap}
                    onChange={(e) => setDisruptCap(Number(e.target.value))}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 text-xs"
                  />
                </div>
              </div>

              <button
                onClick={handleAddDisruption}
                className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold rounded border border-amber-500/40 text-xs transition-colors"
              >
                Inject Outage & Constrain Supply
              </button>
            </div>

            {disruptions.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] text-slate-400">Active Injected Disruptions:</span>
                {disruptions.map((d, i) => (
                  <div
                    key={i}
                    className="p-2 rounded bg-amber-950/20 border border-amber-700/40 text-[11px] font-mono text-amber-200"
                  >
                    {d.location_id} • W{d.week} ➔ Cap {d.reduced_capacity} night(s)
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Solver Execution Console Log */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col font-mono shadow-inner">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center space-x-2">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-200">NebulaX Solver Console Output</span>
            </div>
            <span className="text-[10px] text-slate-500">Live Execution Engine</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 text-xs text-slate-300 max-h-[420px] pr-2">
            {logs.map((log, index) => {
              let color = 'text-slate-300';
              if (log.includes('[SUCCESS]')) color = 'text-emerald-400 font-bold';
              else if (log.includes('[Warning]')) color = 'text-amber-400';
              else if (log.includes('[DISRUPTION')) color = 'text-rose-400';
              else if (log.includes('[INIT]')) color = 'text-blue-400';

              return (
                <div key={index} className={`leading-relaxed ${color}`}>
                  <span className="text-slate-600 mr-2">{index + 1}.</span>
                  {log}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
