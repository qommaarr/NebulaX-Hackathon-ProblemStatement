import React, { useState } from 'react';
import {
  FullDataset,
  ScheduleAccess,
  ContractProject,
  Activity,
  ScenarioType,
} from '../types';
import {
  Search,
  Filter,
  Calendar,
  Zap,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { dateToWeek, weekToDate } from '../utils/pathUtils';
import {
  calculateActivityDurationWeeks,
  calculateActivityEndDate,
} from '../utils/scenarioStateMachine';

interface ScheduleGanttProps {
  dataset: FullDataset;
  accesses: ScheduleAccess[];
  scenario?: ScenarioType;
}

export const ScheduleGantt: React.FC<ScheduleGanttProps> = ({ dataset, accesses, scenario = 'A' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContract, setSelectedContract] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedNature, setSelectedNature] = useState<string>('ALL');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const contractMap = new Map<string, ContractProject>(dataset.contracts.map((c) => [c.contract_number, c]));

  // Map of activityId -> Accesses
  const activityAccesses = new Map<string, ScheduleAccess[]>();
  for (const acc of accesses) {
    if (!activityAccesses.has(acc.activity_id)) {
      activityAccesses.set(acc.activity_id, []);
    }
    activityAccesses.get(acc.activity_id)!.push(acc);
  }

  // Filter activities
  const filteredActivities = dataset.activities.filter((act) => {
    const contract = contractMap.get(act.contract_number);
    if (!contract) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesId = act.activity_id.toLowerCase().includes(q);
      const matchesDesc = (contract.contract_description || act.activity_type).toLowerCase().includes(q);
      const matchesContract = contract.contract_number.toLowerCase().includes(q);
      if (!matchesId && !matchesDesc && !matchesContract) return false;
    }

    if (selectedContract !== 'ALL' && act.contract_number !== selectedContract) return false;
    if (selectedPriority !== 'ALL' && String(contract.contract_priority) !== selectedPriority) return false;
    if (selectedNature !== 'ALL' && contract.nature_of_activity !== selectedNature) return false;

    return true;
  });

  const weeks = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search activity, contract, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        {/* Contract filter */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">Contract:</span>
          <select
            value={selectedContract}
            onChange={(e) => setSelectedContract(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none font-mono"
          >
            <option value="ALL">All Contracts (14)</option>
            {dataset.contracts.map((c) => (
              <option key={c.contract_number} value={c.contract_number}>
                {c.contract_number} (P{c.contract_priority})
              </option>
            ))}
          </select>
        </div>

        {/* Priority filter */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">Tier:</span>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none font-mono"
          >
            <option value="ALL">All Tiers</option>
            <option value="1">Priority 1 (Critical)</option>
            <option value="2">Priority 2 (High)</option>
            <option value="3">Priority 3 (Routine)</option>
          </select>
        </div>

        {/* Nature filter */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">Nature:</span>
          <select
            value={selectedNature}
            onChange={(e) => setSelectedNature(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none font-mono"
          >
            <option value="ALL">All Natures</option>
            <option value="Live">Live (750V)</option>
            <option value="Non-live (Consist)">Non-live (Consist)</option>
            <option value="Non-live (Others)">Non-live (Others)</option>
          </select>
        </div>
      </div>

      {/* Main Gantt Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              Track Access Gantt Matrix ({filteredActivities.length} activities shown)
            </h3>
          </div>
          <div className="flex items-center space-x-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded bg-blue-500"></span> Standard Night
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded bg-purple-500"></span> ECLO Night (1.5x)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-3 bg-amber-400"></span> Planned Start
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs font-mono">
            {/* Table Header: Weeks 1-30 */}
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <th className="py-2 px-3 text-left sticky left-0 bg-slate-950 z-20 min-w-[220px] border-r border-slate-800">
                  Activity / Contract
                </th>
                <th className="py-2 px-2 text-center min-w-[45px] border-r border-slate-800 text-[10px]">
                  Req.
                </th>
                <th className="py-2 px-2 text-center min-w-[130px] border-r border-slate-800 text-[10px]">
                  Calc Duration & End
                </th>
                <th className="py-2 px-2 text-center min-w-[80px] border-r border-slate-800 text-[10px]">
                  Status
                </th>
                {weeks.map((w) => (
                  <th
                    key={w}
                    className="py-2 px-1 text-center min-w-[34px] border-r border-slate-800/40 text-[11px] font-semibold"
                  >
                    W{w}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800/50">
              {filteredActivities.map((act) => {
                const contract = contractMap.get(act.contract_number);
                const accList = activityAccesses.get(act.activity_id) || [];
                const plannedStartWeek = dateToWeek(act.planned_start_date, dataset.parameters.horizon_start);

                // Exact mathematical rules:
                // Duration = Math.ceil(total_accesses / number_of_maximum_access_per_week)
                // End Date = Start Date + Duration (in weeks)
                const maxNightsPerWeek = contract ? contract.number_of_maximum_access_per_week : 3;
                const durationWeeks = calculateActivityDurationWeeks(act.total_accesses, maxNightsPerWeek);
                const theoreticalEndDate = calculateActivityEndDate(act.planned_start_date, durationWeeks);
                const theoreticalEndWeek = dateToWeek(theoreticalEndDate, dataset.parameters.horizon_start);

                // Actual scheduled completion
                const scheduledWeeks = accList.map((a) => a.week);
                const actualEndWeek = scheduledWeeks.length > 0 ? Math.max(...scheduledWeeks) : plannedStartWeek + durationWeeks - 1;
                const isDelayed = actualEndWeek > theoreticalEndWeek;
                const delayWeeks = Math.max(0, actualEndWeek - theoreticalEndWeek);

                // Map of week -> access
                const weekMap = new Map<number, ScheduleAccess>();
                for (const a of accList) {
                  weekMap.set(a.week, a);
                }

                return (
                  <tr
                    key={act.activity_id}
                    onClick={() => setSelectedActivity(act)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    {/* Activity Column (Sticky Left) */}
                    <td className="py-2 px-3 sticky left-0 bg-slate-900/95 hover:bg-slate-800/90 z-10 border-r border-slate-800">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-100">{act.activity_id}</span>
                        <span
                          className={`text-[9px] px-1 rounded font-sans ${
                            contract?.contract_priority === 1
                              ? 'bg-rose-500/20 text-rose-300'
                              : contract?.contract_priority === 2
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {act.contract_number}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate max-w-[200px] font-sans">
                        {contract?.contract_description || act.activity_type}
                      </p>
                    </td>

                    {/* Required Accesses */}
                    <td className="py-2 px-2 text-center text-slate-300 border-r border-slate-800 font-bold">
                      {act.total_accesses}
                    </td>

                    {/* Calculated Theoretical Duration & End */}
                    <td className="py-2 px-2 text-center border-r border-slate-800 font-mono text-[10px] text-slate-300">
                      <div>{durationWeeks} wk{durationWeeks > 1 ? 's' : ''}</div>
                      <div className="text-slate-500 text-[9px]">{theoreticalEndDate}</div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-2 px-2 text-center border-r border-slate-800">
                      {isDelayed ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          <span>+{delayWeeks}w</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          <span>TRACK</span>
                        </span>
                      )}
                    </td>

                    {/* 30 Week Cells */}
                    {weeks.map((w) => {
                      const access = weekMap.get(w);
                      const isPlannedStart = w === plannedStartWeek;

                      let cellBg = '';
                      let cellText = '';
                      if (access) {
                        cellBg = access.eclo === 1 ? 'bg-purple-600 text-white font-bold' : 'bg-blue-600 text-white font-bold';
                        cellText = `N${access.access_night}`;
                      }

                      return (
                        <td
                          key={w}
                          className={`py-1 px-1 text-center border-r border-slate-800/40 relative ${
                            isPlannedStart ? 'border-l-2 border-l-amber-400' : ''
                          }`}
                        >
                          {access ? (
                            <div
                              className={`h-6 w-full rounded flex items-center justify-center text-[10px] shadow-sm ${cellBg}`}
                              title={`Week ${w}: Night ${access.access_night} (${access.eclo === 1 ? 'ECLO' : 'Standard'})`}
                            >
                              {cellText}
                            </div>
                          ) : (
                            <span className="text-slate-800 text-[10px]">•</span>
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

      {/* Activity Details Modal / Bottom Drawer */}
      {selectedActivity && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-mono font-bold">
                {selectedActivity.activity_id}
              </span>
              <div>
                <h4 className="text-sm font-bold text-slate-100">
                  {contractMap.get(selectedActivity.contract_number)?.contract_description || selectedActivity.activity_type}
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Contract {selectedActivity.contract_number} • Priority Tier {selectedActivity.activity_priority}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedActivity(null)}
              className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1 rounded bg-slate-800"
            >
              Close
            </button>
          </div>

          {(() => {
            const contract = contractMap.get(selectedActivity.contract_number);
            const maxPerWeek = contract ? contract.number_of_maximum_access_per_week : 3;
            const duration = calculateActivityDurationWeeks(selectedActivity.total_accesses, maxPerWeek);
            const theoreticalEnd = calculateActivityEndDate(selectedActivity.planned_start_date, duration);
            const accList = activityAccesses.get(selectedActivity.activity_id) || [];
            const weeks = accList.map((a) => a.week);
            const actualEndWeek = weeks.length > 0 ? Math.max(...weeks) : dateToWeek(theoreticalEnd, dataset.parameters.horizon_start);
            const actualEndDate = weekToDate(actualEndWeek, dataset.parameters.horizon_start);
            const theoreticalEndWeek = dateToWeek(theoreticalEnd, dataset.parameters.horizon_start);
            const isDelayed = actualEndWeek > theoreticalEndWeek;
            const delayDays = Math.max(0, actualEndWeek - theoreticalEndWeek) * 7;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Planned Start:</span>
                  <p className="text-slate-200 font-bold mt-0.5">{selectedActivity.planned_start_date}</p>
                  <span className="text-[10px] text-slate-400">
                    Week {dateToWeek(selectedActivity.planned_start_date, dataset.parameters.horizon_start)}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Theoretical Duration:</span>
                  <p className="text-blue-400 font-bold mt-0.5">{duration} weeks</p>
                  <span className="text-[10px] text-slate-400 block truncate" title="Math.ceil(total_accesses / max_per_week)">
                    Math.ceil({selectedActivity.total_accesses} / {maxPerWeek})
                  </span>
                </div>

                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Theoretical End Date:</span>
                  <p className="text-slate-200 font-bold mt-0.5">{theoreticalEnd}</p>
                  <span className="text-[10px] text-slate-400">
                    Start + {duration} wks (W{theoreticalEndWeek})
                  </span>
                </div>

                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Simulated Schedule:</span>
                  <p className={`font-bold mt-0.5 ${isDelayed ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {isDelayed ? `Delayed (+${delayDays}d)` : 'On Track (0d)'}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    Finished {actualEndDate} (W{actualEndWeek})
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
