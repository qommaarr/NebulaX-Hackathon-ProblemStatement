import Papa from 'papaparse';
import { ScheduleAccess, ScheduleOccupancy, ContractResult } from '../types';

export function exportAccessesCsv(accesses: ScheduleAccess[]): string {
  return Papa.unparse(accesses, {
    columns: ['activity_id', 'access_seq', 'week', 'eclo', 'access_night'],
  });
}

export function exportOccupancyCsv(occupancies: ScheduleOccupancy[]): string {
  return Papa.unparse(occupancies, {
    columns: ['activity_id', 'week', 'location_id', 'co_share_group'],
  });
}

export function exportResultsCsv(results: ContractResult[]): string {
  return Papa.unparse(results, {
    columns: ['scenario', 'contract_number', 'simulated_completion_date', 'overrun_days'],
  });
}

export function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
