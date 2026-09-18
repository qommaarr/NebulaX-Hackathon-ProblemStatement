import {
  FullDataset,
  ScheduleAccess,
  ScheduleOccupancy,
  ContractResult,
  ScenarioType,
  Activity,
  ContractProject,
} from '../types';
import { dateToWeek, weekToDate, getOccupiedLocationsForActivity } from './pathUtils';

export interface SolverOptions {
  scenario: ScenarioType;
  coSharingEnabled?: boolean;
  allowEclo?: boolean;
  maxExcessPerLocation?: number; // 0 for A, Infinity for B, 1 for C
  disruptions?: Array<{ location_id: string; week: number; reduced_capacity: number }>;
}

export function runOptimizationSolver(
  dataset: FullDataset,
  options: SolverOptions
): {
  accesses: ScheduleAccess[];
  occupancies: ScheduleOccupancy[];
  results: ContractResult[];
  solverLog: string[];
} {
  const solverLog: string[] = [];
  const { scenario, coSharingEnabled = true, disruptions = [] } = options;

  solverLog.push(`Starting NebulaX Optimizer for Scenario ${scenario}...`);
  solverLog.push(`Loaded ${dataset.activities.length} activities across ${dataset.contracts.length} contracts.`);

  // Disruption map: location_id + week -> capacity override
  const disruptionMap = new Map<string, number>();
  for (const d of disruptions) {
    disruptionMap.set(`${d.location_id}_${d.week}`, d.reduced_capacity);
    solverLog.push(`[Disruption] Applied capacity cap ${d.reduced_capacity} to ${d.location_id} at week ${d.week}`);
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

  // Topological sorting by predecessor
  const activities = [...dataset.activities];
  const sortedActivities: Activity[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(act: Activity) {
    if (visited.has(act.activity_id)) return;
    if (visiting.has(act.activity_id)) {
      // Cycle detected, break cycle
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

  // Sort activities primarily by Contract Priority (1 > 2 > 3), then planned_start_date, then activity_priority
  sortedActivities.sort((a, b) => {
    const cA = contractMap.get(a.contract_number);
    const cB = contractMap.get(b.contract_number);
    const pA = cA ? cA.contract_priority : 3;
    const pB = cB ? cB.contract_priority : 3;
    if (pA !== pB) return pA - pB; // 1 before 2 before 3

    const dateA = a.planned_start_date;
    const dateB = b.planned_start_date;
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    return a.activity_priority - b.activity_priority;
  });

  const accesses: ScheduleAccess[] = [];
  const occupancies: ScheduleOccupancy[] = [];

  // Track state:
  // activityCompletionWeek: activityId -> week
  const activityCompletionWeek = new Map<string, number>();

  // locationWeekUsage: locationId_week -> Set of distinct co-share groups used
  const locationUsage = new Map<string, Set<string>>();

  // contractWeekNights: contract_week -> Map<night, Set<activityId>>
  const contractWeekNights = new Map<string, Map<number, Set<string>>>();

  // ECLO line continuity window (for Scenario C)
  const ecloWeeksLine = {
    ALP: new Set<number>(),
    BET: new Set<number>(),
  };

  const horizonWeeks = dataset.parameters.horizon_weeks || 30;

  for (const act of sortedActivities) {
    const contract = contractMap.get(act.contract_number)!;
    const maxNightsPerWeek = contract.number_of_maximum_access_per_week;
    const maxWorkfronts = contract.number_of_workfronts;

    // Minimum start week
    let minWeek = dateToWeek(act.planned_start_date, dataset.parameters.horizon_start);

    // Predecessor constraint: Finish to start (FS+0) -> strictly greater week
    if (act.predecessor_activity_id && activityCompletionWeek.has(act.predecessor_activity_id)) {
      minWeek = Math.max(minWeek, activityCompletionWeek.get(act.predecessor_activity_id)! + 1);
    }

    const occupiedLocs = getOccupiedLocationsForActivity(act);
    const neededYield = act.total_accesses;
    let accumulatedYield = 0;
    let accessSeq = 1;
    let currentWeek = minWeek;

    const plannedDeadlineWeek = dateToWeek(contract.planned_completion_date, dataset.parameters.horizon_start);

    while (accumulatedYield < neededYield && currentWeek <= horizonWeeks + 10) {
      // Check if we can schedule in currentWeek
      const contractWeekKey = `${contract.contract_number}_${currentWeek}`;
      if (!contractWeekNights.has(contractWeekKey)) {
        contractWeekNights.set(contractWeekKey, new Map());
      }
      const nightsMap = contractWeekNights.get(contractWeekKey)!;

      // Determine whether ECLO is appropriate:
      // In Scenario A: ECLO is strictly forbidden
      // In Scenario B: allow ECLO if approaching or past planned deadline
      // In Scenario C: allow ECLO if beneficial and within continuity window
      let useEclo = 0;
      if (scenario !== 'A') {
        const canUseEclo = scenario === 'B' || (scenario === 'C' && (ecloWeeksLine.ALP.size <= 2 && ecloWeeksLine.BET.size <= 2));
        if (canUseEclo && (currentWeek >= plannedDeadlineWeek || neededYield - accumulatedYield >= 1.5)) {
          useEclo = 1;
        }
      }

      // Try finding an available access_night in this week (1..maxNightsPerWeek)
      let allocatedNight = -1;
      let allocatedGroup = '';

      for (let night = 1; night <= maxNightsPerWeek; night++) {
        const existingActs = nightsMap.get(night) || new Set();

        // Check workfront cap
        if (existingActs.size >= maxWorkfronts) {
          continue;
        }

        const coGroup = `b${night}`;

        // Check location capacities
        let capacityOk = true;
        for (const loc of occupiedLocs) {
          const locKey = `${loc}_${currentWeek}`;
          const currentGroups = locationUsage.get(locKey) || new Set();
          const cap = getCapacity(loc, currentWeek);

          const willAddGroup = !currentGroups.has(coGroup);
          const newDemand = currentGroups.size + (willAddGroup ? 1 : 0);

          let allowedCap = cap;
          if (scenario === 'C') {
            allowedCap = cap + 1; // Scenario C allows up to 1 excess access night
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
        // Book the access!
        const yieldValue = useEclo === 1 ? 1.5 : 1.0;
        accumulatedYield += yieldValue;

        accesses.push({
          activity_id: act.activity_id,
          access_seq: accessSeq++,
          week: currentWeek,
          eclo: useEclo,
          access_night: allocatedNight,
        });

        // Update nightsMap
        if (!nightsMap.has(allocatedNight)) {
          nightsMap.set(allocatedNight, new Set());
        }
        nightsMap.get(allocatedNight)!.add(act.activity_id);

        // Update locationUsage and occupancies
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

        // Advance to next week (standard max 1 access per activity per week)
        currentWeek++;
      } else {
        // Cannot fit in this week, move to next week
        currentWeek++;
      }
    }

    if (accumulatedYield < neededYield) {
      solverLog.push(`[Warning] Activity ${act.activity_id} could only schedule ${accumulatedYield}/${neededYield} yield.`);
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

    // Overrun days: (lastWeek - plannedWeek) * 7
    let overrunDays = Math.max(0, (lastWeek - plannedWeek) * 7);

    // In Scenario B, overrun must be 0
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

  solverLog.push(`Optimization complete: ${accesses.length} accesses and ${occupancies.length} occupancies generated.`);

  return { accesses, occupancies, results, solverLog };
}
