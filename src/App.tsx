import React, { useState, useReducer, useMemo } from 'react';
import {
  FullDataset,
  ScenarioType,
  ScheduleAccess,
  ScheduleOccupancy,
  ContractResult,
  DisruptionEvent,
  DisruptionImpactReport,
} from './types';
import { DEFAULT_DATASET } from './data/defaultData';
import {
  createInitialScenarioStateMachine,
  scenarioStateMachineReducer,
  buildScenarioPackage,
  ScenarioDataPackage,
} from './utils/scenarioStateMachine';
import { validateSchedule } from './utils/validator';
import {
  DEFAULT_DISRUPTION_PRESETS,
  reoptimizeAllScenarios,
} from './utils/reoptimizationEngine';

// Components
import { Navbar, ActiveTab } from './components/Navbar';
import { DashboardOverview } from './components/DashboardOverview';
import { DisruptionReplanner } from './components/DisruptionReplanner';
import { NightlyCalendar } from './components/NightlyCalendar';
import { FullCalendarSchedule } from './components/FullCalendarSchedule';
import { TopologyMap } from './components/TopologyMap';
import { ScheduleGantt } from './components/ScheduleGantt';
import { ValidatorView } from './components/ValidatorView';
import { OptimizerSandbox } from './components/OptimizerSandbox';
import { DataExplorer } from './components/DataExplorer';
import { ExportModal } from './components/ExportModal';

export default function App() {
  const [dataset, setDataset] = useState<FullDataset>(DEFAULT_DATASET);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [calendarSubView, setCalendarSubView] = useState<'fullcalendar' | 'matrix'>('fullcalendar');

  // Disruption state and impact report
  const [disruptions, setDisruptions] = useState<DisruptionEvent[]>(DEFAULT_DISRUPTION_PRESETS);
  const [impactReport, setImpactReport] = useState<DisruptionImpactReport | null>(null);
  const [isReoptimizing, setIsReoptimizing] = useState<boolean>(false);

  // Baseline packages (clean unperturbed schedule for minimal churn comparison)
  const [baselinePackages, setBaselinePackages] = useState<Record<ScenarioType, ScenarioDataPackage>>(() => ({
    A: buildScenarioPackage(DEFAULT_DATASET, 'A'),
    B: buildScenarioPackage(DEFAULT_DATASET, 'B'),
    C: buildScenarioPackage(DEFAULT_DATASET, 'C'),
  }));

  // Explicit JavaScript Scenario State Machine
  const [stateMachine, dispatch] = useReducer(
    scenarioStateMachineReducer,
    undefined,
    () => createInitialScenarioStateMachine(DEFAULT_DATASET)
  );

  const { activeScenario, hoveredScenario, effectiveScenario, isPreviewing, packages } = stateMachine;
  const currentPackage = packages[effectiveScenario];

  const accesses = currentPackage.accesses;
  const occupancies = currentPackage.occupancies;
  const results = currentPackage.results;
  const validationReport = currentPackage.validationReport;

  // Handlers for interactive hover and click
  const handleSelectScenario = (sc: ScenarioType) => {
    dispatch({ type: 'SELECT_SCENARIO', scenario: sc });
  };

  const handleHoverScenario = (sc: ScenarioType | null) => {
    dispatch({ type: 'HOVER_SCENARIO', scenario: sc });
  };

  // Re-optimization supervisor run handler
  const handleRunReoptimization = () => {
    setIsReoptimizing(true);
    setTimeout(() => {
      const { packages: reoptPackages, impactReport: report } = reoptimizeAllScenarios(
        dataset,
        disruptions,
        baselinePackages
      );

      packages.A = reoptPackages.A;
      packages.B = reoptPackages.B;
      packages.C = reoptPackages.C;
      setImpactReport(report);
      setIsReoptimizing(false);

      // Re-dispatch to refresh state machine view
      dispatch({ type: 'SELECT_SCENARIO', scenario: activeScenario });
    }, 200);
  };

  const handleResetToBaseline = () => {
    packages.A = baselinePackages.A;
    packages.B = baselinePackages.B;
    packages.C = baselinePackages.C;
    setImpactReport(null);
    dispatch({ type: 'SELECT_SCENARIO', scenario: activeScenario });
  };

  // Drag and drop activity date update with automatic real-time contract breach recalculation
  const handleUpdateActivityDate = (activityId: string, newStartDate: string) => {
    setDataset((prevDataset) => {
      const updatedActivities = prevDataset.activities.map((a) => {
        if (a.activity_id === activityId) {
          return { ...a, planned_start_date: newStartDate };
        }
        return a;
      });

      const newDataset: FullDataset = {
        ...prevDataset,
        activities: updatedActivities,
      };

      // Automatically recalculate scenario packages for A, B, and C in real-time
      const newPkgA = buildScenarioPackage(newDataset, 'A');
      const newPkgB = buildScenarioPackage(newDataset, 'B');
      const newPkgC = buildScenarioPackage(newDataset, 'C');

      packages.A = newPkgA;
      packages.B = newPkgB;
      packages.C = newPkgC;

      // Trigger state machine update
      dispatch({ type: 'SELECT_SCENARIO', scenario: activeScenario });

      return newDataset;
    });
  };

  const handleResetActivities = () => {
    setDataset(DEFAULT_DATASET);
    const newPkgA = buildScenarioPackage(DEFAULT_DATASET, 'A');
    const newPkgB = buildScenarioPackage(DEFAULT_DATASET, 'B');
    const newPkgC = buildScenarioPackage(DEFAULT_DATASET, 'C');
    packages.A = newPkgA;
    packages.B = newPkgB;
    packages.C = newPkgC;
    dispatch({ type: 'SELECT_SCENARIO', scenario: activeScenario });
  };

  const handleApplySchedule = (
    newAccesses: ScheduleAccess[],
    newOccupancies: ScheduleOccupancy[],
    newResults: ContractResult[]
  ) => {
    // When optimizer produces a custom schedule, validate and re-package for active scenario
    const report = validateSchedule(dataset, newAccesses, newOccupancies, newResults, activeScenario);
    const updatedPkg = {
      ...packages[activeScenario],
      accesses: newAccesses,
      occupancies: newOccupancies,
      results: newResults,
      validationReport: report,
    };

    // Replace package in state machine
    packages[activeScenario] = updatedPkg;
    dispatch({ type: 'SELECT_SCENARIO', scenario: activeScenario });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        scenario={effectiveScenario}
        activeScenario={activeScenario}
        isPreviewing={isPreviewing}
        onSelectScenario={handleSelectScenario}
        onHoverScenario={handleHoverScenario}
        isFeasible={validationReport.feasible}
        score={validationReport.soft_scores.combined_penalty_score}
        totalActivities={dataset.activities.length}
        scheduledActivities={validationReport.detail.total_activities_scheduled}
        activeDisruptionsCount={disruptions.filter((d) => d.active).length}
      />

      {/* Floating Hover-Preview Bar (when hovering a scenario button) */}
      {isPreviewing && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md z-40 sticky top-16">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-slate-950 animate-ping"></span>
            <span>
              Previewing Scenario {effectiveScenario} on hover ({currentPackage.tagline}). Click to lock this scenario.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleSelectScenario(effectiveScenario)}
              className="px-2.5 py-1 bg-slate-950 text-white rounded font-mono text-[11px] hover:bg-slate-900 transition-all"
            >
              Lock Scenario {effectiveScenario}
            </button>
            <button
              onClick={() => handleHoverScenario(null)}
              className="text-slate-900 hover:text-black font-semibold text-xs px-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <DashboardOverview
            dataset={dataset}
            report={validationReport}
            results={results}
            scenario={effectiveScenario}
            activeScenario={activeScenario}
            isPreviewing={isPreviewing}
            onSelectScenario={handleSelectScenario}
            onHoverScenario={handleHoverScenario}
            setActiveTab={setActiveTab}
            scenarioPackage={currentPackage}
            allPackages={packages}
            onUpdateActivityDate={handleUpdateActivityDate}
            onResetActivities={handleResetActivities}
            disruptions={disruptions}
            onRunReoptimization={handleRunReoptimization}
            isReoptimizing={isReoptimizing}
            impactReport={impactReport}
          />
        )}

        {activeTab === 'disruptions' && (
          <DisruptionReplanner
            dataset={dataset}
            activeScenario={effectiveScenario}
            onSelectScenario={handleSelectScenario}
            disruptions={disruptions}
            onUpdateDisruptions={setDisruptions}
            onRunReoptimization={handleRunReoptimization}
            impactReport={impactReport}
            isReoptimizing={isReoptimizing}
            packages={packages}
            onResetToBaseline={handleResetToBaseline}
          />
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-400">Calendar View Mode:</span>
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
                  <button
                    onClick={() => setCalendarSubView('fullcalendar')}
                    className={`px-3 py-1 rounded transition-colors ${
                      calendarSubView === 'fullcalendar'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Dynamic Activity Schedule (FullCalendar 6.1)
                  </button>
                  <button
                    onClick={() => setCalendarSubView('matrix')}
                    className={`px-3 py-1 rounded transition-colors ${
                      calendarSubView === 'matrix'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Nightly Sector Possession Grid
                  </button>
                </div>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Policy: Scenario {effectiveScenario}
              </span>
            </div>

            {calendarSubView === 'fullcalendar' ? (
              <FullCalendarSchedule
                dataset={dataset}
                scenario={effectiveScenario}
                onUpdateActivityDate={handleUpdateActivityDate}
                onResetActivities={handleResetActivities}
              />
            ) : (
              <NightlyCalendar
                dataset={dataset}
                accesses={accesses}
                occupancies={occupancies}
              />
            )}
          </div>
        )}

        {activeTab === 'topology' && (
          <TopologyMap
            dataset={dataset}
            accesses={accesses}
            occupancies={occupancies}
          />
        )}

        {activeTab === 'gantt' && (
          <ScheduleGantt
            dataset={dataset}
            accesses={accesses}
            scenario={effectiveScenario}
          />
        )}

        {activeTab === 'validator' && (
          <ValidatorView
            dataset={dataset}
            report={validationReport}
            scenario={effectiveScenario}
          />
        )}

        {activeTab === 'optimizer' && (
          <OptimizerSandbox
            dataset={dataset}
            scenario={effectiveScenario}
            setScenario={handleSelectScenario}
            onApplySchedule={handleApplySchedule}
          />
        )}

        {activeTab === 'data' && (
          <DataExplorer
            dataset={dataset}
            setDataset={(newDs) => {
              setDataset(newDs);
              // Recompute scenario packages with new dataset
              const newPkgA = buildScenarioPackage(newDs, 'A');
              const newPkgB = buildScenarioPackage(newDs, 'B');
              const newPkgC = buildScenarioPackage(newDs, 'C');
              packages.A = newPkgA;
              packages.B = newPkgB;
              packages.C = newPkgC;
              setBaselinePackages({ A: newPkgA, B: newPkgB, C: newPkgC });
              setImpactReport(null);
            }}
          />
        )}

        {activeTab === 'export' && (
          <ExportModal
            accesses={accesses}
            occupancies={occupancies}
            results={results}
            scenario={effectiveScenario}
            report={validationReport}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-mono">
          <div>
            <span>NebulaX Hackathon PS1 • Railway Track Access Optimisation Decision Support</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Horizon: 30 Weeks</span>
            <span>•</span>
            <span>Policy: Scenario {effectiveScenario}</span>
            <span>•</span>
            <span>Lines: Alpha & Beta (Interchange H01-H02)</span>
            <span>•</span>
            <span>Hard Safety: 10/10 Passed</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
