import { describe, expect, it } from 'vitest';
import { onAirSentence, reportSentence, spanOf, type OnAirSummary } from './onair';

const base: OnAirSummary = {
  deal: 'dl-104',
  source: 'Sponsor overlay',
  streamStartedAt: '2026-09-18T20:00:00.000+00:00',
  startObserved: true,
  intervals: [
    { start: '2026-09-18T20:05:00.000+00:00', end: '2026-09-18T20:35:00.000+00:00', seconds: 1800, streamOffsetSeconds: 300 },
    { start: '2026-09-18T21:00:00.000+00:00', end: '2026-09-18T21:32:00.000+00:00', seconds: 1920, streamOffsetSeconds: 3600 },
  ],
  totalSeconds: 3720,
  disagreements: 0,
  openSince: null,
  reports: [],
};

describe('spanOf', () => {
  it('reads as a person would say it', () => {
    expect(spanOf(3720)).toBe('1h 02m');
    expect(spanOf(720)).toBe('12m');
    expect(spanOf(45)).toBe('45s');
  });
});

describe('onAirSentence', () => {
  it('sums the intervals', () => {
    expect(onAirSentence(base)).toBe('On air 1h 02m across 2 intervals.');
  });

  it('says what the log could not settle rather than hiding it', () => {
    const s = onAirSentence({ ...base, disagreements: 2, openSince: '2026-09-18T22:00:00.000+00:00' });
    expect(s).toContain('with one still open');
    expect(s).toContain('2 direct checks contradicted an OBS event');
  });

  it('says when offsets into the recording are unknown', () => {
    expect(onAirSentence({ ...base, startObserved: false })).toContain('offsets into the recording unknown');
  });

  it('distinguishes never on air from still on air', () => {
    expect(onAirSentence({ ...base, intervals: [], totalSeconds: 0 })).toBe('Logged, but never on air.');
    expect(onAirSentence({ ...base, intervals: [], totalSeconds: 0, openSince: 'x' })).toMatch(/On air now/);
  });
});

describe('reportSentence', () => {
  it('names the latest signed report, or the command to make one', () => {
    expect(reportSentence(base, 'dl-104')).toBe('No signed report yet. Run `sponsifable report dl-104`.');
    expect(reportSentence({ ...base, reports: ['dl-104-20260918T220000Z', 'dl-104-20260919T090000Z'] }, 'dl-104')).toBe(
      'Signed report: dl-104-20260919T090000Z',
    );
  });
});
