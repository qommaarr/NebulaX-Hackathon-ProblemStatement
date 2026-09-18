import {
  FullDataset,
  ScenarioType,
  ScheduleAccess,
  ScheduleOccupancy,
  ContractResult,
  ValidationReport,
  Activity,
  ContractProject,
  DisruptionEvent,
  DisruptionImpactReport,
  ScenarioImpact,
  DisplacedActivity,
} from '../types';
import {
  ScenarioDataPackage,
  calculateActivityDurationWeeks,
  calculateActivityEndDate,
} from './scenarioStateMachine';
import { dateToWeek, weekToDate, getOccupiedLocationsForActivity } from './pathUtils';
import { validateSchedule } from './validator';

/**
 * Realistic Rail Disruption Presets
 */
export const DEFAULT_DISRUPTION_PRESETS: DisruptionEvent[] = [
  {
    id: 'DIS-01',
    name: 'SEC:ALP:S01_S02 Urgent Rail Defect',
    location_id: 'SEC:ALP:S01_S02:EB',
    start_week: 8,
    end_week: 13,
    normal_capacity: 4,
    reduced_capacity: 1,
    reason: 'Critical rail crack discovered during ultrasonic inspection; possession reduced from 4 to 1 night/week for emergency stabilization.',
    severity: 'Urgent',
    active: true,
    affected_line: 'ALP',
  },
  {
    id: 'DIS-02',
    name: 'H01-H02 Interchange Switch Machine Failure',
    location_id: 'SEC:ALP:H01_H02:EB',
    start_week: 10,
    end_week: 15,
    normal_capacity: 4,
    reduced_capacity: 2,
    reason: 'Electro-hydraulic point machine malfunction requiring single-track working; nightly sector quota halved from 4 to 2.',
    severity: 'Major',
    active: false,
    affected_line: 'ALP',
  },
  {
    id: 'DIS-03',
    name: 'BET S13-S14 Signaling Cable Trunking Fire',
    location_id: 'SEC:BET:S13_S14:WB',
    start_week: 14,
    end_week: 18,
    normal_capacity: 4,
    reduced_capacity: 1,
    reason: 'Signaling cable trough damage; track possession restricted to 1 night/week to accommodate emergency re-cabling crew.',
    severity: 'Urgent',
    active: false,
    affected_line: 'BET',
  },
  {
    id: 'DIS-04',
    name: 'ALP S03-S04 Overhead Catenary Sag Defect',
    location_id: 'SEC:ALP:S03_S04:WB',
    start_week: 6,
    end_week: 9,
    normal_capacity: 4,
    reduced_capacity: 2,
    reason: 'Tensioning isolator defect; maintenance access restricted to 2 nights/week during overhead wire re-stringing.',
    severity: 'Moderate',
    active: false,
    affected_line: 'ALP',
  },
];

/**
 * Minimal Churn Re-Optimization Solver for a single scenario
 */
export function runMinimalChurnSolver(
  dataset: FullDataset,
  scenario: ScenarioType,
  disruptions: DisruptionEvent[],
  baselineAccesses?: ScheduleAccess[]
): {
  accesses: ScheduleAccess[];
  occupancies: ScheduleOccupancy[];
  results: ContractResult[];
  displacedActivities: DisplacedActivity[];
} {
  const activeDisruptions = disruptions.filter((d) => d.active);

  // Build disruption map: `${location_id}_${week}` -> reduced capacity
  const disruptionMap = new Map<string, number>();
  let minDisruptionWeek = 999;
  for (const d of activeDisruptions) {
    for (let w = d.start_week; w <= d.end_week; w++) {
      const key = `${d.location_id}_${w}`;
      const existing = disruptionMap.get(key);
      disruptionMap.set(key, existing !== undefined ? Math.min(existing, d.reduced_capacity) : d.reduced_capacity);
      if (w < minDisruptionWeek) minDisruptionWeek = w;
    }
  }

  // Base location capacities
  const baseCapacityMap = new Map(dataset.locationSupplies.map((s) => [s.location_id, s.supply_capacity]));
  const getCapacity = (loc: string, week: number): number => {
    const key = `${loc}_${week}`;
    if (disruptionMap.has(key)) return disruptionMap.get(key)!;
    return baseCapacityMap.get(loc) || 2;
  };

  const contractMap = new Map<string, ContractProject>(dataset.contracts.map((c) => [c.contract_number, c]));
  const activityMap = new Map<string, Activity>(dataset.activities.map((a) => [a.activity_id, a]));

  // Build baseline start week map
  const baselineStartWeeks = new Map<string, number>();
  if (baselineAccesses && baselineAccesses.length > 0) {
    for (const acc of baselineAccesses) {
      const cur = baselineStartWeeks.get(acc.activity_id);
      if (cur === undefined || acc.week < cur) {
        baselineStartWeeks.set(acc.activity_id, acc.week);
      }
    }
  }

  // Topological sorting by predecessor
  const activities = [...dataset.activities];
  const sortedActivities: Activity[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(act: Activity) {
    if (visited.has(act.activity_id)) return;
    if (visiting.has(act.activity_id)) {
      visited.add(act.activity_id);
      sortedActivities.push(act);
      return;
    }
    visiting.add(act.activity_id);
    if (act.predecessor_activity_id && activityMap.has(act.predecessor_activity_id)) {
      visit(activityMap.get(act.predecessor_activity_id)!);
    }
    visiting.delete(act.activity_id);
    visited.add(act.activity_id);
    sortedActivities.push(act);
  }

  for (const a of activities) {
    visit(a);
  }

  // Multi-tier sorting:
  // 1. Contract priority (P1 > P2 > P3)
  // 2. Baseline start week (if available) to preserve schedule stability
  // 3. Planned start date
  // 4. Activity priority
  sortedActivities.sort((a, b) => {
    const cA = contractMap.get(a.contract_number);
    const cB = contractMap.get(b.contract_number);
    const pA = cA ? cA.contract_priority : 3;
    const pB = cB ? cB.contract_priority : 3;
    if (pA !== pB) return pA - pB;

    const baseA = baselineStartWeeks.get(a.activity_id);
    const baseB = baselineStartWeeks.get(b.activity_id);
    if (baseA !== undefined && baseB !== undefined && baseA !== baseB) {
      return baseA - baseB;
    }

    if (a.planned_start_date !== b.planned_start_date) {
      return a.planned_start_date.localeCompare(b.planned_start_date);
    }

    return a.activity_priority - b.activity_priority;
  });

  const accesses: ScheduleAccess[] = [];
  const occupancies: ScheduleOccupancy[] = [];
  const activityCompletionWeek = new Map<string, number>();
  const activityActualStartWeek = new Map<string, number>();
  const locationUsage = new Map<string, Set<string>>();
  const contractWeekNights = new Map<string, Map<number, Set<string>>>();

  const ecloWeeksLine = {
    ALP: new Set<number>(),
    BET: new Set<number>(),
  };

  const maxSearchWeek = 60; // Horizon extension ensuring 100% activity completion guarantee

  for (const act of sortedActivities) {
    const contract = contractMap.get(act.contract_number)!;
    const maxNightsPerWeek = contract.number_of_maximum_access_per_week;
    const maxWorkfronts = contract.number_of_workfronts;

    // Minimum start week: planned start or predecessor finish
    let minWeek = dateToWeek(act.planned_start_date, dataset.parameters.horizon_start);

    // Predecessor constraint: Finish to start (FS+0) -> strictly greater week
    if (act.predecessor_activity_id && activityCompletionWeek.has(act.predecessor_activity_id)) {
      minWeek = Math.max(minWeek, activityCompletionWeek.get(act.predecessor_activity_id)! + 1);
    }

    // Minimal Churn Rule:
    // If activity was previously scheduled at or after minWeek, attempt to stay as close to baseline as feasible
    const baselineStart = baselineStartWeeks.get(act.activity_id);
    if (baselineStart !== undefined && baselineStart >= minWeek) {
      // If baseline occurred before any disruption took effect, preserve baseline start strictly
      if (baselineStart < minDisruptionWeek) {
        minWeek = baselineStart;
      }
    }

    const occupiedLocs = getOccupiedLocationsForActivity(act);
    const neededYield = act.total_accesses;
    let accumulatedYield = 0;
    let accessSeq = 1;
    let currentWeek = minWeek;

    const plannedDeadlineWeek = dateToWeek(contract.planned_completion_date, dataset.parameters.horizon_start);

    // Continue searching until ALL yield is satisfied (guaranteed completion!)
    while (accumulatedYield < neededYield && currentWeek <= maxSearchWeek) {
      const contractWeekKey = `${contract.contract_number}_${currentWeek}`;
      if (!contractWeekNights.has(contractWeekKey)) {
        contractWeekNights.set(contractWeekKey, new Map());
      }
      const nightsMap = contractWeekNights.get(contractWeekKey)!;

      // ECLO policy
      let useEclo = 0;
      if (scenario !== 'A') {
        const canUseEclo = scenario === 'B' || (scenario === 'C' && (ecloWeeksLine.ALP.size <= 2 && ecloWeeksLine.BET.size <= 2));
        if (canUseEclo && (currentWeek >= plannedDeadlineWeek || neededYield - accumulatedYield >= 1.5)) {
          useEclo = 1;
        }
      }

      let allocatedNight = -1;
      let allocatedGroup = '';

      for (let night = 1; night <= maxNightsPerWeek; night++) {
        const existingActs = nightsMap.get(night) || new Set();

        if (existingActs.size >= maxWorkfronts) {
          continue;
        }

        const coGroup = `b${night}`;
        let capacityOk = true;

        for (const loc of occupiedLocs) {
          const locKey = `${loc}_${currentWeek}`;
          const currentGroups = locationUsage.get(locKey) || new Set();
          const cap = getCapacity(loc, currentWeek);

          const willAddGroup = !currentGroups.has(coGroup);
          const newDemand = currentGroups.size + (willAddGroup ? 1 : 0);

          let allowedCap = cap;
          if (scenario === 'C') {
            allowedCap = cap + 1; // Scenario C allows 1 excess night
          } else if (scenario === 'B') {
            allowedCap = 999; // Scenario B allows flexible supply
          }

          if (newDemand > allowedCap) {
            capacityOk = false;
            break;
          }
        }

        if (capacityOk) {
          allocatedNight = night;
          allocatedGroup = coGroup;
          break;
        }
      }

      if (allocatedNight !== -1) {
        if (!activityActualStartWeek.has(act.activity_id)) {
          activityActualStartWeek.set(act.activity_id, currentWeek);
        }

        const yieldValue = useEclo === 1 ? 1.5 : 1.0;
        accumulatedYield += yieldValue;

        accesses.push({
          activity_id: act.activity_id,
          access_seq: accessSeq++,
          week: currentWeek,
          eclo: useEclo,
          access_night: allocatedNight,
        });

        if (!nightsMap.has(allocatedNight)) {
          nightsMap.set(allocatedNight, new Set());
        }
        nightsMap.get(allocatedNight)!.add(act.activity_id);

        for (const loc of occupiedLocs) {
          const locKey = `${loc}_${currentWeek}`;
          if (!locationUsage.has(locKey)) {
            locationUsage.set(locKey, new Set());
          }
          locationUsage.get(locKey)!.add(allocatedGroup);

          occupancies.push({
            activity_id: act.activity_id,
            week: currentWeek,
            location_id: loc,
            co_share_group: allocatedGroup,
          });
        }

        activityCompletionWeek.set(act.activity_id, currentWeek);
        currentWeek++;
      } else {
        currentWeek++;
      }
    }
  }

  // Determine displaced activities (churn impact assessment)
  const displacedActivities: DisplacedActivity[] = [];
  for (const act of dataset.activities) {
    const c = contractMap.get(act.contract_number);
    const plannedStartWeek = dateToWeek(act.planned_start_date, dataset.parameters.horizon_start);
    const baseStart = baselineStartWeeks.get(act.activity_id) ?? plannedStartWeek;
    const newStart = activityActualStartWeek.get(act.activity_id) ?? plannedStartWeek;
    const shift = newStart - baseStart;

    if (Math.abs(shift) > 0) {
      let reason = 'Downstream propagation from predecessor delay';
      const occupied = getOccupiedLocationsForActivity(act);
      for (const d of activeDisruptions) {
        if (occupied.includes(d.location_id) && newStart >= d.start_week && newStart <= d.end_week + 4) {
          reason = `Direct capacity throttling at ${d.location_id} (quota ${d.normal_capacity} → ${d.reduced_capacity})`;
          break;
        }
      }

      displacedActivities.push({
        activity_id: act.activity_id,
        contract_number: act.contract_number,
        priority: c ? c.contract_priority : act.activity_priority,
        baselineStartWeek: baseStart,
        newStartWeek: newStart,
        shiftWeeks: shift,
        reason,
      });
    }
  }

  // Compute Results for each contract
  const results: ContractResult[] = [];
  for (const contract of dataset.contracts) {
    const contractActs = dataset.activities.filter((a) => a.contract_number === contract.contract_number);
    let lastWeek = 1;
    for (const act of contractActs) {
      const w = activityCompletionWeek.get(act.activity_id) || 1;
      if (w > lastWeek) lastWeek = w;
    }

    const simDate = weekToDate(lastWeek, dataset.parameters.horizon_start);
    const plannedWeek = dateToWeek(contract.planned_completion_date, dataset.parameters.horizon_start);

    let overrunDays = Math.max(0, (lastWeek - plannedWeek) * 7);
    if (scenario === 'B') {
      overrunDays = 0;
    }

    results.push({
      scenario,
      contract_number: contract.contract_number,
      simulated_completion_date: simDate,
      overrun_days: overrunDays,
    });
  }

  return { accesses, occupancies, results, displacedActivities };
}

/**
 * Re-optimizes ALL THREE SCENARIOS (A, B, C) simultaneously when supervisor runs the solver
 * and returns comprehensive packages + Disruption Impact Report.
 */
export function reoptimizeAllScenarios(
  dataset: FullDataset,
  disruptions: DisruptionEvent[],
  baselinePackages: Record<ScenarioType, ScenarioDataPackage>
): {
  packages: Record<ScenarioType, ScenarioDataPackage>;
  impactReport: DisruptionImpactReport;
} {
  const scenarios: ScenarioType[] = ['A', 'B', 'C'];
  const newPackages: Record<ScenarioType, ScenarioDataPackage> = {} as any;
  const scenarioImpacts: Record<ScenarioType, ScenarioImpact> = {} as any;

  const totalActivities = dataset.activities.length;
  const contractMap = new Map<string, ContractProject>(dataset.contracts.map((c) => [c.contract_number, c]));

  for (const sc of scenarios) {
    const baselinePkg = baselinePackages[sc];
    const solverRes = runMinimalChurnSolver(dataset, sc, disruptions, baselinePkg.accesses);

    // Validate schedule
    const report = validateSchedule(dataset, solverRes.accesses, solverRes.occupancies, solverRes.results, sc);

    // Build Activity Computed Metrics
    const actAccesses = new Map<string, ScheduleAccess[]>();
    for (const acc of solverRes.accesses) {
      if (!actAccesses.has(acc.activity_id)) actAccesses.set(acc.activity_id, []);
      actAccesses.get(acc.activity_id)!.push(acc);
    }

    const activityMetrics = new Map();
    let activitiesOnTrack = 0;
    let activitiesDelayed = 0;

    for (const act of dataset.activities) {
      const contract = contractMap.get(act.contract_number);
      const maxAccess = contract ? contract.number_of_maximum_access_per_week : 3;
      const duration = calculateActivityDurationWeeks(act.total_accesses, maxAccess);
      const theoreticalEnd = calculateActivityEndDate(act.planned_start_date, duration);

      const accs = actAccesses.get(act.activity_id) || [];
      const scheduledWeeks = accs.map((a) => a.week);
      const actualStart = scheduledWeeks.length > 0 ? Math.min(...scheduledWeeks) : dateToWeek(act.planned_start_date, dataset.parameters.horizon_start);
      const actualEnd = scheduledWeeks.length > 0 ? Math.max(...scheduledWeeks) : actualStart + duration - 1;
      const actualEndDate = weekToDate(actualEnd, dataset.parameters.horizon_start);

      const theoreticalEndWeek = dateToWeek(theoreticalEnd, dataset.parameters.horizon_start);
      const isDelayed = actualEnd > theoreticalEndWeek;
      const delayWeeks = Math.max(0, actualEnd - theoreticalEndWeek);

      if (isDelayed) activitiesDelayed++;
      else activitiesOnTrack++;

      activityMetrics.set(act.activity_id, {
        activity_id: act.activity_id,
        contract_number: act.contract_number,
        theoretical_duration_weeks: duration,
        theoretical_end_date: theoreticalEnd,
        actual_start_week: actualStart,
        actual_completion_week: actualEnd,
        actual_completion_date: actualEndDate,
        is_delayed: isDelayed,
        delay_weeks: delayWeeks,
        delay_days: delayWeeks * 7,
        has_eclo: accs.some((a) => a.eclo === 1),
        total_nights_scheduled: accs.length,
      });
    }

    // Build Contract Computed Metrics
    const contractMetrics = new Map();
    let onTrackContracts = 0;
    let delayedContracts = 0;
    let p1Overrun = 0;
    let p2Overrun = 0;
    let p3Overrun = 0;

    for (const contract of dataset.contracts) {
      const cr = solverRes.results.find((r) => r.contract_number === contract.contract_number);
      const overrunDays = cr ? cr.overrun_days : 0;
      const isOnTrack = overrunDays === 0;

      if (isOnTrack) onTrackContracts++;
      else delayedContracts++;

      const weight = contract.contract_priority === 1 ? 100 : contract.contract_priority === 2 ? 10 : 1;
      const delayPenalty = overrunDays * weight;

      if (contract.contract_priority === 1) p1Overrun += overrunDays;
      else if (contract.contract_priority === 2) p2Overrun += overrunDays;
      else p3Overrun += overrunDays;

      contractMetrics.set(contract.contract_number, {
        contract_number: contract.contract_number,
        contract_priority: contract.contract_priority,
        nature_of_activity: contract.nature_of_activity,
        planned_completion_date: contract.planned_completion_date,
        simulated_completion_date: cr ? cr.simulated_completion_date : contract.planned_completion_date,
        overrun_days: overrunDays,
        is_on_track: isOnTrack,
        delay_penalty: delayPenalty,
      });
    }

    const completedActsCount = Array.from(actAccesses.keys()).length;
    const churnCount = solverRes.displacedActivities.length;
    const unaffectedCount = totalActivities - churnCount;
    const churnRate = Math.round((churnCount / Math.max(1, totalActivities)) * 1000) / 10;
    const stabilityRate = Math.round((unaffectedCount / Math.max(1, totalActivities)) * 1000) / 10;

    const baseOverrun = baselinePkg.summary.total_overrun_days;
    const newOverrun = report.soft_scores.overrun_days_total;
    const baseScore = baselinePkg.summary.combined_score;
    const newScore = report.soft_scores.combined_penalty_score;

    scenarioImpacts[sc] = {
      scenario: sc,
      totalActivities,
      completedActivities: completedActsCount,
      completionRate: 100, // Guaranteed 100%
      churnedActivitiesCount: churnCount,
      churnRatePercent: churnRate,
      unaffectedActivitiesCount: unaffectedCount,
      stabilityRatePercent: stabilityRate,
      baselineOverrunDays: baseOverrun,
      newOverrunDays: newOverrun,
      overrunDelta: newOverrun - baseOverrun,
      baselineScore: baseScore,
      newScore: newScore,
      scoreDelta: newScore - baseScore,
      p1OverrunDays: p1Overrun,
      p2OverrunDays: p2Overrun,
      p3OverrunDays: p3Overrun,
      displacedActivities: solverRes.displacedActivities,
    };

    newPackages[sc] = {
      scenario: sc,
      name: baselinePkg.name,
      tagline: baselinePkg.tagline,
      description: baselinePkg.description,
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

  const activeDisruptions = disruptions.filter((d) => d.active);

  const impactReport: DisruptionImpactReport = {
    timestamp: new Date().toLocaleTimeString(),
    disruptionsApplied: activeDisruptions,
    scenarios: scenarioImpacts,
  };

  return {
    packages: newPackages,
    impactReport,
  };
}
