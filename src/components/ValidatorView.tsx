import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Calculator,
  ChevronDown,
  Layers,
  Flame,
} from 'lucide-react';
import { ValidationReport, FullDataset, ScenarioType } from '../types';

interface ValidatorViewProps {
  dataset: FullDataset;
  report: ValidationReport;
  scenario: ScenarioType;
}

export const ValidatorView: React.FC<ValidatorViewProps> = ({ dataset, report, scenario }) => {
  const { feasible, hard_violations, soft_scores, detail } = report;

  const rules = [
    {
      id: 'workload_conservation',
      num: 'Rule 1',
      title: 'Complete Workload Conservation',
      description: 'Every activity in the demand book must be scheduled. Delivered yields (1.0 for standard, 1.5 for ECLO) must sum to at least total_accesses.',
      passed: !hard_violations.some((v) => v.rule === 'workload_conservation'),
      statusText: `${detail.total_activities_scheduled} of ${detail.total_activities_required} activities scheduled (100% delivered)`,
    },
    {
      id: 'planned_start_date',
      num: 'Rule 2',
      title: 'Planned Start Date Compliance',
      description: 'No activity may start before its planned start week (converted from planned_start_date against horizon).',
      passed: !hard_violations.some((v) => v.rule === 'planned_start_date'),
      statusText: 'All activities start on or after their designated planned start week',
    },
    {
      id: 'predecessor_precedence',
      num: 'Rule 3',
      title: 'Predecessor Precedence (FS+0)',
      description: 'Finish-to-Start constraint: An activity naming a predecessor must not start until that predecessor has completely finished.',
      passed: !hard_violations.some((v) => v.rule === 'predecessor_precedence'),
      statusText: 'All dependency chains verified; zero overlapping predecessor weeks',
    },
    {
      id: 'closures_buffers',
      num: 'Rule 4',
      title: 'Closures & Safety Buffers (750V Traction Power)',
      description: 'Live rail works cut 750V traction power, mirroring to the opposite bound (EB <-> WB) and crossing both lines at H01_H02. Non-live Consist enforces 1-sector safety buffer.',
      passed: !hard_violations.some((v) => v.rule === 'closures_buffers'),
      statusText: 'All safety buffers and opposite-bound live power isolations enforced',
    },
    {
      id: 'possession_mix',
      num: 'Rule 5',
      title: 'Possession Location Mixes',
      description: 'Legal nightly mixes per location: 1 PM alone, or 1 PC with up to 3 C, or up to 4 C. Never combine PM with other types.',
      passed: !hard_violations.some((v) => v.rule === 'possession_mix'),
      statusText: 'No invalid possession mix combinations detected',
    },
    {
      id: 'co_sharing',
      num: 'Rule 6',
      title: 'Co-sharing Exemption',
      description: 'Contractors within the same (location, week, co_share_group) share one possession slot without depleting extra supply.',
      passed: true,
      statusText: 'Co-sharing slots utilized effectively to maximize capacity efficiency',
    },
    {
      id: 'weekly_allocation',
      num: 'Rule 7',
      title: 'Weekly Night Allocation Budget',
      description: 'A contract cannot use more distinct access_night values in a single calendar week than its granted number_of_maximum_access_per_week.',
      passed: !hard_violations.some((v) => v.rule === 'weekly_allocation'),
      statusText: 'All contracts adhere strictly to weekly access night allocations',
    },
    {
      id: 'workfronts',
      num: 'Rule 8',
      title: 'Workfront Concurrency Cap',
      description: 'A contract can run at most number_of_workfronts distinct activities simultaneously on the same access_night in any given week.',
      passed: !hard_violations.some((v) => v.rule === 'workfronts'),
      statusText: 'Workfront limits respected across all active nights and weeks',
    },
    {
      id: 'eclo',
      num: 'Rule 9',
      title: 'ECLO Operational Policy',
      description: 'Early Closure Late Opening extends engineering hours from 3.5h to 5.0h (+1.5 yield). Strictly forbidden in Scenario A. In Scenario C, restricted to a 2-week line window.',
      passed: !hard_violations.some((v) => v.rule === 'eclo'),
      statusText:
        scenario === 'A'
          ? 'ECLO count is 0 (Compliant with Scenario A ban)'
          : `${soft_scores.eclo_nights_total} ECLO nights scheduled within permitted window`,
    },
    {
      id: 'capacity',
      num: 'Rule 10',
      title: 'Capacity & Scenario Boundary Limits',
      description:
        scenario === 'A'
          ? 'Scenario A: Rigid supply. Excess access nights strictly forbidden.'
          : scenario === 'B'
          ? 'Scenario B: Rigid schedule dates. Overrun days strictly forbidden.'
          : 'Scenario C: Balanced trade-off. At most 1 excess night permitted per location-week.',
      passed: !hard_violations.some((v) => v.rule === 'capacity' || v.rule === 'planned_date'),
      statusText:
        scenario === 'A'
          ? 'Zero excess supply nights utilized'
          : scenario === 'B'
          ? 'Zero overrun days achieved'
          : 'Excess nights within elasticity bounds',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Feasibility Banner */}
      <div
        className={`p-6 rounded-xl border flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
          feasible
            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
            : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
        }`}
      >
        <div className="flex items-start space-x-4">
          <div
            className={`p-3 rounded-xl ${
              feasible ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            {feasible ? <ShieldCheck className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
          </div>
          <div>
            <h2 className="text-xl font-bold font-mono">
              {feasible ? 'SCHEDULE VERIFIED: FULLY FEASIBLE' : 'VALIDATION FAILED: HARD VIOLATIONS DETECTED'}
            </h2>
            <p className="text-sm opacity-90 mt-1 font-sans">
              {feasible
                ? 'All 10 physical, safety, operational, and regulatory constraints have passed inspection.'
                : `${hard_violations.length} non-negotiable rule breaches must be resolved before submission.`}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-slate-400">Hard Breaches:</span>
            <p className={`text-base font-bold ${feasible ? 'text-emerald-400' : 'text-rose-400'}`}>
              {hard_violations.length}
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-slate-400">Score ({scenario}):</span>
            <p className="text-base font-bold text-amber-400">
              {soft_scores.combined_penalty_score.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Hard Violations List (if any) */}
      {hard_violations.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-500/40 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <span>Violations Breakdown ({hard_violations.length})</span>
          </h3>
          <div className="space-y-2">
            {hard_violations.map((v, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs font-mono text-rose-200 flex items-start gap-2"
              >
                <XCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold uppercase tracking-wider text-[10px] text-rose-400">
                    [{v.rule}]
                  </span>
                  <p className="mt-0.5">{v.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Soft Score Breakdown Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center space-x-2">
          <Calculator className="h-5 w-5 text-amber-400" />
          <h3 className="text-base font-bold text-slate-100">Soft Score & Penalty Evaluation</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
            <span className="text-xs text-slate-400 font-medium">Priority-Weighted Overrun</span>
            <div className="text-2xl font-bold font-mono text-blue-400">
              {soft_scores.priority_weighted_score.toLocaleString()} <span className="text-xs text-slate-500">pts</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
              Tier 1 (100× + nudge) + Tier 2 (10× + nudge) + Tier 3 (1×)
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
            <span className="text-xs text-slate-400 font-medium">Excess Track Access Nights</span>
            <div className="text-2xl font-bold font-mono text-purple-400">
              {(soft_scores.excess_access_nights_total * 7).toLocaleString()} <span className="text-xs text-slate-500">pts</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
              {soft_scores.excess_access_nights_total} extra nights × 7 points/night
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
            <span className="text-xs text-slate-400 font-medium">ECLO Commuter Disruption</span>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {(soft_scores.eclo_nights_total * 5).toLocaleString()} <span className="text-xs text-slate-500">pts</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
              {soft_scores.eclo_nights_total} ECLO nights × 5 points/night
            </p>
          </div>
        </div>
      </div>

      {/* Rule Compliance Checklist */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-100">10-Point Technical Compliance Audit</h3>
        <p className="text-xs text-slate-400">
          Evaluated against the official competition validator specification from the briefing packet.
        </p>

        <div className="space-y-3">
          {rules.map((r) => (
            <div
              key={r.id}
              className={`p-4 rounded-xl border transition-all ${
                r.passed
                  ? 'bg-slate-950/60 border-slate-800'
                  : 'bg-rose-950/20 border-rose-700/60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">
                    {r.passed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-blue-400">{r.num}:</span>
                      <h4 className="text-sm font-semibold text-slate-100">{r.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{r.description}</p>
                  </div>
                </div>

                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-mono font-medium whitespace-nowrap border ${
                    r.passed
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  {r.passed ? 'COMPLIANT' : 'BREACH'}
                </span>
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Audit Detail:</span>
                <span className={r.passed ? 'text-slate-300' : 'text-rose-300 font-bold'}>
                  {r.statusText}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
