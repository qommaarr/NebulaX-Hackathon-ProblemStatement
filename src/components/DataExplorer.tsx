import React, { useState } from 'react';
import {
  FullDataset,
} from '../types';
import {
  FileSpreadsheet,
  Upload,
  RefreshCw,
  Search,
  Database,
  CheckCircle,
} from 'lucide-react';
import { parseInstanceFiles } from '../utils/csvParser';
import { DEFAULT_DATASET } from '../data/defaultData';

interface DataExplorerProps {
  dataset: FullDataset;
  setDataset: (d: FullDataset) => void;
}

type DatasetKey =
  | 'lines'
  | 'stations'
  | 'sectors'
  | 'locationSupplies'
  | 'bufferRules'
  | 'parameters'
  | 'contracts'
  | 'activities';

export const DataExplorer: React.FC<DataExplorerProps> = ({ dataset, setDataset }) => {
  const [activeDataset, setActiveDataset] = useState<DatasetKey>('activities');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const datasetTabs: Array<{ id: DatasetKey; label: string; count: number; filename: string }> = [
    { id: 'activities', label: 'Activities (Demand Book)', count: dataset.activities.length, filename: '08_ACTIVITY_DETAILS.csv' },
    { id: 'contracts', label: 'Contract Projects', count: dataset.contracts.length, filename: '07_PROJECT_DETAILS.csv' },
    { id: 'locationSupplies', label: 'Location Supply', count: dataset.locationSupplies.length, filename: '04_LOCATION_SUPPLY.csv' },
    { id: 'sectors', label: 'Tunnel Sectors', count: dataset.sectors.length, filename: '03_SECTORS.csv' },
    { id: 'stations', label: 'Stations', count: dataset.stations.length, filename: '02_STATIONS.csv' },
    { id: 'lines', label: 'Lines', count: dataset.lines.length, filename: '01_LINES.csv' },
    { id: 'bufferRules', label: 'Buffer Rules', count: dataset.bufferRules.length, filename: '05_BUFFER_LOCATION.csv' },
    { id: 'parameters', label: 'Parameters', count: 2, filename: '06_PARAMETERS.csv' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileMap: Record<string, string> = {};
    let loadedCount = 0;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        fileMap[file.name] = text;
        loadedCount++;
        if (loadedCount === files.length) {
          const updated = parseInstanceFiles(fileMap, dataset);
          setDataset(updated);
          setUploadStatus(`Successfully parsed ${loadedCount} CSV file(s).`);
          setTimeout(() => setUploadStatus(null), 4000);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleResetToDefault = () => {
    setDataset(DEFAULT_DATASET);
    setUploadStatus('Reset to default competition instance.');
    setTimeout(() => setUploadStatus(null), 3000);
  };

  // Prepare table data for current active dataset
  let currentData: any[] = [];
  if (activeDataset === 'parameters') {
    currentData = [
      { key: 'horizon_start', value: dataset.parameters.horizon_start },
      { key: 'horizon_weeks', value: dataset.parameters.horizon_weeks },
    ];
  } else {
    currentData = (dataset[activeDataset] as any[]) || [];
  }

  // Filter table data
  const filteredData = currentData.filter((row) => {
    if (!searchTerm) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const columns = currentData.length > 0 ? Object.keys(currentData[0]) : [];

  return (
    <div className="space-y-6">
      {/* Upload & Management Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-blue-400" />
            <h2 className="text-base font-bold text-slate-100">Dataset Explorer & CSV Ingestion</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review raw competition tables or upload new instance files to test alternative demand or capacity scenarios.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <label className="cursor-pointer px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-2">
            <Upload className="h-4 w-4 text-blue-400" />
            <span>Upload Instance CSVs</span>
            <input type="file" multiple accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            onClick={handleResetToDefault}
            className="px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5"
            title="Reset to default competition instance"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {uploadStatus && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-mono text-emerald-300 flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <span>{uploadStatus}</span>
        </div>
      )}

      {/* Dataset Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-2 border-b border-slate-800">
        {datasetTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveDataset(tab.id);
              setSearchTerm('');
            }}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center space-x-2 ${
              activeDataset === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeDataset === tab.id ? 'bg-blue-800 text-blue-200' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm space-y-3 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs font-mono text-slate-400">
            Showing <span className="text-slate-200 font-bold">{filteredData.length}</span> rows from{' '}
            <span className="text-blue-400 font-semibold">
              {datasetTabs.find((t) => t.id === activeDataset)?.filename}
            </span>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search table values..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 sticky top-0 z-10 text-slate-400 border-b border-slate-800">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="py-2.5 px-3 font-semibold capitalize whitespace-nowrap">
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  {columns.map((col) => (
                    <td key={col} className="py-2 px-3 text-slate-300 whitespace-nowrap">
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
