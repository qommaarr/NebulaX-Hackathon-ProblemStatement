export type LineCode = 'ALP' | 'BET';
export type Bound = 'EB' | 'WB';
export type NatureOfWorks = 'Live' | 'Non-live (Consist)' | 'Non-live (Others)';
export type AccessType = 'PM' | 'PC' | 'C';
export type ActivityType = 'Renewal' | 'Construction';
export type ScenarioType = 'A' | 'B' | 'C';

export interface Line {
  line_code: LineCode;
  line_name: string;
}

export interface Station {
  station_id: string;
  line_code: LineCode;
  seq: number;
  is_interchange: number; // 0 or 1
}

export interface Sector {
  sector_id: string;
  line_code: LineCode;
  from_station_id: string;
  to_station_id: string;
  seq: number;
  is_shared: number;
}

export interface LocationSupply {
  location_id: string;
  location_kind: 'tunnel sector' | 'platform sector';
  line_code: LineCode;
  bound: Bound;
  supply_capacity: number;
}

export interface BufferRule {
  nature_of_works: NatureOfWorks;
  up_to_buffer_sectors: number;
  opposite_bound_required: number;
}

export interface ParameterItem {
  key: string;
  value: string;
}

export interface ContractProject {
  contract_number: string;
  contract_description: string;
  contract_award_date: string;
  activity_type: ActivityType;
  nature_of_activity: NatureOfWorks;
  contract_priority: number; // 1, 2, or 3
  contract_completion_date: string;
  planned_completion_date: string;
  number_of_workfronts: number;
  access_type: AccessType;
  number_of_maximum_access_per_week: number;
}

export interface Activity {
  activity_id: string;
  contract_number: string;
  activity_type: ActivityType;
  start_location_id: string;
  end_location_id: string;
  total_accesses: number;
  planned_start_date: string;
  predecessor_activity_id?: string;
  activity_priority: number; // 1, 2, or 3
}

export interface ScheduleAccess {
  activity_id: string;
  access_seq: number;
  week: number;
  eclo: number; // 0 or 1
  access_night: number; // 1..number_of_maximum_access_per_week
}

export interface ScheduleOccupancy {
  activity_id: string;
  week: number;
  location_id: string;
  co_share_group: string;
}

export interface ContractResult {
  scenario: ScenarioType;
  contract_number: string;
  simulated_completion_date: string;
  overrun_days: number;
}

export interface HardViolation {
  rule: string;
  severity: 'hard' | 'soft';
  detail: string;
}

export interface SoftScores {
  scenario: ScenarioType;
  overrun_days_total: number;
  contracts_overrunning: number;
  earliness_days_total: number;
  excess_access_nights_total: number;
  eclo_nights_total: number;
  priority_overrun: { [tier: string]: number };
  priority_weighted_score: number;
  combined_penalty_score: number;
}

export interface ValidationReport {
  scenario: ScenarioType;
  feasible: boolean;
  hard_violations: HardViolation[];
  soft_scores: SoftScores;
  detail: {
    capacity_hotspots: Array<{ location_id: string; week: number; demand: number; capacity: number; excess: number }>;
    nights_scheduled: number;
    eclo_nights: number;
    total_activities_scheduled: number;
    total_activities_required: number;
  };
}

export interface FullDataset {
  lines: Line[];
  stations: Station[];
  sectors: Sector[];
  locationSupplies: LocationSupply[];
  bufferRules: BufferRule[];
  parameters: {
    horizon_start: string;
    horizon_weeks: number;
  };
  contracts: ContractProject[];
  activities: Activity[];
}

export interface DisruptionEvent {
  id: string;
  name: string;
  location_id: string;
  start_week: number;
  end_week: number;
  normal_capacity: number;
  reduced_capacity: number;
  reason: string;
  severity: 'Urgent' | 'Major' | 'Moderate';
  active: boolean;
  affected_line: LineCode | 'BOTH';
}

export interface DisplacedActivity {
  activity_id: string;
  contract_number: string;
  priority: number;
  baselineStartWeek: number;
  newStartWeek: number;
  shiftWeeks: number;
  reason: string;
}

export interface ScenarioImpact {
  scenario: ScenarioType;
  totalActivities: number;
  completedActivities: number;
  completionRate: number; // 100%
  churnedActivitiesCount: number;
  churnRatePercent: number;
  unaffectedActivitiesCount: number;
  stabilityRatePercent: number;
  baselineOverrunDays: number;
  newOverrunDays: number;
  overrunDelta: number;
  baselineScore: number;
  newScore: number;
  scoreDelta: number;
  p1OverrunDays: number;
  p2OverrunDays: number;
  p3OverrunDays: number;
  displacedActivities: DisplacedActivity[];
}

export interface DisruptionImpactReport {
  timestamp: string;
  disruptionsApplied: DisruptionEvent[];
  scenarios: Record<ScenarioType, ScenarioImpact>;
}
