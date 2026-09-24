import type { GoalSpec, ProjectState } from './types';

export interface GoalEvaluation {
  solved: boolean;
  reasons: string[];
}

/**
 * Evaluate whether the project satisfies a level goal.
 *
 * Args:
 *   project: Current project state.
 *   goal: Level goal specification.
 * Returns:
 *   Evaluation with solved flag and human-readable failure reasons.
 */
export function evaluateGoal(project: ProjectState, goal: GoalSpec): GoalEvaluation {
  const reasons: string[] = [];

  if (goal.materializations) {
    for (const [id, mat] of Object.entries(goal.materializations)) {
      const node = project.nodes[id];
      if (!node) {
        reasons.push(`missing model: ${id}`);
        continue;
      }
      if (node.materialization !== mat) {
        reasons.push(`${id} materialization is ${node.materialization}, expected ${mat}`);
      }
    }
  }

  if (goal.refs) {
    for (const [id, refs] of Object.entries(goal.refs)) {
      const node = project.nodes[id];
      if (!node) {
        reasons.push(`missing model: ${id}`);
        continue;
      }
      const have = [...node.refs].sort();
      const want = [...refs].sort();
      if (JSON.stringify(have) !== JSON.stringify(want)) {
        reasons.push(`${id} refs are [${have.join(', ')}], expected [${want.join(', ')}]`);
      }
    }
  }

  const builtMode = goal.builtMode ?? 'exactly';
  const expectedBuilt = goal.built ?? [];
  const actualBuilt = Object.values(project.nodes)
    .filter((n) => n.status === 'success')
    .map((n) => n.id)
    .sort();

  if (goal.notBuilt?.length) {
    for (const id of goal.notBuilt) {
      if (actualBuilt.includes(id)) {
        reasons.push(`${id} must NOT be built`);
      }
    }
  }

  if (expectedBuilt.length || builtMode === 'none') {
    const exp = [...expectedBuilt].sort();
    if (builtMode === 'none') {
      if (actualBuilt.length) {
        reasons.push(`expected no models built, got [${actualBuilt.join(', ')}]`);
      }
    } else if (builtMode === 'atLeast') {
      for (const id of exp) {
        if (!actualBuilt.includes(id)) {
          reasons.push(`missing build: ${id}`);
        }
      }
    } else {
      if (JSON.stringify(actualBuilt) !== JSON.stringify(exp)) {
        reasons.push(
          `built set is [${actualBuilt.join(', ')}], expected [${exp.join(', ')}]`,
        );
      }
    }
  }

  if (goal.testsPassed?.length) {
    for (const key of goal.testsPassed) {
      if (!testPasses(project, key)) {
        reasons.push(`test not passed: ${key}`);
      }
    }
  }

  if (goal.mustRunCommand) {
    const needle = goal.mustRunCommand;
    const hit = project.commandsIssued.some((c) => c.includes(needle));
    if (!hit) {
      reasons.push(`run a command containing: ${needle}`);
    }
  }

  if (goal.selectionIncludes?.length) {
    const sel = new Set(project.lastSelection);
    for (const id of goal.selectionIncludes) {
      if (!sel.has(id)) reasons.push(`selection missing: ${id}`);
    }
  }

  if (goal.selectionEquals) {
    const a = [...project.lastSelection].sort();
    const b = [...goal.selectionEquals].sort();
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      reasons.push(`selection is [${a.join(', ')}], expected [${b.join(', ')}]`);
    }
  }

  if (goal.modelsExist?.length) {
    for (const id of goal.modelsExist) {
      if (!project.nodes[id]) reasons.push(`model missing: ${id}`);
    }
  }

  if (goal.testsDefined?.length) {
    for (const t of goal.testsDefined) {
      const node = project.nodes[t.model];
      if (!node) {
        reasons.push(`model missing for test: ${t.model}`);
        continue;
      }
      const hit = node.tests.some(
        (x) =>
          x.type === t.type &&
          (t.column === undefined || x.column === t.column),
      );
      if (!hit) reasons.push(`test missing: ${t.type}${t.column ? ` on ${t.column}` : ''} for ${t.model}`);
    }
  }

  if (goal.macrosDefined?.length) {
    for (const m of goal.macrosDefined) {
      if (!project.macros[m]) reasons.push(`macro missing: ${m}`);
    }
  }

  if (goal.packagesInstalled?.length) {
    for (const p of goal.packagesInstalled) {
      if (!project.packages.includes(p)) reasons.push(`package missing: ${p}`);
    }
  }

  if (goal.docsBuilt && !project.docsBuilt) {
    reasons.push('run `dbt docs generate`');
  }

  if (goal.snapshots?.length) {
    for (const id of goal.snapshots) {
      const n = project.nodes[id];
      if (!n || n.materialization !== 'snapshot') reasons.push(`snapshot missing: ${id}`);
    }
  }

  if (goal.exposures?.length) {
    for (const id of goal.exposures) {
      if (!project.exposures[id]) reasons.push(`exposure missing: ${id}`);
    }
  }

  if (goal.varsSet) {
    for (const [k, v] of Object.entries(goal.varsSet)) {
      if (project.vars[k] !== v) reasons.push(`var ${k} should be ${v}`);
    }
  }

  if (goal.contracts?.length) {
    for (const id of goal.contracts) {
      const n = project.nodes[id];
      if (!n?.contract) reasons.push(`contract not enforced on ${id}`);
    }
  }

  if (goal.incrementalStrategies) {
    for (const [id, strat] of Object.entries(goal.incrementalStrategies)) {
      const n = project.nodes[id];
      if (n?.incrementalStrategy !== strat) {
        reasons.push(`${id} strategy is ${n?.incrementalStrategy ?? 'unset'}, expected ${strat}`);
      }
    }
  }

  if (goal.sqlContains) {
    for (const [id, needle] of Object.entries(goal.sqlContains)) {
      const n = project.nodes[id];
      if (!n?.sql || !n.sql.includes(needle)) {
        reasons.push(`${id} sql should contain ${needle}`);
      }
    }
  }

  if (goal.minDiagnoses != null) {
    if ((project.diagnoses?.length ?? 0) < goal.minDiagnoses) {
      reasons.push(`record at least ${goal.minDiagnoses} diagnosis note(s)`);
    }
  }
  if (goal.diagnosesInclude?.length) {
    const blob = (project.diagnoses ?? []).join(' ').toLowerCase();
    for (const kw of goal.diagnosesInclude) {
      if (!blob.includes(kw.toLowerCase())) {
        reasons.push(`diagnosis should mention: ${kw}`);
      }
    }
  }
  if (goal.ciSaved && !project.ciState) {
    reasons.push('run `ci save` to create the state artifact');
  }
  if (goal.macroArgs) {
    for (const [name, args] of Object.entries(goal.macroArgs)) {
      const m = project.macros[name];
      if (!m) {
        reasons.push(`macro missing: ${name}`);
        continue;
      }
      const have = m.args ?? [];
      for (const a of args) {
        if (!have.includes(a)) reasons.push(`macro ${name} missing arg ${a}`);
      }
    }
  }
  if (goal.sqlRequires) {
    for (const [id, need] of Object.entries(goal.sqlRequires)) {
      const sql = project.nodes[id]?.sql ?? '';
      const ok =
        need === 'for'
          ? /\{%\s*for\s+/.test(sql)
          : need === 'if'
            ? /\{%\s*if\s+/.test(sql)
            : need === 'set'
              ? /\{%\s*set\s+/.test(sql)
              : /\{\{\s*[a-zA-Z_]/.test(sql);
      if (!ok) reasons.push(`${id} sql must use jinja {% ${need} %}`);
    }
  }

  const solved = reasons.length === 0;
  return { solved, reasons };
}

function testPasses(project: ProjectState, key: string): boolean {
  // key forms: testId | model | model.column | model.type
  for (const node of Object.values(project.nodes)) {
    if (node.id === key) {
      return node.tests.length > 0 && node.tests.every((t) => t.passed === true);
    }
    for (const t of node.tests) {
      if (t.id === key) return t.passed === true;
      if (t.column && key === `${node.id}.${t.column}` && t.passed === true) return true;
      if (key === `${node.id}.${t.type}` && t.passed === true) return true;
    }
  }
  return false;
}

/**
 * Set of successfully built model ids.
 *
 * Args:
 *   project: Project state.
 * Returns:
 *   Sorted id list.
 */
export function builtModelIds(project: ProjectState): string[] {
  return Object.values(project.nodes)
    .filter((n) => n.status === 'success')
    .map((n) => n.id)
    .sort();
}
