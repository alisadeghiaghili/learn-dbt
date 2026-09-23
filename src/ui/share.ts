export const APP_BASE_URL = 'https://alisadeghiaghili.github.io/learn-dbt/';

export interface ShareInput {
  levelId: string;
  levelName: string;
  sequence: string;
  commands: number;
  par?: number;
  /** Titles already learned (curriculum). */
  learned?: string[];
  upNext?: string | null;
  baseUrl?: string;
}

export interface ShareLinks {
  url: string;
  text: string;
  linkedinText: string;
  linkedin: string;
  twitter: string;
  facebook: string;
}

/**
 * Build social share URLs + progress-aware copy (learn-dvc share pattern).
 *
 * Args:
 *   input: Level identity, golf stats, and learned curriculum.
 * Returns:
 *   Permalink, short/full share text, and LinkedIn / X / Facebook intents.
 */
export function buildShareLinks(input: ShareInput): ShareLinks {
  const base = (input.baseUrl ?? APP_BASE_URL).replace(/\/?$/, '/');
  const url = `${base}?level=${encodeURIComponent(input.levelId)}`;
  const golf =
    input.par && input.par > 0
      ? ` in ${input.commands} command${input.commands === 1 ? '' : 's'} (par ${input.par})`
      : ` in ${input.commands} command${input.commands === 1 ? '' : 's'}`;

  const learnedList = (input.learned ?? []).slice(-8);
  const learnedBlock = learnedList.length
    ? `\n\nWhat I have learned so far:\n${learnedList.map((t) => `• ${t}`).join('\n')}`
    : '';
  const upNext = input.upNext ? `\n\nUp next: ${input.upNext}` : '';

  const linkedinText =
    `I am learning dbt with learn-dbt — just completed “${input.levelName}” (${input.sequence})${golf}.` +
    `\n\nInteractive DAG tutorial: selection grammar, materializations, tests, slim CI.` +
    learnedBlock +
    upNext +
    `\n\nTry it: ${url}`;

  const text =
    `Learning dbt with learn-dbt — solved “${input.levelName}”${golf}.` +
    (learnedList.length ? ` Learned: ${learnedList.slice(0, 3).join('; ')}.` : '') +
    ` ${url}`;

  return {
    url,
    text,
    linkedinText,
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

export function markLevelSolved(levelId: string): string[] {
  try {
    const raw = localStorage.getItem('learn-dbt:solved');
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!list.includes(levelId)) list.push(levelId);
    localStorage.setItem('learn-dbt:solved', JSON.stringify(list));
    document.cookie = `learn_dbt_solved=${encodeURIComponent(JSON.stringify(list))};path=/;max-age=${400 * 86400}`;
    return list;
  } catch {
    return [];
  }
}

export function loadSolvedLevels(): string[] {
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
