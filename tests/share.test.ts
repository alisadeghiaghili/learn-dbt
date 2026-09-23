import { describe, expect, it } from 'vitest';
import { APP_BASE_URL, buildShareLinks, levelIdFromSearch } from '../src/ui/share';

describe('share links', () => {
  it('builds share intents with learned curriculum in the post copy', () => {
    const links = buildShareLinks({
      levelId: 'intro_run_one',
      levelName: 'Build one model',
      sequence: 'intro',
      commands: 1,
      par: 1,
      learned: ['intro / Build one model', 'intro / See the graph'],
      upNext: 'selection / Select by tag',
    });
    expect(links.url).toBe(`${APP_BASE_URL}?level=intro_run_one`);
    expect(links.linkedin).toContain('linkedin.com/sharing/share-offsite');
    expect(links.linkedinText).toContain('What I have learned');
    expect(links.linkedinText).toContain('Up next: selection / Select by tag');
    expect(links.twitter).toContain('twitter.com/intent/tweet');
    expect(links.facebook).toContain('facebook.com/sharer');
  });

  it('parses level id from query string', () => {
    expect(levelIdFromSearch('?level=sel_tag')).toBe('sel_tag');
    expect(levelIdFromSearch('')).toBeNull();
  });
});
