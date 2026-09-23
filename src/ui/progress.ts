import type { LevelDef, ProjectState } from '../engine/types';

const KEY_LEVEL = 'learn-dbt:progress:';

export interface SavedProgress {
  project: ProjectState;
  history: string[];
}

/**
 * Persist in-progress level work (wrong commands must not wipe the level).
 *
 * Args:
 *   levelId: Level id.
 *   data: Project + history snapshot.
 */
export function saveLevelProgress(levelId: string, data: SavedProgress): void {
  try {
    sessionStorage.setItem(KEY_LEVEL + levelId, JSON.stringify(data));
  } catch {
    /* private mode */
  }
}

/**
 * Load saved in-progress work for a level.
 *
 * Args:
 *   levelId: Level id.
 * Returns:
 *   Snapshot or null.
 */
export function loadLevelProgress(levelId: string): SavedProgress | null {
  try {
    const raw = sessionStorage.getItem(KEY_LEVEL + levelId);
    if (!raw) return null;
    return JSON.parse(raw) as SavedProgress;
  } catch {
    return null;
  }
}

export function clearLevelProgress(levelId: string): void {
  try {
    sessionStorage.removeItem(KEY_LEVEL + levelId);
  } catch {
    /* ignore */
  }
}

export function saveSolvedList(ids: string[]): void {
  try {
    localStorage.setItem('learn-dbt:solved', JSON.stringify(ids));
    // cookie backup ~400 days (learn-dvc pattern)
    document.cookie = `learn_dbt_solved=${encodeURIComponent(JSON.stringify(ids))};path=/;max-age=${400 * 86400}`;
  } catch {
    /* ignore */
  }
}

export function loadSolvedList(): string[] {
  try {
    const raw = localStorage.getItem('learn-dbt:solved');
    if (raw) return JSON.parse(raw) as string[];
    const match = document.cookie.match(/(?:^|;\s*)learn_dbt_solved=([^;]+)/);
    if (match) return JSON.parse(decodeURIComponent(match[1])) as string[];
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Curriculum outcomes for share text — titles of solved levels.
 */
export function learnedTopics(levels: Pick<LevelDef, 'id' | 'name' | 'sequence'>[], solvedIds: string[]): string[] {
  return levels
    .filter((l) => solvedIds.includes(l.id))
    .map((l) => `${l.sequence} / ${l.name}`);
}

export function nextLevelUp(
  levels: Pick<LevelDef, 'id' | 'name' | 'sequence'>[],
  solvedIds: string[],
): { id: string; name: string; sequence: string } | null {
  const nxt = levels.find((l) => !solvedIds.includes(l.id) && l.id !== 'sandbox');
  return nxt ? { id: nxt.id, name: nxt.name, sequence: nxt.sequence } : null;
}
