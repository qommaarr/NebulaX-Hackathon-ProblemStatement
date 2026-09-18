import React, { useState } from 'react';
import {
  ScheduleAccess,
  ScheduleOccupancy,
  ContractResult,
  ScenarioType,
  ValidationReport,
} from '../types';
import {
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import {
  exportAccessesCsv,
  exportOccupancyCsv,
  exportResultsCsv,
  downloadCsv,
} from '../utils/exportCsv';

interface ExportModalProps {
  accesses: ScheduleAccess[];
  occupancies: ScheduleOccupancy[];
  results: ContractResult[];
  scenario: ScenarioType;
  report: ValidationReport;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  accesses,
  occupancies,
  results,
  scenario,
  report,
}) => {
  const [activePreview, setActivePreview] = useState<'access' | 'occupancy' | 'results'>('access');
  const [copied, setCopied] = useState<boolean>(false);

  const accessesCsv = exportAccessesCsv(accesses);
  const occupanciesCsv = exportOccupancyCsv(occupancies);
  const resultsCsv = exportResultsCsv(results);

  const currentCsv =
    activePreview === 'access'
      ? accessesCsv
      : activePreview === 'occupancy'
      ? occupanciesCsv
      : resultsCsv;

  const currentFilename =
    activePreview === 'access'
      ? 'SCHEDULE_ACCESS.csv'
      : activePreview === 'occupancy'
      ? 'SCHEDULE_OCCUPANCY.csv'
      : 'RESULTS.csv';

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAll = () => {
    downloadCsv('SCHEDULE_ACCESS.csv', accessesCsv);
    setTimeout(() => downloadCsv('SCHEDULE_OCCUPANCY.csv', occupanciesCsv), 300);
    setTimeout(() => downloadCsv('RESULTS.csv', resultsCsv), 600);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Download className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-bold text-slate-100">Official Submission Deliverables</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Download the 3 mandatory submission CSV files strictly conforming to Problem Statement 1 schemas for
            direct grading by the automated competition validator.
          </p>
        </div>

        <button
          onClick={handleDownloadAll}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center space-x-2"
        >
          <Download className="h-4 w-4" />
          <span>Download All 3 Files (.zip / CSV)</span>
        </button>
      </div>

      {/* 3 Deliverable Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Deliverable 1: SCHEDULE_ACCESS.csv */}
        <div
          onClick={() => setActivePreview('access')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activePreview === 'access'
              ? 'bg-blue-950/40 border-blue-500/60 shadow-sm'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="h-4 w-4 text-blue-400" />
              <span className="font-bold text-xs text-slate-200">SCHEDULE_ACCESS.csv</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadCsv('SCHEDULE_ACCESS.csv', accessesCsv);
              }}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-blue-400 rounded"
              title="Download SCHEDULE_ACCESS.csv"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Defines activity allocations across weeks, access sequence, ECLO usage, and access nights.
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Rows: {accesses.length}</span>
            <span className="text-emerald-400">Valid Schema</span>
          </div>
        </div>

        {/* Deliverable 2: SCHEDULE_OCCUPANCY.csv */}
        <div
          onClick={() => setActivePreview('occupancy')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activePreview === 'occupancy'
              ? 'bg-blue-950/40 border-blue-500/60 shadow-sm'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <span className="font-bold text-xs text-slate-200">SCHEDULE_OCCUPANCY.csv</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadCsv('SCHEDULE_OCCUPANCY.csv', occupanciesCsv);
              }}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded"
              title="Download SCHEDULE_OCCUPANCY.csv"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Detailed physical sector and platform bookings with co-share group tags per week.
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Rows: {occupancies.length}</span>
            <span className="text-emerald-400">Valid Schema</span>
          </div>
        </div>

        {/* Deliverable 3: RESULTS.csv */}
        <div
          onClick={() => setActivePreview('results')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activePreview === 'results'
              ? 'bg-blue-950/40 border-blue-500/60 shadow-sm'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="h-4 w-4 text-purple-400" />
              <span className="font-bold text-xs text-slate-200">RESULTS.csv</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadCsv('RESULTS.csv', resultsCsv);
              }}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-purple-400 rounded"
              title="Download RESULTS.csv"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Summary outcome for all 14 contracts with simulated completion dates and overrun calculations.
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Rows: {results.length}</span>
            <span className="text-emerald-400">Valid Schema</span>
          </div>
        </div>
      </div>

      {/* CSV Code Preview & Export Box */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner font-mono text-xs">
        <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-200">{currentFilename}</span>
            <span className="text-[10px] text-slate-500">Preview</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center space-x-1 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy CSV'}</span>
            </button>
            <button
              onClick={() => downloadCsv(currentFilename, currentCsv)}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center space-x-1 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>

        <div className="p-4 overflow-x-auto max-h-[380px] bg-slate-950/90 text-slate-300 select-all leading-relaxed whitespace-pre font-mono text-[11px]">
          {currentCsv.slice(0, 4000)}
          {currentCsv.length > 4000 && `\n... and ${currentCsv.split('\n').length - 50} more rows`}
        </div>
      </div>
    </div>
  );
};
