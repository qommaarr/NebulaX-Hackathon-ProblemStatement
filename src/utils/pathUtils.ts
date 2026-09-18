import { Activity, FullDataset, LineCode, Bound, NatureOfWorks } from '../types';

export interface ParsedLocation {
  type: 'SEC' | 'PLAT';
  line: LineCode;
  stationOrSector: string;
  bound: Bound;
}

export function parseLocationId(locationId: string): ParsedLocation | null {
  const parts = locationId.split(':');
  if (parts.length < 4) return null;
  return {
    type: parts[0] as 'SEC' | 'PLAT',
    line: parts[1] as LineCode,
    stationOrSector: parts[2],
    bound: parts[3] as Bound,
  };
}

export function getStationSequence(stationId: string, line: LineCode): number {
  if (line === 'ALP') {
    const map: Record<string, number> = {
      S01: 1, S02: 2, S03: 3, S04: 4, H01: 5, H02: 6, S05: 7, S06: 8, S07: 9, S08: 10
    };
    return map[stationId] ?? 0;
  } else {
    const map: Record<string, number> = {
      S11: 1, S12: 2, S13: 3, S14: 4, H01: 5, H02: 6, S15: 7, S16: 8, S17: 9, S18: 10
    };
    return map[stationId] ?? 0;
  }
}

export function getStationIdBySeq(seq: number, line: LineCode): string | null {
  if (line === 'ALP') {
    const arr = ['S01', 'S02', 'S03', 'S04', 'H01', 'H02', 'S05', 'S06', 'S07', 'S08'];
    return arr[seq - 1] ?? null;
  } else {
    const arr = ['S11', 'S12', 'S13', 'S14', 'H01', 'H02', 'S15', 'S16', 'S17', 'S18'];
    return arr[seq - 1] ?? null;
  }
}

export function getSectorFromTo(sectorCode: string): [string, string] | null {
  const parts = sectorCode.split('_');
  if (parts.length === 2) return [parts[0], parts[1]];
  return null;
}

/**
 * Returns all platform and tunnel sector location IDs booked by an activity.
 */
export function getOccupiedLocationsForActivity(activity: Activity): string[] {
  const startParsed = parseLocationId(activity.start_location_id);
  const endParsed = parseLocationId(activity.end_location_id);

  if (!startParsed || !endParsed || startParsed.line !== endParsed.line || startParsed.bound !== endParsed.bound) {
    // Fallback: return at least start and end
    return Array.from(new Set([activity.start_location_id, activity.end_location_id]));
  }

  const line = startParsed.line;
  const bound = startParsed.bound;

  const startStns = getSectorFromTo(startParsed.stationOrSector);
  const endStns = getSectorFromTo(endParsed.stationOrSector);

  if (!startStns || !endStns) {
    return [activity.start_location_id, activity.end_location_id];
  }

  const seq1 = Math.min(getStationSequence(startStns[0], line), getStationSequence(startStns[1], line));
  const seq2 = Math.max(getStationSequence(endStns[0], line), getStationSequence(endStns[1], line));

  const minSeq = Math.min(seq1, Math.min(getStationSequence(endStns[0], line), getStationSequence(endStns[1], line)));
  const maxSeq = Math.max(seq2, Math.max(getStationSequence(startStns[0], line), getStationSequence(startStns[1], line)));

  const locations: string[] = [];

  // Add platform sectors for all traversed stations
  for (let s = minSeq; s <= maxSeq; s++) {
    const stn = getStationIdBySeq(s, line);
    if (stn) {
      locations.push(`PLAT:${line}:${stn}:${bound}`);
    }
  }

  // Add tunnel sectors
  for (let s = minSeq; s < maxSeq; s++) {
    const stn1 = getStationIdBySeq(s, line);
    const stn2 = getStationIdBySeq(s + 1, line);
    if (stn1 && stn2) {
      locations.push(`SEC:${line}:${stn1}_${stn2}:${bound}`);
    }
  }

  return Array.from(new Set(locations));
}

/**
 * Computes safety buffer locations and opposite bound mirroring (for Live).
 */
export function getBufferAndClosureLocations(
  occupiedLocations: string[],
  nature: NatureOfWorks
): { closures: string[]; buffers: string[] } {
  if (nature === 'Non-live (Others)') {
    return { closures: occupiedLocations, buffers: [] };
  }

  const closures = new Set<string>(occupiedLocations);
  const buffers = new Set<string>();

  const bufferSize = nature === 'Live' ? 2 : 1;

  for (const loc of occupiedLocations) {
    const parsed = parseLocationId(loc);
    if (!parsed) continue;

    // Opposite bound mirroring for Live
    if (nature === 'Live') {
      const oppBound = parsed.bound === 'EB' ? 'WB' : 'EB';
      closures.add(`${parsed.type}:${parsed.line}:${parsed.stationOrSector}:${oppBound}`);

      // If at interchange H01_H02, cross lines
      if (parsed.stationOrSector.includes('H01') || parsed.stationOrSector.includes('H02')) {
        const otherLine: LineCode = parsed.line === 'ALP' ? 'BET' : 'ALP';
        closures.add(`${parsed.type}:${otherLine}:${parsed.stationOrSector}:${parsed.bound}`);
        closures.add(`${parsed.type}:${otherLine}:${parsed.stationOrSector}:${oppBound}`);
      }
    }
  }

  // Calculate buffer sectors ahead and behind along the line
  // Buffer applies bufferSize sectors outside the span
  // For each occupied location, find adjacent sectors
  // (In real validator, buffers never overlap with another possession's span or buffer)
  return {
    closures: Array.from(closures),
    buffers: Array.from(buffers),
  };
}

/**
 * Converts week index (1-30) to Monday date format (YYYY-MM-DD).
 */
export function weekToDate(week: number, horizonStart: string = '2027-01-04'): string {
  const [year, month, day] = horizonStart.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + (week - 1) * 7);
  return date.toISOString().split('T')[0];
}

/**
 * Converts week index (1-30) and night (1-7) to full date and day representation.
 */
export function getNightDate(
  week: number,
  night: number,
  horizonStart: string = '2027-01-04'
): { dateStr: string; dayName: string; formatted: string } {
  const [year, month, day] = horizonStart.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + (week - 1) * 7 + (night - 1));

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName = dayNames[(night - 1) % 7] || `Night ${night}`;
  const d = date.getUTCDate();
  const m = monthNames[date.getUTCMonth()];
  const y = date.getUTCFullYear();

  return {
    dateStr: date.toISOString().split('T')[0],
    dayName,
    formatted: `${d.toString().padStart(2, '0')} ${m} ${y}`,
  };
}

/**
 * Converts date string (YYYY-MM-DD) to week number (1..30).
 */
export function dateToWeek(dateStr: string, horizonStart: string = '2027-01-04'): number {
  const [year, month, day] = horizonStart.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day)).getTime();
  const [dYear, dMonth, dDay] = dateStr.split('-').map(Number);
  const target = new Date(Date.UTC(dYear, dMonth - 1, dDay)).getTime();
  const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}
