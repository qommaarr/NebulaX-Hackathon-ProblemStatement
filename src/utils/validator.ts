import {
  FullDataset,
  ScheduleAccess,
  ScheduleOccupancy,
  ContractResult,
  ValidationReport,
  HardViolation,
  SoftScores,
  ScenarioType,
} from '../types';
import { dateToWeek, weekToDate } from './pathUtils';

export function validateSchedule(
  dataset: FullDataset,
  accesses: ScheduleAccess[],
  occupancies: ScheduleOccupancy[],
  results: ContractResult[],
  scenario: ScenarioType
): ValidationReport {
  const hardViolations: HardViolation[] = [];
  const activityMap = new Map(dataset.activities.map((a) => [a.activity_id, a]));
  const contractMap = new Map(dataset.contracts.map((c) => [c.contract_number, c]));

  // Map of activityId -> Accesses
  const activityAccesses = new Map<string, ScheduleAccess[]>();
  for (const acc of accesses) {
    if (!activityAccesses.has(acc.activity_id)) {
      activityAccesses.set(acc.activity_id, []);
    }
    activityAccesses.get(acc.activity_id)!.push(acc);
  }

  // 1. Workload Conservation
  let scheduledCount = 0;
  for (const activity of dataset.activities) {
    const accList = activityAccesses.get(activity.activity_id) || [];
    let deliveredYield = 0;
    for (const a of accList) {
      deliveredYield += a.eclo === 1 ? 1.5 : 1.0;
    }

    if (accList.length > 0) {
      scheduledCount++;
    }

    if (deliveredYield < activity.total_accesses) {
      hardViolations.push({
        rule: 'workload_conservation',
        severity: 'hard',
        detail: `Activity ${activity.activity_id} has delivered yield ${deliveredYield.toFixed(1)} < required ${activity.total_accesses}`,
      });
    }
  }

  // 2. Planned Start Date
  for (const [actId, accList] of activityAccesses.entries()) {
    const act = activityMap.get(actId);
    if (!act) continue;
    const plannedStartWeek = dateToWeek(act.planned_start_date, dataset.parameters.horizon_start);
    const minWeek = Math.min(...accList.map((a) => a.week));
    if (minWeek < plannedStartWeek) {
      hardViolations.push({
        rule: 'planned_start_date',
        severity: 'hard',
        detail: `Activity ${actId} starts in week ${minWeek} before planned start week ${plannedStartWeek} (${act.planned_start_date})`,
      });
    }
  }

  // 3. Predecessor Precedence (FS+0)
  for (const [actId, accList] of activityAccesses.entries()) {
    const act = activityMap.get(actId);
    if (!act || !act.predecessor_activity_id) continue;
    const predAccesses = activityAccesses.get(act.predecessor_activity_id);
    if (!predAccesses || predAccesses.length === 0) {
      hardViolations.push({
        rule: 'predecessor_precedence',
        severity: 'hard',
        detail: `Activity ${actId} predecessor ${act.predecessor_activity_id} is not scheduled`,
      });
      continue;
    }

    const predLastWeek = Math.max(...predAccesses.map((a) => a.week));
    const actFirstWeek = Math.min(...accList.map((a) => a.week));

    if (actFirstWeek <= predLastWeek) {
      hardViolations.push({
        rule: 'predecessor_precedence',
        severity: 'hard',
        detail: `Activity ${actId} starts in week ${actFirstWeek} while predecessor ${act.predecessor_activity_id} finishes in week ${predLastWeek}`,
      });
    }
  }

  // 7 & 8. Weekly Allocation and Workfronts
  // Group by (contract, week)
  const contractWeekAccesses = new Map<string, ScheduleAccess[]>();
  for (const acc of accesses) {
    const act = activityMap.get(acc.activity_id);
    if (!act) continue;
    const key = `${act.contract_number}_${acc.week}`;
    if (!contractWeekAccesses.has(key)) {
      contractWeekAccesses.set(key, []);
    }
    contractWeekAccesses.get(key)!.push(acc);
  }

  for (const [key, accList] of contractWeekAccesses.entries()) {
    const [contractNum, weekStr] = key.split('_');
    const week = Number(weekStr);
    const contract = contractMap.get(contractNum);
    if (!contract) continue;

    // Distinct access_nights
    const distinctNights = new Set(accList.map((a) => a.access_night));
    if (distinctNights.size > contract.number_of_maximum_access_per_week) {
      hardViolations.push({
        rule: 'weekly_allocation',
        severity: 'hard',
        detail: `Contract ${contractNum} used ${distinctNights.size} access nights in week ${week} (max allowed: ${contract.number_of_maximum_access_per_week})`,
      });
    }

    // Workfront per night
    const nightActivities = new Map<number, Set<string>>();
    for (const a of accList) {
      if (!nightActivities.has(a.access_night)) {
        nightActivities.set(a.access_night, new Set());
      }
      nightActivities.get(a.access_night)!.add(a.activity_id);
    }

    for (const [night, actSet] of nightActivities.entries()) {
      if (actSet.size > contract.number_of_workfronts) {
        hardViolations.push({
          rule: 'workfronts',
          severity: 'hard',
          detail: `Contract ${contractNum} has ${actSet.size} concurrent workfronts on week ${week} night ${night} (max: ${contract.number_of_workfronts})`,
        });
      }
    }
  }

  // 9. ECLO checks
  let totalEcloNights = 0;
  for (const acc of accesses) {
    if (acc.eclo === 1) {
      totalEcloNights++;
      if (scenario === 'A') {
        hardViolations.push({
          rule: 'eclo',
          severity: 'hard',
          detail: `Activity ${acc.activity_id} has ECLO=1 in week ${acc.week}, which is strictly forbidden in Scenario A`,
        });
      }
    }
  }

  // Scenario B: Planned Date hard constraint
  // In Scenario B, overrun past planned_completion_date is a hard violation!
  if (scenario === 'B') {
    for (const res of results) {
      if (res.overrun_days > 0) {
        hardViolations.push({
          rule: 'planned_date',
          severity: 'hard',
          detail: `Contract ${res.contract_number} has ${res.overrun_days} overrun days in Scenario B, where dates are rigid`,
        });
      }
    }
  }

  // Capacity & Hotspots
  // Group occupancies by (location_id, week)
  const locationWeekMap = new Map<string, ScheduleOccupancy[]>();
  for (const occ of occupancies) {
    const key = `${occ.location_id}_${occ.week}`;
    if (!locationWeekMap.has(key)) {
      locationWeekMap.set(key, []);
    }
    locationWeekMap.get(key)!.push(occ);
  }

  const supplyMap = new Map(dataset.locationSupplies.map((s) => [s.location_id, s.supply_capacity]));
  const capacityHotspots: Array<{ location_id: string; week: number; demand: number; capacity: number; excess: number }> = [];
  let totalExcessAccessNights = 0;

  for (const [key, occList] of locationWeekMap.entries()) {
    const [locationId, weekStr] = key.split('_');
    const week = Number(weekStr);
    const capacity = supplyMap.get(locationId) || 2;
    // Distinct co-share groups count towards capacity usage
    const distinctGroups = new Set(occList.map((o) => o.co_share_group));
    const demand = distinctGroups.size;

    if (demand > capacity) {
      const excess = demand - capacity;
      totalExcessAccessNights += excess;
      capacityHotspots.push({ location_id: locationId, week, demand, capacity, excess });

      if (scenario === 'A') {
        hardViolations.push({
          rule: 'capacity',
          severity: 'hard',
          detail: `Location ${locationId} week ${week} demand ${demand} exceeds capacity ${capacity} (strictly forbidden in Scenario A)`,
        });
      } else if (scenario === 'C' && excess > 1) {
        hardViolations.push({
          rule: 'capacity',
          severity: 'hard',
          detail: `Location ${locationId} week ${week} excess ${excess} exceeds Scenario C limit of 1 excess night`,
        });
      }
    }
  }

  // Calculate Overruns and Soft Scores
  const priorityOverrun: { [tier: string]: number } = { '1': 0, '2': 0, '3': 0 };
  let overrunDaysTotal = 0;
  let contractsOverrunning = 0;
  let earlinessDaysTotal = 0;
  let priorityWeightedScore = 0;

  for (const res of results) {
    const contract = contractMap.get(res.contract_number);
    if (!contract) continue;

    if (res.overrun_days > 0) {
      contractsOverrunning++;
      overrunDaysTotal += res.overrun_days;
      const tierKey = String(contract.contract_priority);
      priorityOverrun[tierKey] = (priorityOverrun[tierKey] || 0) + res.overrun_days;

      // Base weight: P1 = 100, P2 = 10, P3 = 1
      const baseWeight = contract.contract_priority === 1 ? 100 : contract.contract_priority === 2 ? 10 : 1;

      // Nudge from activities inside this contract
      const contractActs = dataset.activities.filter((a) => a.contract_number === contract.contract_number);
      const avgNudge = contractActs.reduce((acc, a) => {
        const nudge = a.activity_priority === 1 ? 0.3 : a.activity_priority === 2 ? 0.2 : 0.0;
        return acc + nudge;
      }, 0) / (contractActs.length || 1);

      priorityWeightedScore += baseWeight * (1 + avgNudge) * res.overrun_days;
    } else if (res.overrun_days < 0) {
      earlinessDaysTotal += Math.abs(res.overrun_days);
    }
  }

  // Combined score formula
  let combinedScore = 0;
  if (scenario === 'A') {
    combinedScore = priorityWeightedScore;
  } else if (scenario === 'B') {
    combinedScore = 7 * totalExcessAccessNights + 5 * totalEcloNights;
  } else {
    // Scenario C
    combinedScore = priorityWeightedScore + 7 * totalExcessAccessNights + 5 * totalEcloNights;
  }

  const softScores: SoftScores = {
    scenario,
    overrun_days_total: overrunDaysTotal,
    contracts_overrunning: contractsOverrunning,
    earliness_days_total: earlinessDaysTotal,
    excess_access_nights_total: totalExcessAccessNights,
    eclo_nights_total: totalEcloNights,
    priority_overrun: priorityOverrun,
    priority_weighted_score: Math.round(priorityWeightedScore * 10) / 10,
    combined_penalty_score: Math.round(combinedScore * 10) / 10,
  };

  return {
    scenario,
    feasible: hardViolations.length === 0,
    hard_violations: hardViolations,
    soft_scores: softScores,
    detail: {
      capacity_hotspots: capacityHotspots,
      nights_scheduled: accesses.length,
      eclo_nights: totalEcloNights,
      total_activities_scheduled: scheduledCount,
      total_activities_required: dataset.activities.length,
    },
  };
}
