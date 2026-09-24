/**
 * Project hygiene audits: naming, layer boundaries, ownership, grain docs.
 */

import type { LogLine, ProjectState } from './types';
import { cloneProject } from './project';

export interface AuditIssue {
  severity: 'error' | 'warn';
  code: string;
  modelId: string;
  message: string;
}

function log(kind: LogLine['kind'], text: string): LogLine {
  return { kind, text };
}

/**
 * Run convention audits over the project graph.
 *
 * Args:
 *   project: Current project state.
 * Returns:
 *   List of issues (empty = clean).
 */
export function auditProject(project: ProjectState): AuditIssue[] {
  const issues: AuditIssue[] = [];

  for (const n of Object.values(project.nodes)) {
    // naming by layer
    if (n.layer === 'staging' && !n.id.startsWith('stg_')) {
      issues.push({
        severity: 'error',
        code: 'naming',
        modelId: n.id,
        message: `staging model must be named stg_*, got ${n.id}`,
      });
    }
    if (n.layer === 'mart' && !(n.id.startsWith('fct_') || n.id.startsWith('dim_') || n.id.startsWith('mart_'))) {
      issues.push({
        severity: 'warn',
        code: 'naming',
        modelId: n.id,
        message: `mart model should start with fct_/dim_/mart_, got ${n.id}`,
      });
    }
    if (n.layer === 'intermediate' && !n.id.startsWith('int_')) {
      issues.push({
        severity: 'warn',
        code: 'naming',
        modelId: n.id,
        message: `intermediate model should start with int_, got ${n.id}`,
      });
    }

    // layer boundaries: marts must not read sources
    if (n.layer === 'mart' && n.sourceRefs.length) {
      issues.push({
        severity: 'error',
        code: 'layer',
        modelId: n.id,
        message: `mart ${n.id} reads sources directly — go through staging`,
      });
    }
    if (n.layer === 'staging' && n.refs.length) {
      issues.push({
        severity: 'warn',
        code: 'layer',
        modelId: n.id,
        message: `staging ${n.id} refs other models — staging should only read sources`,
      });
    }

    // ownership + description on marts
    if (n.layer === 'mart' && !n.owner) {
      issues.push({
        severity: 'warn',
        code: 'owner',
        modelId: n.id,
        message: `mart ${n.id} has no owner`,
      });
    }
    if (n.layer === 'mart' && !n.description) {
      issues.push({
        severity: 'warn',
        code: 'docs',
        modelId: n.id,
        message: `mart ${n.id} has no description (grain undocumented)`,
      });
    }

    // PK test on facts
    if (n.id.startsWith('fct_') && !n.tests.some((t) => t.type === 'unique')) {
      issues.push({
        severity: 'warn',
        code: 'sli',
        modelId: n.id,
        message: `fact ${n.id} lacks a unique test on its grain key`,
      });
    }
  }

  return issues;
}

/**
 * Run `audit` / `audit --strict` command.
 */
export function runAudit(
  project: ProjectState,
  strict: boolean,
): { project: ProjectState; logs: LogLine[]; ok: boolean } {
  const issues = auditProject(project);
  const logs: LogLine[] = [
    log('meta', `audit: ${issues.length} issue(s)${strict ? ' [strict]' : ''}`),
  ];
  for (const i of issues) {
    logs.push(log(i.severity === 'error' ? 'err' : 'out', `${i.severity} ${i.code} ${i.modelId}: ${i.message}`));
  }
  if (!issues.length) {
    logs.push(log('ok', 'clean project — naming, layers, ownership look good'));
  }
  const errors = issues.filter((i) => i.severity === 'error').length;
  return {
    project: cloneProject(project),
    logs,
    ok: strict ? errors === 0 : true,
  };
}
