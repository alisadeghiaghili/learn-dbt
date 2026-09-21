export const APP_BASE_URL = 'https://alisadeghiaghili.github.io/learn-dbt/';

export interface ShareInput {
  levelId: string;
  levelName: string;
  sequence: string;
  commands: number;
  par?: number;
  /** Origin + path of the app; defaults to GitHub Pages. */
  baseUrl?: string;
}

export interface ShareLinks {
  url: string;
  text: string;
  linkedin: string;
  twitter: string;
  facebook: string;
}

/**
 * Build social share URLs for a solved level (learnGitBranching-style celebration).
 *
 * Args:
 *   input: Level identity and golf stats.
 * Returns:
 *   Permalink, share text, and LinkedIn / X / Facebook intent URLs.
 */
export function buildShareLinks(input: ShareInput): ShareLinks {
  const base = (input.baseUrl ?? APP_BASE_URL).replace(/\/?$/, '/');
  const url = `${base}?level=${encodeURIComponent(input.levelId)}`;
  const golf =
    input.par && input.par > 0
      ? ` in ${input.commands} command${input.commands === 1 ? '' : 's'} (par ${input.par})`
      : ` in ${input.commands} command${input.commands === 1 ? '' : 's'}`;
  const text = `I just solved “${input.levelName}” (${input.sequence}) on learn-dbt${golf}. Interactive dbt DAG tutorial.`;

  return {
    url,
    text,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    twitter:
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}` +
      `&url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  };
}

/**
 * Read `?level=` from the current location (browser only).
 *
 * Args:
 *   search: window.location.search
 * Returns:
 *   Level id or null.
 */
export function levelIdFromSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search);
    return params.get('level');
  } catch {
    return null;
  }
}

/**
 * Persist solved level ids in localStorage (best-effort).
 *
 * Args:
 *   levelId: Level that was solved.
 * Returns:
 *   Updated list of solved ids.
 */
export function markLevelSolved(levelId: string): string[] {
  try {
    const raw = localStorage.getItem('learn-dbt:solved');
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!list.includes(levelId)) list.push(levelId);
    localStorage.setItem('learn-dbt:solved', JSON.stringify(list));
    return list;
  } catch {
    return [];
  }
}

export function loadSolvedLevels(): string[] {
  try {
    const raw = localStorage.getItem('learn-dbt:solved');
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
