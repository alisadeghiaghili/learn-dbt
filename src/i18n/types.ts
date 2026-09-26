/** UI locale catalogs. Commands and CLI output stay English. */

export type Locale = 'en' | 'de' | 'fa';

export const LOCALES: Locale[] = ['en', 'de', 'fa'];

export interface UiCopy {
  appTitle: string;
  language: string;
  menuLabel: string;
  levels: string;
  guide: string;
  hint: string;
  solution: string;
  undo: string;
  reset: string;
  sandboxBtn: string;
  help: string;
  helpTitle: string;
  close: string;
  youAreLearning: string;
  fieldNotes: string;
  companionSql: string;
  companionSqlBody: string;
  checklist: string;
  nowChip: string;
  typeNext: string;
  typeNextTip: string;
  run: string;
  start: string;
  nextLevel: string;
  replay: string;
  keepExploring: string;
  showGoal: string;
  hideGoal: string;
  shareWhatYouLearned: string;
  linkedin: string;
  twitter: string;
  facebook: string;
  copyPost: string;
  copied: string;
  soundOn: string;
  soundOff: string;
  examScore: string;
  welcomeBack: (n: number, total: number) => string;
  nextUp: string;
  allStepsMet: string;
  progressKept: (cmd: string) => string;
  nextCmd: (cmd: string) => string;
  objective: string;
  hintLabel: string;
  levelsTitle: string;
  sandbox: string;
  freePlay: string;
  solved: string;
  cmds: string;
  par: string;
  levelSolved: string;
  inCommand: (n: number) => string;
  githubTitle: string;
  welcomeTitle: string;
  welcomeIntro: string;
  welcomeBoard: string;
  welcomeTracks: string;
  welcomeMeta: string;
  welcomeLevelsCount: (n: number) => string;
  welcomeWhat: string;
  welcomeWhatBody: string;
  welcomePublisher: string;
  welcomePublisherBody: string;
  welcomeGithub: string;
  welcomeCoffee: string;
  welcomeToolbar: string;
  openLevels: string;
  useIt: string;
}

export interface Catalog {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  ui: UiCopy;
}
