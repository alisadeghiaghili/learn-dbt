import { describe, expect, it } from 'vitest';
import { APP_BASE_URL, buildShareLinks, levelIdFromSearch } from '../src/ui/share';

describe('share links', () => {
  it('builds LinkedIn, X, and Facebook intents with level permalink', () => {
    const links = buildShareLinks({
      levelId: 'intro_run_one',
      levelName: 'Build one model',
      sequence: 'intro',
      commands: 1,
      par: 1,
    });
    expect(links.url).toBe(`${APP_BASE_URL}?level=intro_run_one`);
    expect(links.linkedin).toContain('linkedin.com/sharing/share-offsite');
    expect(decodeURIComponent(links.linkedin)).toContain(links.url);
    expect(links.twitter).toContain('twitter.com/intent/tweet');
    expect(decodeURIComponent(links.twitter)).toContain('Build one model');
    expect(links.facebook).toContain('facebook.com/sharer');
    expect(decodeURIComponent(links.facebook)).toContain(links.url);
  });

  it('parses level id from query string', () => {
    expect(levelIdFromSearch('?level=sel_tag')).toBe('sel_tag');
    expect(levelIdFromSearch('')).toBeNull();
  });
});
