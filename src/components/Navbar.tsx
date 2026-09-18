import React, { useState, useEffect } from 'react';
import {
  Train,
  Sliders,
  Calendar,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Share2,
  Cpu,
  Layers,
  ShieldAlert,
  Menu,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { ScenarioType } from '../types';

export type ActiveTab =
  | 'overview'
  | 'disruptions'
  | 'calendar'
  | 'topology'
  | 'gantt'
  | 'validator'
  | 'optimizer'
  | 'data'
  | 'export';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  scenario: ScenarioType;
  activeScenario?: ScenarioType;
  isPreviewing?: boolean;
  onSelectScenario: (sc: ScenarioType) => void;
  onHoverScenario: (sc: ScenarioType | null) => void;
  isFeasible: boolean;
  score: number;
  totalActivities: number;
  scheduledActivities: number;
  activeDisruptionsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  scenario,
  activeScenario = scenario,
  isPreviewing = false,
  onSelectScenario,
  onHoverScenario,
  isFeasible,
  score,
  totalActivities,
  scheduledActivities,
  activeDisruptionsCount = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prevent background scrolling when menu drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const navGroups = [
    {
      group: 'Core Operations & Planning',
      items: [
        {
          id: 'overview' as ActiveTab,
          label: 'Overview Dashboard',
          description: 'Full network state, KPI scorecards & activity calendar',
          icon: Layers,
        },
        {
          id: 'disruptions' as ActiveTab,
          label: 'Urgent Disruption & Re-Plan',
          description: 'Mid-horizon quota drops, minimal churn re-optimization',
          icon: ShieldAlert,
          badge: activeDisruptionsCount > 0 ? `${activeDisruptionsCount} Active` : undefined,
        },
        {
          id: 'calendar' as ActiveTab,
          label: 'Nightly Possession Calendar',
          description: 'Sector track access matrix & FullCalendar schedules',
          icon: CalendarDays,
        },
        {
          id: 'topology' as ActiveTab,
          label: 'Network Topology Map',
          description: 'Interactive Alpha & Beta dual-line sector geometry',
          icon: Share2,
        },
        {
          id: 'gantt' as ActiveTab,
          label: 'Gantt Timeline Schedule',
          description: 'Contract project milestones & planned completion dates',
          icon: Calendar,
        },
      ],
    },
    {
      group: 'Validation & Solver Intelligence',
      items: [
        {
          id: 'validator' as ActiveTab,
          label: 'Validator & Constraint Rules',
          description: 'Hard safety bounds, co-sharing & soft penalty audit',
          icon: CheckCircle2,
        },
        {
          id: 'optimizer' as ActiveTab,
          label: 'Optimization Sandbox',
          description: 'Scenario parameters, weights & solver run engine',
          icon: Cpu,
        },
      ],
    },
    {
      group: 'Data & Official Deliverables',
      items: [
        {
          id: 'data' as ActiveTab,
          label: 'Data Explorer',
          description: 'Inspect activities, contract packages & supply constraints',
          icon: FileSpreadsheet,
        },
        {
          id: 'export' as ActiveTab,
          label: 'Export Submissions',
          description: 'Download official CSV schedule format for evaluation',
          icon: Download,
        },
      ],
    },
  ];

  // Find currently active item
  const allItems = navGroups.flatMap((g) => g.items);
  const currentItem = allItems.find((i) => i.id === activeTab) || allItems[0];
  const CurrentIcon = currentItem.icon;

  const handleNavigate = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsOpen(false);
  };

  return (
    <>
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Hamburger Button + Brand + Current View Breadcrumb */}
            <div className="flex items-center space-x-3 sm:space-x-4">
              {/* Hamburger Button */}
              <button
                id="hamburger-menu-button"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition-all flex items-center gap-2 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 relative"
              >
                <Menu className="h-5 w-5 text-slate-200" />
                <span className="hidden sm:inline text-xs font-semibold tracking-wide">Menu</span>
                {activeDisruptionsCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-1.5 right-1.5 animate-pulse" />
                )}
              </button>

              <div className="h-6 w-px bg-slate-800 hidden sm:block" />

              {/* Logo & Brand */}
              <div className="flex items-center space-x-2.5">
                <div className="h-9 w-9 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                  <Train className="h-5 w-5" />
                </div>
                <div className="leading-tight">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-slate-100 text-base sm:text-lg tracking-tight">NebulaX</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      PS1
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono hidden md:block">
                    Track Access Optimizer
                  </p>
                </div>
              </div>

              {/* Active Tab Breadcrumb */}
              <div className="hidden lg:flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-900/60 border border-slate-800/80 rounded-lg px-2.5 py-1.5">
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                <CurrentIcon className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold text-slate-200">{currentItem.label}</span>
                {currentItem.badge && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {currentItem.badge}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Policy Scenario Switcher & Status Badges */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Scenario selector */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 relative">
                <span className="text-xs text-slate-400 font-medium px-2 hidden sm:flex items-center gap-1">
                  <Sliders className="h-3 w-3" /> Policy:
                </span>
                {(['A', 'B', 'C'] as ScenarioType[]).map((sc) => {
                  const isEffective = scenario === sc;
                  const isLocked = activeScenario === sc;
                  return (
                    <button
                      key={sc}
                      onClick={() => onSelectScenario(sc)}
                      onMouseEnter={() => onHoverScenario(sc)}
                      onMouseLeave={() => onHoverScenario(null)}
                      title={`Scenario ${sc}: Hover to preview, click to lock`}
                      className={`px-2 sm:px-2.5 py-1 text-xs font-semibold rounded transition-all flex items-center gap-1 relative ${
                        isEffective
                          ? isPreviewing
                            ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                            : 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>{sc}</span>
                      <span className="hidden md:inline">
                        {sc === 'A' ? ' (Strict)' : sc === 'B' ? ' (0d Delay)' : ' (Balanced)'}
                      </span>
                      {isLocked && !isPreviewing && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                      )}
                      {isEffective && isPreviewing && (
                        <span className="text-[9px] px-1 rounded bg-amber-950 text-amber-300 font-mono">Preview</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Feasibility pill */}
              <div
                className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                  isFeasible
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                {isFeasible ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                )}
                <span className="font-mono">{isFeasible ? '0 Violations' : 'Violations'}</span>
              </div>

              {/* Penalty Score */}
              <div className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono">
                <span className="text-slate-400 hidden sm:inline">Score: </span>
                <span className="text-amber-400 font-bold">{score.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hamburger Navigation Slide-Out Drawer & Backdrop Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-fade-in"
          />

          {/* Side Drawer Panel */}
          <div className="fixed inset-y-0 left-0 max-w-full flex">
            <div className="w-screen max-w-sm sm:max-w-md bg-slate-950 border-r border-slate-800 shadow-2xl flex flex-col transform transition ease-in-out duration-200">
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
                    <Train className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="font-bold text-slate-100 text-base">NebulaX Optimizer</h2>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Menu
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                      Alpha &amp; Beta Dual-Line Solver
                    </p>
                  </div>
                </div>

                <button
                  id="close-hamburger-menu-button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Policy Quick Selector Inside Drawer */}
              <div className="px-5 py-4 bg-slate-900/30 border-b border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    Active Policy Scenario
                  </span>
                  <span className="text-[11px] font-mono text-amber-400 font-bold">
                    Scenario {scenario}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['A', 'B', 'C'] as ScenarioType[]).map((sc) => {
                    const isSelected = scenario === sc;
                    return (
                      <button
                        key={sc}
                        onClick={() => onSelectScenario(sc)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center justify-between">
                          <span>Scenario {sc}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                        </div>
                        <span className="text-[10px] opacity-75 block truncate">
                          {sc === 'A' ? 'Strict Supply' : sc === 'B' ? '0d Delay' : 'Balanced'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navigation Items (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {navGroups.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-1.5">
                    <h3 className="px-3 text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                      {group.group}
                    </h3>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleNavigate(item.id)}
                            className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-start justify-between group ${
                              isActive
                                ? 'bg-gradient-to-r from-blue-600/20 to-blue-500/10 border border-blue-500/40 text-white shadow-sm'
                                : 'text-slate-300 hover:bg-slate-900/80 hover:text-white border border-transparent hover:border-slate-800'
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <div
                                className={`p-2 rounded-lg mt-0.5 ${
                                  isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-900 text-slate-400 group-hover:text-slate-200 border border-slate-800'
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-semibold">{item.label}</span>
                                  {item.badge && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 font-normal mt-0.5 line-clamp-1">
                                  {item.description}
                                </p>
                              </div>
                            </div>

                            <ChevronRight
                              className={`w-4 h-4 mt-2 transition-transform ${
                                isActive
                                  ? 'text-blue-400 translate-x-0.5'
                                  : 'text-slate-600 group-hover:text-slate-400'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Drawer Footer Status Summary */}
              <div className="p-4 border-t border-slate-800 bg-slate-900/50 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">FEASIBILITY</span>
                    <span className={isFeasible ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {isFeasible ? 'Feasible (0 Violations)' : 'Violations Detected'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">CURRENT PENALTY</span>
                    <span className="text-amber-400 font-bold">{score.toLocaleString()} pts</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
                  <span>Horizon: 2026-03-01 to 2026-08-31</span>
                  <span>26 Weeks</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

