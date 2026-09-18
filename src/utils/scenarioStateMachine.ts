import {
  FullDataset,
  ScenarioType,
  ScheduleAccess,
  ScheduleOccupancy,
  ContractResult,
  ValidationReport,
  Activity,
  ContractProject,
} from '../types';
import { DEFAULT_DATASET } from '../data/defaultData';
import { runOptimizationSolver } from './scheduler';
import { validateSchedule } from './validator';
import { dateToWeek, weekToDate } from './pathUtils';

/**
 * Strict mathematical rules requested by user:
 * 1. Duration = Math.ceil(total_accesses / number_of_maximum_access_per_week)
 * 2. End Date = Start Date + Duration (in weeks)
 */
export function calculateActivityDurationWeeks(totalAccesses: number, maxAccessPerWeek: number): number {
  return Math.ceil(totalAccesses / Math.max(1, maxAccessPerWeek));
}

export function calculateActivityEndDate(startDateStr: string, durationWeeks: number): string {
  const [year, month, day] = startDateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + durationWeeks * 7);
  return date.toISOString().split('T')[0];
}

export interface ActivityComputedMetrics {
  activity_id: string;
  contract_number: string;
  theoretical_duration_weeks: number;
  theoretical_end_date: string;
  actual_start_week: number;
  actual_completion_week: number;
  actual_completion_date: string;
  is_delayed: boolean;
  delay_weeks: number;
  delay_days: number;
  has_eclo: boolean;
  total_nights_scheduled: number;
}

export interface ContractComputedMetrics {
  contract_number: string;
  contract_priority: number;
  nature_of_activity: string;
  planned_completion_date: string;
  simulated_completion_date: string;
  overrun_days: number;
  is_on_track: boolean;
  delay_penalty: number;
}

export interface ScenarioDataPackage {
  scenario: ScenarioType;
  name: string;
  tagline: string;
  description: string;
  accesses: ScheduleAccess[];
  occupancies: ScheduleOccupancy[];
  results: ContractResult[];
  validationReport: ValidationReport;
  activityMetrics: Map<string, ActivityComputedMetrics>;
  contractMetrics: Map<string, ContractComputedMetrics>;
  summary: {
    feasible: boolean;
    combined_score: number;
    total_overrun_days: number;
    p1_overrun_days: number;
    p2_overrun_days: number;
    p3_overrun_days: number;
    eclo_nights: number;
    excess_supply_nights: number;
    on_track_contracts: number;
    delayed_contracts: number;
    total_activities_scheduled: number;
    activities_on_track: number;
    activities_delayed: number;
  };
}

export interface ScenarioStateMachineState {
  activeScenario: ScenarioType;
  hoveredScenario: ScenarioType | null;
  effectiveScenario: ScenarioType;
  isPreviewing: boolean;
  packages: Record<ScenarioType, ScenarioDataPackage>;
}

export type ScenarioStateMachineEvent =
  | { type: 'SELECT_SCENARIO'; scenario: ScenarioType }
  | { type: 'HOVER_SCENARIO'; scenario: ScenarioType | null }
  | { type: 'TOGGLE_SCENARIO' };

/**
 * Builds computed packages for Scenarios A, B, and C using strict mathematical rules
 * and the optimization solver with default dataset.
 */
export function buildScenarioPackage(
  dataset: FullDataset,
  scenario: ScenarioType
): ScenarioDataPackage {
  // Solver configurations per scenario definition
  const solverRes = runOptimizationSolver(dataset, {
    scenario,
    coSharingEnabled: true,
    allowEclo: scenario !== 'A',
    maxExcessPerLocation: scenario === 'A' ? 0 : scenario === 'B' ? 999 : 1,
  });

  const report = validateSchedule(
    dataset,
    solverRes.accesses,
    solverRes.occupancies,
    solverRes.results,
    scenario
  );

  const contractMap = new Map<string, ContractProject>(dataset.contracts.map((c) => [c.contract_number, c]));
  const activityMap = new Map<string, Activity>(dataset.activities.map((a) => [a.activity_id, a]));

  // Track access min and max weeks per activity
  const actAccesses = new Map<string, ScheduleAccess[]>();
  for (const acc of solverRes.accesses) {
    if (!actAccesses.has(acc.activity_id)) {
      actAccesses.set(acc.activity_id, []);
    }
    actAccesses.get(acc.activity_id)!.push(acc);
  }

  // Compute Activity Metrics
  const activityMetrics = new Map<string, ActivityComputedMetrics>();
  let activitiesOnTrack = 0;
  let activitiesDelayed = 0;

  for (const act of dataset.activities) {
    const contract = contractMap.get(act.contract_number)!;
    const duration = calculateActivityDurationWeeks(act.total_accesses, contract.number_of_maximum_access_per_week);
    const theoreticalEnd = calculateActivityEndDate(act.planned_start_date, duration);

    const scheduled = actAccesses.get(act.activity_id) || [];
    const weeks = scheduled.map((s) => s.week);
    const actualStartWeek = weeks.length > 0 ? Math.min(...weeks) : dateToWeek(act.planned_start_date, dataset.parameters.horizon_start);
    const actualCompletionWeek = weeks.length > 0 ? Math.max(...weeks) : actualStartWeek + duration - 1;
    const actualCompletionDate = weekToDate(actualCompletionWeek, dataset.parameters.horizon_start);

    const theoreticalEndWeek = dateToWeek(theoreticalEnd, dataset.parameters.horizon_start);
    const isDelayed = actualCompletionWeek > theoreticalEndWeek;
    const delayWeeks = Math.max(0, actualCompletionWeek - theoreticalEndWeek);
    const delayDays = delayWeeks * 7;

    if (isDelayed) {
      activitiesDelayed++;
    } else {
      activitiesOnTrack++;
    }

    const hasEclo = scheduled.some((s) => s.eclo === 1);

    activityMetrics.set(act.activity_id, {
      activity_id: act.activity_id,
      contract_number: act.contract_number,
      theoretical_duration_weeks: duration,
      theoretical_end_date: theoreticalEnd,
      actual_start_week: actualStartWeek,
      actual_completion_week: actualCompletionWeek,
      actual_completion_date: actualCompletionDate,
      is_delayed: isDelayed,
      delay_weeks: delayWeeks,
      delay_days: delayDays,
      has_eclo: hasEclo,
      total_nights_scheduled: scheduled.length,
    });
  }

  // Compute Contract Metrics
  const contractMetrics = new Map<string, ContractComputedMetrics>();
  let onTrackContracts = 0;
  let delayedContracts = 0;
  let p1Overrun = 0;
  let p2Overrun = 0;
  let p3Overrun = 0;

  for (const res of solverRes.results) {
    const contract = contractMap.get(res.contract_number)!;
    const isOnTrack = res.overrun_days === 0;
    if (isOnTrack) {
      onTrackContracts++;
    } else {
      delayedContracts++;
    }

    const weight = contract.contract_priority === 1 ? 100 : contract.contract_priority === 2 ? 10 : 1;
    const penalty = res.overrun_days * weight;

    if (contract.contract_priority === 1) p1Overrun += res.overrun_days;
    if (contract.contract_priority === 2) p2Overrun += res.overrun_days;
    if (contract.contract_priority === 3) p3Overrun += res.overrun_days;

    contractMetrics.set(res.contract_number, {
      contract_number: res.contract_number,
      contract_priority: contract.contract_priority,
      nature_of_activity: contract.nature_of_activity,
      planned_completion_date: contract.planned_completion_date,
      simulated_completion_date: res.simulated_completion_date,
      overrun_days: res.overrun_days,
      is_on_track: isOnTrack,
      delay_penalty: penalty,
    });
  }

  const metaMap: Record<ScenarioType, { name: string; tagline: string; description: string }> = {
    A: {
      name: 'Scenario A',
      tagline: 'Strict Supply • Delay Penalties',
      description: 'Zero excess supply or ECLO allowed. Delays are permitted but penalized by priority tier (P1: 100×, P2: 10×, P3: 1×).',
    },
    B: {
      name: 'Scenario B',
      tagline: 'Strict Schedule (0d Delay) • Flexible Supply',
      description: 'Zero contract overrun permitted. Flexible supply nights allowed; ECLO (+1.5h) allowed with commuter disruption costs.',
    },
    C: {
      name: 'Scenario C',
      tagline: 'Balanced Trade-off • Elastic Capacity',
      description: 'Balanced multi-objective trade-off. Max 1 excess night per location-week with contiguous 2-week ECLO windows.',
    },
  };

  return {
    scenario,
    name: metaMap[scenario].name,
    tagline: metaMap[scenario].tagline,
    description: metaMap[scenario].description,
    accesses: solverRes.accesses,
    occupancies: solverRes.occupancies,
    results: solverRes.results,
    validationReport: report,
    activityMetrics,
    contractMetrics,
    summary: {
      feasible: report.feasible,
      combined_score: report.soft_scores.combined_penalty_score,
      total_overrun_days: report.soft_scores.overrun_days_total,
      p1_overrun_days: p1Overrun,
      p2_overrun_days: p2Overrun,
      p3_overrun_days: p3Overrun,
      eclo_nights: report.soft_scores.eclo_nights_total,
      excess_supply_nights: report.soft_scores.excess_access_nights_total,
      on_track_contracts: onTrackContracts,
      delayed_contracts: delayedContracts,
      total_activities_scheduled: report.detail.total_activities_scheduled,
      activities_on_track: activitiesOnTrack,
      activities_delayed: activitiesDelayed,
    },
  };
}

/**
 * State machine transition reducer
 */
export function scenarioStateMachineReducer(
  state: ScenarioStateMachineState,
  event: ScenarioStateMachineEvent
): ScenarioStateMachineState {
  switch (event.type) {
    case 'SELECT_SCENARIO': {
      return {
        ...state,
        activeScenario: event.scenario,
        hoveredScenario: null,
        effectiveScenario: event.scenario,
        isPreviewing: false,
      };
    }
    case 'HOVER_SCENARIO': {
      const nextEffective = event.scenario || state.activeScenario;
      return {
        ...state,
        hoveredScenario: event.scenario,
        effectiveScenario: nextEffective,
        isPreviewing: event.scenario !== null && event.scenario !== state.activeScenario,
      };
    }
    case 'TOGGLE_SCENARIO': {
      const order: ScenarioType[] = ['A', 'B', 'C'];
      const nextIdx = (order.indexOf(state.activeScenario) + 1) % order.length;
      const nextScenario = order[nextIdx];
      return {
        ...state,
        activeScenario: nextScenario,
        hoveredScenario: null,
        effectiveScenario: nextScenario,
        isPreviewing: false,
      };
    }
    default:
      return state;
  }
}

/**
 * Creates initial state with pre-computed scenario packages
 */
export function createInitialScenarioStateMachine(dataset: FullDataset = DEFAULT_DATASET): ScenarioStateMachineState {
  const packageA = buildScenarioPackage(dataset, 'A');
  const packageB = buildScenarioPackage(dataset, 'B');
  const packageC = buildScenarioPackage(dataset, 'C');

  return {
    activeScenario: 'A',
    hoveredScenario: null,
    effectiveScenario: 'A',
    isPreviewing: false,
    packages: {
      A: packageA,
      B: packageB,
      C: packageC,
    },
  };
}
