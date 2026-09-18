import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  FullDataset,
  ScenarioType,
  Activity,
  ContractProject,
} from '../types';
import {
  calculateActivityDurationWeeks,
  calculateActivityEndDate,
} from '../utils/scenarioStateMachine';
import {
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Move,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface FullCalendarScheduleProps {
  dataset: FullDataset;
  scenario: ScenarioType;
  onUpdateActivityDate: (activityId: string, newStartDate: string) => void;
  onResetActivities?: () => void;
}

export interface BreachAnalysis {
  activityId: string;
  contractNumber: string;
  contractDescription: string;
  contractPriority: number;
  oldStartDate: string;
  newStartDate: string;
  newActivityEndDate: string;
  contractPlannedEnd: string;
  contractSimulatedEnd: string;
  isBreached: boolean;
  overrunDays: number;
  priorityPenalty: number;
  timestamp: string;
}

export const FullCalendarSchedule: React.FC<FullCalendarScheduleProps> = ({
  dataset,
  scenario,
  onUpdateActivityDate,
  onResetActivities,
}) => {
  const calendarRef = useRef<HTMLDivElement>(null);
  const calendarInstanceRef = useRef<any>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [lastBreach, setLastBreach] = useState<BreachAnalysis | null>(null);
  const [contractFilter, setContractFilter] = useState<string>('ALL');
  const [calendarLoaded, setCalendarLoaded] = useState<boolean>(false);

  const contractMap = useMemo(() => {
    return new Map<string, ContractProject>(dataset.contracts.map((c) => [c.contract_number, c]));
  }, [dataset.contracts]);

  const activityMap = useMemo(() => {
    return new Map<string, Activity>(dataset.activities.map((a) => [a.activity_id, a]));
  }, [dataset.activities]);

  // Map each activity from the active scenario into the required calendar event object
  const calendarEvents = useMemo(() => {
    return dataset.activities
      .filter((act) => contractFilter === 'ALL' || act.contract_number === contractFilter)
      .map((act) => {
        const contract = contractMap.get(act.contract_number);
        const maxAccessPerWeek = contract ? contract.number_of_maximum_access_per_week : 3;
        const durationWeeks = calculateActivityDurationWeeks(act.total_accesses, maxAccessPerWeek);
        const calculated_finish_date = calculateActivityEndDate(act.planned_start_date, durationWeeks);

        return {
          id: act.activity_id,
          title: `${act.activity_id} (${act.contract_number})`,
          start: act.planned_start_date,
          end: calculated_finish_date,
          color: act.activity_priority === 1 ? '#ff4d4f' : '#1890ff',
          allDay: true,
          extendedProps: {
            activity_id: act.activity_id,
            contract_number: act.contract_number,
            activity_priority: act.activity_priority,
            total_accesses: act.total_accesses,
            planned_start_date: act.planned_start_date,
            calculated_finish_date,
            durationWeeks,
            contract_description: contract?.contract_description,
            planned_completion_date: contract?.planned_completion_date,
            nature_of_activity: contract?.nature_of_activity,
          },
        };
      });
  }, [dataset.activities, dataset.contracts, contractFilter, contractMap]);

  // Function to analyze real-time contract deadline breaches when an activity is moved
  const analyzeBreach = (activityId: string, newStartDate: string): BreachAnalysis => {
    const act = activityMap.get(activityId);
    if (!act) {
      throw new Error(`Activity ${activityId} not found`);
    }

    const contract = contractMap.get(act.contract_number);
    const maxAccess = contract ? contract.number_of_maximum_access_per_week : 3;
    const durationWeeks = calculateActivityDurationWeeks(act.total_accesses, maxAccess);
    const newActivityEndDate = calculateActivityEndDate(newStartDate, durationWeeks);

    // Find all activities for this contract, with the updated one replaced
    const contractActs = dataset.activities.map((a) => {
      if (a.activity_id === activityId) {
        return { ...a, planned_start_date: newStartDate };
      }
      return a;
    }).filter((a) => a.contract_number === act.contract_number);

    let contractSimulatedEnd = newActivityEndDate;
    for (const a of contractActs) {
      const dur = calculateActivityDurationWeeks(a.total_accesses, maxAccess);
      const end = calculateActivityEndDate(a.planned_start_date, dur);
      if (end > contractSimulatedEnd) {
        contractSimulatedEnd = end;
      }
    }

    const plannedEnd = contract ? contract.planned_completion_date : '2027-04-30';
    const isBreached = contractSimulatedEnd > plannedEnd;

    let overrunDays = 0;
    if (isBreached) {
      const diffMs = new Date(contractSimulatedEnd).getTime() - new Date(plannedEnd).getTime();
      overrunDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    const priority = contract ? contract.contract_priority : act.activity_priority;
    const weight = priority === 1 ? 100 : priority === 2 ? 10 : 1;
    const priorityPenalty = overrunDays * weight;

    return {
      activityId,
      contractNumber: act.contract_number,
      contractDescription: contract?.contract_description || '',
      contractPriority: priority,
      oldStartDate: act.planned_start_date,
      newStartDate,
      newActivityEndDate,
      contractPlannedEnd: plannedEnd,
      contractSimulatedEnd,
      isBreached,
      overrunDays,
      priorityPenalty,
      timestamp: new Date().toLocaleTimeString(),
    };
  };

  // Initialize FullCalendar
  useEffect(() => {
    let checkInterval: any = null;

    const initCalendar = () => {
      if (!calendarRef.current) return;
      const FullCalendar = (window as any).FullCalendar;
      if (!FullCalendar) return;

      // Clean up existing instance if any
      if (calendarInstanceRef.current) {
        calendarInstanceRef.current.destroy();
      }

      const calendar = new FullCalendar.Calendar(calendarRef.current, {
        initialView: 'dayGridMonth',
        initialDate: dataset.parameters.horizon_start || '2026-10-01',
        editable: true,
        selectable: true,
        dayMaxEvents: 4,
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek,listMonth',
        },
        events: calendarEvents,
        eventDrop: (info: any) => {
          const activityId = info.event.id;
          const newStart = info.event.startStr ? info.event.startStr.split('T')[0] : '';
          if (activityId && newStart) {
            // Real-time calculation of potential contract deadline breaches
            const breach = analyzeBreach(activityId, newStart);
            setLastBreach(breach);

            // Update underlying dataset state
            onUpdateActivityDate(activityId, newStart);
          }
        },
        eventClick: (info: any) => {
          const act = activityMap.get(info.event.id);
          if (act) {
            setSelectedActivity(act);
          }
        },
      });

      calendar.render();
      calendarInstanceRef.current = calendar;
      setCalendarLoaded(true);
    };

    if ((window as any).FullCalendar) {
      initCalendar();
    } else {
      checkInterval = setInterval(() => {
        if ((window as any).FullCalendar) {
          clearInterval(checkInterval);
          initCalendar();
        }
      }, 50);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (calendarInstanceRef.current) {
        calendarInstanceRef.current.destroy();
        calendarInstanceRef.current = null;
      }
    };
  }, []);

  // Update events when calendarEvents change
  useEffect(() => {
    if (calendarInstanceRef.current) {
      calendarInstanceRef.current.removeAllEvents();
      calendarInstanceRef.current.addEventSource(calendarEvents);
    }
  }, [calendarEvents]);

  const p1Count = dataset.activities.filter((a) => a.activity_priority === 1).length;
  const p2p3Count = dataset.activities.filter((a) => a.activity_priority !== 1).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
      {/* Calendar Header with Controls & Legend */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="h-5 w-5 text-blue-400" />
            <h2 className="text-base font-bold text-slate-100">Dynamic Activity Schedule & Interactive Calendar</h2>
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
              FullCalendar 6.1 • Drag & Drop Enabled
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Interactive schedule for Scenario {scenario}. Drag and drop any activity block to reschedule its start date and view real-time contract deadline breach calculations.
          </p>
        </div>

        {/* Legend and Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-3 text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="h-3 w-3 rounded" style={{ backgroundColor: '#ff4d4f' }}></span>
              <span>Priority 1 ({p1Count})</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="h-3 w-3 rounded" style={{ backgroundColor: '#1890ff' }}></span>
              <span>Priority 2/3 ({p2p3Count})</span>
            </span>
          </div>

          {/* Contract Filter Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={contractFilter}
              onChange={(e) => setContractFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-200 font-mono focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-slate-200">All Contracts (14)</option>
              {dataset.contracts.map((c) => (
                <option key={c.contract_number} value={c.contract_number} className="bg-slate-900 text-slate-200">
                  {c.contract_number} ({c.contract_description.slice(0, 20)}...)
                </option>
              ))}
            </select>
          </div>

          {onResetActivities && (
            <button
              onClick={onResetActivities}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg border border-slate-700 flex items-center gap-1 transition-colors"
              title="Reset activities to initial planned start dates"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-Time Deadline Breach Alert Banner */}
      {lastBreach && (
        <div
          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
            lastBreach.isBreached
              ? 'bg-rose-950/40 border-rose-500/60 text-rose-200'
              : 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-lg ${
                lastBreach.isBreached ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {lastBreach.isBreached ? (
                <ShieldAlert className="h-5 w-5 animate-bounce" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2 text-xs font-bold font-mono">
                <span>
                  Rescheduled {lastBreach.activityId} → {lastBreach.newStartDate} (ends {lastBreach.newActivityEndDate})
                </span>
                <span className="text-slate-400">[{lastBreach.timestamp}]</span>
              </div>
              <p className="text-xs">
                {lastBreach.isBreached ? (
                  <span>
                    <strong className="text-rose-400 font-semibold font-mono">CONTRACT DEADLINE BREACH!</strong>{' '}
                    Contract <strong className="font-mono">{lastBreach.contractNumber}</strong> completion pushed to{' '}
                    <strong className="font-mono">{lastBreach.contractSimulatedEnd}</strong> (Planned:{' '}
                    <strong className="font-mono">{lastBreach.contractPlannedEnd}</strong>) • Overrun:{' '}
                    <strong className="text-rose-300 font-mono font-bold">+{lastBreach.overrunDays} days</strong> • Priority{' '}
                    {lastBreach.contractPriority} Penalty:{' '}
                    <strong className="font-mono font-bold">+{lastBreach.priorityPenalty} pts</strong>
                  </span>
                ) : (
                  <span>
                    <strong className="text-emerald-400 font-semibold font-mono">ON SCHEDULE:</strong> Contract{' '}
                    <strong className="font-mono">{lastBreach.contractNumber}</strong> remains within planned completion date{' '}
                    <strong className="font-mono">{lastBreach.contractPlannedEnd}</strong> (Simulated:{' '}
                    <strong className="font-mono">{lastBreach.contractSimulatedEnd}</strong>, 0d delay).
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-center">
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-slate-900/80 border border-slate-700">
              Contract {lastBreach.contractNumber} (P{lastBreach.contractPriority})
            </span>
            <button
              onClick={() => setLastBreach(null)}
              className="text-xs text-slate-400 hover:text-slate-200 px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* FullCalendar Container */}
      <div className="relative min-h-[560px] bg-slate-950 rounded-xl p-4 border border-slate-800">
        {!calendarLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 rounded-xl z-10">
            <div className="flex items-center space-x-2 text-slate-400 font-mono text-xs">
              <Clock className="h-4 w-4 animate-spin text-blue-400" />
              <span>Initializing FullCalendar 6.1 CDN...</span>
            </div>
          </div>
        )}
        <div ref={calendarRef} id="fullcalendar-dynamic-container" />
      </div>

      {/* Interactive Activity Detail Drawer */}
      {selectedActivity && (
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 animate-in fade-in space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: selectedActivity.activity_priority === 1 ? '#ff4d4f' : '#1890ff' }}
              ></span>
              <h3 className="text-sm font-bold text-slate-100 font-mono">
                Activity {selectedActivity.activity_id} ({selectedActivity.contract_number})
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                selectedActivity.activity_priority === 1 ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'
              }`}>
                Priority {selectedActivity.activity_priority}
              </span>
            </div>
            <button
              onClick={() => setSelectedActivity(null)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              ✕ Close
            </button>
          </div>

          {(() => {
            const contract = contractMap.get(selectedActivity.contract_number);
            const maxAccess = contract ? contract.number_of_maximum_access_per_week : 3;
            const durationWeeks = calculateActivityDurationWeeks(selectedActivity.total_accesses, maxAccess);
            const calculatedEnd = calculateActivityEndDate(selectedActivity.planned_start_date, durationWeeks);
            const isBreach = contract ? calculatedEnd > contract.planned_completion_date : false;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Planned Start:</span>
                  <p className="text-slate-200 font-bold mt-0.5">{selectedActivity.planned_start_date}</p>
                  <span className="text-[10px] text-slate-400">Drag block in calendar to edit</span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Calculated Duration:</span>
                  <p className="text-blue-400 font-bold mt-0.5">{durationWeeks} weeks</p>
                  <span className="text-[10px] text-slate-400">
                    Math.ceil({selectedActivity.total_accesses} / {maxAccess})
                  </span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Calculated Finish:</span>
                  <p className="text-slate-200 font-bold mt-0.5">{calculatedEnd}</p>
                  <span className="text-[10px] text-slate-400">Start + {durationWeeks} wks</span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Contract Planned End:</span>
                  <p className={`font-bold mt-0.5 ${isBreach ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {contract?.planned_completion_date || 'N/A'}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {isBreach ? 'Potential Deadline Overrun' : 'Within Target Deadline'}
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
