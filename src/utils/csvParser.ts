import Papa from 'papaparse';
import {
  FullDataset,
  Line,
  Station,
  Sector,
  LocationSupply,
  BufferRule,
  ContractProject,
  Activity,
  ScheduleAccess,
  ScheduleOccupancy,
  ContractResult,
} from '../types';

export function parseCSV<T>(csvText: string): T[] {
  const result = Papa.parse<T>(csvText.trim(), {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return result.data;
}

export function parseInstanceFiles(files: Record<string, string>, baseDataset: FullDataset): FullDataset {
  const updated: FullDataset = { ...baseDataset };

  for (const [filename, content] of Object.entries(files)) {
    const lower = filename.toLowerCase();
    if (lower.includes('line')) {
      updated.lines = parseCSV<Line>(content);
    } else if (lower.includes('station')) {
      updated.stations = parseCSV<Station>(content);
    } else if (lower.includes('sector')) {
      updated.sectors = parseCSV<Sector>(content);
    } else if (lower.includes('supply') || lower.includes('location_supply')) {
      updated.locationSupplies = parseCSV<LocationSupply>(content);
    } else if (lower.includes('buffer')) {
      updated.bufferRules = parseCSV<BufferRule>(content);
    } else if (lower.includes('parameter')) {
      const params = parseCSV<{ key: string; value: any }>(content);
      for (const p of params) {
        if (p.key === 'horizon_start') updated.parameters.horizon_start = String(p.value);
        if (p.key === 'horizon_weeks') updated.parameters.horizon_weeks = Number(p.value);
      }
    } else if (lower.includes('project') || lower.includes('contract')) {
      updated.contracts = parseCSV<ContractProject>(content);
    } else if (lower.includes('activity')) {
      updated.activities = parseCSV<Activity>(content);
    }
  }

  return updated;
}

export function parseSubmissionFiles(files: Record<string, string>): {
  accesses?: ScheduleAccess[];
  occupancies?: ScheduleOccupancy[];
  results?: ContractResult[];
} {
  const out: { accesses?: ScheduleAccess[]; occupancies?: ScheduleOccupancy[]; results?: ContractResult[] } = {};

  for (const [filename, content] of Object.entries(files)) {
    const lower = filename.toLowerCase();
    if (lower.includes('access')) {
      out.accesses = parseCSV<ScheduleAccess>(content);
    } else if (lower.includes('occupancy')) {
      out.occupancies = parseCSV<ScheduleOccupancy>(content);
    } else if (lower.includes('result')) {
      out.results = parseCSV<ContractResult>(content);
    }
  }

  return out;
}
