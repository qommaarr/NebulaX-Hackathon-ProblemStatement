import React, { useState } from 'react';
import {
  FullDataset,
  ScheduleAccess,
  ScheduleOccupancy,
  LineCode,
  Bound,
} from '../types';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Info,
  Zap,
  ShieldAlert,
  Users,
  Train,
} from 'lucide-react';
import { parseLocationId, weekToDate } from '../utils/pathUtils';

interface TopologyMapProps {
  dataset: FullDataset;
  accesses: ScheduleAccess[];
  occupancies: ScheduleOccupancy[];
}

export const TopologyMap: React.FC<TopologyMapProps> = ({
  dataset,
  accesses,
  occupancies,
}) => {
  const [selectedWeek, setSelectedWeek] = useState<number>(17);
  const [selectedBound, setSelectedBound] = useState<'ALL' | Bound>('ALL');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>('SEC:ALP:H01_H02:EB');

  // Timer for play/pause week scrubbing
  React.useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setSelectedWeek((w) => (w >= 30 ? 1 : w + 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  // Filter occupancies for current selected week
  const weekOccupancies = occupancies.filter((o) => o.week === selectedWeek);
  const occupiedLocationMap = new Map<string, ScheduleOccupancy[]>();
  for (const occ of weekOccupancies) {
    if (!occupiedLocationMap.has(occ.location_id)) {
      occupiedLocationMap.set(occ.location_id, []);
    }
    occupiedLocationMap.get(occ.location_id)!.push(occ);
  }

  // Activities active in this week
  const weekAccesses = accesses.filter((a) => a.week === selectedWeek);
  const activityMap = new Map(dataset.activities.map((a) => [a.activity_id, a]));
  const contractMap = new Map(dataset.contracts.map((c) => [c.contract_number, c]));

  // Stations for Alpha and Beta
  const alphaStations = [
    { id: 'S01', name: 'S01', x: 60, y: 120 },
    { id: 'S02', name: 'S02', x: 150, y: 120 },
    { id: 'S03', name: 'S03', x: 240, y: 120 },
    { id: 'S04', name: 'S04', x: 330, y: 120 },
    { id: 'H01', name: 'Hub H01', x: 440, y: 180, isInterchange: true },
    { id: 'H02', name: 'Hub H02', x: 570, y: 180, isInterchange: true },
    { id: 'S05', name: 'S05', x: 680, y: 120 },
    { id: 'S06', name: 'S06', x: 770, y: 120 },
    { id: 'S07', name: 'S07', x: 860, y: 120 },
    { id: 'S08', name: 'S08', x: 950, y: 120 },
  ];

  const betaStations = [
    { id: 'S11', name: 'S11', x: 60, y: 240 },
    { id: 'S12', name: 'S12', x: 150, y: 240 },
    { id: 'S13', name: 'S13', x: 240, y: 240 },
    { id: 'S14', name: 'S14', x: 330, y: 240 },
    { id: 'H01', name: 'Hub H01', x: 440, y: 180, isInterchange: true },
    { id: 'H02', name: 'Hub H02', x: 570, y: 180, isInterchange: true },
    { id: 'S15', name: 'S15', x: 680, y: 240 },
    { id: 'S16', name: 'S16', x: 770, y: 240 },
    { id: 'S17', name: 'S17', x: 860, y: 240 },
    { id: 'S18', name: 'S18', x: 950, y: 240 },
  ];

  // Helper to check if a location or sector is occupied
  function getLocationStatus(locationId: string) {
    const occs = occupiedLocationMap.get(locationId) || [];
    if (occs.length === 0) return { isOccupied: false, occs: [], hasLive: false };

    let hasLive = false;
    for (const o of occs) {
      const act = activityMap.get(o.activity_id);
      if (act) {
        const contract = contractMap.get(act.contract_number);
        if (contract && contract.nature_of_activity === 'Live') {
          hasLive = true;
        }
      }
    }
    return { isOccupied: true, occs, hasLive };
  }

  const selectedLocInfo = selectedLocation ? parseLocationId(selectedLocation) : null;
  const selectedOccs = selectedLocation ? occupiedLocationMap.get(selectedLocation) || [] : [];
  const selectedSupply = dataset.locationSupplies.find((s) => s.location_id === selectedLocation);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Week scrubber */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center"
            title={isPlaying ? 'Pause' : 'Play timeline'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          <button
            onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-mono">
              Week <span className="text-amber-400 font-bold text-sm">{selectedWeek}</span> of 30
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Starting {weekToDate(selectedWeek, dataset.parameters.horizon_start)}
            </span>
          </div>

          <button
            onClick={() => setSelectedWeek(Math.min(30, selectedWeek + 1))}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <input
            type="range"
            min="1"
            max="30"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="w-32 sm:w-48 accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Bound Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-medium">Bound:</span>
          {(['ALL', 'EB', 'WB'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBound(b)}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                selectedBound === b
                  ? 'bg-slate-800 text-blue-400 border border-slate-700'
                  : 'text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              {b === 'ALL' ? 'Both Bounds' : `${b} Only`}
            </button>
          ))}
        </div>

        {/* Live Week Stats */}
        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-semibold">{weekAccesses.length}</span>
            <span className="text-slate-400">Night Accesses Active</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400"></span>
            <span className="text-slate-300 font-semibold">
              {weekOccupancies.length}
            </span>
            <span className="text-slate-400">Track Sectors Booked</span>
          </div>
        </div>
      </div>

      {/* Network Map & Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* SVG Rail Map Visualizer */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-hidden relative shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-red-500"></span>
              <span className="text-xs font-bold text-red-400">Line Alpha (Red)</span>
              <span className="text-slate-600">|</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold text-emerald-400">Line Beta (Green)</span>
            </div>
            <div className="flex items-center space-x-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400"></span> Co-share Slot
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500"></span> 750V Live Cut
              </span>
            </div>
          </div>

          {/* SVG Map */}
          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 1020 340" className="w-full min-w-[750px] h-auto">
              <defs>
                <linearGradient id="interchangeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#ef4444" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              {/* Line Alpha Track Line (Red) */}
              <path
                d="M 60 120 L 330 120 Q 380 120 440 180 L 570 180 Q 630 120 680 120 L 950 120"
                fill="none"
                stroke="#ef4444"
                strokeWidth="4"
                strokeOpacity="0.4"
              />

              {/* Line Beta Track Line (Green) */}
              <path
                d="M 60 240 L 330 240 Q 380 240 440 180 L 570 180 Q 630 240 680 240 L 950 240"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeOpacity="0.4"
              />

              {/* Interchange Tunnel H01 - H02 (Special Dual-Line Zone) */}
              <line
                x1="440"
                y1="180"
                x2="570"
                y2="180"
                stroke="url(#interchangeGlow)"
                strokeWidth="6"
              />

              {/* Sector Clickable Rectangles & Glows */}
              {dataset.sectors.map((sec) => {
                const isAlpha = sec.line_code === 'ALP';
                const stn1 = (isAlpha ? alphaStations : betaStations).find((s) => s.id === sec.from_station_id);
                const stn2 = (isAlpha ? alphaStations : betaStations).find((s) => s.id === sec.to_station_id);
                if (!stn1 || !stn2) return null;

                const midX = (stn1.x + stn2.x) / 2;
                const midY = (stn1.y + stn2.y) / 2;

                const ebLoc = `${sec.sector_id}:EB`;
                const wbLoc = `${sec.sector_id}:WB`;
                const ebStatus = getLocationStatus(ebLoc);
                const wbStatus = getLocationStatus(wbLoc);

                const hasActivity = ebStatus.isOccupied || wbStatus.isOccupied;
                const isLive = ebStatus.hasLive || wbStatus.hasLive;

                const isSelected = selectedLocation?.includes(sec.sector_id);

                return (
                  <g key={sec.sector_id} className="cursor-pointer" onClick={() => setSelectedLocation(ebLoc)}>
                    {hasActivity && (
                      <circle
                        cx={midX}
                        cy={midY}
                        r="14"
                        fill={isLive ? '#ef4444' : '#f59e0b'}
                        fillOpacity="0.3"
                        className="animate-pulse"
                      />
                    )}
                    <rect
                      x={midX - 18}
                      y={midY - 8}
                      width="36"
                      height="16"
                      rx="4"
                      fill={hasActivity ? (isLive ? '#ef4444' : '#f59e0b') : isSelected ? '#3b82f6' : '#1e293b'}
                      stroke={isSelected ? '#60a5fa' : '#334155'}
                      strokeWidth={isSelected ? '2' : '1'}
                    />
                    <text
                      x={midX}
                      y={midY + 4}
                      textAnchor="middle"
                      fill={hasActivity ? '#ffffff' : '#94a3b8'}
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {hasActivity ? `${(ebStatus.occs.length + wbStatus.occs.length)}` : '•'}
                    </text>
                  </g>
                );
              })}

              {/* Station Nodes Line Alpha */}
              {alphaStations.map((stn) => {
                const platEbLoc = `PLAT:ALP:${stn.id}:EB`;
                const platWbLoc = `PLAT:ALP:${stn.id}:WB`;
                const ebStat = getLocationStatus(platEbLoc);
                const wbStat = getLocationStatus(platWbLoc);
                const isOccupied = ebStat.isOccupied || wbStat.isOccupied;
                const isSelected = selectedLocation?.includes(stn.id);

                return (
                  <g key={`alp_${stn.id}`} className="cursor-pointer" onClick={() => setSelectedLocation(platEbLoc)}>
                    <circle
                      cx={stn.x}
                      cy={stn.y}
                      r={stn.isInterchange ? 9 : 7}
                      fill={isOccupied ? '#f59e0b' : '#0f172a'}
                      stroke={stn.isInterchange ? '#fbbf24' : '#ef4444'}
                      strokeWidth={isSelected ? '3' : '2'}
                    />
                    <text
                      x={stn.x}
                      y={stn.y - 12}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="10"
                      fontWeight="600"
                      fontFamily="sans-serif"
                    >
                      {stn.name}
                    </text>
                  </g>
                );
              })}

              {/* Station Nodes Line Beta */}
              {betaStations.map((stn) => {
                if (stn.isInterchange) return null; // Avoid drawing duplicate Hub H01/H02 circles
                const platEbLoc = `PLAT:BET:${stn.id}:EB`;
                const platWbLoc = `PLAT:BET:${stn.id}:WB`;
                const ebStat = getLocationStatus(platEbLoc);
                const wbStat = getLocationStatus(platWbLoc);
                const isOccupied = ebStat.isOccupied || wbStat.isOccupied;
                const isSelected = selectedLocation?.includes(stn.id);

                return (
                  <g key={`bet_${stn.id}`} className="cursor-pointer" onClick={() => setSelectedLocation(platEbLoc)}>
                    <circle
                      cx={stn.x}
                      cy={stn.y}
                      r={7}
                      fill={isOccupied ? '#f59e0b' : '#0f172a'}
                      stroke="#10b981"
                      strokeWidth={isSelected ? '3' : '2'}
                    />
                    <text
                      x={stn.x}
                      y={stn.y + 20}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="10"
                      fontWeight="600"
                      fontFamily="sans-serif"
                    >
                      {stn.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Click any Station or Tunnel Sector to inspect real-time possessions</span>
            <span className="font-mono text-slate-500">Dual-Line Network Model</span>
          </div>
        </div>

        {/* Location Inspector Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Train className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-bold text-slate-100">Location Inspector</h3>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
              Week {selectedWeek}
            </span>
          </div>

          {selectedLocation ? (
            <div className="space-y-4 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[11px]">Location ID:</span>
                <p className="text-sm font-bold text-blue-400 break-all">{selectedLocation}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <span className="text-slate-500">Kind:</span>{' '}
                    <span className="capitalize">{selectedSupply?.location_kind || 'Sector'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Line:</span>{' '}
                    <span>{selectedLocInfo?.line === 'ALP' ? 'Alpha' : 'Beta'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Bound:</span> <span>{selectedLocInfo?.bound}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Weekly Supply:</span>{' '}
                    <span className="text-emerald-400 font-bold">{selectedSupply?.supply_capacity || 2} nights</span>
                  </div>
                </div>
              </div>

              {/* Status in Selected Week */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 font-sans font-semibold">Active Work in Week {selectedWeek}:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] ${
                      selectedOccs.length > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {selectedOccs.length} Occupancy Slots
                  </span>
                </div>

                {selectedOccs.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-950/40 border border-slate-800 text-center text-slate-500">
                    Track clear this week. No possessions scheduled.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedOccs.map((occ, idx) => {
                      const act = activityMap.get(occ.activity_id);
                      const contract = act ? contractMap.get(act.contract_number) : null;
                      return (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between"
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-200">{occ.activity_id}</span>
                              <span className="text-slate-500">({contract?.contract_number})</span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px]">
                                Slot: {occ.co_share_group}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-sans mt-1">
                              {contract?.contract_description}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                              contract?.nature_of_activity === 'Live'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {contract?.nature_of_activity}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Buffer & Power Info */}
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-1.5 text-[11px] text-slate-400 font-sans">
                <div className="flex items-center space-x-1.5 text-amber-400 font-semibold">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Rule Check §2.4:</span>
                </div>
                <p>
                  {selectedLocation.includes('H01') || selectedLocation.includes('H02')
                    ? 'Interchange Station: Live closures mirror to the other line tunnel sector & platforms.'
                    : 'Standard Sector: Non-live work does not cross bounds. Live work cuts 750V and mirrors to opposite bound.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500">
              Select a station or sector from the diagram above to inspect details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
